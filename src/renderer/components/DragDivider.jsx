import React, { useCallback, useEffect, useRef } from 'react';

export default function DragDivider({ onDrag, onDragEnd }) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      const dx = e.clientX - startX.current;
      startX.current = e.clientX;
      if (onDrag) onDrag(dx);
    };
    const handleMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (onDragEnd) onDragEnd();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onDrag, onDragEnd]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 4,
        cursor: 'col-resize',
        backgroundColor: 'transparent',
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
        transition: 'background-color 0.15s',
        margin: '0 1px',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#45475a'; }}
      onMouseLeave={(e) => { if (!dragging.current) e.currentTarget.style.backgroundColor = 'transparent'; }}
    />
  );
}
