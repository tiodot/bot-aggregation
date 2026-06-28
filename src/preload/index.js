const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Send a query to all AI services
  sendQuery: (query, sessionId) => ipcRenderer.invoke('send-query', query, sessionId),

  // Update card positions (for BrowserView overlay)
  updateCardRects: (rects) => ipcRenderer.invoke('update-card-rects', rects),

  // Toggle a bot on/off
  toggleBot: (name, enabled) => ipcRenderer.invoke('toggle-bot', name, enabled),

  // Sync bot configs to main process
  botsSync: (configs) => ipcRenderer.invoke('bots-sync', configs),

  // Get current bot configs from main process
  botsGet: () => ipcRenderer.invoke('bots-get'),

  // Start new chat for all enabled bots
  newChat: () => ipcRenderer.invoke('new-chat'),

  // Session management
  sessionCreate: (title) => ipcRenderer.invoke('session-create', title),
  sessionList: () => ipcRenderer.invoke('session-list'),
  sessionGet: (sessionId) => ipcRenderer.invoke('session-get', sessionId),
  sessionUpdateTitle: (sessionId, title) => ipcRenderer.invoke('session-update-title', sessionId, title),
  sessionDelete: (sessionId) => ipcRenderer.invoke('session-delete', sessionId),
  sessionLinkBot: (sessionId, botName, sessionUrl) => ipcRenderer.invoke('session-link-bot', sessionId, botName, sessionUrl),
  sessionGetLatest: () => ipcRenderer.invoke('session-get-latest'),

  // Navigate a specific bot to a URL
  navigateBot: (botName, url) => ipcRenderer.invoke('navigate-bot', botName, url),

  // Listen for AI events (status changes, response chunks)
  onAiEvent: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('ai-event', handler);
    return () => ipcRenderer.removeListener('ai-event', handler);
  },

  // Retry a specific AI service
  retryAi: (name) => ipcRenderer.invoke('retry-ai', name),
});
