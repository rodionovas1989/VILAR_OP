import { FormEvent, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';

type ChatMessage = {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
};

const POLL_MS = 7000;

export default function HeaderChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const rows = await api.listChatMessages();
      setMessages(rows);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (!user || !open) return;
    load();
    const t = setInterval(() => {
      load().catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [user, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  if (!user) return null;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.postChatMessage(body);
      setText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="header-chat">
      <button
        type="button"
        className={`app-header-btn header-chat-toggle${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-label="Чат"
        title="Чат"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path
            fill="currentColor"
            d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 3v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 4v2h12V8H6zm0 4v2h8v-2H6z"
          />
        </svg>
      </button>
      {open && (
        <div className="header-chat-panel" role="dialog" aria-label="Общий чат">
          <div className="header-chat-head">
            <strong>Общий чат</strong>
            <button type="button" className="ghost" onClick={() => setOpen(false)}>
              Закрыть
            </button>
          </div>
          <div className="header-chat-list" ref={listRef}>
            {!messages.length && <div className="muted">Пока нет сообщений</div>}
            {messages.map((m) => (
              <div key={m.id} className={`header-chat-msg${m.userId === user.id ? ' mine' : ''}`}>
                <div className="header-chat-meta">
                  <span>{m.userName}</span>
                  <time dateTime={m.createdAt}>
                    {new Date(m.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
                <div className="header-chat-text">{m.text}</div>
              </div>
            ))}
          </div>
          {error && <div className="header-chat-error">{error}</div>}
          <form className="header-chat-form" onSubmit={send}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Сообщение…"
              maxLength={1000}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !text.trim()}>
              →
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
