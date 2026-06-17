const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Send a query to all AI services
  sendQuery: (query) => ipcRenderer.invoke('send-query', query),

  // Show/hide original webview for a specific AI
  showOriginal: (name) => ipcRenderer.invoke('show-original', name),
  hideOriginal: () => ipcRenderer.invoke('hide-original'),

  // Listen for AI events (status changes, response chunks)
  onAiEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('ai-event', handler);
    return () => ipcRenderer.removeListener('ai-event', handler);
  },

  // Retry a specific AI service
  retryAi: (name) => ipcRenderer.invoke('retry-ai', name),
});
