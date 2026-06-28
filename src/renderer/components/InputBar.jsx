import React, { useState, useCallback } from 'react';
import useStore from '../store';

const styles = {
  bar: {
    padding: '12px 14px',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #313244',
    backgroundColor: '#181825',
    color: '#cdd6f4',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  sendBtn: (disabled) => ({
    padding: '10px 18px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: disabled ? '#1e1e2e' : '#89b4fa',
    color: disabled ? '#45475a' : '#11111b',
    fontWeight: 600,
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  }),
  newBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #313244',
    backgroundColor: 'transparent',
    color: '#585b70',
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  },
};

export default function InputBar() {
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const clearResponses = useStore((s) => s.clearResponses);
  const createSession = useStore((s) => s.createSession);
  const currentSessionId = useStore((s) => s.currentSessionId);

  const handleSend = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setQuery('');
    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const title = trimmed.length > 50 ? trimmed.substring(0, 50) + '...' : trimmed;
        const session = await createSession(title);
        sessionId = session?.id;
      }
      clearResponses();
      await window.api.sendQuery(trimmed, sessionId);
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  }, [query, sending, clearResponses, createSession, currentSessionId]);

  const handleNewChat = useCallback(async () => {
    if (!window.api) return;
    setQuery('');
    clearResponses();
    try {
      await createSession('新对话');
      await window.api.newChat();
    } catch (err) {
      console.error('New chat failed:', err);
    }
  }, [clearResponses, createSession]);

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleNewChat(); }
  };

  return (
    <div style={styles.bar}>
      <input
        style={styles.input}
        placeholder="Send to all AIs..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending}
        onFocus={(e) => { e.target.style.borderColor = '#45475a'; }}
        onBlur={(e) => { e.target.style.borderColor = '#313244'; }}
      />
      <button
        style={styles.sendBtn(!query.trim() || sending)}
        onClick={handleSend}
        disabled={!query.trim() || sending}
        onMouseEnter={(e) => { if (!(!query.trim() || sending)) e.currentTarget.style.backgroundColor = '#74c7ec'; }}
        onMouseLeave={(e) => { if (!(!query.trim() || sending)) e.currentTarget.style.backgroundColor = '#89b4fa'; }}
      >
        {sending ? '...' : 'Send'}
      </button>
      <button
        style={styles.newBtn}
        onClick={handleNewChat}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#45475a'; e.currentTarget.style.color = '#a6adc8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#313244'; e.currentTarget.style.color = '#585b70'; }}
      >
        New
      </button>
    </div>
  );
}
