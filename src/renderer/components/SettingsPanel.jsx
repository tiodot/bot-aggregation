import React, { useState, useCallback, useRef } from 'react';
import useStore from '../store';

/* ── Catppuccin Mocha palette ── */
const C = {
  bg: '#181825',
  surface: '#1e1e2e',
  surface2: '#313244',
  text: '#cdd6f4',
  subtext: '#a6adc8',
  muted: '#585b70',
  overlay: '#45475a',
  accent: '#89b4fa',
  red: '#f38ba8',
  green: '#a6e3a1',
  peach: '#fab387',
  mauve: '#cba6f7',
};

/* ── Styles ── */
const s = {
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: C.bg,
    zIndex: 900,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: `1px solid ${C.surface2}`,
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: C.text,
    letterSpacing: '-0.01em',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'transparent',
    color: C.muted,
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  },

  /* ── Toolbar ── */
  toolbar: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  btn: (variant) => ({
    padding: '7px 14px',
    borderRadius: 8,
    border: variant === 'ghost' ? `1px solid ${C.surface2}` : 'none',
    backgroundColor: variant === 'primary' ? C.accent
      : variant === 'danger' ? C.red
      : 'transparent',
    color: variant === 'primary' ? '#11111b'
      : variant === 'danger' ? '#11111b'
      : C.subtext,
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.1s',
    whiteSpace: 'nowrap',
  }),

  /* ── Bot list ── */
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 20,
  },
  botRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 8,
    backgroundColor: C.surface,
    transition: 'background-color 0.1s',
  },
  botDot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
  }),
  botName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 500,
    color: C.text,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  botUrl: {
    flex: 1,
    fontSize: 11,
    color: C.muted,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  iconBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    border: 'none',
    backgroundColor: 'transparent',
    color: C.muted,
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.1s',
  },

  /* ── Form ── */
  form: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: '16px 18px',
    marginBottom: 20,
    border: `1px solid ${C.surface2}`,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    marginBottom: 14,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: `1px solid ${C.surface2}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.1s',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 6,
    border: `1px solid ${C.surface2}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.1s',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: `1px solid ${C.surface2}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 11,
    outline: 'none',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    resize: 'vertical',
    minHeight: 80,
    boxSizing: 'border-box',
    lineHeight: 1.5,
    transition: 'border-color 0.1s',
  },
  formRow: {
    display: 'flex',
    gap: 12,
  },
  formActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 14,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: C.accent,
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: 12,
    color: C.subtext,
    cursor: 'pointer',
  },

  /* ── Import/Export ── */
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: C.text,
    marginBottom: 10,
  },
  ioBox: {
    backgroundColor: C.surface,
    borderRadius: 10,
    padding: '14px 16px',
    border: `1px solid ${C.surface2}`,
    marginBottom: 12,
  },
  ioTextarea: {
    width: '100%',
    minHeight: 120,
    padding: '8px 10px',
    borderRadius: 6,
    border: `1px solid ${C.surface2}`,
    backgroundColor: C.bg,
    color: C.text,
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1.5,
  },
  ioActions: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  msg: (ok) => ({
    fontSize: 11,
    color: ok ? C.green : C.red,
    marginTop: 6,
  }),
};

const EMPTY_BOT = {
  name: '',
  url: '',
  color: '#89b4fa',
  enabled: true,
  inputType: 'textarea',
  sendMethod: 'enter',
  sendSelector: '',
  selectors: { input: '', response: '', stopBtn: '' },
};

export default function SettingsPanel({ onClose }) {
  const bots = useStore((st) => st.bots);
  const addBot = useStore((st) => st.addBot);
  const updateBot = useStore((st) => st.updateBot);
  const removeBot = useStore((st) => st.removeBot);
  const importBots = useStore((st) => st.importBots);
  const exportBots = useStore((st) => st.exportBots);

  const [editingId, setEditingId] = useState(null); // null = add mode, string = edit mode
  const [form, setForm] = useState({ ...EMPTY_BOT, selectors: { ...EMPTY_BOT.selectors } });
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState(null);
  const [exportCopied, setExportCopied] = useState(false);
  const fileInputRef = useRef(null);

  /* ── Form helpers ── */
  const resetForm = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_BOT, selectors: { ...EMPTY_BOT.selectors } });
  }, []);

  const startEdit = useCallback((bot) => {
    setEditingId(bot.id);
    setForm({
      name: bot.name,
      url: bot.url,
      color: bot.color,
      enabled: bot.enabled,
      inputType: bot.inputType,
      sendMethod: bot.sendMethod,
      sendSelector: bot.sendSelector,
      selectors: { ...bot.selectors },
    });
  }, []);

  const handleField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSelector = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, selectors: { ...prev.selectors, [field]: value } }));
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim() || !form.url.trim()) return;
    if (!form.selectors.input.trim() || !form.selectors.response.trim()) return;
    const payload = {
      name: form.name.trim(),
      url: form.url.trim(),
      color: form.color,
      enabled: form.enabled,
      inputType: form.inputType,
      sendMethod: form.sendMethod,
      sendSelector: form.sendSelector.trim(),
      selectors: {
        input: form.selectors.input.trim(),
        response: form.selectors.response.trim(),
        stopBtn: form.selectors.stopBtn.trim(),
      },
    };
    if (editingId) {
      updateBot(editingId, payload);
    } else {
      addBot(payload);
    }
    resetForm();
  }, [form, editingId, addBot, updateBot, resetForm]);

  const handleDelete = useCallback((id) => {
    removeBot(id);
    if (editingId === id) resetForm();
  }, [removeBot, editingId, resetForm]);

  /* ── Import/Export ── */
  const handleImportText = useCallback(() => {
    if (!importText.trim()) return;
    const result = importBots(importText);
    if (result.ok) {
      setImportMsg({ ok: true, text: 'Imported successfully' });
      setImportText('');
    } else {
      setImportMsg({ ok: false, text: result.error });
    }
    setTimeout(() => setImportMsg(null), 4000);
  }, [importText, importBots]);

  const handleImportFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importBots(reader.result);
      if (result.ok) {
        setImportMsg({ ok: true, text: `Imported from ${file.name}` });
      } else {
        setImportMsg({ ok: false, text: result.error });
      }
      setTimeout(() => setImportMsg(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importBots]);

  const handleExport = useCallback(() => {
    const json = exportBots();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bot-configs.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportBots]);

  const handleCopyExport = useCallback(async () => {
    const json = exportBots();
    try {
      await navigator.clipboard.writeText(json);
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch {
      // fallback: select textarea content
    }
  }, [exportBots]);

  return (
    <div style={s.overlay}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.title}>Settings</span>
        <button
          style={s.closeBtn}
          onClick={onClose}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surface; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = C.muted; }}
        >
          x
        </button>
      </div>

      <div style={s.body}>
        {/* ── Bot list ── */}
        <div style={s.toolbar}>
          <button
            style={s.btn('primary')}
            onClick={resetForm}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            + Add Bot
          </button>
        </div>

        <div style={s.list}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              style={s.botRow}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surface2; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.surface; }}
            >
              <span style={s.botDot(bot.color)} />
              <span style={s.botName}>{bot.name}</span>
              <span style={s.botUrl}>{bot.url}</span>
              <button
                style={s.iconBtn}
                title="Edit"
                onClick={() => startEdit(bot)}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}
              >
                Edit
              </button>
              <button
                style={s.iconBtn}
                title="Delete"
                onClick={() => handleDelete(bot.id)}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.red; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}
              >
                Del
              </button>
            </div>
          ))}
          {bots.length === 0 && (
            <div style={{ color: C.muted, fontSize: 12, padding: '12px 0' }}>
              No bots configured. Click "Add Bot" to get started.
            </div>
          )}
        </div>

        {/* ── Add / Edit form ── */}
        <div style={s.form}>
          <div style={s.formTitle}>{editingId ? 'Edit Bot' : 'Add New Bot'}</div>

          <div style={s.formRow}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Name</label>
              <input
                style={s.input}
                value={form.name}
                onChange={(e) => handleField('name', e.target.value)}
                placeholder="e.g. ChatGPT"
                onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
                onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
              />
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => handleField('color', e.target.value)}
                  style={{ width: 32, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, backgroundColor: 'transparent' }}
                />
                <input
                  style={{ ...s.input, flex: 1 }}
                  value={form.color}
                  onChange={(e) => handleField('color', e.target.value)}
                  placeholder="#89b4fa"
                  onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
                  onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
                />
              </div>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>URL</label>
            <input
              style={s.input}
              value={form.url}
              onChange={(e) => handleField('url', e.target.value)}
              placeholder="https://chat.example.com"
              onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
              onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
            />
          </div>

          <div style={s.formRow}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Input Type</label>
              <select
                style={s.select}
                value={form.inputType}
                onChange={(e) => handleField('inputType', e.target.value)}
              >
                <option value="textarea">Textarea</option>
                <option value="contenteditable">ContentEditable</option>
                <option value="slate-editor">Slate Editor</option>
              </select>
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Send Method</label>
              <select
                style={s.select}
                value={form.sendMethod}
                onChange={(e) => handleField('sendMethod', e.target.value)}
              >
                <option value="enter">Enter Key</option>
                <option value="click">Click Button</option>
              </select>
            </div>
          </div>

          <div style={s.field}>
            <label style={s.label}>Send Selector</label>
            <input
              style={s.input}
              value={form.sendSelector}
              onChange={(e) => handleField('sendSelector', e.target.value)}
              placeholder="button[type='submit']"
              onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
              onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
            />
          </div>

          <div style={s.checkboxRow}>
            <input
              type="checkbox"
              style={s.checkbox}
              id="bot-enabled"
              checked={form.enabled}
              onChange={(e) => handleField('enabled', e.target.checked)}
            />
            <label htmlFor="bot-enabled" style={s.checkboxLabel}>Enabled</label>
          </div>

          {/* Selectors */}
          <div style={{ ...s.label, marginTop: 8, marginBottom: 8 }}>Selectors</div>
          <div style={s.field}>
            <label style={{ ...s.label, textTransform: 'none', fontSize: 11 }}>Input</label>
            <input
              style={s.input}
              value={form.selectors.input}
              onChange={(e) => handleSelector('input', e.target.value)}
              placeholder="textarea, [contenteditable]"
              onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
              onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
            />
          </div>
          <div style={s.field}>
            <label style={{ ...s.label, textTransform: 'none', fontSize: 11 }}>Response</label>
            <input
              style={s.input}
              value={form.selectors.response}
              onChange={(e) => handleSelector('response', e.target.value)}
              placeholder=".message-content, [class*='markdown']"
              onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
              onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
            />
          </div>
          <div style={s.field}>
            <label style={{ ...s.label, textTransform: 'none', fontSize: 11 }}>Stop Button</label>
            <input
              style={s.input}
              value={form.selectors.stopBtn}
              onChange={(e) => handleSelector('stopBtn', e.target.value)}
              placeholder="button[class*='stop']"
              onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
              onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
            />
          </div>

          <div style={s.formActions}>
            {editingId && (
              <button
                style={s.btn('ghost')}
                onClick={resetForm}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
              >
                Cancel
              </button>
            )}
            <button
              style={s.btn('primary')}
              onClick={handleSave}
              disabled={!form.name.trim() || !form.url.trim() || !form.selectors.input.trim() || !form.selectors.response.trim()}
              onMouseEnter={(e) => { if (form.name.trim() && form.url.trim() && form.selectors.input.trim() && form.selectors.response.trim()) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              {editingId ? 'Save Changes' : 'Add Bot'}
            </button>
          </div>
        </div>

        {/* ── Import / Export ── */}
        <div style={s.sectionTitle}>Import / Export</div>
        <div style={s.ioBox}>
          <textarea
            style={s.ioTextarea}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          placeholder='Paste JSON array of bot configs here...'
            onFocus={(e) => { e.target.style.borderColor = C.overlay; }}
            onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
          />
          <div style={s.ioActions}>
            <button
              style={s.btn('primary')}
              onClick={handleImportText}
              disabled={!importText.trim()}
            >
              Import from Text
            </button>
            <button
              style={s.btn('ghost')}
              onClick={handleImportFile}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
            >
              Import from File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
          {importMsg && <div style={s.msg(importMsg.ok)}>{importMsg.text}</div>}
        </div>

        <div style={s.ioBox}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={s.btn('primary')}
              onClick={handleExport}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Export as File
            </button>
            <button
              style={s.btn('ghost')}
              onClick={handleCopyExport}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
            >
              {exportCopied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
