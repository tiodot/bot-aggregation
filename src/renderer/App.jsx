import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import useStore from './store';
import AiSidebar from './components/AiSidebar';
import InputBar from './components/InputBar';
import ResponseCard from './components/ResponseCard';
import DragDivider from './components/DragDivider';

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#11111b',
    color: '#cdd6f4',
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    fontSize: 13,
    lineHeight: 1.5,
    WebkitFontSmoothing: 'antialiased',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  cards: {
    flex: 1,
    display: 'flex',
    padding: '0 10px 10px 10px',
    gap: 0,
    overflow: 'hidden',
  },
};

export default function App() {
  const bots = useStore((s) => s.bots);
  const cardWidths = useStore((s) => s.cardWidths);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const updateCardWidths = useStore((s) => s.updateCardWidths);
  const recalcCardWidths = useStore((s) => s.recalcCardWidths);
  const refreshSessions = useStore((s) => s.refreshSessions);
  const sidebarRef = useRef(null);
  const updateStatus = useStore((s) => s.updateStatus);
  const updateChunk = useStore((s) => s.updateChunk);
  const setError = useStore((s) => s.setError);
  const cardRefs = useRef({});

  // Filter to only enabled bots
  const enabledServices = useMemo(
    () => bots.filter((b) => b.enabled),
    [bots]
  );

  // Restore persisted bot states to main process on mount
  useEffect(() => {
    recalcCardWidths();
    if (!window.api) return;
    bots.forEach((bot) => {
      if (!bot.enabled) {
        window.api.toggleBot(bot.name, false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for IPC events from main process
  useEffect(() => {
    if (!window.api) return;
    const unsubscribe = window.api.onAiEvent((event) => {
      const { name, type, data } = event;
      if (type === 'status') updateStatus(name, data);
      else if (type === 'chunk') updateChunk(name, data);
      else if (type === 'error') setError(name, data);
      else if (type === 'session-updated') refreshSessions();
    });
    return unsubscribe;
  }, [updateStatus, updateChunk, setError, refreshSessions]);

  // Report all card rects to main process
  const reportAllRects = useCallback(() => {
    if (!window.api) return;
    const rects = {};
    enabledServices.forEach((ai) => {
      const el = cardRefs.current[ai.name];
      if (el) {
        const bodyEl = el.querySelector('[data-card-body]') || el.lastChild;
        if (bodyEl) {
          const rect = bodyEl.getBoundingClientRect();
          rects[ai.name] = {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        }
      }
    });
    if (Object.keys(rects).length > 0) {
      window.api.updateCardRects(rects);
    }
  }, [enabledServices]);

  // Report rects on mount
  useEffect(() => {
    const timer = setTimeout(reportAllRects, 500);
    return () => clearTimeout(timer);
  }, [reportAllRects]);

  // Report rects when card widths or enabled bots change
  useEffect(() => {
    const timer = setTimeout(reportAllRects, 250);
    return () => clearTimeout(timer);
  }, [cardWidths, bots, sidebarCollapsed, reportAllRects]);

  // Re-report rects when sidebar transition finishes
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const onTransitionEnd = (e) => {
      if (e.propertyName !== 'width' || e.target !== el) return;
      reportAllRects();
    };
    el.addEventListener('transitionend', onTransitionEnd);
    return () => el.removeEventListener('transitionend', onTransitionEnd);
  }, [reportAllRects]);

  // Observe cards container resize
  useEffect(() => {
    const container = document.querySelector('[data-cards-container]');
    if (!container) return;
    let debounceTimer = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(reportAllRects, 50);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      clearTimeout(debounceTimer);
    };
  }, [reportAllRects]);

  // Handle drag divider — adjust widths of adjacent enabled cards
  const handleDrag = useCallback((enabledIdx, dx) => {
    const container = document.querySelector('[data-cards-container]');
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const deltaPercent = (dx / containerWidth) * 100;
    const leftBot = enabledServices[enabledIdx];
    const rightBot = enabledServices[enabledIdx + 1];
    if (!leftBot || !rightBot) return;

    updateCardWidths((prev) => {
      const next = { ...prev };
      const minPercent = 10;
      let leftNew = (next[leftBot.id] || 0) + deltaPercent;
      let rightNew = (next[rightBot.id] || 0) - deltaPercent;
      if (leftNew < minPercent) { rightNew += leftNew - minPercent; leftNew = minPercent; }
      if (rightNew < minPercent) { leftNew += rightNew - minPercent; rightNew = minPercent; }
      next[leftBot.id] = leftNew;
      next[rightBot.id] = rightNew;
      return next;
    });
  }, [updateCardWidths, enabledServices]);

  const setCardRef = useCallback((name, el) => {
    if (el) cardRefs.current[name] = el;
  }, []);

  return (
    <div style={styles.app}>
      <AiSidebar ref={sidebarRef} />
      <div style={styles.main}>
        <InputBar />
        <div style={styles.cards} data-cards-container>
          {enabledServices.map((bot, i) => {
            return (
              <React.Fragment key={bot.id}>
                {i > 0 && (
                  <DragDivider
                    onDrag={(dx) => handleDrag(i - 1, dx)}
                    onDragEnd={reportAllRects}
                  />
                )}
                <div
                  style={{
                    flex: `0 0 ${cardWidths[bot.id] || 0}%`,
                    display: 'flex',
                    minWidth: 0,
                  }}
                  ref={(el) => setCardRef(bot.name, el)}
                >
                  <ResponseCard
                    ai={bot}
                    onRect={(name, rect) => {
                      if (window.api) window.api.updateCardRects({ [name]: rect });
                    }}
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
