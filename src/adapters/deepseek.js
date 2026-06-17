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
