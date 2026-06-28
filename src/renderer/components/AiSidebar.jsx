import React, { useCallback, useEffect, forwardRef } from 'react';
import useStore from '../store';

const s = {
  sidebar: (collapsed) => ({
    width: collapsed ? 56 : 220,
    height: '100vh',
    backgroundColor: '#181825',
    borderRight: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    overflowX: 'hidden',
    overflowY: 'auto',
    position: 'relative',
    zIndex: 1000,
  }),

  /* ── Logo ─────────────────────────────────────── */
  logoSection: (collapsed) => ({
    padding: collapsed ? '16px 0 12px' : '20px 16px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: collapsed ? 0 : 10,
    flexShrink: 0,
  }),
  logoMark: {
    width: 32,
    height: 32,
    flexShrink: 0,
    position: 'relative',
  },
  logoText: (collapsed) => ({
    display: 'flex',
    flexDirection: 'column',
    opacity: collapsed ? 0 : 1,
    width: collapsed ? 0 : 'auto',
    overflow: 'hidden',
    transition: 'opacity 0.15s',
    whiteSpace: 'nowrap',
  }),
  logoTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#cdd6f4',
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  logoSubtitle: {
    fontSize: 10,
    fontWeight: 500,
    color: '#585b70',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1.3,
  },

  /* ── Section labels ───────────────────────────── */
  section: (collapsed) => ({
    padding: collapsed ? '6px 0' : '8px 20px 4px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#45475a',
    whiteSpace: 'nowrap',
    opacity: collapsed ? 0 : 1,
    height: collapsed ? 0 : 'auto',
    overflow: 'hidden',
  }),

  /* ── Bot item ─────────────────────────────────── */
  botItem: (collapsed) => ({
    padding: collapsed ? '8px 0' : '8px 12px',
    margin: collapsed ? '3px 10px' : '2px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: collapsed ? 0 : 10,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    borderRadius: 10,
    transition: 'background-color 0.1s',
    position: 'relative',
    flexShrink: 0,
    minHeight: 40,
  }),
  botAccent: (color, active) => ({
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
    backgroundColor: active ? color : 'transparent',
    transition: 'background-color 0.2s',
  }),
  botBadge: (color, collapsed) => ({
    width: collapsed ? 28 : 26,
    height: collapsed ? 28 : 26,
    borderRadius: 8,
    backgroundColor: color + '20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  }),
  botBadgeLetter: (color) => ({
    fontSize: 12,
    fontWeight: 700,
    color: color,
    lineHeight: 1,
  }),
  botInfo: (collapsed) => ({
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    opacity: collapsed ? 0 : 1,
    width: collapsed ? 0 : 'auto',
    transition: 'opacity 0.15s',
    flex: 1,
    minWidth: 0,
  }),
  botName: {
    fontSize: 13,
    fontWeight: 500,
    color: '#bac2de',
    lineHeight: 1.2,
  },
  botStatus: (color, status) => ({
    fontSize: 10,
    fontWeight: 500,
    color: status === 'ready' ? '#a6e3a1'
      : status === 'error' ? '#f38ba8'
      : status === 'streaming' ? color
      : '#585b70',
    lineHeight: 1.3,
    transition: 'color 0.2s',
  }),
  toggle: (enabled) => ({
    width: 30,
    height: 16,
    borderRadius: 8,
    border: 'none',
    backgroundColor: enabled ? '#a6e3a1' : '#313244',
    cursor: 'pointer',
    position: 'relative',
    flexShrink: 0,
    transition: 'background-color 0.2s',
    marginLeft: 'auto',
    padding: 0,
  }),
  toggleDot: (enabled) => ({
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: enabled ? '#1e1e2e' : '#585b70',
    position: 'absolute',
    top: 2,
    left: enabled ? 16 : 2,
    transition: 'left 0.2s, background-color 0.2s',
  }),

  /* ── History ──────────────────────────────────── */
  historyHeader: {
    padding: '2px 20px 4px',
    margin: '6px 0 0',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#45475a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionItem: (isActive) => ({
    padding: '5px 12px',
    margin: '1px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    backgroundColor: isActive ? '#313244' : 'transparent',
    borderRadius: 6,
    transition: 'background-color 0.1s',
  }),
  sessionDot: (isActive) => ({
    width: 5,
    height: 5,
    borderRadius: '50%',
    backgroundColor: isActive ? '#89b4fa' : '#45475a',
    flexShrink: 0,
  }),
  sessionTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: '#a6adc8',
    flex: 1,
    minWidth: 0,
    fontSize: 12,
  },
  sessionTime: {
    fontSize: 10,
    color: '#45475a',
    flexShrink: 0,
  },
  deleteBtn: {
    width: 16,
    height: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#45475a',
    cursor: 'pointer',
    fontSize: 10,
    flexShrink: 0,
    opacity: 0,
    transition: 'opacity 0.1s, color 0.1s',
  },

  /* ── Footer ───────────────────────────────────── */
  footer: { flex: 1 },
  settingsRow: (collapsed) => ({
    padding: collapsed ? '12px 0' : '10px 20px',
    color: '#45475a',
    fontSize: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: 8,
    whiteSpace: 'nowrap',
    transition: 'color 0.15s',
  }),
  collapseRow: (collapsed) => ({
    padding: collapsed ? '8px 0 12px' : '6px 16px 12px',
    borderTop: '1px solid #1e1e2e',
    display: 'flex',
    justifyContent: collapsed ? 'center' : 'flex-end',
  }),
  collapseBtn: (collapsed) => ({
    width: collapsed ? 32 : 24,
    height: collapsed ? 32 : 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    border: 'none',
    backgroundColor: 'transparent',
    color: '#585b70',
    cursor: 'pointer',
    fontSize: 14,
    flexShrink: 0,
    transition: 'all 0.15s',
  }),
};

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const STATUS_LABEL = {
  loading: 'Loading…',
  ready: 'Ready',
  streaming: 'Responding…',
  error: 'Error',
  disabled: 'Disabled',
};

/* ── Logo SVG: 3 overlapping circles = convergence ── */
function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="8" fill="#89b4fa" fillOpacity="0.5" />
      <circle cx="21" cy="11" r="8" fill="#cba6f7" fillOpacity="0.5" />
      <circle cx="16" cy="19" r="8" fill="#fab387" fillOpacity="0.5" />
    </svg>
  );
}

const AiSidebar = forwardRef(function AiSidebar(props, ref) {
  const bots = useStore((st) => st.bots);
  const collapsed = useStore((st) => st.sidebarCollapsed);
  const toggleSidebar = useStore((st) => st.toggleSidebar);
  const toggleBot = useStore((st) => st.toggleBot);
  const sessions = useStore((st) => st.sessions);
  const currentSessionId = useStore((st) => st.currentSessionId);
  const showHistory = useStore((st) => st.showHistory);
  const toggleHistory = useStore((st) => st.toggleHistory);
  const loadSession = useStore((st) => st.loadSession);
  const deleteSession = useStore((st) => st.deleteSession);
  const refreshSessions = useStore((st) => st.refreshSessions);
  const toggleSettings = useStore((st) => st.toggleSettings);

  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  const handleClick = useCallback((name) => {
    toggleBot(name);
  }, [toggleBot]);

  return (
    <div ref={ref} style={s.sidebar(collapsed)}>
      {/* ── Logo ── */}
      <div style={s.logoSection(collapsed)}>
        <LogoMark />
        <div style={s.logoText(collapsed)}>
          <span style={s.logoTitle}>AI</span>
          <span style={s.logoSubtitle}>Aggregator</span>
        </div>
      </div>

      {/* ── Services ── */}
      <div style={s.section(collapsed)}>Services</div>
      {bots.map((bot) => {
        const enabled = bot.enabled;
        const initial = bot.name.charAt(0);
        return (
          <div
            key={bot.id}
            style={s.botItem(collapsed)}
            onClick={() => handleClick(bot.name)}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e1e2e'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {/* Brand accent bar (expanded only) */}
            {!collapsed && <div style={s.botAccent(bot.color, enabled)} />}

            {/* Initial badge */}
            <div style={s.botBadge(bot.color, collapsed)}>
              <span style={s.botBadgeLetter(bot.color)}>{initial}</span>
            </div>

            {/* Name + status (expanded only) */}
            {!collapsed && (
              <div style={s.botInfo(false)}>
                <span style={s.botName}>{bot.name}</span>
                <span style={s.botStatus(bot.color, bot.status)}>
                  {enabled ? STATUS_LABEL[bot.status] || bot.status : 'Disabled'}
                </span>
              </div>
            )}

            {/* Toggle (expanded only) */}
            {!collapsed && (
              <button
                style={s.toggle(enabled)}
                onClick={(e) => { e.stopPropagation(); handleClick(bot.name); }}
              >
                <span style={s.toggleDot(enabled)} />
              </button>
            )}
          </div>
        );
      })}

      {/* ── History ── */}
      {!collapsed && (
        <>
          <div style={s.historyHeader} onClick={toggleHistory}>
            <span>History</span>
            <span style={{
              fontSize: 9,
              transform: showHistory ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
            }}>›</span>
          </div>
          {showHistory && sessions.slice(0, 8).map((session) => (
            <div
              key={session.id}
              style={s.sessionItem(session.id === currentSessionId)}
              onClick={() => loadSession(session.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e1e2e';
                const btn = e.currentTarget.querySelector('.del');
                if (btn) btn.style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                if (session.id !== currentSessionId) e.currentTarget.style.backgroundColor = 'transparent';
                const btn = e.currentTarget.querySelector('.del');
                if (btn) btn.style.opacity = '0';
              }}
            >
              <span style={s.sessionDot(session.id === currentSessionId)} />
              <span style={s.sessionTitle}>{session.title}</span>
              <span style={s.sessionTime}>{formatTime(session.updated_at)}</span>
              <button
                className="del"
                style={s.deleteBtn}
                onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
              >✕</button>
            </div>
          ))}
        </>
      )}

      {/* ── Footer ── */}
      <div style={s.footer} />
      <div
        style={s.settingsRow(collapsed)}
        onClick={toggleSettings}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#a6adc8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#45475a'; }}
      >
        <span style={{ fontSize: 14 }}>⚙</span>
        {!collapsed && <span>Settings</span>}
      </div>
      <div style={s.collapseRow(collapsed)}>
        <button
          style={s.collapseBtn(collapsed)}
          onClick={toggleSidebar}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1e1e2e'; e.currentTarget.style.color = '#cdd6f4'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#585b70'; }}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
    </div>
  );
});

export default AiSidebar;
