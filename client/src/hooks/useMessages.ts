import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Message } from '../types';

const byTime = (a: Message, b: Message) => a.created_at.localeCompare(b.created_at);

/** Merge without duplicates (a message can arrive via the API response AND realtime). */
function merge(prev: Message[], incoming: Message[]): Message[] {
  const seen = new Set(prev.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  return fresh.length === 0 ? prev : [...prev, ...fresh].sort(byTime);
}

export function useMessages(roomId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const live: { channel: RealtimeChannel | null } = { channel: null };

    setMessages([]);
    setHasMore(false);
    setError(null);
    setLoading(true);

    // Setup is deferred one tick so React StrictMode's mount->unmount->mount in dev
    // doesn't create the same channel topic twice (supabase-js reuses a topic's channel).
    const timer = setTimeout(() => {
      // Subscribe FIRST so nothing is missed between the fetch and the subscription.
      live.channel = supabase
        .channel(`messages:${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
          (payload) => setMessages((prev) => merge(prev, [payload.new as Message])),
        )
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (id) setMessages((prev) => prev.filter((m) => m.id !== id));
        })
        .subscribe();

      api
        .listMessages(roomId)
        .then(({ messages: initial, hasMore: more }) => {
          if (cancelled) return;
          setMessages((prev) => merge(prev, initial));
          setHasMore(more);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (live.channel) void supabase.removeChannel(live.channel);
    };
  }, [roomId]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const { messages: older, hasMore: more } = await api.listMessages(roomId, messages[0].created_at);
      setMessages((prev) => merge(prev, older));
      setHasMore(more);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, messages, loadingOlder]);

  const send = useCallback(
    async (content: string) => {
      const message = await api.sendMessage(roomId, content);
      setMessages((prev) => merge(prev, [message]));
    },
    [roomId],
  );

  const remove = useCallback(async (id: string) => {
    await api.deleteMessage(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return { messages, loading, loadingOlder, hasMore, error, loadOlder, send, remove };
}
