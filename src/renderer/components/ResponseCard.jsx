import React, { useRef, useEffect, useCallback } from 'react';

const styles = {
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#181825',
    borderRadius: 10,
    border: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  tag: (color) => ({
    position: 'absolute',
    top: 8,
    left: 8,
    fontSize: 10,
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: 5,
    backgroundColor: color + '18',
    color: color,
    zIndex: 2,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    letterSpacing: '0.02em',
  }),
  body: {
    flex: 1,
    position: 'relative',
  },
  error: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#f38ba8',
    fontSize: 12,
    padding: 20,
    textAlign: 'center',
    zIndex: 1,
    pointerEvents: 'none',
    lineHeight: 1.6,
  },
};

/**
 * ResponseCard — a container for one AI service.
 * The BrowserView is positioned over the body area by the main process.
 * Reports its body area's bounding rect via onRect callback.
 */
export default function ResponseCard({ ai, onRect }) {
  const cardRef = useRef(null);
  const bodyRef = useRef(null);

  const reportRect = useCallback(() => {
    if (!bodyRef.current || !onRect) return;
    const rect = bodyRef.current.getBoundingClientRect();
    onRect(ai.name, {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, [ai.name, onRect]);

  useEffect(() => { reportRect(); }, [ai.status, reportRect]);

  useEffect(() => {
    if (cardRef.current) cardRef.current.__reportRect = reportRect;
  }, [reportRect]);

  return (
    <div ref={cardRef} style={styles.card} data-ai-name={ai.name}>
      <span style={styles.tag(ai.color)}>{ai.name}</span>
      <div ref={bodyRef} style={styles.body} data-card-body>
        {ai.error && (
          <div style={styles.error}>
            {ai.error}
          </div>
        )}
      </div>
    </div>
  );
}
