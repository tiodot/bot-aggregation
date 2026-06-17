import React, { useCallback } from 'react';
import useStore from '../store';

const styles = {
  card: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#1e1e2e',
    borderRadius: 10,
    border: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid #313244',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: (color) => ({
    fontWeight: 600,
    color,
  }),
  statusBadge: (status) => {
    const colors = {
      loading: { bg: '#f9e2af22', color: '#f9e2af' },
      ready: { bg: '#a6e3a122', color: '#a6e3a1' },
      sending: { bg: '#89b4fa22', color: '#89b4fa' },
      done: { bg: '#a6e3a122', color: '#a6e3a1' },
      error: { bg: '#f38ba822', color: '#f38ba8' },
    };
    const c = colors[status] || colors.ready;
    return {
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 4,
      backgroundColor: c.bg,
      color: c.color,
    };
  },
  statusText: {
    loading: '加载中...',
    ready: '就绪',
    sending: '回答中...',
    done: '完成',
    error: '错误',
  },
  body: {
    flex: 1,
    padding: 12,
    color: '#a6adc8',
    fontSize: 13,
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
  },
  footer: {
    padding: '8px 14px',
    borderTop: '1px solid #313244',
    display: 'flex',
    gap: 8,
  },
  btn: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid #45475a',
    backgroundColor: 'transparent',
    color: '#6c7086',
    cursor: 'pointer',
  },
};

const statusLabels = {
  loading: '加载中...',
  ready: '就绪',
  sending: '回答中...',
  done: '✓ 完成',
  error: '✗ 错误',
};

export default function ResponseCard({ ai }) {
  const showOriginal = useStore((s) => s.showOriginal);

  const handleShowOriginal = useCallback(() => {
    if (window.api) window.api.showOriginal(ai.name);
    showOriginal(ai.name);
  }, [ai.name, showOriginal]);

  const handleCopy = useCallback(() => {
    if (ai.response) {
      navigator.clipboard.writeText(ai.response);
    }
  }, [ai.response]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.name(ai.color)}>{ai.name}</span>
        <span style={styles.statusBadge(ai.status)}>
          {statusLabels[ai.status] || ai.status}
        </span>
      </div>
      <div style={styles.body}>
        {ai.error ? (
          <span style={{ color: '#f38ba8' }}>⚠ {ai.error}</span>
        ) : ai.response ? (
          ai.response
        ) : ai.status === 'loading' ? (
          <span style={{ color: '#45475a' }}>等待页面就绪...</span>
        ) : (
          <span style={{ color: '#45475a' }}>发送问题后，回答将在此显示</span>
        )}
        {ai.status === 'sending' && <span style={{ animation: 'blink 1s infinite' }}> ▎</span>}
      </div>
      <div style={styles.footer}>
        <button style={styles.btn} onClick={handleShowOriginal}>查看原网页</button>
        {ai.response && (
          <button style={styles.btn} onClick={handleCopy}>复制</button>
        )}
      </div>
    </div>
  );
}
