import React, { useState, useCallback } from 'react';
import useStore from '../store';

const styles = {
  bar: {
    padding: 16,
    borderBottom: '1px solid #313244',
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #45475a',
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    fontSize: 14,
    outline: 'none',
  },
  button: (disabled) => ({
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: disabled ? '#45475a' : '#89b4fa',
    color: disabled ? '#6c7086' : '#1e1e2e',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 14,
  }),
};

export default function InputBar() {
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const clearResponses = useStore((s) => s.clearResponses);

  const handleSend = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || sending) return;

    setSending(true);
    clearResponses();

    try {
      await window.api.sendQuery(trimmed);
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  }, [query, sending, clearResponses]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.bar}>
      <input
        style={styles.input}
        placeholder="输入问题，同时发送到所有 AI..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending}
      />
      <button
        style={styles.button(!query.trim() || sending)}
        onClick={handleSend}
        disabled={!query.trim() || sending}
      >
        {sending ? '发送中...' : '发送'}
      </button>
    </div>
  );
}
