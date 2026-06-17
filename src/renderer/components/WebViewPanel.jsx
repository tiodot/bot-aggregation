import React, { useCallback } from 'react';
import useStore from '../store';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#181825',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
  },
  topBar: {
    padding: '8px 16px',
    backgroundColor: '#1e1e2e',
    borderBottom: '1px solid #313244',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: '6px 16px',
    borderRadius: 6,
    border: '1px solid #45475a',
    backgroundColor: 'transparent',
    color: '#cdd6f4',
    cursor: 'pointer',
    fontSize: 13,
  },
  title: {
    fontWeight: 600,
    fontSize: 14,
  },
};

export default function WebViewPanel() {
  const activeOriginal = useStore((s) => s.activeOriginal);
  const hideOriginal = useStore((s) => s.hideOriginal);

  const handleBack = useCallback(() => {
    if (window.api) window.api.hideOriginal();
    hideOriginal();
  }, [hideOriginal]);

  return (
    <div style={styles.overlay}>
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={handleBack}>← 返回</button>
        <span style={styles.title}>{activeOriginal} — 原始网页</span>
        <div style={{ width: 80 }} />
      </div>
      {/* The actual BrowserView is shown by the main process, overlaying this area */}
    </div>
  );
}
