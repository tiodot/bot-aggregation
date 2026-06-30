import React, { useState, useCallback, useRef } from 'react';
import useStore from '../store';

/* ── Catppuccin Mocha ── */
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
  mantle: '#11111b',
};

const s = {
  /* ── Full-screen overlay ── */
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: C.bg,
    zIndex: 900,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  /* ── Header ── */
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 24px',
    borderBottom: `1px solid ${C.surface2}`,
    flexShrink: 0,
    gap: 12,
  },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'transparent',
    color: C.muted,
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
    letterSpacing: '-0.01em',
    flex: 1,
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
    flexShrink: 0,
  },

  /* ── Body ── */
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 24px',
  },

  /* ── Toolbar ── */
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  addBtn: {
    padding: '7px 16px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: C.accent,
    color: C.mantle,
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.1s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  toolbarSpacer: { flex: 1 },
  ghostBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: `1px solid ${C.surface2}`,
    backgroundColor: 'transparent',
    color: C.subtext,
    fontWeight: 500,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.1s',
  },

  /* ── Bot list ── */
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  botCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 10,
    backgroundColor: C.surface,
    border: `1px solid transparent`,
    cursor: 'pointer',
    transition: 'all 0.15s',
    position: 'relative',
  },
  botAccent: (color) => ({
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: color,
  }),
  botDot: (color) => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink: 0,
    boxShadow: `0 0 6px ${color}40`,
  }),
  botInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  botName: {
    fontSize: 13,
    fontWeight: 600,
    color: C.text,
    lineHeight: 1.2,
  },
  botMeta: {
    fontSize: 11,
    color: C.muted,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  botActions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
    opacity: 0,
    transition: 'opacity 0.1s',
  },
  iconBtn: (hoverColor) => ({
    width: 26,
    height: 26,
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'transparent',
    color: C.muted,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s',
  }),

  /* ── Empty state ── */
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    gap: 12,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.surface,
    border: `1px dashed ${C.surface2}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    color: C.muted,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: C.subtext,
  },
  emptyDesc: {
    fontSize: 12,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 1.5,
    maxWidth: 280,
  },

  /* ── Detail view ── */
  detail: {
    maxWidth: 520,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: C.text,
    marginBottom: 20,
    letterSpacing: '-0.02em',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: `1px solid ${C.surface2}`,
  },
  fieldRow: {
    display: 'flex',
    gap: 14,
    marginBottom: 12,
  },
  field: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    minWidth: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: C.subtext,
    letterSpacing: '0.01em',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 7,
    border: `1px solid ${C.surface2}`,
    backgroundColor: C.surface,
    color: C.text,
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 7,
    border: `1px solid ${C.surface2}`,
    backgroundColor: C.surface,
    color: C.text,
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23585b70' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: 28,
  },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  colorPicker: {
    width: 32,
    height: 32,
    padding: 0,
    border: `1px solid ${C.surface2}`,
    borderRadius: 7,
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  colorHex: {
    fontSize: 12,
    color: C.subtext,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  toggle: (on) => ({
    width: 36,
    height: 20,
    borderRadius: 10,
    border: 'none',
    backgroundColor: on ? C.green : C.surface2,
    cursor: 'pointer',
    position: 'relative',
    transition: 'background-color 0.2s',
    padding: 0,
    flexShrink: 0,
  }),
  toggleKnob: (on) => ({
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: on ? C.mantle : C.muted,
    position: 'absolute',
    top: 2,
    left: on ? 18 : 2,
    transition: 'left 0.2s, background-color 0.2s',
  }),
  toggleLabel: {
    fontSize: 12,
    color: C.subtext,
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 24,
    paddingTop: 16,
    borderTop: `1px solid ${C.surface2}`,
  },
  saveBtn: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    backgroundColor: C.accent,
    color: C.mantle,
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.1s',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: `1px solid ${C.surface2}`,
    backgroundColor: 'transparent',
    color: C.subtext,
    fontWeight: 500,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.1s',
  },

  /* ── Import modal ── */
  importOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(17,17,27,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  importModal: {
    width: 440,
    maxHeight: '80vh',
    backgroundColor: C.surface,
    borderRadius: 12,
    border: `1px solid ${C.surface2}`,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  importTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
  },
  importTextarea: {
    width: '100%',
    minHeight: 140,
    padding: '10px 12px',
    borderRadius: 7,
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
  importActions: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  msg: (ok) => ({
    fontSize: 11,
    color: ok ? C.green : C.red,
    marginTop: 4,
  }),

  /* ── Toast ── */
  toast: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 20px',
    borderRadius: 8,
    backgroundColor: C.green,
    color: C.mantle,
    fontSize: 12,
    fontWeight: 600,
    zIndex: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
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

  // view: 'list' | 'add' | 'edit'
  const [view, setView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_BOT, selectors: { ...EMPTY_BOT.selectors } });

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  /* ── Navigation ── */
  const goAdd = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_BOT, selectors: { ...EMPTY_BOT.selectors } });
    setView('add');
  }, []);

  const goEdit = useCallback((bot) => {
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
    setView('edit');
  }, []);

  const goBack = useCallback(() => {
    setView('list');
  }, []);

  /* ── Form ── */
  const handleField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSelector = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, selectors: { ...prev.selectors, [field]: value } }));
  }, []);

  const isValid = form.name.trim() && form.url.trim() && form.selectors.input.trim() && form.selectors.response.trim();

  const handleSave = useCallback(() => {
    if (!isValid) return;
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
      showToast('Bot updated');
    } else {
      addBot(payload);
      showToast('Bot added');
    }
    setView('list');
  }, [form, editingId, isValid, addBot, updateBot, showToast]);

  const handleDelete = useCallback((e, id) => {
    e.stopPropagation();
    removeBot(id);
    showToast('Bot removed');
    if (editingId === id) setView('list');
  }, [removeBot, editingId, showToast]);

  /* ── Import/Export ── */
  const handleImportText = useCallback(() => {
    if (!importText.trim()) return;
    const result = importBots(importText);
    if (result.ok) {
      showToast('Bots imported');
      setShowImport(false);
      setImportText('');
    } else {
      setImportMsg({ ok: false, text: result.error });
      setTimeout(() => setImportMsg(null), 4000);
    }
  }, [importText, importBots, showToast]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importBots(reader.result);
      if (result.ok) {
        showToast(`Imported from ${file.name}`);
      } else {
        showToast('Import failed');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importBots, showToast]);

  const handleExport = useCallback(() => {
    const json = exportBots();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bot-configs.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Config exported');
  }, [exportBots, showToast]);

  /* ── Render: List View ── */
  const renderList = () => (
    <>
      <div style={s.toolbar}>
        <button
          style={s.addBtn}
          onClick={goAdd}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add Bot
        </button>
        <div style={s.toolbarSpacer} />
        <button
          style={s.ghostBtn}
          onClick={() => setShowImport(true)}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
        >
          Import
        </button>
        <button
          style={s.ghostBtn}
          onClick={handleExport}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
        >
          Export
        </button>
      </div>

      {bots.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>+</div>
          <div style={s.emptyTitle}>No bots configured</div>
          <div style={s.emptyDesc}>Add an AI service to start querying multiple models at once.</div>
          <button
            style={{ ...s.addBtn, marginTop: 8 }}
            onClick={goAdd}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Add your first bot
          </button>
        </div>
      ) : (
        <div style={s.list}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              style={s.botCard}
              onClick={() => goEdit(bot)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.surface2;
                e.currentTarget.style.backgroundColor = '#252536';
                const actions = e.currentTarget.querySelector('.bot-actions');
                if (actions) actions.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.backgroundColor = C.surface;
                const actions = e.currentTarget.querySelector('.bot-actions');
                if (actions) actions.style.opacity = '0';
              }}
            >
              <div style={s.botAccent(bot.color)} />
              <div style={s.botDot(bot.color)} />
              <div style={s.botInfo}>
                <span style={s.botName}>{bot.name}</span>
                <span style={s.botMeta}>{bot.url}</span>
                <span style={{ ...s.botMeta, fontSize: 10, color: C.overlay }}>
                  {bot.inputType} · {bot.sendMethod}{bot.enabled ? '' : ' · disabled'}
                </span>
              </div>
              <div className="bot-actions" style={s.botActions}>
                <button
                  style={s.iconBtn(C.accent)}
                  title="Edit"
                  onClick={(e) => { e.stopPropagation(); goEdit(bot); }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = C.accent; e.currentTarget.style.backgroundColor = C.surface2; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  ⚙
                </button>
                <button
                  style={s.iconBtn(C.red)}
                  title="Delete"
                  onClick={(e) => handleDelete(e, bot.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.color = C.red; e.currentTarget.style.backgroundColor = 'rgba(243,139,168,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  /* ── Render: Detail View (Add/Edit) ── */
  const renderDetail = () => (
    <div style={s.detail}>
      <div style={s.detailTitle}>{view === 'edit' ? 'Edit Bot' : 'Add New Bot'}</div>

      {/* Basic */}
      <div style={s.sectionLabel}>Basic</div>
      <div style={s.fieldRow}>
        <div style={s.field}>
          <span style={s.label}>Name</span>
          <input
            style={s.input}
            value={form.name}
            onChange={(e) => handleField('name', e.target.value)}
            placeholder="e.g. ChatGPT"
            onFocus={(e) => { e.target.style.borderColor = C.accent; }}
            onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
          />
        </div>
        <div style={{ ...s.field, maxWidth: 140 }}>
          <span style={s.label}>Color</span>
          <div style={s.colorRow}>
            <input
              type="color"
              value={form.color}
              onChange={(e) => handleField('color', e.target.value)}
              style={s.colorPicker}
            />
            <span style={s.colorHex}>{form.color}</span>
          </div>
        </div>
      </div>

      <div style={s.field}>
        <span style={s.label}>URL</span>
        <input
          style={s.input}
          value={form.url}
          onChange={(e) => handleField('url', e.target.value)}
          placeholder="https://chat.example.com"
          onFocus={(e) => { e.target.style.borderColor = C.accent; }}
          onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
        />
      </div>

      <div style={s.toggleRow}>
        <button
          style={s.toggle(form.enabled)}
          onClick={() => handleField('enabled', !form.enabled)}
        >
          <span style={s.toggleKnob(form.enabled)} />
        </button>
        <span style={s.toggleLabel} onClick={() => handleField('enabled', !form.enabled)}>
          {form.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Input */}
      <div style={s.sectionLabel}>Input</div>
      <div style={s.fieldRow}>
        <div style={s.field}>
          <span style={s.label}>Input Type</span>
          <select
            style={s.select}
            value={form.inputType}
            onChange={(e) => handleField('inputType', e.target.value)}
          >
            <option value="textarea">textarea</option>
            <option value="contenteditable">contenteditable</option>
            <option value="slate-editor">slate-editor</option>
          </select>
        </div>
        <div style={s.field}>
          <span style={s.label}>Send Method</span>
          <select
            style={s.select}
            value={form.sendMethod}
            onChange={(e) => handleField('sendMethod', e.target.value)}
          >
            <option value="enter">Enter key</option>
            <option value="click">Click button</option>
          </select>
        </div>
      </div>

      {form.sendMethod === 'click' && (
        <div style={s.field}>
          <span style={s.label}>Send Button Selector</span>
          <input
            style={s.input}
            value={form.sendSelector}
            onChange={(e) => handleField('sendSelector', e.target.value)}
            placeholder="button[type='submit']"
            onFocus={(e) => { e.target.style.borderColor = C.accent; }}
            onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
          />
        </div>
      )}

      {/* Selectors */}
      <div style={s.sectionLabel}>Selectors</div>
      <div style={s.field}>
        <span style={s.label}>Input Selector</span>
        <input
          style={s.input}
          value={form.selectors.input}
          onChange={(e) => handleSelector('input', e.target.value)}
          placeholder="textarea, [contenteditable]"
          onFocus={(e) => { e.target.style.borderColor = C.accent; }}
          onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
        />
      </div>
      <div style={s.field}>
        <span style={s.label}>Response Selector</span>
        <input
          style={s.input}
          value={form.selectors.response}
          onChange={(e) => handleSelector('response', e.target.value)}
          placeholder=".message-content, [class*='markdown']"
          onFocus={(e) => { e.target.style.borderColor = C.accent; }}
          onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
        />
      </div>
      <div style={s.field}>
        <span style={s.label}>Stop Button Selector</span>
        <input
          style={s.input}
          value={form.selectors.stopBtn}
          onChange={(e) => handleSelector('stopBtn', e.target.value)}
          placeholder="button[class*='stop']"
          onFocus={(e) => { e.target.style.borderColor = C.accent; }}
          onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
        />
      </div>

      {/* Actions */}
      <div style={s.actions}>
        <button
          style={s.cancelBtn}
          onClick={goBack}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
        >
          Cancel
        </button>
        <button
          style={{ ...s.saveBtn, opacity: isValid ? 1 : 0.5, cursor: isValid ? 'pointer' : 'not-allowed' }}
          onClick={handleSave}
          onMouseEnter={(e) => { if (isValid) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = isValid ? '1' : '0.5'; }}
        >
          {view === 'edit' ? 'Save Changes' : 'Add Bot'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={s.overlay}>
      {/* Header */}
      <div style={s.header}>
        {view !== 'list' && (
          <button
            style={s.backBtn}
            onClick={goBack}
            onMouseEnter={(e) => { e.currentTarget.style.color = C.text; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = C.muted; }}
          >
            ←
          </button>
        )}
        <span style={s.headerTitle}>
          {view === 'list' ? 'Bot Settings' : view === 'edit' ? `Edit · ${form.name}` : 'New Bot'}
        </span>
        <button
          style={s.closeBtn}
          onClick={onClose}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.surface; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = C.muted; }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={s.body}>
        {view === 'list' ? renderList() : renderDetail()}
      </div>

      {/* Import modal */}
      {showImport && (
        <div style={s.importOverlay} onClick={() => setShowImport(false)}>
          <div style={s.importModal} onClick={(e) => e.stopPropagation()}>
            <span style={s.importTitle}>Import Bots</span>
            <textarea
              style={s.importTextarea}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='Paste JSON array of bot configs...'
              onFocus={(e) => { e.target.style.borderColor = C.accent; }}
              onBlur={(e) => { e.target.style.borderColor = C.surface2; }}
            />
            {importMsg && <div style={s.msg(importMsg.ok)}>{importMsg.text}</div>}
            <div style={s.importActions}>
              <button
                style={s.ghostBtn}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
              >
                From File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                style={s.cancelBtn}
                onClick={() => setShowImport(false)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.overlay; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.surface2; e.currentTarget.style.color = C.subtext; }}
              >
                Cancel
              </button>
              <button
                style={{ ...s.saveBtn, opacity: importText.trim() ? 1 : 0.5, cursor: importText.trim() ? 'pointer' : 'not-allowed' }}
                onClick={handleImportText}
                onMouseEnter={(e) => { if (importText.trim()) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = importText.trim() ? '1' : '0.5'; }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
