# AI Aggregator Mac App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron desktop app that embeds multiple AI chatbot webviews, injects JS to send queries simultaneously, and displays streaming responses in a unified card layout.

**Architecture:** Electron main process manages hidden BrowserViews (one per AI service). Each AI has an adapter that handles DOM injection for sending queries and listening for responses via MutationObserver. The React renderer shows a sidebar + input bar + response cards.

**Tech Stack:** Electron, React 18, Zustand, Vite, electron-builder

---

## File Map

```
bot-aggregation/
├── package.json                          # Dependencies and scripts
├── vite.config.js                        # Vite config for renderer
├── electron-builder.yml                  # Packaging config
├── src/
│   ├── main/
│   │   ├── index.js                      # Electron entry, creates window + webviews
│   │   └── webviewManager.js             # BrowserView lifecycle, broadcast, IPC relay
│   ├── renderer/
│   │   ├── index.html                    # HTML shell for React
│   │   ├── index.jsx                     # React entry point
│   │   ├── App.jsx                       # Main layout: sidebar + input + cards
│   │   ├── store.js                      # Zustand store
│   │   └── components/
│   │       ├── AiSidebar.jsx             # Left sidebar with AI list + status dots
│   │       ├── InputBar.jsx              # Top input + send button
│   │       ├── ResponseCard.jsx          # Single AI response card
│   │       └── WebViewPanel.jsx          # Full-screen original webview overlay
│   ├── adapters/
│   │   ├── base.js                       # BaseAdapter: waitForReady, sendQuery, listenForResponse
│   │   ├── qwen.js                       # Qwen (tongyi.aliyun.com) adapter
│   │   ├── deepseek.js                   # DeepSeek adapter
│   │   └── kimi.js                       # Kimi (kimi.moonshot.cn) adapter
│   └── preload/
│       └── index.js                      # contextBridge: expose IPC to renderer
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `electron-builder.yml`
- Create: `.gitignore` (update existing)
- Create: `src/renderer/index.html`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "ai-aggregator",
  "version": "1.0.0",
  "description": "Multi-AI chatbot aggregator for Mac",
  "main": "src/main/index.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "vite build && electron-builder",
    "build:renderer": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "concurrently": "^8.2.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0",
    "vite": "^5.3.0",
    "wait-on": "^7.2.0"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 3: Create electron-builder.yml**

```yaml
appId: com.ai-aggregator.app
productName: AI Aggregator
mac:
  category: public.app-category.productivity
  target: dmg
directories:
  output: dist/release
files:
  - dist/renderer/**/*
  - src/main/**/*
  - src/adapters/**/*
  - src/preload/**/*
  - package.json
```

- [ ] **Step 4: Update .gitignore**

Append to existing `.gitignore`:

```
node_modules/
dist/
.superpowers/
```

- [ ] **Step 5: Create renderer/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Aggregator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./index.jsx"></script>
</body>
</html>
```

- [ ] **Step 6: Install dependencies and verify**

Run: `cd /Users/xiong/Workplace/bot-aggregation && npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.js electron-builder.yml .gitignore src/renderer/index.html
git commit -m "feat: scaffold Electron + React + Vite project"
```

---

### Task 2: Electron Main Process — Window

**Files:**
- Create: `src/main/index.js`

- [ ] **Step 1: Create main/index.js**

```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;

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

  mainWindow.on('closed', () => {
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

module.exports = { getMainWindow: () => mainWindow };
```

- [ ] **Step 2: Verify Electron launches**

Run: `cd /Users/xiong/Workplace/bot-aggregation && npx electron .`
Expected: Electron window opens (will show blank since renderer isn't built yet in dev mode — that's OK, we'll wire Vite in the next task)

- [ ] **Step 3: Commit**

```bash
git add src/main/index.js
git commit -m "feat: add Electron main process with window creation"
```

---

### Task 3: Preload Script

**Files:**
- Create: `src/preload/index.js`

- [ ] **Step 1: Create preload/index.js**

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.js
git commit -m "feat: add preload script with IPC bridge"
```

---

### Task 4: Base Adapter

**Files:**
- Create: `src/adapters/base.js`

- [ ] **Step 1: Create adapters/base.js**

```javascript
class BaseAdapter {
  constructor(name, url) {
    this.name = name;
    this.url = url;
  }

  /** CSS selectors for the AI's web interface. Override in subclass. */
  get selectors() {
    return {
      input: '',       // textarea or contenteditable for user input
      sendBtn: '',     // button to submit the query
      response: '',    // container for the AI's response text
      stopBtn: '',     // "stop generating" button (used to detect stream end)
    };
  }

  /**
   * Wait until the AI page is loaded and the input element exists.
   * @param {Electron.WebContents} webContents
   * @param {number} timeout - ms to wait before throwing
   */
  async waitForReady(webContents, timeout = 30000) {
    const selector = this.selectors.input;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await webContents.executeJavaScript(
        `!!document.querySelector('${selector}')`
      ).catch(() => false);
      if (found) return true;
      await this._sleep(500);
    }
    throw new Error(`${this.name}: input element "${selector}" not found after ${timeout}ms`);
  }

  /**
   * Type a query into the input field and click send.
   * @param {Electron.WebContents} webContents
   * @param {string} query
   */
  async sendQuery(webContents, query) {
    // Subclasses should override this for special handling
    // (contenteditable, custom event dispatching, etc.)
    await webContents.executeJavaScript(`
      (() => {
        const input = document.querySelector('${this.selectors.input}');
        if (!input) throw new Error('Input not found');

        // For <textarea> and <input>
        if ('value' in input) {
          input.value = ${JSON.stringify(query)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          // contenteditable
          input.focus();
          input.textContent = ${JSON.stringify(query)};
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }

        // Click send button (with small delay to let input events propagate)
        setTimeout(() => {
          const btn = document.querySelector('${this.selectors.sendBtn}');
          if (btn) btn.click();
        }, 100);
      })()
    `);
  }

  /**
   * Listen for the AI's response via MutationObserver.
   * Calls onChunk(text) each time the response changes.
   * Resolves when the response is complete.
   *
   * @param {Electron.WebContents} webContents
   * @param {function} onChunk - callback with latest full text
   * @returns {Promise<string>} final response text
   */
  async listenForResponse(webContents, onChunk) {
    const responseSelector = this.selectors.response;
    const stopBtnSelector = this.selectors.stopBtn;

    // Inject a MutationObserver that posts messages back
    const responseId = `__ai_response_${Date.now()}`;

    await webContents.executeJavaScript(`
      (() => {
        const responseSel = '${responseSelector}';
        const stopSel = '${stopBtnSelector}';
        const RESPONSE_ID = '${responseId}';

        // Find the latest response element (last matching element)
        function getLatestResponse() {
          const els = document.querySelectorAll(responseSel);
          return els.length > 0 ? els[els.length - 1] : null;
        }

        let lastText = '';
        let stableCount = 0;
        let observer = null;

        function check() {
          const el = getLatestResponse();
          if (!el) return;

          const text = el.innerText.trim();
          if (text !== lastText) {
            lastText = text;
            stableCount = 0;
            window[RESPONSE_ID] = { status: 'streaming', text };
          } else {
            stableCount++;
          }

          // Check if done: stop button gone, or text stable for 3s
          const stopBtn = document.querySelector(stopSel);
          if (!stopBtn && stableCount >= 6) {
            window[RESPONSE_ID] = { status: 'done', text: lastText };
            if (observer) observer.disconnect();
          }
        }

        // Start observing the response container's parent
        const target = getLatestResponse()?.parentElement || document.body;
        observer = new MutationObserver(() => {
          setTimeout(check, 200);
        });
        observer.observe(target, { childList: true, subtree: true, characterData: true });

        // Also poll as fallback
        const interval = setInterval(() => {
          check();
          if (window[RESPONSE_ID]?.status === 'done') {
            clearInterval(interval);
          }
        }, 500);

        window[RESPONSE_ID] = { status: 'waiting', text: '' };
      })()
    `);

    // Poll the injected state from the renderer
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${this.name}: response timeout (120s)`));
      }, 120000);

      const poll = setInterval(async () => {
        try {
          const state = await webContents.executeJavaScript(
            `window['${responseId}']`
          );
          if (!state) return;

          if (state.text && state.status === 'streaming') {
            onChunk(state.text);
          }

          if (state.status === 'done') {
            clearInterval(poll);
            clearTimeout(timeout);
            onChunk(state.text);
            resolve(state.text);
          }
        } catch (e) {
          clearInterval(poll);
          clearTimeout(timeout);
          reject(e);
        }
      }, 300);
    });
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = BaseAdapter;
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/base.js
git commit -m "feat: add BaseAdapter with JS injection for send and listen"
```

---

### Task 5: Qwen Adapter

**Files:**
- Create: `src/adapters/qwen.js`

- [ ] **Step 1: Create adapters/qwen.js**

```javascript
const BaseAdapter = require('./base');

class QwenAdapter extends BaseAdapter {
  constructor() {
    super('Qwen', 'https://tongyi.aliyun.com/qianwen');
  }

  get selectors() {
    return {
      input: 'textarea[data-testid="chat-input"], textarea.ant-input, #chat-input',
      sendBtn: 'button[data-testid="chat-send"], .chatInputSendBtn, button[class*="send"]',
      response: '.message-content-container, .chat-message-content, [class*="markdown"]',
      stopBtn: 'button[class*="stop"], [data-testid="chat-stop"]',
    };
  }

  async waitForReady(webContents, timeout = 45000) {
    // Qwen may need extra time to load
    return super.waitForReady(webContents, timeout);
  }

  async sendQuery(webContents, query) {
    await webContents.executeJavaScript(`
      (() => {
        // Try multiple selector strategies
        const selectors = ${JSON.stringify(this.selectors.input.split(', '))};
        let input = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) break;
        }
        if (!input) throw new Error('Qwen input not found');

        input.focus();

        if ('value' in input) {
          // Native textarea/input
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          ).set || Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ).set;
          nativeInputValueSetter.call(input, ${JSON.stringify(query)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          input.textContent = ${JSON.stringify(query)};
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }

        setTimeout(() => {
          const btnSelectors = ${JSON.stringify(this.selectors.sendBtn.split(', '))};
          for (const sel of btnSelectors) {
            const btn = document.querySelector(sel.trim());
            if (btn && !btn.disabled) { btn.click(); break; }
          }
        }, 200);
      })()
    `);
  }
}

module.exports = QwenAdapter;
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/qwen.js
git commit -m "feat: add Qwen adapter"
```

---

### Task 6: DeepSeek Adapter

**Files:**
- Create: `src/adapters/deepseek.js`

- [ ] **Step 1: Create adapters/deepseek.js**

```javascript
const BaseAdapter = require('./base');

class DeepSeekAdapter extends BaseAdapter {
  constructor() {
    super('DeepSeek', 'https://chat.deepseek.com');
  }

  get selectors() {
    return {
      input: 'textarea#chat-input, textarea[placeholder], textarea',
      sendBtn: 'button[class*="send"], div[class*="send"]',
      response: '.ds-markdown--block, .markdown-body, [class*="message-content"]',
      stopBtn: 'button[class*="stop"], [class*="stop-generating"]',
    };
  }

  async sendQuery(webContents, query) {
    await webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(this.selectors.input.split(', '))};
        let input = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) break;
        }
        if (!input) throw new Error('DeepSeek input not found');

        input.focus();
        if ('value' in input) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          ).set;
          setter.call(input, ${JSON.stringify(query)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          input.textContent = ${JSON.stringify(query)};
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }

        setTimeout(() => {
          const btnSelectors = ${JSON.stringify(this.selectors.sendBtn.split(', '))};
          for (const sel of btnSelectors) {
            const btn = document.querySelector(sel.trim());
            if (btn && !btn.disabled) { btn.click(); break; }
          }
        }, 200);
      })()
    `);
  }
}

module.exports = DeepSeekAdapter;
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/deepseek.js
git commit -m "feat: add DeepSeek adapter"
```

---

### Task 7: Kimi Adapter

**Files:**
- Create: `src/adapters/kimi.js`

- [ ] **Step 1: Create adapters/kimi.js**

```javascript
const BaseAdapter = require('./base');

class KimiAdapter extends BaseAdapter {
  constructor() {
    super('Kimi', 'https://kimi.moonshot.cn');
  }

  get selectors() {
    return {
      input: '[data-testid="msh-chatinput-editor"], .editor-content, textarea, [contenteditable="true"]',
      sendBtn: '[data-testid="msh-chatinput-send-button"], button[class*="send"]',
      response: '.chat-message-content, [class*="markdown"], [class*="message-text"]',
      stopBtn: 'button[class*="stop"], [data-testid*="stop"]',
    };
  }

  async sendQuery(webContents, query) {
    await webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(this.selectors.input.split(', '))};
        let input = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) break;
        }
        if (!input) throw new Error('Kimi input not found');

        input.focus();

        if ('value' in input) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          ).set;
          setter.call(input, ${JSON.stringify(query)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          // Kimi uses contenteditable
          input.textContent = '';
          document.execCommand('insertText', false, ${JSON.stringify(query)});
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }

        setTimeout(() => {
          const btnSelectors = ${JSON.stringify(this.selectors.sendBtn.split(', '))};
          for (const sel of btnSelectors) {
            const btn = document.querySelector(sel.trim());
            if (btn && !btn.disabled) { btn.click(); break; }
          }
        }, 200);
      })()
    `);
  }
}

module.exports = KimiAdapter;
```

- [ ] **Step 2: Commit**

```bash
git add src/adapters/kimi.js
git commit -m "feat: add Kimi adapter"
```

---

### Task 8: WebviewManager

**Files:**
- Create: `src/main/webviewManager.js`

- [ ] **Step 1: Create webviewManager.js**

```javascript
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
        // Allow cross-origin requests for AI sites
        webSecurity: false,
      },
    });

    this.views.set(adapter.name, { view, adapter, status: 'loading' });
    this._notifyRenderer(adapter.name, 'status', 'loading');

    await view.webContents.loadURL(adapter.url);

    // Wait for the AI page to be ready
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

    ipcMain.handle('show-original', (_event, name) => {
      this.showOriginal(name);
    });

    ipcMain.handle('hide-original', () => {
      this.hideOriginal();
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
    this._notifyRenderer(name, 'chunk', ''); // clear previous response

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

  showOriginal(name) {
    const entry = this.views.get(name);
    if (!entry) return;
    this.mainWindow.setBrowserView(entry.view);
    const bounds = this.mainWindow.getContentBounds();
    entry.view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });
  }

  hideOriginal() {
    this.mainWindow.setBrowserView(null);
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
```

- [ ] **Step 2: Commit**

```bash
git add src/main/webviewManager.js
git commit -m "feat: add WebviewManager with BrowserView lifecycle and IPC"
```

---

### Task 9: Integrate WebviewManager into Main Process

**Files:**
- Modify: `src/main/index.js`

- [ ] **Step 1: Update src/main/index.js to initialize WebviewManager**

Replace the entire file:

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/main/index.js
git commit -m "feat: integrate WebviewManager into main process"
```

---

### Task 10: Zustand Store

**Files:**
- Create: `src/renderer/store.js`

- [ ] **Step 1: Create renderer/store.js**

```javascript
import { create } from 'zustand';

const useStore = create((set, get) => ({
  // AI services state
  aiServices: [
    { name: 'Qwen', color: '#89b4fa', status: 'loading', response: '', error: null },
    { name: 'DeepSeek', color: '#cba6f7', status: 'loading', response: '', error: null },
    { name: 'Kimi', color: '#fab387', status: 'loading', response: '', error: null },
  ],

  // View state
  currentView: 'unified', // 'unified' | 'original'
  activeOriginal: null,    // name of AI whose original webview is shown

  // Update a specific AI's status
  updateStatus: (name, status) => set((state) => ({
    aiServices: state.aiServices.map((ai) =>
      ai.name === name ? { ...ai, status, error: status === 'error' ? ai.error : null } : ai
    ),
  })),

  // Update a specific AI's response chunk
  updateChunk: (name, chunk) => set((state) => ({
    aiServices: state.aiServices.map((ai) =>
      ai.name === name ? { ...ai, response: chunk } : ai
    ),
  })),

  // Set error for a specific AI
  setError: (name, error) => set((state) => ({
    aiServices: state.aiServices.map((ai) =>
      ai.name === name ? { ...ai, error, status: 'error' } : ai
    ),
  })),

  // Clear all responses (before new query)
  clearResponses: () => set((state) => ({
    aiServices: state.aiServices.map((ai) => ({ ...ai, response: '', error: null })),
  })),

  // View management
  showOriginal: (name) => set({ currentView: 'original', activeOriginal: name }),
  hideOriginal: () => set({ currentView: 'unified', activeOriginal: null }),
}));

export default useStore;
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/store.js
git commit -m "feat: add Zustand store for AI state management"
```

---

### Task 11: React Entry and App Layout

**Files:**
- Create: `src/renderer/index.jsx`
- Create: `src/renderer/App.jsx`

- [ ] **Step 1: Create renderer/index.jsx**

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

- [ ] **Step 2: Create renderer/App.jsx**

```jsx
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
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.jsx src/renderer/App.jsx
git commit -m "feat: add React entry point and App layout"
```

---

### Task 12: AiSidebar Component

**Files:**
- Create: `src/renderer/components/AiSidebar.jsx`

- [ ] **Step 1: Create AiSidebar.jsx**

```jsx
import React from 'react';
import useStore from '../store';

const styles = {
  sidebar: {
    width: 180,
    backgroundColor: '#1e1e2e',
    borderRight: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  title: {
    padding: '16px 12px 8px',
    fontWeight: 600,
    fontSize: 14,
  },
  item: {
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    cursor: 'default',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  footer: {
    flex: 1,
  },
  settings: {
    padding: 12,
    borderTop: '1px solid #313244',
    color: '#6c7086',
    fontSize: 12,
    cursor: 'pointer',
  },
};

const statusColors = {
  ready: '#a6e3a1',
  loading: '#f9e2af',
  sending: '#a6e3a1',
  done: '#a6e3a1',
  error: '#f38ba8',
};

export default function AiSidebar() {
  const aiServices = useStore((s) => s.aiServices);

  return (
    <div style={styles.sidebar}>
      <div style={styles.title}>AI 服务</div>
      {aiServices.map((ai) => (
        <div key={ai.name} style={styles.item}>
          <span style={{ ...styles.dot, backgroundColor: statusColors[ai.status] || '#6c7086' }} />
          <span>{ai.name}</span>
        </div>
      ))}
      <div style={styles.footer} />
      <div style={styles.settings}>⚙ 设置</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/AiSidebar.jsx
git commit -m "feat: add AiSidebar component with status indicators"
```

---

### Task 13: InputBar Component

**Files:**
- Create: `src/renderer/components/InputBar.jsx`

- [ ] **Step 1: Create InputBar.jsx**

```jsx
import React, { useState, useCallback } from 'react';
import useStore from '../store';

const styles = {
  bar: {
    padding: 16,
    borderBottom: '1px solid #313244',
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #45475a',
    backgroundColor: '#1e1e2e',
    color: '#cdd6f4',
    fontSize: 14,
    outline: 'none',
  },
  button: (disabled) => ({
    padding: '10px 20px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: disabled ? '#45475a' : '#89b4fa',
    color: disabled ? '#6c7086' : '#1e1e2e',
    fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 14,
  }),
};

export default function InputBar() {
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const clearResponses = useStore((s) => s.clearResponses);

  const handleSend = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || sending) return;

    setSending(true);
    clearResponses();

    try {
      await window.api.sendQuery(trimmed);
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  }, [query, sending, clearResponses]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.bar}>
      <input
        style={styles.input}
        placeholder="输入问题，同时发送到所有 AI..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={sending}
      />
      <button
        style={styles.button(!query.trim() || sending)}
        onClick={handleSend}
        disabled={!query.trim() || sending}
      >
        {sending ? '发送中...' : '发送'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/InputBar.jsx
git commit -m "feat: add InputBar component with Enter-to-send"
```

---

### Task 14: ResponseCard Component

**Files:**
- Create: `src/renderer/components/ResponseCard.jsx`

- [ ] **Step 1: Create ResponseCard.jsx**

```jsx
import React, { useCallback } from 'react';
import useStore from '../store';

const styles = {
  card: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#1e1e2e',
    borderRadius: 10,
    border: '1px solid #313244',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid #313244',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: (color) => ({
    fontWeight: 600,
    color,
  }),
  statusBadge: (status) => {
    const colors = {
      loading: { bg: '#f9e2af22', color: '#f9e2af' },
      ready: { bg: '#a6e3a122', color: '#a6e3a1' },
      sending: { bg: '#89b4fa22', color: '#89b4fa' },
      done: { bg: '#a6e3a122', color: '#a6e3a1' },
      error: { bg: '#f38ba822', color: '#f38ba8' },
    };
    const c = colors[status] || colors.ready;
    return {
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 4,
      backgroundColor: c.bg,
      color: c.color,
    };
  },
  statusText: {
    loading: '加载中...',
    ready: '就绪',
    sending: '回答中...',
    done: '完成',
    error: '错误',
  },
  body: {
    flex: 1,
    padding: 12,
    color: '#a6adc8',
    fontSize: 13,
    lineHeight: 1.6,
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
  },
  footer: {
    padding: '8px 14px',
    borderTop: '1px solid #313244',
    display: 'flex',
    gap: 8,
  },
  btn: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid #45475a',
    backgroundColor: 'transparent',
    color: '#6c7086',
    cursor: 'pointer',
  },
};

const statusLabels = {
  loading: '加载中...',
  ready: '就绪',
  sending: '回答中...',
  done: '✓ 完成',
  error: '✗ 错误',
};

export default function ResponseCard({ ai }) {
  const showOriginal = useStore((s) => s.showOriginal);

  const handleShowOriginal = useCallback(() => {
    if (window.api) window.api.showOriginal(ai.name);
    showOriginal(ai.name);
  }, [ai.name, showOriginal]);

  const handleCopy = useCallback(() => {
    if (ai.response) {
      navigator.clipboard.writeText(ai.response);
    }
  }, [ai.response]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.name(ai.color)}>{ai.name}</span>
        <span style={styles.statusBadge(ai.status)}>
          {statusLabels[ai.status] || ai.status}
        </span>
      </div>
      <div style={styles.body}>
        {ai.error ? (
          <span style={{ color: '#f38ba8' }}>⚠ {ai.error}</span>
        ) : ai.response ? (
          ai.response
        ) : ai.status === 'loading' ? (
          <span style={{ color: '#45475a' }}>等待页面就绪...</span>
        ) : (
          <span style={{ color: '#45475a' }}>发送问题后，回答将在此显示</span>
        )}
        {ai.status === 'sending' && <span style={{ animation: 'blink 1s infinite' }}> ▎</span>}
      </div>
      <div style={styles.footer}>
        <button style={styles.btn} onClick={handleShowOriginal}>查看原网页</button>
        {ai.response && (
          <button style={styles.btn} onClick={handleCopy}>复制</button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/ResponseCard.jsx
git commit -m "feat: add ResponseCard component with status and copy"
```

---

### Task 15: WebViewPanel Component

**Files:**
- Create: `src/renderer/components/WebViewPanel.jsx`

- [ ] **Step 1: Create WebViewPanel.jsx**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/WebViewPanel.jsx
git commit -m "feat: add WebViewPanel component for original webview overlay"
```

---

### Task 16: Add CSS Animation and Polish

**Files:**
- Modify: `src/renderer/index.html`

- [ ] **Step 1: Add cursor blink animation to index.html**

Update the `<style>` block in `src/renderer/index.html`:

```html
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  /* Scrollbar styling */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #585b70; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/index.html
git commit -m "feat: add cursor blink animation and scrollbar styling"
```

---

### Task 17: End-to-End Verification

- [ ] **Step 1: Start dev server and verify**

Run: `cd /Users/xiong/Workplace/bot-aggregation && npm run dev`
Expected: Electron window opens showing the UI with sidebar, input bar, and three empty response cards

- [ ] **Step 2: Verify webviews load**

Check the Electron DevTools console for logs. Expected: Three "ready" status indicators (green dots) in the sidebar after pages load.

- [ ] **Step 3: Test query broadcast**

Type a question in the input bar and press Enter. Expected: All three cards show "回答中..." and stream responses from the AI services.

- [ ] **Step 4: Test original webview**

Click "查看原网页" on any card. Expected: The main UI is replaced by the AI's full web page. Click "← 返回" to go back.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete AI aggregator Mac app v1.0"
```
