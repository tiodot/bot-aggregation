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
    return super.waitForReady(webContents, timeout);
  }

  async sendQuery(webContents, query) {
    console.log(`[Qwen] sendQuery: using custom implementation`);
    const result = await webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(this.selectors.input.split(', '))};
        let input = null;
        let matched = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) { matched = sel.trim(); break; }
        }
        if (!input) {
          console.error('[Qwen] Input not found. Tried:', selectors.join(', '));
          return { ok: false, error: 'Qwen input not found. Tried: ' + selectors.join(', ') };
        }

        console.log('[Qwen] Found input:', matched, 'tag:', input.tagName);
        input.focus();

        if ('value' in input) {
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

        console.log('[Qwen] Input filled. Will click send in 200ms...');

        setTimeout(() => {
          const btnSelectors = ${JSON.stringify(this.selectors.sendBtn.split(', '))};
          for (const sel of btnSelectors) {
            const btn = document.querySelector(sel.trim());
            if (btn && !btn.disabled) {
              console.log('[Qwen] Clicking send button:', sel.trim());
              btn.click();
              return;
            }
          }
          console.error('[Qwen] Send button not found or disabled');
        }, 200);

        return { ok: true, matchedSelector: matched };
      })()
    `);

    console.log(`[Qwen] sendQuery result:`, JSON.stringify(result));
    if (result && !result.ok) {
      throw new Error(result.error);
    }
  }
}

module.exports = QwenAdapter;
