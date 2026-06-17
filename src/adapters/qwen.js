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
    await webContents.executeJavaScript(`
      (() => {
        const selectors = ${JSON.stringify(this.selectors.input.split(', '))};
        let input = null;
        for (const sel of selectors) {
          input = document.querySelector(sel.trim());
          if (input) break;
        }
        if (!input) throw new Error('Qwen input not found');

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
