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
