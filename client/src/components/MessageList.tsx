import { Fragment, useLayoutEffect, useRef } from "react";
import { formatDay, formatTime } from "../lib/format";
import type { Message } from "../types";
import { Avatar } from "./Avatar";

interface Props {
  messages: Message[];
  currentUserId: string;
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  onLoadOlder: () => Promise<void>;
  onDelete: (id: string) => void;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function MessageList({
  messages,
  currentUserId,
  loading,
  loadingOlder,
  hasMore,
  onLoadOlder,
  onDelete,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const restoreFrom = useRef<number | null>(null); // scrollHeight before older messages were prepended

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  async function handleLoadOlder() {
    const el = listRef.current;
    if (el) restoreFrom.current = el.scrollHeight;
    stickToBottom.current = false;
    await onLoadOlder();
  }

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (restoreFrom.current !== null) {
      el.scrollTop = el.scrollHeight - restoreFrom.current; // keep the reader's place
      restoreFrom.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="messages messages--center">
        <span className="spinner" aria-label="Loading messages" />
      </div>
    );
  }

  return (
    <div className="messages" ref={listRef} onScroll={handleScroll}>
      {hasMore && (
        <button
          className="btn btn--ghost btn--sm messages__older"
          onClick={handleLoadOlder}
          disabled={loadingOlder}
        >
          {loadingOlder ? "Loading…" : "Load older messages"}
        </button>
      )}

      {messages.length === 0 && (
        <div className="empty">
          <div className="empty__icon" aria-hidden="true">
            👋
          </div>
          <p>No messages yet. Say hello!</p>
        </div>
      )}

      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const newDay =
          !prev ||
          new Date(prev.created_at).toDateString() !==
            new Date(m.created_at).toDateString();
        const grouped =
          !newDay &&
          prev.user_id === m.user_id &&
          new Date(m.created_at).getTime() -
            new Date(prev.created_at).getTime() <
            GROUP_WINDOW_MS;
        const mine = m.user_id === currentUserId;

        return (
          <Fragment key={m.id}>
            {newDay && (
              <div className="day">
                <span>{formatDay(m.created_at)}</span>
              </div>
            )}
            <div
              className={`msg ${mine ? "msg--mine" : ""} ${grouped ? "msg--grouped" : ""}`}
            >
              {!mine && (
                <div className="msg__avatar">
                  {!grouped && <Avatar name={m.username} />}
                </div>
              )}
              <div className="msg__body">
                {!grouped && (
                  <div className="msg__meta">
                    {!mine && <strong>{m.username}</strong>}
                    <time dateTime={m.created_at}>
                      {formatTime(m.created_at)}
                    </time>
                  </div>
                )}
                <div className="msg__bubble">
                  <span className="msg__text">{m.content}</span>
                  {mine && (
                    <button
                      className="msg__delete"
                      onClick={() => onDelete(m.id)}
                      aria-label="Delete message"
                      title="Delete message"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
