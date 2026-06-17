import React from 'react';
import useStore from '../store';

const styles = {
  sidebar: {
    width: 180,
    backgroundColor: '#1e1e2e',
    borderRight: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  title: {
    padding: '16px 12px 8px',
    fontWeight: 600,
    fontSize: 14,
  },
  item: {
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    cursor: 'default',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  footer: {
    flex: 1,
  },
  settings: {
    padding: 12,
    borderTop: '1px solid #313244',
    color: '#6c7086',
    fontSize: 12,
    cursor: 'pointer',
  },
};

const statusColors = {
  ready: '#a6e3a1',
  loading: '#f9e2af',
  sending: '#a6e3a1',
  done: '#a6e3a1',
  error: '#f38ba8',
};

export default function AiSidebar() {
  const aiServices = useStore((s) => s.aiServices);

  return (
    <div style={styles.sidebar}>
      <div style={styles.title}>AI 服务</div>
      {aiServices.map((ai) => (
        <div key={ai.name} style={styles.item}>
          <span style={{ ...styles.dot, backgroundColor: statusColors[ai.status] || '#6c7086' }} />
          <span>{ai.name}</span>
        </div>
      ))}
      <div style={styles.footer} />
      <div style={styles.settings}>⚙ 设置</div>
    </div>
  );
}
