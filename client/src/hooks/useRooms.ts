import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Room } from '../types';

function addRoom(list: Room[], room: Room): Room[] {
  if (list.some((r) => r.id === room.id)) return list;
  return [...list, room].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const live: { channel: RealtimeChannel | null } = { channel: null };

    // Deferred one tick so React StrictMode's double-mount in dev can't create the
    // same channel topic twice.
    const timer = setTimeout(() => {
      // Realtime: new rooms created by anyone appear instantly in every sidebar.
      live.channel = supabase
        .channel('rooms')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rooms' }, (payload) => {
          setRooms((prev) => addRoom(prev, payload.new as Room));
        })
        .subscribe();

      api
        .listRooms()
        .then((list) => {
          if (cancelled) return;
          setRooms((prev) => list.reduce(addRoom, prev));
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
  }, []);

  const createRoom = useCallback(async (name: string): Promise<Room> => {
    const room = await api.createRoom(name);
    setRooms((prev) => addRoom(prev, room));
    return room;
  }, []);

  return { rooms, loading, error, createRoom };
}
