import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Generate a simple UUID
function uuid() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

const DEFAULT_BOTS = [
  {
    id: 'qwen-default',
    name: 'Qwen',
    url: 'https://www.qianwen.com/',
    color: '#89b4fa',
    enabled: true,
    inputType: 'slate-editor',
    sendMethod: 'click',
    sendSelector: "button[aria-label='发送消息']",
    selectors: {
      input: '[contenteditable="true"], textarea',
      response: '.message-content-container, .chat-message-content, [class*="markdown"], [class*="message-content"]',
      stopBtn: 'button[class*="stop"], [data-testid="chat-stop"], [class*="stop"], button[aria-label*="stop" i]',
    },
  },
  {
    id: 'deepseek-default',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com',
    color: '#cba6f7',
    enabled: true,
    inputType: 'textarea',
    sendMethod: 'click',
    sendSelector: "div[role='button'][class*='ds-button']",
    selectors: {
      input: 'textarea#chat-input, textarea[placeholder], textarea',
      response: '.ds-assistant-message-main-content, .ds-markdown--block, .markdown-body, [class*="message-content"]',
      stopBtn: 'button[class*="stop"], [class*="stop-generating"], [class*="stop"]',
    },
  },
  {
    id: 'kimi-default',
    name: 'Kimi',
    url: 'https://kimi.moonshot.cn',
    color: '#fab387',
    enabled: true,
    inputType: 'contenteditable',
    sendMethod: 'click',
    sendSelector: '.send-button-container',
    selectors: {
      input: '[data-testid="msh-chatinput-editor"], .editor-content, [contenteditable="true"], textarea',
      response: '.chat-message-content, [class*="markdown"], [class*="message-text"]',
      stopBtn: 'button[class*="stop"], [data-testid*="stop"]',
    },
  },
];

// Compute equal card widths for all bots based on enabled state
function calcCardWidths(bots) {
  const enabledBots = bots.filter((b) => b.enabled);
  const equalWidth = enabledBots.length > 0 ? 100 / enabledBots.length : 0;
  const cardWidths = {};
  bots.forEach((bot) => {
    cardWidths[bot.id] = bot.enabled ? equalWidth : 0;
  });
  return cardWidths;
}

const useStore = create(
  persist(
    (set, get) => ({
      // Unified bots array (config + runtime state)
      bots: DEFAULT_BOTS.map((bot) => ({
        ...bot,
        status: 'loading',
        response: '',
        error: null,
      })),

      // Sidebar collapsed state
      sidebarCollapsed: false,

      // Settings panel state
      showSettings: false,

      // Session state
      currentSessionId: null,
      sessions: [],
      showHistory: false,

      // Card widths (percentages) — indexed by bot id
      cardWidths: {},

      // ── Session actions ──
      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),
      setSessions: (sessions) => set({ sessions }),
      toggleHistory: () => set((state) => ({ showHistory: !state.showHistory })),

      createSession: async (title) => {
        if (!window.api) return null;
        const session = await window.api.sessionCreate(title || '新对话');
        set({ currentSessionId: session.id });
        const sessions = await window.api.sessionList();
        set({ sessions });
        return session;
      },

      loadSession: async (sessionId) => {
        if (!window.api) return;
        const session = await window.api.sessionGet(sessionId);
        if (!session) return;
        set({ currentSessionId: sessionId });
        for (const bot of session.bots) {
          if (bot.session_url && bot.status !== 'error') {
            await window.api.navigateBot(bot.bot_name, bot.session_url);
          }
        }
      },

      deleteSession: async (sessionId) => {
        if (!window.api) return;
        await window.api.sessionDelete(sessionId);
        const state = get();
        if (state.currentSessionId === sessionId) {
          set({ currentSessionId: null });
        }
        const sessions = await window.api.sessionList();
        set({ sessions });
      },

      linkBotSession: async (botName, sessionUrl) => {
        const state = get();
        if (!state.currentSessionId || !window.api) return;
        await window.api.sessionLinkBot(state.currentSessionId, botName, sessionUrl);
      },

      refreshSessions: async () => {
        if (!window.api) return;
        const sessions = await window.api.sessionList();
        set({ sessions });
      },

      // ── Card width management ──
      recalcCardWidths: () => set((state) => {
        const enabledBots = state.bots.filter((b) => b.enabled);
        if (enabledBots.length === 0) return {};
        const equalWidth = 100 / enabledBots.length;
        const cardWidths = {};
        state.bots.forEach((bot) => {
          cardWidths[bot.id] = bot.enabled ? equalWidth : 0;
        });
        return { cardWidths };
      }),

      updateCardWidths: (widthsOrFn) => set((state) => ({
        cardWidths: typeof widthsOrFn === 'function' ? widthsOrFn(state.cardWidths) : widthsOrFn,
      })),

      // ── Sidebar ──
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

      // ── Bot management ──
      toggleBot: (name) => {
        let newEnabledValue = false;
        set((state) => {
          const bots = state.bots.map((bot) => {
            if (bot.name !== name) return bot;
            const newEnabled = !bot.enabled;
            newEnabledValue = newEnabled;
            return {
              ...bot,
              enabled: newEnabled,
              status: newEnabled ? 'loading' : 'disabled',
              error: null,
            };
          });

          return { bots, cardWidths: calcCardWidths(bots) };
        });

        if (window.api) {
          window.api.toggleBot(name, newEnabledValue);
        }
      },

      addBot: (config) => {
        const id = config.id || uuid();
        const newBot = {
          id,
          name: config.name,
          url: config.url,
          color: config.color || '#cdd6f4',
          enabled: true,
          inputType: config.inputType || 'textarea',
          sendMethod: config.sendMethod || 'enter',
          sendSelector: config.sendSelector || '',
          selectors: config.selectors,
          status: 'loading',
          response: '',
          error: null,
        };
        set((state) => {
          const bots = [...state.bots, newBot];
          return { bots, cardWidths: calcCardWidths(bots) };
        });
        // Sync to main process
        get().syncBotsToMain();
        return id;
      },

      updateBot: (id, patch) => {
        const ALLOWED_FIELDS = new Set(['name', 'url', 'color', 'enabled', 'inputType', 'sendMethod', 'sendSelector', 'selectors']);
        const safePatch = {};
        for (const [key, value] of Object.entries(patch)) {
          if (ALLOWED_FIELDS.has(key)) safePatch[key] = value;
        }
        set((state) => ({
          bots: state.bots.map((bot) =>
            bot.id === id ? { ...bot, ...safePatch } : bot
          ),
        }));
        get().syncBotsToMain();
      },

      removeBot: (id) => {
        set((state) => {
          const bots = state.bots.filter((bot) => bot.id !== id);
          return { bots, cardWidths: calcCardWidths(bots) };
        });
        get().syncBotsToMain();
      },

      importBots: (jsonString) => {
        try {
          const imported = JSON.parse(jsonString);
          if (!Array.isArray(imported)) throw new Error('Expected JSON array');
          set((state) => {
            const newBots = imported
              .filter((b) => b.name && b.url && b.selectors)
              .map((b) => ({
                id: b.id || uuid(),
                name: b.name,
                url: b.url,
                color: b.color || '#cdd6f4',
                enabled: b.enabled !== false,
                inputType: b.inputType || 'textarea',
                sendMethod: b.sendMethod || 'enter',
                sendSelector: b.sendSelector || '',
                selectors: b.selectors,
                status: 'loading',
                response: '',
                error: null,
              }));

            // Upsert by name
            const bots = [...state.bots];
            for (const newBot of newBots) {
              const idx = bots.findIndex((b) => b.name === newBot.name);
              if (idx >= 0) {
                bots[idx] = { ...bots[idx], ...newBot, id: bots[idx].id };
              } else {
                bots.push(newBot);
              }
            }

            return { bots, cardWidths: calcCardWidths(bots) };
          });
          get().syncBotsToMain();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },

      exportBots: () => {
        const state = get();
        const configs = state.bots.map(({ status, response, error, ...config }) => config);
        return JSON.stringify(configs, null, 2);
      },

      // ── Runtime state updates ──
      updateStatus: (name, status) => set((state) => ({
        bots: state.bots.map((bot) =>
          bot.name === name ? { ...bot, status, error: status === 'error' ? bot.error : null } : bot
        ),
      })),

      updateChunk: (name, chunk) => set((state) => ({
        bots: state.bots.map((bot) =>
          bot.name === name ? { ...bot, response: chunk } : bot
        ),
      })),

      setError: (name, error) => set((state) => ({
        bots: state.bots.map((bot) =>
          bot.name === name ? { ...bot, error, status: 'error' } : bot
        ),
      })),

      clearResponses: () => set((state) => ({
        bots: state.bots.map((bot) => ({ ...bot, response: '', error: null })),
      })),

      // ── IPC sync ──
      syncBotsToMain: () => {
        if (!window.api) return;
        const state = get();
        const configs = state.bots.map(({ status, response, error, ...config }) => config);
        window.api.botsSync(configs);
      },
    }),
    {
      name: 'bot-aggregation-settings',
      partialize: (state) => ({
        bots: state.bots.map(({ status, response, error, ...config }) => config),
        sidebarCollapsed: state.sidebarCollapsed,
      }),
      merge: (persisted, current) => {
        // Merge persisted bot configs with runtime defaults
        const persistedBots = persisted?.bots || [];
        const bots = (Array.isArray(persistedBots) && persistedBots.length > 0
          ? persistedBots
          : DEFAULT_BOTS
        ).map((config) => ({
          ...config,
          status: 'loading',
          response: '',
          error: null,
        }));
        return {
          ...current,
          ...persisted,
          bots,
        };
      },
    }
  )
);

export default useStore;
