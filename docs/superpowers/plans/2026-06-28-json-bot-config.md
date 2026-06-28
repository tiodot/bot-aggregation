# JSON Bot Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded bot definitions with a JSON-driven configuration system, enabling users to add/edit/remove AI bots through a Settings UI.

**Architecture:** Unified `bots` array in Zustand store replaces `aiServices` + `enabledBots`. A single `GenericAdapter` class reads config to handle different input types (textarea, contenteditable, slate-editor) and send methods (enter, click). Config syncs from renderer to main process via `bots-sync` IPC.

**Tech Stack:** Electron (main + renderer), Zustand with persist middleware, React, IPC via contextBridge

## Global Constraints

- Catppuccin Mocha dark theme: bg `#181825`, surface `#1e1e2e`, text `#cdd6f4`
- Bot `name` is the display key; `id` is the unique identifier (UUID)
- Persisted fields: `id`, `name`, `url`, `color`, `enabled`, `inputType`, `sendMethod`, `sendSelector`, `selectors`
- Runtime-only fields (not persisted): `status`, `response`, `error`
- `window.api` bridge exposes all IPC methods

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/adapters/generic.js` | GenericAdapter: config-driven adapter with template-based fill/send |
| `src/renderer/components/SettingsPanel.jsx` | Settings UI: bot list, add/edit form, import/export |

### Modified Files
| File | Changes |
|---|---|
| `src/renderer/store.js` | Replace `aiServices`+`enabledBots` with `bots` array; add `addBot`, `updateBot`, `removeBot`, `importBots`, `exportBots`; persist `bots` config; add `botsSync()` IPC call |
| `src/main/webviewManager.js` | Remove hardcoded adapter imports; accept bots config; use GenericAdapter; add `bots-sync` handler |
| `src/main/index.js` | Pass bots config to WebviewManager; register `bots-sync` IPC |
| `src/preload/index.js` | Add `botsSync()`, `botsGet()` to bridge |
| `src/renderer/App.jsx` | Update selectors from `aiServices`/`enabledBots` to `bots` |
| `src/renderer/components/AiSidebar.jsx` | Update selectors; wire Settings click to show SettingsPanel |
| `src/renderer/components/InputBar.jsx` | Update `clearResponses` to use `bots` |
| `src/renderer/components/ResponseCard.jsx` | Update to use bot shape from `bots` array |

---

### Task 1: Store Refactor — Unified `bots` Array

**Files:**
- Modify: `src/renderer/store.js`

**Interfaces:**
- Produces: `bots` array, `addBot(config)`, `updateBot(id, patch)`, `removeBot(id)`, `importBots(json)`, `exportBots()`, `toggleBot(name)`, `updateStatus(name, status)`, `updateChunk(name, chunk)`, `setError(name, error)`, `clearResponses()`, `recalcCardWidths()`

- [ ] **Step 1: Define default bot configs and replace store state**

Replace the entire `src/renderer/store.js` with:

```js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Generate a simple UUID
function uuid() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

const DEFAULT_BOTS = [
  {
    id: 'qwen-default',
    name: 'Qwen',
    url: 'https://www.qianwen.com/',
    color: '#89b4fa',
    enabled: true,
    inputType: 'slate-editor',
    sendMethod: 'click',
    sendSelector: "button[aria-label='发送消息']",
    selectors: {
      input: '[contenteditable="true"], textarea',
      response: '.message-content-container, .chat-message-content, [class*="markdown"], [class*="message-content"]',
      stopBtn: 'button[class*="stop"], [data-testid="chat-stop"], [class*="stop"], button[aria-label*="stop" i]',
    },
  },
  {
    id: 'deepseek-default',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    color: '#cba6f7',
    enabled: true,
    inputType: 'textarea',
    sendMethod: 'click',
    sendSelector: "div[role='button'][class*='ds-button']",
    selectors: {
      input: 'textarea#chat-input, textarea[placeholder], textarea',
      response: '.ds-assistant-message-main-content, .ds-markdown--block, .markdown-body, [class*="message-content"]',
      stopBtn: 'button[class*="stop"], [class*="stop-generating"], [class*="stop"]',
    },
  },
  {
    id: 'kimi-default',
    name: 'Kimi',
    url: 'https://kimi.moonshot.cn',
    color: '#fab387',
    enabled: true,
    inputType: 'contenteditable',
    sendMethod: 'click',
    sendSelector: '.send-button-container',
    selectors: {
      input: '[data-testid="msh-chatinput-editor"], .editor-content, [contenteditable="true"], textarea',
      response: '.chat-message-content, [class*="markdown"], [class*="message-text"]',
      stopBtn: 'button[class*="stop"], [data-testid*="stop"]',
    },
  },
];

const useStore = create(
  persist(
    (set, get) => ({
      // Unified bots array (config + runtime state)
      bots: DEFAULT_BOTS.map((bot) => ({
        ...bot,
        status: 'loading',
        response: '',
        error: null,
      })),

      // Sidebar collapsed state
      sidebarCollapsed: false,

      // Session state
      currentSessionId: null,
      sessions: [],
      showHistory: false,

      // Card widths (percentages) — indexed by bot id
      cardWidths: {},

      // ── Session actions ──
      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
      setSessions: (sessions) => set({ sessions }),
      toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),

      createSession: async (title) => {
        if (!window.api) return null;
        const session = await window.api.sessionCreate(title || '新对话');
        set({ currentSessionId: session.id });
        const sessions = await window.api.sessionList();
        set({ sessions });
        return session;
      },

      loadSession: async (sessionId) => {
        if (!window.api) return;
        const session = await window.api.sessionGet(sessionId);
        if (!session) return;
        set({ currentSessionId: sessionId });
        for (const bot of session.bots) {
          if (bot.session_url && bot.status !== 'error') {
            await window.api.navigateBot(bot.bot_name, bot.session_url);
          }
        }
      },

      deleteSession: async (sessionId) => {
        if (!window.api) return;
        await window.api.sessionDelete(sessionId);
        const state = get();
        if (state.currentSessionId === sessionId) {
          set({ currentSessionId: null });
        }
        const sessions = await window.api.sessionList();
        set({ sessions });
      },

      linkBotSession: async (botName, sessionUrl) => {
        const state = get();
        if (!state.currentSessionId || !window.api) return;
        await window.api.sessionLinkBot(state.currentSessionId, botName, sessionUrl);
      },

      refreshSessions: async () => {
        if (!window.api) return;
        const sessions = await window.api.sessionList();
        set({ sessions });
      },

      // ── Card width management ──
      recalcCardWidths: () => set((state) => {
        const enabledBots = state.bots.filter((b) => b.enabled);
        if (enabledBots.length === 0) return {};
        const equalWidth = 100 / enabledBots.length;
        const cardWidths = {};
        state.bots.forEach((bot) => {
          cardWidths[bot.id] = bot.enabled ? equalWidth : 0;
        });
        return { cardWidths };
      }),

      updateCardWidths: (widthsOrFn) => set((state) => ({
        cardWidths: typeof widthsOrFn === 'function' ? widthsOrFn(state.cardWidths) : widthsOrFn,
      })),

      // ── Sidebar ──
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // ── Bot management ──
      toggleBot: (name) => {
        let newEnabledValue = false;
        set((state) => {
          const bots = state.bots.map((bot) => {
            if (bot.name !== name) return bot;
            const newEnabled = !bot.enabled;
            newEnabledValue = newEnabled;
            return {
              ...bot,
              enabled: newEnabled,
              status: newEnabled ? 'loading' : 'disabled',
              error: null,
            };
          });

          const enabledBots = bots.filter((b) => b.enabled);
          const equalWidth = enabledBots.length > 0 ? 100 / enabledBots.length : 0;
          const cardWidths = {};
          bots.forEach((bot) => {
            cardWidths[bot.id] = bot.enabled ? equalWidth : 0;
          });

          return { bots, cardWidths };
        });

        if (window.api) {
          window.api.toggleBot(name, newEnabledValue);
        }
      },

      addBot: (config) => {
        const id = config.id || uuid();
        const newBot = {
          id,
          name: config.name,
          url: config.url,
          color: config.color || '#cdd6f4',
          enabled: true,
          inputType: config.inputType || 'textarea',
          sendMethod: config.sendMethod || 'enter',
          sendSelector: config.sendSelector || '',
          selectors: config.selectors,
          status: 'loading',
          response: '',
          error: null,
        };
        set((state) => {
          const bots = [...state.bots, newBot];
          // Recalc card widths
          const enabledBots = bots.filter((b) => b.enabled);
          const equalWidth = enabledBots.length > 0 ? 100 / enabledBots.length : 0;
          const cardWidths = {};
          bots.forEach((bot) => {
            cardWidths[bot.id] = bot.enabled ? equalWidth : 0;
          });
          return { bots, cardWidths };
        });
        // Sync to main process
        get().syncBotsToMain();
        return id;
      },

      updateBot: (id, patch) => {
        set((state) => ({
          bots: state.bots.map((bot) =>
            bot.id === id ? { ...bot, ...patch } : bot
          ),
        }));
        get().syncBotsToMain();
      },

      removeBot: (id) => {
        set((state) => {
          const bots = state.bots.filter((bot) => bot.id !== id);
          const enabledBots = bots.filter((b) => b.enabled);
          const equalWidth = enabledBots.length > 0 ? 100 / enabledBots.length : 0;
          const cardWidths = {};
          bots.forEach((bot) => {
            cardWidths[bot.id] = bot.enabled ? equalWidth : 0;
          });
          return { bots, cardWidths };
        });
        get().syncBotsToMain();
      },

      importBots: (jsonString) => {
        try {
          const imported = JSON.parse(jsonString);
          if (!Array.isArray(imported)) throw new Error('Expected JSON array');
          set((state) => {
            const existingNames = new Set(state.bots.map((b) => b.name));
            const newBots = imported
              .filter((b) => b.name && b.url && b.selectors)
              .map((b) => ({
                id: b.id || uuid(),
                name: b.name,
                url: b.url,
                color: b.color || '#cdd6f4',
                enabled: b.enabled !== false,
                inputType: b.inputType || 'textarea',
                sendMethod: b.sendMethod || 'enter',
                sendSelector: b.sendSelector || '',
                selectors: b.selectors,
                status: 'loading',
                response: '',
                error: null,
              }));

            // Upsert by name
            const bots = [...state.bots];
            for (const newBot of newBots) {
              const idx = bots.findIndex((b) => b.name === newBot.name);
              if (idx >= 0) {
                bots[idx] = { ...bots[idx], ...newBot, id: bots[idx].id };
              } else {
                bots.push(newBot);
              }
            }

            const enabledBots = bots.filter((b) => b.enabled);
            const equalWidth = enabledBots.length > 0 ? 100 / enabledBots.length : 0;
            const cardWidths = {};
            bots.forEach((bot) => {
              cardWidths[bot.id] = bot.enabled ? equalWidth : 0;
            });

            return { bots, cardWidths };
          });
          get().syncBotsToMain();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },

      exportBots: () => {
        const state = get();
        const configs = state.bots.map(({ status, response, error, ...config }) => config);
        return JSON.stringify(configs, null, 2);
      },

      // ── Runtime state updates ──
      updateStatus: (name, status) => set((state) => ({
        bots: state.bots.map((bot) =>
          bot.name === name ? { ...bot, status, error: status === 'error' ? bot.error : null } : bot
        ),
      })),

      updateChunk: (name, chunk) => set((state) => ({
        bots: state.bots.map((bot) =>
          bot.name === name ? { ...bot, response: chunk } : bot
        ),
      })),

      setError: (name, error) => set((state) => ({
        bots: state.bots.map((bot) =>
          bot.name === name ? { ...bot, error, status: 'error' } : bot
        ),
      })),

      clearResponses: () => set((state) => ({
        bots: state.bots.map((bot) => ({ ...bot, response: '', error: null })),
      })),

      // ── IPC sync ──
      syncBotsToMain: () => {
        if (!window.api) return;
        const state = get();
        const configs = state.bots.map(({ status, response, error, ...config }) => config);
        window.api.botsSync(configs);
      },
    }),
    {
      name: 'bot-aggregation-settings',
      partialize: (state) => ({
        bots: state.bots.map(({ status, response, error, ...config }) => config),
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      merge: (persisted, current) => {
        // Merge persisted bot configs with runtime defaults
        const persistedBots = persisted?.bots || [];
        const bots = (Array.isArray(persistedBots) && persistedBots.length > 0
          ? persistedBots
          : DEFAULT_BOTS
        ).map((config) => ({
          ...config,
          status: 'loading',
          response: '',
          error: null,
        }));
        return {
          ...current,
          ...persisted,
          bots,
        };
      },
    }
  )
);

export default useStore;
```

- [ ] **Step 2: Verify store compiles**

Run: `npm run dev`
Expected: App starts without errors. The renderer loads with the 3 default bots.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/store.js
git commit -m "refactor: replace aiServices+enabledBots with unified bots array"
```

---

### Task 2: Update Renderer Components

**Files:**
- Modify: `src/renderer/App.jsx`
- Modify: `src/renderer/components/AiSidebar.jsx`
- Modify: `src/renderer/components/InputBar.jsx`
- Modify: `src/renderer/components/ResponseCard.jsx`

**Interfaces:**
- Consumes: `bots` array from store (replaces `aiServices` + `enabledBots`)
- Consumes: `cardWidths` keyed by `bot.id` (replaces array index)

- [ ] **Step 1: Update App.jsx**

Replace `src/renderer/App.jsx` with:

```jsx
import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import useStore from './store';
import AiSidebar from './components/AiSidebar';
import InputBar from './components/InputBar';
import ResponseCard from './components/ResponseCard';
import DragDivider from './components/DragDivider';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#11111b',
    color: '#cdd6f4',
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    fontSize: 13,
    lineHeight: 1.5,
    WebkitFontSmoothing: 'antialiased',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  cards: {
    flex: 1,
    display: 'flex',
    padding: '0 10px 10px 10px',
    gap: 0,
    overflow: 'hidden',
  },
};

export default function App() {
  const bots = useStore((s) => s.bots);
  const cardWidths = useStore((s) => s.cardWidths);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const updateCardWidths = useStore((s) => s.updateCardWidths);
  const recalcCardWidths = useStore((s) => s.recalcCardWidths);
  const refreshSessions = useStore((s) => s.refreshSessions);
  const syncBotsToMain = useStore((s) => s.syncBotsToMain);
  const sidebarRef = useRef(null);
  const updateStatus = useStore((s) => s.updateStatus);
  const updateChunk = useStore((s) => s.updateChunk);
  const setError = useStore((s) => s.setError);
  const cardRefs = useRef({});

  // Filter to only enabled bots
  const enabledBots = useMemo(
    () => bots.filter((b) => b.enabled),
    [bots]
  );

  // Restore persisted bot states to main process on mount
  useEffect(() => {
    recalcCardWidths();
    // Sync full config to main process
    syncBotsToMain();
    if (!window.api) return;
    bots.forEach((bot) => {
      if (!bot.enabled) {
        window.api.toggleBot(bot.name, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for IPC events from main process
  useEffect(() => {
    if (!window.api) return;
    const unsubscribe = window.api.onAiEvent((event) => {
      const { name, type, data } = event;
      if (type === 'status') updateStatus(name, data);
      else if (type === 'chunk') updateChunk(name, data);
      else if (type === 'error') setError(name, data);
      else if (type === 'session-updated') refreshSessions();
    });
    return unsubscribe;
  }, [updateStatus, updateChunk, setError, refreshSessions]);

  // Report all card rects to main process
  const reportAllRects = useCallback(() => {
    if (!window.api) return;
    const rects = {};
    enabledBots.forEach((bot) => {
      const el = cardRefs.current[bot.name];
      if (el) {
        const bodyEl = el.querySelector('[data-card-body]') || el.lastChild;
        if (bodyEl) {
          const rect = bodyEl.getBoundingClientRect();
          rects[bot.name] = {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }
      }
    });
    if (Object.keys(rects).length > 0) {
      window.api.updateCardRects(rects);
    }
  }, [enabledBots]);

  // Report rects on mount
  useEffect(() => {
    const timer = setTimeout(reportAllRects, 500);
    return () => clearTimeout(timer);
  }, [reportAllRects]);

  // Report rects when card widths or enabled bots change
  useEffect(() => {
    const timer = setTimeout(reportAllRects, 250);
    return () => clearTimeout(timer);
  }, [cardWidths, bots, sidebarCollapsed, reportAllRects]);

  // Re-report rects when sidebar transition finishes
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const onTransitionEnd = (e) => {
      if (e.propertyName !== 'width' || e.target !== el) return;
      reportAllRects();
    };
    el.addEventListener('transitionend', onTransitionEnd);
    return () => el.removeEventListener('transitionend', onTransitionEnd);
  }, [reportAllRects]);

  // Observe cards container resize
  useEffect(() => {
    const container = document.querySelector('[data-cards-container]');
    if (!container) return;
    let debounceTimer = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(reportAllRects, 50);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
    };
  }, [reportAllRects]);

  // Handle drag divider — adjust widths of adjacent enabled cards
  const handleDrag = useCallback((enabledIdx, dx) => {
    const container = document.querySelector('[data-cards-container]');
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const deltaPercent = (dx / containerWidth) * 100;
    const leftBot = enabledBots[enabledIdx];
    const rightBot = enabledBots[enabledIdx + 1];

    updateCardWidths((prev) => {
      const next = { ...prev };
      const minPercent = 10;
      let leftNew = (next[leftBot.id] || 33) + deltaPercent;
      let rightNew = (next[rightBot.id] || 33) - deltaPercent;
      if (leftNew < minPercent) { rightNew += leftNew - minPercent; leftNew = minPercent; }
      if (rightNew < minPercent) { leftNew += rightNew - minPercent; rightNew = minPercent; }
      next[leftBot.id] = leftNew;
      next[rightBot.id] = rightNew;
      return next;
    });
  }, [updateCardWidths, enabledBots]);

  const setCardRef = useCallback((name, el) => {
    if (el) cardRefs.current[name] = el;
  }, []);

  return (
    <div style={styles.app}>
      <AiSidebar ref={sidebarRef} />
      <div style={styles.main}>
        <InputBar />
        <div style={styles.cards} data-cards-container>
          {enabledBots.map((bot, i) => (
            <React.Fragment key={bot.id}>
              {i > 0 && (
                <DragDivider
                  onDrag={(dx) => handleDrag(i - 1, dx)}
                  onDragEnd={reportAllRects}
                />
              )}
              <div
                style={{
                  flex: `0 0 ${cardWidths[bot.id] || 33.33}%`,
                  display: 'flex',
                  minWidth: 0,
                }}
                ref={(el) => setCardRef(bot.name, el)}
              >
                <ResponseCard
                  ai={bot}
                  onRect={(name, rect) => {
                    if (window.api) window.api.updateCardRects({ [name]: rect });
                  }}
                />
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update AiSidebar.jsx selectors**

In `src/renderer/components/AiSidebar.jsx`, update the store selectors. Find and replace:

```js
// OLD
const aiServices = useStore((st) => st.aiServices);
const enabledBots = useStore((st) => st.enabledBots);

// NEW
const bots = useStore((st) => st.bots);
```

Then update the JSX to use `bots` instead of `aiServices`, and `bot.enabled` instead of `enabledBots[bot.name]`:

```jsx
// In the Services section, replace:
{aiServices.map((ai) => {
  const enabled = enabledBots[ai.name];
  const initial = ai.name.charAt(0);
  return (
    <div key={ai.name} style={s.botItem(collapsed)} onClick={() => handleClick(ai.name)} ...>
// With:
{bots.map((bot) => {
  const initial = bot.name.charAt(0);
  return (
    <div key={bot.id} style={s.botItem(collapsed)} onClick={() => handleClick(bot.name)} ...>
```

Update all `ai.` references to `bot.` and `enabled` to `bot.enabled`:

```jsx
{/* Brand accent bar (expanded only) */}
{!collapsed && <div style={s.botAccent(bot.color, bot.enabled)} />}

{/* Initial badge */}
<div style={s.botBadge(bot.color, collapsed)}>
  <span style={s.botBadgeLetter(bot.color)}>{initial}</span>
</div>

{/* Name + status (expanded only) */}
{!collapsed && (
  <div style={s.botInfo(false)}>
    <span style={s.botName}>{bot.name}</span>
    <span style={s.botStatus(bot.color, bot.status)}>
      {bot.enabled ? STATUS_LABEL[bot.status] || bot.status : 'Disabled'}
    </span>
  </div>
)}

{/* Toggle (expanded only) */}
{!collapsed && (
  <button
    style={s.toggle(bot.enabled)}
    onClick={(e) => { e.stopPropagation(); handleClick(bot.name); }}
  >
    <span style={s.toggleDot(bot.enabled)} />
  </button>
)}
```

- [ ] **Step 3: Update InputBar.jsx**

In `src/renderer/components/InputBar.jsx`, find `clearResponses` usage. The store function signature is unchanged, so no code changes needed — just verify it still works.

- [ ] **Step 4: Update ResponseCard.jsx**

In `src/renderer/components/ResponseCard.jsx`, verify the `ai` prop still has the same shape: `{ name, color, status, response, error }`. No changes needed since the `bots` array items have these same fields.

- [ ] **Step 5: Verify app renders correctly**

Run: `npm run dev`
Expected: App starts, 3 bots appear in sidebar, cards render for enabled bots.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/
git commit -m "refactor: update renderer components to use unified bots array"
```

---

### Task 3: Update Preload Bridge

**Files:**
- Modify: `src/preload/index.js`

**Interfaces:**
- Produces: `window.api.botsSync(configs)`, `window.api.botsGet()`

- [ ] **Step 1: Add bots-sync and bots-get to preload**

In `src/preload/index.js`, add these methods to the `contextBridge.exposeInMainWorld` call:

```js
// Add after the existing toggleBot line:
botsSync: (configs) => ipcRenderer.invoke('bots-sync', configs),
botsGet: () => ipcRenderer.invoke('bots-get'),
```

- [ ] **Step 2: Verify preload compiles**

Run: `npm run dev`
Expected: No errors. `window.api.botsSync` is defined.

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.js
git commit -m "feat: add botsSync and botsGet to preload bridge"
```

---

### Task 4: Create GenericAdapter

**Files:**
- Create: `src/adapters/generic.js`

**Interfaces:**
- Extends: `BaseAdapter` from `./base`
- Constructor: `new GenericAdapter(config)` where config has `{ name, url, inputType, sendMethod, sendSelector, selectors }`
- Produces: `selectors` getter, `_fillInput()`, `_clickSendButton()`

- [ ] **Step 1: Create GenericAdapter**

Create `src/adapters/generic.js`:

```js
const BaseAdapter = require('./base');

class GenericAdapter extends BaseAdapter {
  constructor(config) {
    super(config.name, config.url);
    this.config = config;
  }

  get selectors() {
    return {
      input: this.config.selectors.input || '',
      response: this.config.selectors.response || '',
      stopBtn: this.config.selectors.stopBtn || '',
    };
  }

  /**
   * Fill input based on inputType template.
   * - textarea: native value setter + React input event
   * - contenteditable: execCommand('insertText')
   * - slate-editor: InputEvent + DataTransfer
   */
  async _fillInput(webContents, query) {
    const inputSel = this.config.selectors.input;
    const inputType = this.config.inputType || 'textarea';

    return webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(inputSel.split(', '))};
        let input = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) break;
        }
        if (!input) {
          return { ok: false, error: 'Input not found: ' + selectors.join(', ') };
        }

        input.focus();
        const text = ${JSON.stringify(query)};
        const inputType = '${inputType}';

        if (inputType === 'slate-editor') {
          // Slate editor: find the right contenteditable element
          let editor = input;
          if (input.tagName === 'TEXTAREA') {
            const editables = document.querySelectorAll('[contenteditable="true"]');
            for (const el of editables) {
              if (el.offsetHeight < 200 && el.offsetHeight > 10) { editor = el; break; }
            }
          }
          editor.focus();
          document.execCommand('selectAll');

          const dt = new DataTransfer();
          dt.setData('text/plain', text);
          editor.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true,
            inputType: 'insertText', data: text, dataTransfer: dt,
          }));
          editor.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'insertText', data: text,
          }));

          // Fallback if DataTransfer didn't work
          const current = editor.innerText || '';
          if (!current.includes(text.substring(0, 20))) {
            document.execCommand('insertText', false, text);
          }
        } else if (inputType === 'contenteditable') {
          // Contenteditable: execCommand
          document.execCommand('selectAll');
          document.execCommand('insertText', false, text);
        } else {
          // textarea: native value setter + React event
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          if (setter) setter.call(input, text);
          else input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const val = input.value || input.innerText || '';
        return { ok: true, valueLength: val?.length || 0 };
      })()
    `);
  }

  /**
   * Click send button based on config.
   * If sendMethod is 'click' and sendSelector is set, query and click.
   * Otherwise return false (fallback to Enter key in base class).
   */
  async _clickSendButton(webContents) {
    if (this.config.sendMethod === 'click' && this.config.sendSelector) {
      const selector = this.config.sendSelector;
      return webContents.executeJavaScript(`
        (() => {
          const selectors = ${JSON.stringify(selector.split(', '))};
          for (const sel of selectors) {
            const btns = document.querySelectorAll(sel.trim());
            for (const btn of btns) {
              if (!btn.disabled && !btn.classList.contains('disabled') && !btn.classList.contains('cursor-not-allowed')) {
                btn.click();
                return true;
              }
            }
          }
          // Force-enable and click first match
          for (const sel of selectors) {
            const btn = document.querySelector(sel.trim());
            if (btn) {
              btn.removeAttribute('disabled');
              btn.disabled = false;
              btn.classList.remove('disabled', 'cursor-not-allowed');
              btn.style.cursor = 'pointer';
              btn.click();
              return true;
            }
          }
          return false;
        })()
      `);
    }
    return false;
  }
}

module.exports = GenericAdapter;
```

- [ ] **Step 2: Verify GenericAdapter loads**

Run: `node -e "const GA = require('./src/adapters/generic'); console.log('OK', typeof GA)"`
Expected: `OK function`

- [ ] **Step 3: Commit**

```bash
git add src/adapters/generic.js
git commit -m "feat: add GenericAdapter with template-based fill/send"
```

---

### Task 5: Update WebviewManager to Use Config-Driven Adapters

**Files:**
- Modify: `src/main/webviewManager.js`
- Modify: `src/main/index.js`

**Interfaces:**
- Consumes: `GenericAdapter` from `../adapters/generic`
- Consumes: bots config array via constructor or IPC
- Produces: `bots-sync` IPC handler, `rebuildFromConfig(configs)` method

- [ ] **Step 1: Update WebviewManager**

Replace `src/main/webviewManager.js` with:

```js
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
    this._currentSessionId = null;

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
      console.log(`[${adapter.name}] ✅ Ready!`);
      this._notifyRenderer(adapter.name, 'status', 'ready');

      if (this._cardRects[adapter.name] && entry.userEnabled) {
        this._showView(adapter.name);
      }
    } catch (err) {
      console.error(`[${adapter.name}] ❌ Not ready:`, err.message);
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
```

- [ ] **Step 2: Update main/index.js**

In `src/main/index.js`, update the `did-finish-load` handler to pass bots config to WebviewManager:

```js
mainWindow.webContents.on('did-finish-load', () => {
  sessionManager = new SessionManager();
  webviewManager = new WebviewManager(mainWindow, sessionManager);
  // Initialize with empty config — renderer will send bots-sync shortly
  webviewManager.initialize([]).catch(console.error);
  registerSessionIpc();
});
```

- [ ] **Step 3: Verify app starts**

Run: `npm run dev`
Expected: App starts. Main process logs show "Initializing with 0 adapters". After renderer loads and sends bots-sync, adapters rebuild.

- [ ] **Step 4: Commit**

```bash
git add src/main/webviewManager.js src/main/index.js
git commit -m "feat: config-driven WebviewManager with GenericAdapter and bots-sync"
```

---

### Task 6: Create SettingsPanel Component

**Files:**
- Create: `src/renderer/components/SettingsPanel.jsx`

**Interfaces:**
- Consumes: `bots`, `addBot`, `updateBot`, `removeBot`, `importBots`, `exportBots` from store
- Produces: `SettingsPanel` React component with bot list, add/edit form, import/export

- [ ] **Step 1: Create SettingsPanel component**

Create `src/renderer/components/SettingsPanel.jsx`:

```jsx
import React, { useState, useCallback } from 'react';
import useStore from '../store';

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#181825',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 16px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
    borderBottom: '1px solid #1e1e2e',
  },
  backBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#585b70',
    cursor: 'pointer',
    fontSize: 16,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#cdd6f4',
  },
  toolbar: {
    padding: '8px 16px',
    display: 'flex',
    gap: 8,
    flexShrink: 0,
    borderBottom: '1px solid #1e1e2e',
  },
  toolBtn: {
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 500,
    borderRadius: 6,
    border: '1px solid #313244',
    backgroundColor: 'transparent',
    color: '#a6adc8',
    cursor: 'pointer',
    transition: 'all 0.1s',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  botRow: {
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  },
  botRowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  botDot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  }),
  botName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#bac2de',
    flex: 1,
  },
  botMeta: {
    fontSize: 10,
    color: '#585b70',
    paddingLeft: 16,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  actionBtn: {
    padding: '2px 6px',
    fontSize: 10,
    borderRadius: 4,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#585b70',
    cursor: 'pointer',
    transition: 'color 0.1s',
  },
  deleteBtn: {
    padding: '2px 6px',
    fontSize: 10,
    borderRadius: 4,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#585b70',
    cursor: 'pointer',
  },
  form: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: '#585b70',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    fontSize: 12,
    color: '#cdd6f4',
    backgroundColor: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 6,
    outline: 'none',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    padding: '6px 10px',
    fontSize: 12,
    color: '#cdd6f4',
    backgroundColor: '#1e1e2e',
    border: '1px solid #313244',
    borderRadius: 6,
    outline: 'none',
    fontFamily: 'inherit',
  },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  colorInput: {
    width: 32,
    height: 32,
    padding: 0,
    border: '1px solid #313244',
    borderRadius: 6,
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  formActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTop: '1px solid #1e1e2e',
    marginTop: 'auto',
  },
  cancelBtn: {
    padding: '6px 16px',
    fontSize: 12,
    borderRadius: 6,
    border: '1px solid #313244',
    backgroundColor: 'transparent',
    color: '#a6adc8',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '6px 16px',
    fontSize: 12,
    borderRadius: 6,
    border: 'none',
    backgroundColor: '#89b4fa',
    color: '#1e1e2e',
    fontWeight: 600,
    cursor: 'pointer',
  },
  importModal: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  importBox: {
    width: 360,
    backgroundColor: '#1e1e2e',
    borderRadius: 10,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    border: '1px solid #313244',
  },
  textarea: {
    width: '100%',
    height: 160,
    padding: '8px 10px',
    fontSize: 11,
    color: '#cdd6f4',
    backgroundColor: '#181825',
    border: '1px solid #313244',
    borderRadius: 6,
    outline: 'none',
    fontFamily: 'monospace',
    resize: 'vertical',
  },
  toast: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 16px',
    fontSize: 12,
    borderRadius: 6,
    backgroundColor: '#a6e3a1',
    color: '#1e1e2e',
    fontWeight: 500,
    zIndex: 20,
  },
};

const EMPTY_FORM = {
  name: '',
  url: '',
  color: '#cdd6f4',
  inputType: 'textarea',
  sendMethod: 'enter',
  sendSelector: '',
  inputSelector: '',
  responseSelector: '',
  stopBtnSelector: '',
};

export default function SettingsPanel({ onClose }) {
  const bots = useStore((st) => st.bots);
  const addBot = useStore((st) => st.addBot);
  const updateBot = useStore((st) => st.updateBot);
  const removeBot = useStore((st) => st.removeBot);
  const importBots = useStore((st) => st.importBots);
  const exportBots = useStore((st) => st.exportBots);

  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleEdit = useCallback((bot) => {
    setEditingId(bot.id);
    setForm({
      name: bot.name,
      url: bot.url,
      color: bot.color,
      inputType: bot.inputType || 'textarea',
      sendMethod: bot.sendMethod || 'enter',
      sendSelector: bot.sendSelector || '',
      inputSelector: bot.selectors?.input || '',
      responseSelector: bot.selectors?.response || '',
      stopBtnSelector: bot.selectors?.stopBtn || '',
    });
    setView('edit');
  }, []);

  const handleAdd = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setView('add');
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.url.trim() || !form.inputSelector.trim() || !form.responseSelector.trim()) {
      showToast('Please fill required fields');
      return;
    }
    const config = {
      name: form.name.trim(),
      url: form.url.trim(),
      color: form.color,
      inputType: form.inputType,
      sendMethod: form.sendMethod,
      sendSelector: form.sendSelector.trim(),
      selectors: {
        input: form.inputSelector.trim(),
        response: form.responseSelector.trim(),
        stopBtn: form.stopBtnSelector.trim(),
      },
    };

    if (view === 'edit' && editingId) {
      updateBot(editingId, config);
      showToast('Bot updated');
    } else {
      addBot(config);
      showToast('Bot added');
    }
    setView('list');
  }, [form, view, editingId, addBot, updateBot, showToast]);

  const handleDelete = useCallback((id, name) => {
    if (window.confirm(`Delete "${name}"?`)) {
      removeBot(id);
      showToast('Bot removed');
    }
  }, [removeBot, showToast]);

  const handleExport = useCallback(() => {
    const json = exportBots();
    navigator.clipboard.writeText(json).then(() => {
      showToast('Copied to clipboard');
    }).catch(() => {
      // Fallback: show in import modal
      setImportText(json);
      setShowImport(true);
    });
  }, [exportBots, showToast]);

  const handleImport = useCallback(() => {
    const result = importBots(importText);
    if (result.ok) {
      showToast('Bots imported');
      setShowImport(false);
      setImportText('');
    } else {
      showToast('Import failed: ' + result.error);
    }
  }, [importText, importBots, showToast]);

  const update = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── List view ──
  if (view === 'list') {
    return (
      <div style={s.panel}>
        <div style={s.header}>
          <button style={s.backBtn} onClick={onClose} onMouseEnter={(e) => { e.currentTarget.style.color = '#cdd6f4'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#585b70'; }}>←</button>
          <span style={s.headerTitle}>Bot Settings</span>
        </div>
        <div style={s.toolbar}>
          <button style={s.toolBtn} onClick={handleAdd} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#89b4fa'; e.currentTarget.style.color = '#cdd6f4'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#313244'; e.currentTarget.style.color = '#a6adc8'; }}>+ Add Bot</button>
          <button style={s.toolBtn} onClick={() => setShowImport(true)} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#89b4fa'; e.currentTarget.style.color = '#cdd6f4'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#313244'; e.currentTarget.style.color = '#a6adc8'; }}>Import</button>
          <button style={s.toolBtn} onClick={handleExport} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#89b4fa'; e.currentTarget.style.color = '#cdd6f4'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#313244'; e.currentTarget.style.color = '#a6adc8'; }}>Export</button>
        </div>
        <div style={s.list}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              style={s.botRow}
              onClick={() => handleEdit(bot)}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e1e2e'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={s.botRowTop}>
                <span style={s.botDot(bot.color)} />
                <span style={s.botName}>{bot.name}</span>
                <button
                  style={s.deleteBtn}
                  onClick={(e) => { e.stopPropagation(); handleDelete(bot.id, bot.name); }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f38ba8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#585b70'; }}
                >×</button>
              </div>
              <div style={s.botMeta}>{bot.url}</div>
              <div style={s.botMeta}>{bot.inputType} · {bot.sendMethod}</div>
            </div>
          ))}
        </div>
        {showImport && (
          <div style={s.importModal} onClick={() => setShowImport(false)}>
            <div style={s.importBox} onClick={(e) => e.stopPropagation()}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#cdd6f4' }}>Import Bots</span>
              <textarea
                style={s.textarea}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste JSON config here..."
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={s.cancelBtn} onClick={() => setShowImport(false)}>Cancel</button>
                <button style={s.saveBtn} onClick={handleImport}>Import</button>
              </div>
            </div>
          </div>
        )}
        {toast && <div style={s.toast}>{toast}</div>}
      </div>
    );
  }

  // ── Add/Edit form ──
  return (
    <div style={s.panel}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => setView('list')} onMouseEnter={(e) => { e.currentTarget.style.color = '#cdd6f4'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#585b70'; }}>←</button>
        <span style={s.headerTitle}>{view === 'edit' ? 'Edit Bot' : 'Add New Bot'}</span>
      </div>
      <div style={s.form}>
        <div>
          <div style={s.label}>Name *</div>
          <input style={s.input} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="My Bot" />
        </div>
        <div>
          <div style={s.label}>URL *</div>
          <input style={s.input} value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://chat.example.com" />
        </div>
        <div>
          <div style={s.label}>Color</div>
          <div style={s.colorRow}>
            <input type="color" style={s.colorInput} value={form.color} onChange={(e) => update('color', e.target.value)} />
            <span style={{ fontSize: 12, color: '#a6adc8' }}>{form.color}</span>
          </div>
        </div>
        <div>
          <div style={s.label}>Input Type</div>
          <select style={s.select} value={form.inputType} onChange={(e) => update('inputType', e.target.value)}>
            <option value="textarea">textarea</option>
            <option value="contenteditable">contenteditable</option>
            <option value="slate-editor">slate-editor</option>
          </select>
        </div>
        <div>
          <div style={s.label}>Send Method</div>
          <select style={s.select} value={form.sendMethod} onChange={(e) => update('sendMethod', e.target.value)}>
            <option value="enter">enter</option>
            <option value="click">click</option>
          </select>
        </div>
        {form.sendMethod === 'click' && (
          <div>
            <div style={s.label}>Send Selector</div>
            <input style={s.input} value={form.sendSelector} onChange={(e) => update('sendSelector', e.target.value)} placeholder="button.send" />
          </div>
        )}
        <div>
          <div style={s.label}>Input Selector *</div>
          <input style={s.input} value={form.inputSelector} onChange={(e) => update('inputSelector', e.target.value)} placeholder="textarea, [contenteditable]" />
        </div>
        <div>
          <div style={s.label}>Response Selector *</div>
          <input style={s.input} value={form.responseSelector} onChange={(e) => update('responseSelector', e.target.value)} placeholder=".response-container" />
        </div>
        <div>
          <div style={s.label}>Stop Button Selector</div>
          <input style={s.input} value={form.stopBtnSelector} onChange={(e) => update('stopBtnSelector', e.target.value)} placeholder="button[class*='stop']" />
        </div>
        <div style={s.formActions}>
          <button style={s.cancelBtn} onClick={() => setView('list')}>Cancel</button>
          <button style={s.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run: `npm run dev`
Expected: No import errors for SettingsPanel.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SettingsPanel.jsx
git commit -m "feat: add SettingsPanel with bot list, add/edit form, import/export"
```

---

### Task 7: Wire Settings Panel into Sidebar

**Files:**
- Modify: `src/renderer/components/AiSidebar.jsx`

**Interfaces:**
- Consumes: `SettingsPanel` component
- Produces: Settings click opens SettingsPanel, Back button closes it

- [ ] **Step 1: Add Settings panel state and rendering**

In `src/renderer/components/AiSidebar.jsx`, add import and state:

```jsx
// Add import at top:
import SettingsPanel from './SettingsPanel';

// Add state inside the component:
const [showSettings, setShowSettings] = useState(false);
```

Add `useState` to the React import.

Replace the Settings row and collapse button at the bottom of the sidebar with:

```jsx
{/* ── Footer ── */}
<div style={s.footer} />
{showSettings ? (
  <SettingsPanel onClose={() => setShowSettings(false)} />
) : (
  <>
    <div
      style={s.settingsRow(collapsed)}
      onClick={() => setShowSettings(true)}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#a6adc8'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#45475a'; }}
    >
      <span style={{ fontSize: 14 }}>⚙</span>
      {!collapsed && <span>Settings</span>}
    </div>
    <div style={s.collapseRow(collapsed)}>
      <button
        style={s.collapseBtn(collapsed)}
        onClick={toggleSidebar}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e1e2e'; e.currentTarget.style.color = '#cdd6f4'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#585b70'; }}
      >
        {collapsed ? '»' : '«'}
      </button>
    </div>
  </>
)}
```

- [ ] **Step 2: Verify Settings opens**

Run: `npm run dev`
Expected: Click "Settings" in sidebar footer → sidebar content switches to SettingsPanel with bot list. Click "←" returns to normal sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/AiSidebar.jsx
git commit -m "feat: wire SettingsPanel into sidebar footer"
```

---

### Task 8: Verify End-to-End Flow

**Files:**
- None (verification only)

- [ ] **Step 1: Test full flow**

Run: `npm run dev`

Verify:
1. App starts with 3 default bots (Qwen, DeepSeek, Kimi)
2. Click Settings → bot list shows all 3
3. Click "+ Add Bot" → fill form → Save → new bot appears in list
4. Click Edit on existing bot → modify → Save → changes persist
5. Click × on a bot → confirm → bot removed
6. Click Export → JSON copied to clipboard
7. Click Import → paste JSON → bots imported
8. Reload app → changes persist (localStorage)

- [ ] **Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: end-to-end verification fixes"
```

---

### Task 9: Cleanup Old Adapters

**Files:**
- Delete: `src/adapters/qwen.js`
- Delete: `src/adapters/deepseek.js`
- Delete: `src/adapters/kimi.js`

- [ ] **Step 1: Remove old adapter files**

```bash
rm src/adapters/qwen.js src/adapters/deepseek.js src/adapters/kimi.js
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "qwen\|deepseek\|kimi" src/ --include="*.js" --include="*.jsx" | grep -v "node_modules" | grep -v "DEFAULT_BOTS"
```

Expected: No results (all references removed).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old adapter files, now replaced by GenericAdapter"
```
