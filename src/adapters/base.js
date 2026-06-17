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

    const responseId = `__ai_response_${Date.now()}`;

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
      })()
    `);

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
