import React, { useEffect } from 'react';
import useStore from './store';
import AiSidebar from './components/AiSidebar';
import InputBar from './components/InputBar';
import ResponseCard from './components/ResponseCard';
import WebViewPanel from './components/WebViewPanel';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#181825',
    color: '#cdd6f4',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  cards: {
    flex: 1,
    display: 'flex',
    gap: 12,
    padding: 16,
    overflowX: 'auto',
  },
};

export default function App() {
  const aiServices = useStore((s) => s.aiServices);
  const currentView = useStore((s) => s.currentView);
  const updateStatus = useStore((s) => s.updateStatus);
  const updateChunk = useStore((s) => s.updateChunk);
  const setError = useStore((s) => s.setError);

  // Listen for IPC events from main process
  useEffect(() => {
    if (!window.api) return;

    const unsubscribe = window.api.onAiEvent((event) => {
      const { name, type, data } = event;
      if (type === 'status') updateStatus(name, data);
      else if (type === 'chunk') updateChunk(name, data);
      else if (type === 'error') setError(name, data);
    });

    return unsubscribe;
  }, [updateStatus, updateChunk, setError]);

  // Show original webview overlay
  if (currentView === 'original') {
    return <WebViewPanel />;
  }

  return (
    <div style={styles.app}>
      <AiSidebar />
      <div style={styles.main}>
        <InputBar />
        <div style={styles.cards}>
          {aiServices.map((ai) => (
            <ResponseCard key={ai.name} ai={ai} />
          ))}
        </div>
      </div>
    </div>
  );
}
