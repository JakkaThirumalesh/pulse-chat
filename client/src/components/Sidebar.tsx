import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Room } from '../types';
import { Avatar } from './Avatar';

interface Props {
  rooms: Room[];
  activeId: string | null;
  username: string;
  open: boolean;
  error: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  onSignOut: () => void;
  onClose: () => void;
}

export function Sidebar({ rooms, activeId, username, open, error, onSelect, onCreate, onSignOut, onClose }: Props) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setFormError(null);
    try {
      await onCreate(name.trim());
      setName('');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className={`scrim ${open ? 'scrim--show' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'sidebar--open' : ''}`} aria-label="Rooms">
        <div className="sidebar__brand">
          <span aria-hidden="true">💬</span> Pulse Chat
        </div>

        <h2 className="sidebar__heading">Rooms</h2>
        {error && <p className="alert alert--error">{error}</p>}

        <nav className="sidebar__rooms">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={`room ${room.id === activeId ? 'room--active' : ''}`}
              onClick={() => onSelect(room.id)}
              aria-current={room.id === activeId ? 'page' : undefined}
            >
              <span className="room__hash">#</span>
              <span className="room__name">{room.name}</span>
            </button>
          ))}
        </nav>

        <form className="sidebar__new" onSubmit={handleCreate}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New room…"
            maxLength={40}
            aria-label="New room name"
          />
          <button className="btn btn--primary btn--sm" disabled={creating || !name.trim()}>
            Add
          </button>
        </form>
        {formError && <p className="alert alert--error">{formError}</p>}

        <div className="sidebar__user">
          <Avatar name={username} size={32} />
          <span className="sidebar__username">{username}</span>
          <button className="btn btn--ghost btn--sm" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
