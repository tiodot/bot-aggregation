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
