# Add New AI Bot

Automatically generate an adapter for a new AI chatbot and register it in the project.

## Usage

When the user says "add bot" or "/add-bot", follow this process:

## Step 1: Gather Info

Ask the user for:
- **Bot name** (e.g., "ChatGPT", "Claude", "Gemini")
- **Bot URL** (e.g., "https://chat.openai.com")
- **New chat shortcut** (optional, e.g., "Ctrl+K", "Ctrl+N")

## Step 2: Analyze Target Page

Use the Electron app to load the target page and discover DOM elements. Run this JS injection to find the key elements:

```javascript
// Run this in the BrowserView's webContents.executeJavaScript
(() => {
  const result = {
    url: location.href,
    title: document.title,
    inputs: [],
    buttons: [],
    editables: [],
    possibleResponseAreas: [],
  };

  // Find textareas
  document.querySelectorAll('textarea').forEach((el) => {
    result.inputs.push({
      type: 'textarea',
      tag: el.tagName,
      id: el.id,
      class: el.className?.substring(0, 100),
      placeholder: el.placeholder?.substring(0, 100),
      testId: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label'),
      height: el.offsetHeight,
      width: el.offsetWidth,
    });
  });

  // Find contenteditable elements
  document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
    result.editables.push({
      tag: el.tagName,
      class: el.className?.substring(0, 100),
      role: el.getAttribute('role'),
      testId: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label'),
      height: el.offsetHeight,
      width: el.offsetWidth,
    });
  });

  // Find buttons with send-related attributes
  document.querySelectorAll('button, [role="button"]').forEach((el) => {
    const text = el.innerText?.trim().substring(0, 30);
    const ariaLabel = el.getAttribute('aria-label');
    const testId = el.getAttribute('data-testid');
    const classStr = el.className?.toLowerCase() || '';
    const isSendRelated =
      classStr.includes('send') ||
      classStr.includes('submit') ||
      ariaLabel?.toLowerCase().includes('send') ||
      ariaLabel?.includes('发送') ||
      text?.includes('发送') ||
      testId?.includes('send');

    if (isSendRelated || el.closest('[class*="input"]') || el.closest('[class*="chat"]')) {
      result.buttons.push({
        tag: el.tagName,
        text: text,
        class: el.className?.substring(0, 100),
        ariaLabel: ariaLabel,
        testId: testId,
        role: el.getAttribute('role'),
        disabled: el.disabled,
        isSendRelated: isSendRelated,
        parentClass: el.parentElement?.className?.substring(0, 80),
      });
    }
  });

  // Find possible response/message containers
  document.querySelectorAll('[class*="message"], [class*="markdown"], [class*="response"], [class*="chat-content"], [role="log"]').forEach((el) => {
    result.possibleResponseAreas.push({
      tag: el.tagName,
      class: el.className?.substring(0, 100),
      role: el.getAttribute('role'),
      childCount: el.children.length,
      textLength: el.innerText?.length || 0,
    });
  });

  return result;
})()
```

## Step 3: Identify Key Selectors

From the analysis results, identify:

1. **Input selector** — The textarea or contenteditable for user input
   - Prefer `textarea` over `contenteditable`
   - Use `data-testid` or `aria-label` if available (more stable)
   - Fallback to `id` or `class`
   - Example: `textarea#chat-input, textarea[placeholder], textarea`

2. **Send button selector** — The button to submit the message
   - Use `aria-label` (most stable): `button[aria-label="发送消息"]`
   - Use `data-testid`: `[data-testid="send-button"]`
   - Use class pattern: `div[role="button"].send-button-container`
   - Note if button has disabled state and how it's indicated

3. **Response selector** — The container for AI responses
   - Look for the last message container
   - Use class patterns: `.message-content, [class*="markdown"]`
   - Note if it's the assistant's response specifically

4. **Stop button selector** — The "stop generating" button (for detecting stream end)
   - Look for buttons with "stop" in class/aria-label

## Step 4: Generate Adapter

Create `src/adapters/{bot-name-lowercase}.js`:

```javascript
const BaseAdapter = require('./base');

class {BotName}Adapter extends BaseAdapter {
  constructor() {
    super('{BotName}', '{BotUrl}');
  }

  get selectors() {
    return {
      input: '{input-selector}',
      response: '{response-selector}',
      stopBtn: '{stop-button-selector}',
    };
  }

  // Override _fillInput if the bot uses contenteditable or special input
  // Override _clickSendButton if the bot has a custom send button
  // Override waitForReady if the bot takes longer to load
}

module.exports = {BotName}Adapter;
```

### When to override `_fillInput`:
- Bot uses contenteditable (Slate, ProseMirror, etc.)
- Bot uses a non-standard input mechanism
- Native value setter doesn't trigger React state update

### When to override `_clickSendButton`:
- Bot uses `div[role="button"]` instead of `<button>`
- Bot uses `aria-label` for the send button
- Button has custom disabled state (not standard `disabled` attribute)

### When to override `waitForReady`:
- Bot takes longer than 30s to load
- Bot has multiple pages/states before showing the chat
- Need extra debugging for selector discovery

## Step 5: Register in WebviewManager

Update `src/main/webviewManager.js`:

1. Import the new adapter:
```javascript
const {BotName}Adapter = require('../adapters/{bot-name-lowercase}');
```

2. Add to adapters array in constructor:
```javascript
this.adapters = [new QwenAdapter(), new DeepSeekAdapter(), new KimiAdapter(), new {BotName}Adapter()];
```

## Step 6: Register in Store

Update `src/renderer/store.js`:

1. Add to `aiServices` array:
```javascript
{ name: '{BotName}', color: '{color}', status: 'loading', response: '', error: null }
```

2. Add to `enabledBots`:
```javascript
enabledBots: { Qwen: true, DeepSeek: true, Kimi: true, {BotName}: true }
```

Choose a distinct color from the existing ones (e.g., `#f5c2e7`, `#94e2d5`, `#f9e2af`).

## Step 7: Test

1. Run `npm run dev`
2. Check console logs for the new bot's initialization
3. Verify the page loads and input element is found
4. Test sending a message
5. Test response detection

## Common Issues

**Input not found:**
- The page might require login
- The page might load slowly (increase timeout)
- The selector might be wrong (check the DOM analysis)

**Send button not found:**
- The button might be `div[role="button"]` not `<button>`
- The button might use `aria-label` instead of class
- The button might be disabled until text is entered

**Response not detected:**
- The response container selector might be wrong
- The MutationObserver target might need adjustment
- The stop button selector might be wrong

**Text not filling:**
- For contenteditable, use `execCommand('insertText')` not native setter
- For Slate editors, need `selectAll` + `insertText`
- Some editors need `InputEvent` with `inputType: 'insertText'`

## Example: Adding ChatGPT

```javascript
// src/adapters/chatgpt.js
const BaseAdapter = require('./base');

class ChatGPTAdapter extends BaseAdapter {
  constructor() {
    super('ChatGPT', 'https://chat.openai.com');
  }

  get selectors() {
    return {
      input: 'textarea#prompt-textarea, textarea[placeholder], textarea',
      response: '.markdown, [class*="message-content"], [data-message-author-role="assistant"]',
      stopBtn: 'button[aria-label="Stop generating"], button[data-testid="stop-button"]',
    };
  }

  async _clickSendButton(webContents) {
    return webContents.executeJavaScript(`
      (() => {
        const btn = document.querySelector('button[data-testid="send-button"]');
        if (btn && !btn.disabled) {
          btn.click();
          return true;
        }
        // Fallback: find by aria-label
        const fallback = document.querySelector('button[aria-label="Send prompt"]');
        if (fallback && !fallback.disabled) {
          fallback.click();
          return true;
        }
        return false;
      })()
    `);
  }
}

module.exports = ChatGPTAdapter;
```
