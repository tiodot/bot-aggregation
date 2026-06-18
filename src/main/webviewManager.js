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
    console.log('[WebviewManager] Initializing with', this.adapters.length, 'adapters...');
    for (const adapter of this.adapters) {
      try {
        await this._createView(adapter);
      } catch (err) {
        console.error(`[WebviewManager] Failed to initialize ${adapter.name}:`, err);
        this._notifyRenderer(adapter.name, 'status', 'error');
      }
    }
    console.log('[WebviewManager] Initialization complete. Views:', [...this.views.keys()]);
  }

  async _createView(adapter) {
    console.log(`[${adapter.name}] Creating BrowserView, loading ${adapter.url}...`);

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
    console.log(`[${adapter.name}] Page loaded. Waiting for ready...`);

    try {
      await adapter.waitForReady(view.webContents);
      this.views.get(adapter.name).status = 'ready';
      console.log(`[${adapter.name}] ✅ Ready!`);
      this._notifyRenderer(adapter.name, 'status', 'ready');
    } catch (err) {
      console.error(`[${adapter.name}] ❌ Not ready:`, err.message);
      this.views.get(adapter.name).status = 'error';
      this._notifyRenderer(adapter.name, 'status', 'error');
    }
  }

  _registerIpcHandlers() {
    ipcMain.handle('send-query', async (_event, query) => {
      console.log('[WebviewManager] Received send-query:', query.substring(0, 50));
      return this.broadcast(query);
    });

    ipcMain.handle('retry-ai', async (_event, name) => {
      console.log(`[WebviewManager] Retry requested for ${name}`);
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
    const entries = [...this.views.entries()];
    console.log(`[WebviewManager] Broadcasting to ${entries.length} views...`);

    const results = [];
    for (const [name, { view, adapter, status }] of entries) {
      console.log(`[${name}] Status: ${status}`);
      if (status !== 'ready') {
        console.log(`[${name}] ⏭ Skipped (not ready)`);
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
      console.log(`[${name}] Sending query via adapter...`);
      await adapter.sendQuery(view.webContents, query);
      console.log(`[${name}] Query sent. Listening for response...`);

      const finalText = await adapter.listenForResponse(view.webContents, (chunk) => {
        this._notifyRenderer(name, 'chunk', chunk);
      });

      entry.status = 'ready';
      console.log(`[${name}] ✅ Response complete (${finalText.length} chars)`);
      this._notifyRenderer(name, 'status', 'done');
      return { name, status: 'done', text: finalText };
    } catch (err) {
      console.error(`[${name}] ❌ Query failed:`, err.message);
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
    console.log('[WebviewManager] Destroying all views');
    for (const [, { view }] of this.views) {
      view.webContents.destroy();
    }
    this.views.clear();
  }
}

module.exports = WebviewManager;
