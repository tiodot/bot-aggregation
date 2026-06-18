const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Send a query to all AI services
  sendQuery: (query) => ipcRenderer.invoke('send-query', query),

  // Show/hide the real BrowserView over a card area
  showCardWebview: (name, rect) => ipcRenderer.invoke('show-card-webview', name, rect),
  hideCardWebview: () => ipcRenderer.invoke('hide-card-webview'),

  // Listen for AI events (status changes, response chunks)
  onAiEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('ai-event', handler);
    return () => ipcRenderer.removeListener('ai-event', handler);
  },

  // Retry a specific AI service
  retryAi: (name) => ipcRenderer.invoke('retry-ai', name),
});
