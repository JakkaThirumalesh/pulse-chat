import type { Message, Profile, Room } from '../types';
import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, init: Omit<RequestInit, 'headers'> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: () => request<{ profile: Profile }>('/api/me').then((r) => r.profile),

  listRooms: () => request<{ rooms: Room[] }>('/api/rooms').then((r) => r.rooms),

  createRoom: (name: string) =>
    request<{ room: Room }>('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then((r) => r.room),

  listMessages: (roomId: string, before?: string) => {
    const params = new URLSearchParams({ limit: '50' });
    if (before) params.set('before', before);
    return request<{ messages: Message[]; hasMore: boolean }>(
      `/api/rooms/${roomId}/messages?${params.toString()}`,
    );
  },

  sendMessage: (roomId: string, content: string) =>
    request<{ message: Message }>(`/api/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }).then((r) => r.message),

  deleteMessage: (id: string) => request<void>(`/api/messages/${id}`, { method: 'DELETE' }),
};
