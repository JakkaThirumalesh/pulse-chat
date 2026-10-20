import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';

interface Props {
  roomName: string;
  onSend: (content: string) => Promise<void>;
  onTyping: () => void;
}

const MAX = 2000;

export function MessageInput({ roomName, onSend, onTyping }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  function resize() {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    onTyping();
    resize();
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(content);
      setText('');
      requestAnimationFrame(() => {
        resize();
        areaRef.current?.focus();
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      {error && <p className="alert alert--error composer__error" role="alert">{error}</p>}
      <div className="composer__row">
        <textarea
          ref={areaRef}
          rows={1}
          value={text}
          maxLength={MAX}
          placeholder={`Message #${roomName}`}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-label="Message"
        />
        <button className="btn btn--primary composer__send" disabled={sending || !text.trim()} aria-label="Send message">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.6 2-12.6 2z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
