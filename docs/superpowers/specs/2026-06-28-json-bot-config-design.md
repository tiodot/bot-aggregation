# JSON Bot Configuration Design

**Date:** 2026-06-28
**Status:** Draft

## Problem

Adding a new AI bot currently requires editing 3 separate files (adapter class, webviewManager.js, store.js) and keeping them in sync manually. This is error-prone and not user-friendly. Users should be able to add, edit, and remove bots through a UI without touching code.

## Goals

1. All bot definitions stored in a single JSON configuration
2. Users can add/edit/remove bots through a Settings UI
3. Config can be imported/exported as JSON for sharing
4. Existing 3 bots (Qwen, DeepSeek, Kimi) continue to work
5. Support both simple bots (textarea + button) and complex bots (Slate, contenteditable)

## Non-Goals

- Runtime plugin loading from external files
- Custom JavaScript snippets in config (deferred to future)
- Remote config fetching

---

## 1. Bot Configuration Schema

Each bot is defined by a config object:

```json
{
  "id": "qwen-001",
  "name": "Qwen",
  "url": "https://www.qianwen.com/",
  "color": "#89b4fa",
  "inputType": "slate-editor",
  "sendMethod": "click",
  "sendSelector": "button[class*='send']",
  "selectors": {
    "input": "[contenteditable='true'], textarea",
    "response": ".message-content-container, [class*='markdown']",
    "stopBtn": "button[class*='stop']"
  }
}
```

### Field Definitions

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | auto | UUID | Unique identifier |
| `name` | string | yes | — | Display name, used as key |
| `url` | string | yes | — | AI service URL |
| `color` | string | no | `#cdd6f4` | Hex color for UI |
| `enabled` | boolean | no | `true` | Whether bot is active |
| `inputType` | enum | no | `textarea` | Input element type template |
| `sendMethod` | enum | no | `enter` | How to send the query |
| `sendSelector` | string | if click | — | CSS selector for send button |
| `selectors.input` | string | yes | — | Input element selector (comma = fallback) |
| `selectors.response` | string | yes | — | Response container selector |
| `selectors.stopBtn` | string | no | — | Stop button selector |

### Input Type Templates

| Template | Fill Logic | Use Case |
|---|---|---|
| `textarea` | Native value setter + React `input` event dispatch | Standard `<textarea>` elements |
| `contenteditable` | `document.execCommand('insertText', false, query)` | Contenteditable divs (Kimi) |
| `slate-editor` | `InputEvent('beforeinput')` + `DataTransfer` | Slate-based editors (Qwen) |

### Send Methods

| Method | Behavior |
|---|---|
| `enter` | Dispatch `keydown` + `keyup` for Enter key |
| `click` | Query `sendSelector` and click the element |

### Existing Bot Configs

| Bot | inputType | sendMethod | sendSelector |
|---|---|---|---|
| Qwen | `slate-editor` | `click` | `button[class*='send']` |
| DeepSeek | `textarea` | `click` | `div[role='button']` |
| Kimi | `contenteditable` | `click` | `.send-button-container` |

---

## 2. Store Changes

### Current Structure (Two Data Sources)

```js
aiServices: [
  { name: 'Qwen', color: '#89b4fa', status: 'loading', response: '', error: null },
  { name: 'DeepSeek', color: '#cba6f7', status: 'loading', response: '', error: null },
  { name: 'Kimi', color: '#fab387', status: 'loading', response: '', error: null },
],
enabledBots: { Qwen: true, DeepSeek: true, Kimi: true },
```

### New Structure (Single Source of Truth)

```js
bots: [
  {
    id: 'qwen-001',
    name: 'Qwen',
    url: 'https://www.qianwen.com/',
    color: '#89b4fa',
    enabled: true,
    inputType: 'slate-editor',
    sendMethod: 'click',
    sendSelector: "button[class*='send']",
    selectors: { input: '...', response: '...', stopBtn: '...' },
    // Runtime state (not persisted)
    status: 'loading',
    response: '',
    error: null,
  },
  // ... DeepSeek, Kimi
],
```

### Persisted vs Runtime Fields

**Persisted to localStorage:** `id`, `name`, `url`, `color`, `enabled`, `inputType`, `sendMethod`, `sendSelector`, `selectors`

**Runtime only (not persisted):** `status`, `response`, `error`

### New Store Actions

| Action | Description |
|---|---|
| `addBot(config)` | Add a new bot to the array |
| `updateBot(id, patch)` | Update bot fields by id |
| `removeBot(id)` | Remove a bot by id |
| `reorderBots(fromIdx, toIdx)` | Reorder bot list |
| `importBots(json)` | Parse JSON array, merge by name (upsert) |
| `exportBots()` | Return JSON string of all bot configs |

### IPC Sync

When `bots` changes, the renderer sends `bots-sync` IPC to the main process with the full config array. The main process rebuilds adapters accordingly.

---

## 3. Main Process Changes

### GenericAdapter

Replace the hardcoded adapter array with a single `GenericAdapter` class that reads from config.

```js
// src/adapters/generic.js
class GenericAdapter extends BaseAdapter {
  constructor(config) {
    super(config.name, config.url);
    this.config = config;
  }

  get selectors() {
    return {
      input: this.config.selectors.input,
      response: this.config.selectors.response,
      stopBtn: this.config.selectors.stopBtn || '',
    };
  }

  async _fillInput(webContents, query) {
    switch (this.config.inputType) {
      case 'contenteditable':
        return this._fillContentEditable(webContents, query);
      case 'slate-editor':
        return this._fillSlateEditor(webContents, query);
      default:
        return super._fillInput(webContents, query); // textarea
    }
  }

  async _clickSendButton(webContents) {
    if (this.config.sendMethod === 'click' && this.config.sendSelector) {
      return webContents.executeJavaScript(`
        (() => {
          const el = document.querySelector('${this.config.sendSelector}');
          if (el) { el.click(); return true; }
          return false;
        })()
      `);
    }
    return false; // fallback to Enter key
  }
}
```

### WebviewManager Changes

```js
// Before
this.adapters = [new QwenAdapter(), new DeepSeekAdapter(), new KimiAdapter()];

// After
this.adapters = botsConfig.map(config => new GenericAdapter(config));
```

Add `bots-sync` IPC handler to rebuild adapters when config changes.

---

## 4. Settings UI

### Entry Point

Click "Settings" in the sidebar footer → sidebar expands from 220px to 400px, showing the settings panel.

### Panel: Bot List

```
┌──────────────────────────────────────┐
│  ← Back          Bot Settings        │
├──────────────────────────────────────┤
│  [+ Add Bot]    [Import] [Export]    │
├──────────────────────────────────────┤
│                                      │
│  ● Qwen                    [Edit] [×]│
│    https://www.qianwen.com/          │
│    slate-editor · click              │
│                                      │
│  ● DeepSeek                [Edit] [×]│
│    https://chat.deepseek.com         │
│    textarea · click                  │
│                                      │
│  ● Kimi                    [Edit] [×]│
│    https://kimi.moonshot.cn          │
│    contenteditable · click           │
│                                      │
├──────────────────────────────────────┤
│  ⚙ Settings                          │
│  «                                    │
└──────────────────────────────────────┘
```

- **Color dot** — clickable to change color
- **Edit** — switches to edit form
- **×** — delete with confirmation
- **Drag** — reorder (future enhancement)

### Panel: Add/Edit Form

```
┌──────────────────────────────────────┐
│  ← Back          Add New Bot         │
├──────────────────────────────────────┤
│                                      │
│  Name *                              │
│  ┌────────────────────────────────┐  │
│  │ My Bot                         │  │
│  └────────────────────────────────┘  │
│                                      │
│  URL *                               │
│  ┌────────────────────────────────┐  │
│  │ https://chat.example.com       │  │
│  └────────────────────────────────┘  │
│                                      │
│  Color                               │
│  ┌────┐  #89b4fa                     │
│  └────┘                              │
│                                      │
│  Input Type        ▼                 │
│  ┌────────────────────────────────┐  │
│  │ textarea                       │  │
│  └────────────────────────────────┘  │
│                                      │
│  Send Method       ▼                 │
│  ┌────────────────────────────────┐  │
│  │ enter                          │  │
│  └────────────────────────────────┘  │
│                                      │
│  Send Selector                       │
│  ┌────────────────────────────────┐  │
│  │ button.send                    │  │
│  └────────────────────────────────┘  │
│                                      │
│  Input Selector *                    │
│  ┌────────────────────────────────┐  │
│  │ textarea                       │  │
│  └────────────────────────────────┘  │
│                                      │
│  Response Selector *                 │
│  ┌────────────────────────────────┐  │
│  │ .response-container            │  │
│  └────────────────────────────────┘  │
│                                      │
│  Stop Button Selector                │
│  ┌────────────────────────────────┐  │
│  │ button[class*='stop']          │  │
│  └────────────────────────────────┘  │
│                                      │
│       [Cancel]  [Save]               │
└──────────────────────────────────────┘
```

Required fields marked with `*`. Send Selector only shown when Send Method is `click`.

### Import/Export

- **Export** — Serialize `bots` config (without runtime fields) to JSON, copy to clipboard
- **Import** — Modal with textarea for pasting JSON, parse and merge by `name` (upsert existing, append new)

---

## 5. Migration Plan

### Phase 1: Store Refactor
1. Replace `aiServices` + `enabledBots` with unified `bots` array
2. Add default configs for Qwen, DeepSeek, Kimi
3. Update all renderer components to use `bots` instead of `aiServices`/`enabledBots`

### Phase 2: GenericAdapter
1. Create `src/adapters/generic.js` with template-based fill/send logic
2. Add `bots-sync` IPC handler in main process
3. Replace hardcoded adapter array with config-driven instantiation

### Phase 3: Settings UI
1. Create `SettingsPanel` component
2. Wire up "Settings" click in sidebar
3. Implement Add/Edit/Delete bot flows
4. Implement Import/Export

### Phase 4: Cleanup
1. Remove old adapter files (qwen.js, deepseek.js, kimi.js) after verification
2. Remove old WebviewManager hardcoded imports
3. Update add-bot skill documentation

---

## 6. Files to Modify/Create

### New Files
- `src/adapters/generic.js` — GenericAdapter class
- `src/renderer/components/SettingsPanel.jsx` — Settings UI
- `docs/superpowers/specs/2026-06-28-json-bot-config-design.md` — This spec

### Modified Files
- `src/renderer/store.js` — bots array, new actions, IPC sync
- `src/main/webviewManager.js` — config-driven adapter creation, bots-sync handler
- `src/main/index.js` — pass bots config to WebviewManager
- `src/renderer/components/AiSidebar.jsx` — Settings click handler
- `src/renderer/App.jsx` — adapt to new store shape

### Files to Remove (Phase 4)
- `src/adapters/qwen.js`
- `src/adapters/deepseek.js`
- `src/adapters/kimi.js`
