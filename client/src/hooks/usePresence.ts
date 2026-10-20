import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { OnlineUser } from '../types';

const TYPING_TTL_MS = 3000;
const TYPING_THROTTLE_MS = 2000;

/**
 * Who's online in a room (Supabase Realtime Presence) and who's typing
 * (Realtime Broadcast). Neither touches the database.
 */
export function usePresence(roomId: string, userId: string, username: string) {
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSent = useRef(0);

  useEffect(() => {
    setOnline([]);
    setTyping({});
    const pending = timers.current;

    // Deferred one tick so React StrictMode's double-mount in dev can't create the
    // same channel topic twice (all users in a room must share this exact topic).
    const setup = setTimeout(() => {
      const channel = supabase.channel(`presence:${roomId}`, {
        config: { presence: { key: userId }, broadcast: { self: false } },
      });
      channelRef.current = channel;

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<{ username: string }>();
          setOnline(
            Object.entries(state).map(([id, metas]) => ({ id, username: metas[0]?.username ?? 'someone' })),
          );
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const { userId: id, username: name } = payload as { userId: string; username: string };
          if (id === userId) return;
          setTyping((prev) => ({ ...prev, [id]: name }));
          clearTimeout(pending[id]);
          pending[id] = setTimeout(() => {
            setTyping((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }, TYPING_TTL_MS);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') await channel.track({ username });
        });
    }, 0);

    return () => {
      clearTimeout(setup);
      Object.values(pending).forEach(clearTimeout);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [roomId, userId, username]);

  /** Call on every keystroke; it throttles itself. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < TYPING_THROTTLE_MS) return;
    lastSent.current = now;
    void channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, username },
    });
  }, [userId, username]);

  return { online, typingNames: Object.values(typing), notifyTyping };
}
