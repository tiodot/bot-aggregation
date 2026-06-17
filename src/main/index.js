const { app, BrowserWindow } = require('electron');
const path = require('path');
const WebviewManager = require('./webviewManager');

const isDev = !app.isPackaged;
let mainWindow;
let webviewManager;

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

  // Initialize webview manager after window loads
  mainWindow.webContents.on('did-finish-load', () => {
    webviewManager = new WebviewManager(mainWindow);
    webviewManager.initialize().catch(console.error);
  });

  mainWindow.on('closed', () => {
    if (webviewManager) webviewManager.destroy();
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
