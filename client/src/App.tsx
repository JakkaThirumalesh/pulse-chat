import { useEffect, useState } from 'react';
import { AuthForm } from './components/AuthForm';
import { ChatWindow } from './components/ChatWindow';
import { Sidebar } from './components/Sidebar';
import { useAuth } from './context/AuthContext';
import { useRooms } from './hooks/useRooms';

function ChatLayout({ userId, username }: { userId: string; username: string }) {
  const { signOut } = useAuth();
  const { rooms, loading, error, createRoom } = useRooms();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Default to the first room once rooms load.
  useEffect(() => {
    if (!activeId && rooms.length > 0) setActiveId(rooms[0].id);
  }, [rooms, activeId]);

  const activeRoom = rooms.find((r) => r.id === activeId) ?? null;

  return (
    <div className="app">
      <Sidebar
        rooms={rooms}
        activeId={activeId}
        username={username}
        open={sidebarOpen}
        error={error}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onCreate={async (name) => {
          const room = await createRoom(name);
          setActiveId(room.id);
          setSidebarOpen(false);
        }}
        onSignOut={() => void signOut()}
        onClose={() => setSidebarOpen(false)}
      />

      {activeRoom ? (
        <ChatWindow
          key={activeRoom.id}
          room={activeRoom}
          userId={userId}
          username={username}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
      ) : (
        <section className="chat chat--empty">
          {loading ? <span className="spinner" aria-label="Loading rooms" /> : <p>Create a room to get started.</p>}
        </section>
      )}
    </div>
  );
}

export default function App() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (!session) return <AuthForm />;
  if (!profile) {
    return (
      <div className="splash">
        <span className="spinner" aria-label="Loading profile" />
      </div>
    );
  }
  return <ChatLayout userId={profile.id} username={profile.username} />;
}
