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
   */
  async waitForReady(webContents, timeout = 30000) {
    const selector = this.selectors.input;
    console.log(`[${this.name}] waitForReady: looking for "${selector}"...`);
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await webContents.executeJavaScript(
        `!!document.querySelector('${selector}')`
      ).catch((e) => {
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
   * Type a query into the input field and click send.
   */
  async sendQuery(webContents, query) {
    const inputSel = this.selectors.input;
    const sendSel = this.selectors.sendBtn;
    console.log(`[${this.name}] sendQuery: input="${inputSel}", sendBtn="${sendSel}"`);

    const result = await webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(inputSel.split(', '))};
        let input = null;
        let matchedSelector = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) { matchedSelector = sel.trim(); break; }
        }
        if (!input) {
          return { ok: false, error: 'Input not found. Tried: ' + selectors.join(', ') };
        }

        console.log('[${this.name}] Found input with selector:', matchedSelector, 'tag:', input.tagName);

        if ('value' in input) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set || Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(input, ${JSON.stringify(query)});
          } else {
            input.value = ${JSON.stringify(query)};
          }
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          input.focus();
          input.textContent = ${JSON.stringify(query)};
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
        }

        console.log('[${this.name}] Input filled. Clicking send in 200ms...');

        setTimeout(() => {
          const btnSelectors = ${JSON.stringify(sendSel.split(', '))};
          let btn = null;
          for (const sel of btnSelectors) {
            btn = document.querySelector(sel.trim());
            if (btn) {
              console.log('[${this.name}] Found send button:', sel.trim());
              break;
            }
          }
          if (btn) {
            btn.click();
            console.log('[${this.name}] Send button clicked!');
          } else {
            console.error('[${this.name}] Send button not found! Tried:', btnSelectors.join(', '));
          }
        }, 200);

        return { ok: true, matchedSelector };
      })()
    `);

    console.log(`[${this.name}] sendQuery result:`, JSON.stringify(result));
    if (result && !result.ok) {
      throw new Error(result.error);
    }
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

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = BaseAdapter;
