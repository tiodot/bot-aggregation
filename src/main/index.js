const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const WebviewManager = require('./webviewManager');
const SessionManager = require('./sessionManager');

// Suppress Chromium SSL noise in terminal (harmless subresource preconnection failures)
app.commandLine.appendSwitch('v', '0');

const isDev = !app.isPackaged;
let mainWindow;
let webviewManager;
let sessionManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'AI Aggregator',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Initialize managers after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    sessionManager = new SessionManager();
    webviewManager = new WebviewManager(mainWindow, sessionManager);
    // Initialize with empty config — renderer will send bots-sync shortly
    webviewManager.initialize([]).catch(console.error);

    // Register session IPC handlers
    registerSessionIpc();
  });

  mainWindow.on('closed', () => {
    if (webviewManager) webviewManager.destroy();
    if (sessionManager) sessionManager.close();
    mainWindow = null;
  });
}

function registerSessionIpc() {
  // Remove existing handlers
  ['session-create', 'session-list', 'session-get', 'session-update-title', 'session-delete', 'session-link-bot', 'session-get-latest'].forEach((ch) => {
    ipcMain.removeHandler(ch);
  });

  ipcMain.handle('session-create', (_event, title) => {
    const session = sessionManager.createSession(title);
    console.log('[Session] Created:', session.id, session.title);
    return session;
  });

  ipcMain.handle('session-list', () => {
    return sessionManager.getSessions();
  });

  ipcMain.handle('session-get', (_event, sessionId) => {
    return sessionManager.getSession(sessionId);
  });

  ipcMain.handle('session-update-title', (_event, sessionId, title) => {
    sessionManager.updateSessionTitle(sessionId, title);
    return { ok: true };
  });

  ipcMain.handle('session-delete', (_event, sessionId) => {
    sessionManager.deleteSession(sessionId);
    console.log('[Session] Deleted:', sessionId);
    return { ok: true };
  });

  ipcMain.handle('session-link-bot', (_event, sessionId, botName, sessionUrl) => {
    sessionManager.linkBotSession(sessionId, botName, sessionUrl);
    console.log('[Session] Linked bot:', botName, '->', sessionUrl);
    return { ok: true };
  });

  ipcMain.handle('session-get-latest', () => {
    return sessionManager.getLatestSession();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
