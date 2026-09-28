// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useCallback } from 'react';
import './ModelBadge.css';

interface ModelBadgeProps {
  modelName: string;
  elapsedTimeMs?: number;
}

const ModelBadge: React.FC<ModelBadgeProps> = ({ modelName, elapsedTimeMs }) => {
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const badgeRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Offset from the docked spot: the item keeps its place in the dock, so
    // dragging it never reflows its neighbours.
    const offset = dragPosition ?? { x: 0, y: 0 };
    dragOffsetRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    setDragPosition(offset);
    setIsDragging(true);
  }, [dragPosition]);

  React.useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      setDragPosition({
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y,
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const style: React.CSSProperties = dragPosition
    ? { transform: `translate(${dragPosition.x}px, ${dragPosition.y}px)`, zIndex: 1001 }
    : {};

  return (
    <div
      ref={badgeRef}
      className={`model-generation-badge ${isDragging ? 'dragging' : ''}`}
      style={style}
      onMouseDown={handleMouseDown}
    >
      <span className="model-generation-badge-icon">🤖</span>
      <span className="model-generation-badge-text">
        Generated with <strong>{modelName}</strong>
      </span>
      {elapsedTimeMs != null && (
        <span className="model-generation-badge-time">
          {(elapsedTimeMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
};

export default ModelBadge;
