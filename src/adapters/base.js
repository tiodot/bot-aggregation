class BaseAdapter {
  constructor(name, url) {
    this.name = name;
    this.url = url;
  }

  /** CSS selectors for the AI's web interface. Override in subclass. */
  get selectors() {
    return {
      input: '',       // textarea or contenteditable for user input
      response: '',    // container for the AI's response text
      stopBtn: '',     // "stop generating" button (used to detect stream end)
    };
  }

  /**
   * Wait until the AI page is loaded and the input element exists.
   */
  async waitForReady(webContents, timeout = 30000) {
    const selector = this.selectors.input;
    console.log(`[${this.name}] waitForReady: looking for "${selector}"...`);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await webContents.executeJavaScript(`
        (() => {
          const selectors = ${JSON.stringify(selector.split(', '))};
          for (const sel of selectors) {
            if (document.querySelector(sel.trim())) return true;
          }
          return false;
        })()
      `).catch((e) => {
        console.log(`[${this.name}] waitForReady JS error:`, e.message);
        return false;
      });
      if (found) {
        console.log(`[${this.name}] waitForReady: found input element!`);
        return true;
      }
      await this._sleep(500);
    }
    throw new Error(`${this.name}: input element "${selector}" not found after ${timeout}ms`);
  }

  /**
   * Type a query into the input field and trigger send.
   * Strategy: InputEvent+DataTransfer for contenteditable, native setter for textarea.
   * Then click send button; fallback to Enter key.
   */
  async sendQuery(webContents, query) {
    console.log(`[${this.name}] sendQuery: filling input...`);

    // Step 1: Fill input
    const fillResult = await this._fillInput(webContents, query);
    console.log(`[${this.name}] Input fill result:`, JSON.stringify(fillResult));

    // Step 2: Wait for React to process the input and enable the send button
    await this._sleep(800);

    // Step 3: Try to click the send button (subclasses can override _clickSendButton)
    const clicked = await this._clickSendButton(webContents);
    console.log(`[${this.name}] Button click result:`, clicked);

    if (!clicked) {
      // Step 4: Fallback — send native Enter keypress
      console.log(`[${this.name}] Button click failed, sending Enter key...`);
      webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
      webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
      console.log(`[${this.name}] Enter key sent.`);
    }

    // Step 5: Verify the input was cleared (indicates send was triggered)
    await this._sleep(500);
    const inputCleared = await this._checkInputCleared(webContents);
    console.log(`[${this.name}] Input cleared after send:`, inputCleared);

    if (!inputCleared) {
      // One more attempt: try Enter again
      console.log(`[${this.name}] Input not cleared, retrying Enter...`);
      webContents.sendInputEvent({ type: 'char', keyCode: '\n' });
      await this._sleep(300);
    }
  }

  /**
   * Fill the input field.
   * For contenteditable: uses InputEvent + DataTransfer (triggers Slate/ProseMirror/etc.)
   * For textarea/input: uses native value setter + input event (triggers React controlled components).
   */
  async _fillInput(webContents, query) {
    const inputSel = this.selectors.input;
    return webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(inputSel.split(', '))};
        let input = null;
        let matched = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) { matched = sel.trim(); break; }
        }
        if (!input) {
          return { ok: false, error: 'Input not found: ' + selectors.join(', ') };
        }

        console.log('[${this.name}] Found input:', matched, 'tag:', input.tagName);
        input.focus();

        const text = ${JSON.stringify(query)};
        const isContentEditable = input.getAttribute('contenteditable') === 'true';

        if (isContentEditable) {
          // ContentEditable: use InputEvent + DataTransfer for framework compatibility
          document.execCommand('selectAll');

          const dt = new DataTransfer();
          dt.setData('text/plain', text);
          input.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true,
            inputType: 'insertText', data: text, dataTransfer: dt,
          }));
          input.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'insertText', data: text,
          }));

          // Fallback if DataTransfer didn't work
          const current = input.innerText || '';
          if (!current.includes(text.substring(0, 20))) {
            document.execCommand('insertText', false, text);
          }
        } else {
          // textarea / input: use native setter to bypass React's value tracking
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          if (setter) setter.call(input, text);
          else input.value = text;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const val = input.value || input.innerText || '';
        console.log('[${this.name}] Input value after fill:', val?.substring(0, 50));
        return { ok: true, valueLength: val?.length || 0 };
      })()
    `);
  }

  /**
   * Try to find and click the send button. Override in subclasses for site-specific selectors.
   * Returns true if a button was clicked, false otherwise.
   */
  async _clickSendButton(webContents) {
    return false; // Base implementation — subclasses override
  }

  /**
   * Check if the input was cleared after sending (indicates the message was submitted).
   */
  async _checkInputCleared(webContents) {
    const inputSel = this.selectors.input;
    return webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(inputSel.split(', '))};
        for (const sel of selectors) {
          const el = document.querySelector(sel.trim());
          if (el) {
            const val = el.value || el.textContent || '';
            return val.trim().length === 0;
          }
        }
        return false;
      })()
    `);
  }

  /**
   * Listen for the AI's response via MutationObserver.
   */
  async listenForResponse(webContents, onChunk) {
    const responseSelector = this.selectors.response;
    const stopBtnSelector = this.selectors.stopBtn;
    const responseId = `__ai_response_${Date.now()}`;

    console.log(`[${this.name}] listenForResponse: response="${responseSelector}", stopBtn="${stopBtnSelector}"`);

    await webContents.executeJavaScript(`
      (() => {
        const responseSel = '${responseSelector}';
        const stopSel = '${stopBtnSelector}';
        const RESPONSE_ID = '${responseId}';

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

          const stopBtn = document.querySelector(stopSel);
          if (!stopBtn && stableCount >= 6) {
            window[RESPONSE_ID] = { status: 'done', text: lastText };
            if (observer) observer.disconnect();
          }
        }

        const target = getLatestResponse()?.parentElement || document.body;
        observer = new MutationObserver(() => {
          setTimeout(check, 200);
        });
        observer.observe(target, { childList: true, subtree: true, characterData: true });

        const interval = setInterval(() => {
          check();
          if (window[RESPONSE_ID]?.status === 'done') {
            clearInterval(interval);
          }
        }, 500);

        window[RESPONSE_ID] = { status: 'waiting', text: '' };
        console.log('[${this.name}] MutationObserver installed, waiting for response...');
      })()
    `);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[${this.name}] listenForResponse TIMEOUT (120s)`);
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
            console.log(`[${this.name}] listenForResponse: done (${state.text.length} chars)`);
            onChunk(state.text);
            resolve(state.text);
          }
        } catch (e) {
          clearInterval(poll);
          clearTimeout(timeout);
          console.error(`[${this.name}] listenForResponse error:`, e.message);
          reject(e);
        }
      }, 300);
    });
  }

  /**
   * Start a new chat. Override in subclasses for site-specific selectors.
   * Default: try clicking common "new chat" button selectors.
   */
  async newChat(webContents) {
    return webContents.executeJavaScript(`
      (() => {
        const selectors = [
          'a[href="/new"]',
          '[data-testid="new-chat"]',
          'button[aria-label*="new" i]',
          'button[aria-label*="新" i]',
          'a[aria-label*="new" i]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) { el.click(); return { ok: true, selector: sel }; }
        }
        return { ok: false, error: 'New chat button not found' };
      })()
    `);
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = BaseAdapter;
