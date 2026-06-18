const { BrowserView, ipcMain } = require('electron');
const path = require('path');
const QwenAdapter = require('../adapters/qwen');
const DeepSeekAdapter = require('../adapters/deepseek');
const KimiAdapter = require('../adapters/kimi');

class WebviewManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.views = new Map(); // name -> { view, adapter, status }
    this.adapters = [new QwenAdapter(), new DeepSeekAdapter(), new KimiAdapter()];
    this._registerIpcHandlers();
  }

  async initialize() {
    for (const adapter of this.adapters) {
      try {
        await this._createView(adapter);
      } catch (err) {
        console.error(`Failed to initialize ${adapter.name}:`, err);
        this._notifyRenderer(adapter.name, 'status', 'error');
      }
    }
  }

  async _createView(adapter) {
    const view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
      },
    });

    this.views.set(adapter.name, { view, adapter, status: 'loading' });
    this._notifyRenderer(adapter.name, 'status', 'loading');

    await view.webContents.loadURL(adapter.url);

    try {
      await adapter.waitForReady(view.webContents);
      this.views.get(adapter.name).status = 'ready';
      this._notifyRenderer(adapter.name, 'status', 'ready');
    } catch (err) {
      console.error(`${adapter.name} not ready:`, err.message);
      this.views.get(adapter.name).status = 'error';
      this._notifyRenderer(adapter.name, 'status', 'error');
    }
  }

  _registerIpcHandlers() {
    ipcMain.handle('send-query', async (_event, query) => {
      return this.broadcast(query);
    });

    ipcMain.handle('retry-ai', async (_event, name) => {
      const entry = this.views.get(name);
      if (entry) {
        try {
          await entry.view.webContents.loadURL(entry.adapter.url);
          await entry.adapter.waitForReady(entry.view.webContents);
          entry.status = 'ready';
          this._notifyRenderer(name, 'status', 'ready');
        } catch (err) {
          entry.status = 'error';
          this._notifyRenderer(name, 'status', 'error');
        }
      }
    });
  }

  async broadcast(query) {
    const results = [];
    for (const [name, { view, adapter, status }] of this.views) {
      if (status !== 'ready') {
        results.push({ name, status: 'skipped', error: 'not ready' });
        continue;
      }
      results.push(this._sendToOne(name, view, adapter, query));
    }
    return Promise.allSettled(results);
  }

  async _sendToOne(name, view, adapter, query) {
    const entry = this.views.get(name);
    entry.status = 'sending';
    this._notifyRenderer(name, 'status', 'sending');
    this._notifyRenderer(name, 'chunk', '');

    try {
      await adapter.sendQuery(view.webContents, query);
      const finalText = await adapter.listenForResponse(view.webContents, (chunk) => {
        this._notifyRenderer(name, 'chunk', chunk);
      });
      entry.status = 'ready';
      this._notifyRenderer(name, 'status', 'done');
      return { name, status: 'done', text: finalText };
    } catch (err) {
      console.error(`${name} query failed:`, err.message);
      entry.status = 'error';
      this._notifyRenderer(name, 'status', 'error');
      this._notifyRenderer(name, 'error', err.message);
      return { name, status: 'error', error: err.message };
    }
  }

  _notifyRenderer(name, type, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('ai-event', { name, type, data });
    }
  }

  destroy() {
    for (const [, { view }] of this.views) {
      view.webContents.destroy();
    }
    this.views.clear();
  }
}

module.exports = WebviewManager;
