const { BrowserView, ipcMain } = require('electron');
const path = require('path');
const GenericAdapter = require('../adapters/generic');

class WebviewManager {
  constructor(mainWindow, sessionManager) {
    this.mainWindow = mainWindow;
    this.sessionManager = sessionManager;
    this.views = new Map(); // name -> { view, adapter, status, visible }
    this.adapters = [];
    this._cardRects = {}; // name -> { x, y, width, height }

    // Clean up any existing BrowserViews from previous instances (dev mode reload)
    this._cleanupExistingViews();

    this._registerIpcHandlers();
    this._registerResizeHandler();
  }

  /**
   * Initialize with bot configs. Creates GenericAdapter for each config.
   */
  async initialize(botsConfig = []) {
    this.adapters = botsConfig.map((config) => new GenericAdapter(config));
    console.log('[WebviewManager] Initializing with', this.adapters.length, 'adapters...');
    const results = await Promise.allSettled(
      this.adapters.map((adapter) => this._createView(adapter))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[WebviewManager] ${this.adapters[i].name} init failed:`, r.reason);
      }
    });
    console.log('[WebviewManager] Initialization complete. Views:', [...this.views.keys()]);
  }

  /**
   * Rebuild all views from new config. Destroys existing views first.
   */
  async rebuildFromConfig(botsConfig) {
    console.log('[WebviewManager] Rebuilding from config:', botsConfig.length, 'bots');
    // Destroy existing views
    for (const [, { view }] of this.views) {
      try {
        this.mainWindow.removeBrowserView(view);
        view.webContents.destroy();
      } catch (_) {}
    }
    this.views.clear();
    this._cardRects = {};

    // Create new adapters and views
    this.adapters = botsConfig.map((config) => new GenericAdapter(config));
    const results = await Promise.allSettled(
      this.adapters.map((adapter) => this._createView(adapter))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`[WebviewManager] ${this.adapters[i].name} rebuild failed:`, r.reason);
      }
    });
    console.log('[WebviewManager] Rebuild complete. Views:', [...this.views.keys()]);
  }

  _cleanupExistingViews() {
    const existingViews = this.mainWindow.getBrowserViews();
    if (existingViews.length > 0) {
      console.log(`[WebviewManager] Cleaning up ${existingViews.length} existing BrowserViews`);
      for (const view of existingViews) {
        try {
          this.mainWindow.removeBrowserView(view);
          view.webContents.destroy();
        } catch (_) {}
      }
    }
  }

  async _createView(adapter) {
    console.log(`[${adapter.name}] Creating BrowserView, loading ${adapter.url}...`);

    let view;
    try {
      view = new BrowserView({
        webPreferences: {
          preload: path.join(__dirname, '../preload/index.js'),
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: false,
        },
      });

      const originalUA = view.webContents.getUserAgent();
      const chromeUA = originalUA
        .replace(/Electron\/[\d.]+\s*/g, '')
        .replace(/bot-aggregation\/[\d.]+\s*/g, '');
      view.webContents.setUserAgent(chromeUA);
      console.log(`[${adapter.name}] UA: ${chromeUA.substring(0, 80)}...`);
    } catch (e) {
      console.error(`[${adapter.name}] Failed to create BrowserView:`, e.message);
      throw e;
    }

    this.views.set(adapter.name, { view, adapter, status: 'loading', visible: false, userEnabled: true });
    this._notifyRenderer(adapter.name, 'status', 'loading');

    view.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[${adapter.name}] did-fail-load: code=${errorCode} desc="${errorDescription}" url="${validatedURL}"`);
    });

    view.webContents.on('did-finish-load', () => {
      console.log(`[${adapter.name}] did-finish-load: page loaded successfully`);
    });

    // Load with timeout
    console.log(`[${adapter.name}] Starting loadURL...`);
    try {
      const loadPromise = view.webContents.loadURL(adapter.url);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('loadURL timeout (30s)')), 30000)
      );
      await Promise.race([loadPromise, timeoutPromise]);
      console.log(`[${adapter.name}] loadURL resolved.`);
    } catch (e) {
      console.error(`[${adapter.name}] loadURL failed:`, e.message);
    }

    // Wait for ready
    try {
      await adapter.waitForReady(view.webContents);
      const entry = this.views.get(adapter.name);
      entry.status = 'ready';
      console.log(`[${adapter.name}] Ready`);
      this._notifyRenderer(adapter.name, 'status', 'ready');

      if (this._cardRects[adapter.name] && entry.userEnabled) {
        this._showView(adapter.name);
      }
    } catch (err) {
      console.error(`[${adapter.name}] Not ready:`, err.message);
      this.views.get(adapter.name).status = 'error';
      this._notifyRenderer(adapter.name, 'status', 'error');
    }
  }

  _registerIpcHandlers() {
    ['send-query', 'update-card-rects', 'toggle-bot', 'hide-all-views', 'new-chat', 'retry-ai', 'navigate-bot', 'bots-sync', 'bots-get'].forEach((ch) => {
      ipcMain.removeHandler(ch);
    });

    ipcMain.handle('send-query', async (_event, query, sessionId) => {
      console.log('[WebviewManager] Received send-query:', query.substring(0, 50), 'session:', sessionId);
      return this.broadcast(query, sessionId);
    });

    ipcMain.handle('update-card-rects', (_event, rects) => {
      Object.assign(this._cardRects, rects);
      this._updateAllVisibleViews();
    });

    ipcMain.handle('toggle-bot', (_event, name, enabled) => {
      console.log(`[WebviewManager] Toggle bot ${name}: ${enabled ? 'ON' : 'OFF'}`);
      const entry = this.views.get(name);
      if (!entry) return;
      entry.userEnabled = enabled;
      if (enabled) {
        if (this._cardRects[name]) this._showView(name);
        this._notifyRenderer(name, 'status', entry.status);
      } else {
        this._hideView(name);
      }
    });

    ipcMain.handle('hide-all-views', () => {
      for (const [, entry] of this.views) {
        if (entry.visible) {
          entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
          entry.visible = false;
        }
      }
    });

    ipcMain.handle('new-chat', async () => {
      console.log('[WebviewManager] New chat requested');
      const results = [];
      for (const [name, entry] of this.views) {
        if (!entry.visible) continue;
        try {
          const result = await entry.adapter.newChat(entry.view.webContents);
          console.log(`[${name}] New chat result:`, JSON.stringify(result));
          results.push({ name, ...result });
        } catch (err) {
          console.error(`[${name}] New chat failed:`, err.message);
          results.push({ name, ok: false, error: err.message });
        }
      }
      return results;
    });

    ipcMain.handle('navigate-bot', async (_event, botName, url) => {
      console.log(`[WebviewManager] Navigate ${botName} to ${url}`);
      const entry = this.views.get(botName);
      if (!entry) return { ok: false, error: `${botName} not found` };
      try {
        await entry.view.webContents.loadURL(url);
        entry.status = 'ready';
        this._notifyRenderer(botName, 'status', 'ready');
        return { ok: true };
      } catch (err) {
        console.error(`[WebviewManager] Navigate failed for ${botName}:`, err.message);
        return { ok: false, error: err.message };
      }
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
          if (this._cardRects[name]) this._showView(name);
        } catch (err) {
          entry.status = 'error';
          this._notifyRenderer(name, 'status', 'error');
        }
      }
    });

    // bots-sync: rebuild adapters from new config
    ipcMain.handle('bots-sync', async (_event, botsConfig) => {
      console.log('[WebviewManager] bots-sync received:', botsConfig.length, 'bots');
      await this.rebuildFromConfig(botsConfig);
      return { ok: true };
    });

    // bots-get: return current config (for main process querying)
    ipcMain.handle('bots-get', () => {
      return this.adapters.map((a) => ({
        name: a.name,
        url: a.url,
        ...(a.config || {}),
      }));
    });
  }

  _registerResizeHandler() {
    this.mainWindow.on('resize', () => {
      setTimeout(() => this._updateAllVisibleViews(), 100);
    });
  }

  _showView(name) {
    const entry = this.views.get(name);
    const rect = this._cardRects[name];
    if (!entry || !rect || rect.width <= 0 || rect.height <= 0) return;
    if (!entry.userEnabled) return;

    if (entry.visible) {
      entry.view.setBounds(rect);
      return;
    }

    try { this.mainWindow.removeBrowserView(entry.view); } catch (_) {}

    const safeRect = {
      x: Math.max(180, rect.x),
      y: Math.max(0, rect.y),
      width: rect.width,
      height: rect.height,
    };
    entry.view.setBounds(safeRect);
    this.mainWindow.addBrowserView(entry.view);
    entry.visible = true;
  }

  _hideView(name) {
    const entry = this.views.get(name);
    if (!entry || !entry.visible) return;
    this.mainWindow.removeBrowserView(entry.view);
    entry.visible = false;
  }

  _updateAllVisibleViews() {
    for (const [name, entry] of this.views) {
      const rect = this._cardRects[name];
      if (!rect) continue;
      if (rect.width > 0 && rect.height > 0) {
        if (entry.visible) entry.view.setBounds(rect);
      } else {
        if (entry.visible) entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
      }
    }
  }

  async broadcast(query, sessionId) {
    const entries = [...this.views.entries()];
    console.log(`[WebviewManager] Broadcasting to ${entries.length} views...`);

    const results = [];
    for (const [name, { view, adapter, status }] of entries) {
      if (status !== 'ready') {
        results.push({ name, status: 'skipped', error: 'not ready' });
        continue;
      }
      results.push(this._sendToOne(name, view, adapter, query));
    }

    const settled = await Promise.allSettled(results);

    if (sessionId && this.sessionManager) {
      let sessionTitle = null;
      for (const result of settled) {
        if (result.status === 'fulfilled' && result.value?.sessionUrl) {
          const { name, sessionUrl, pageTitle } = result.value;
          this.sessionManager.linkBotSession(sessionId, name, sessionUrl);
          if (!sessionTitle && pageTitle) sessionTitle = pageTitle;
        }
      }
      if (sessionTitle) {
        this.sessionManager.updateSessionTitle(sessionId, sessionTitle);
        this._notifyRenderer(null, 'session-updated', sessionId);
      }
    }

    return settled;
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

      const sessionUrl = view.webContents.getURL();
      const pageTitle = view.webContents.getTitle();
      entry.status = 'ready';
      this._notifyRenderer(name, 'status', 'done');
      return { name, status: 'done', text: finalText, sessionUrl, pageTitle };
    } catch (err) {
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
      try { this.mainWindow.removeBrowserView(view); } catch (_) {}
      view.webContents.destroy();
    }
    this.views.clear();
  }
}

module.exports = WebviewManager;
