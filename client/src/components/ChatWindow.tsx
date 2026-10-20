import { useMessages } from "../hooks/useMessages";
import { usePresence } from "../hooks/usePresence";
import type { Room } from "../types";
import { Avatar } from "./Avatar";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";

interface Props {
  room: Room;
  userId: string;
  username: string;
  onOpenSidebar: () => void;
}

function typingText(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

export function ChatWindow({ room, userId, username, onOpenSidebar }: Props) {
  const {
    messages,
    loading,
    loadingOlder,
    hasMore,
    error,
    loadOlder,
    send,
    remove,
  } = useMessages(room.id);
  const { online, typingNames, notifyTyping } = usePresence(
    room.id,
    userId,
    username,
  );

  return (
    <section className="chat">
      <header className="chat__header">
        <button
          className="icon-btn menu-btn"
          onClick={onOpenSidebar}
          aria-label="Open rooms"
        >
          ☰
        </button>
        <div className="chat__title">
          <h2># {room.name}</h2>
          <p>
            <span className="dot" aria-hidden="true" /> {online.length} online
          </p>
        </div>
        <div className="chat__online" aria-label="Users online">
          {online.slice(0, 5).map((u) => (
            <Avatar key={u.id} name={u.username} size={28} />
          ))}
          {online.length > 5 && (
            <span className="chat__more">+{online.length - 5}</span>
          )}
        </div>
      </header>

      {error && <p className="alert alert--error chat__error">{error}</p>}

      <MessageList
        messages={messages}
        currentUserId={userId}
        loading={loading}
        loadingOlder={loadingOlder}
        hasMore={hasMore}
        onLoadOlder={loadOlder}
        onDelete={(id) => void remove(id)}
      />

      <div className="typing" aria-live="polite">
        {typingText(typingNames)}
      </div>

      <MessageInput
        roomName={room.name}
        onSend={send}
        onTyping={notifyTyping}
      />
    </section>
  );
}
