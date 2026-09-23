// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef } from 'react';
import { Image, X, Maximize2, Minimize2 } from 'lucide-react';
import './ReferenceImageViewer.css';

interface ReferenceImageViewerProps {
  imageUrl: string;
  onDismiss: () => void;
}

const MIN_W = 160;
const MIN_H = 110;
const MAX_W = 700;
const MAX_H = 700;

const ReferenceImageViewer: React.FC<ReferenceImageViewerProps> = ({ imageUrl, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pos, setPos] = useState(() => ({
    x: Math.max(0, window.innerWidth - 220),
    y: Math.max(0, window.innerHeight - 200),
  }));
  const [size, setSize] = useState({ w: 200, h: 170 });

  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - size.w, dragState.current.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 40, dragState.current.origY + dy)),
    });
  };

  const onHeaderPointerUp = () => { dragState.current = null; };

  const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resizeState.current = { startX: e.clientX, startY: e.clientY, origW: size.w, origH: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeState.current) return;
    const dx = e.clientX - resizeState.current.startX;
    const dy = e.clientY - resizeState.current.startY;
    setSize({
      w: Math.max(MIN_W, Math.min(MAX_W, resizeState.current.origW + dx)),
      h: Math.max(MIN_H, Math.min(MAX_H, resizeState.current.origH + dy)),
    });
  };

  const onResizePointerUp = () => { resizeState.current = null; };

  const imageHeight = Math.max(60, size.h - 32);

  if (isCollapsed) {
    return (
      <div
        className="ref-image-viewer ref-image-collapsed"
        style={{ position: 'fixed', left: pos.x, top: pos.y }}
        onClick={() => setIsCollapsed(false)}
      >
        <Image size={16} />
        <span>Reference</span>
      </div>
    );
  }

  return (
    <>
      {/* Expanded overlay */}
      {isExpanded && (
        <div className="ref-image-overlay" onClick={() => setIsExpanded(false)}>
          <div className="ref-image-overlay-content" onClick={(e) => e.stopPropagation()}>
            <div className="ref-image-overlay-header">
              <span><Image size={16} /> Reference Diagram</span>
              <button onClick={() => setIsExpanded(false)} className="ref-image-close-btn" title="Close">
                <X size={18} />
              </button>
            </div>
            <img src={imageUrl} alt="Reference architecture diagram" className="ref-image-full" />
          </div>
        </div>
      )}

      {/* Floating thumbnail — draggable + resizable */}
      <div
        className="ref-image-viewer ref-image-thumbnail"
        style={{ position: 'fixed', left: pos.x, top: pos.y, width: size.w }}
      >
        <div
          className="ref-image-header ref-image-drag-handle"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
        >
          <span className="ref-image-label">
            <Image size={12} />
            Reference
          </span>
          <div className="ref-image-actions">
            <button onPointerDown={e => e.stopPropagation()} onClick={() => setIsExpanded(true)} title="Expand" className="ref-image-btn">
              <Maximize2 size={12} />
            </button>
            <button onPointerDown={e => e.stopPropagation()} onClick={() => setIsCollapsed(true)} title="Minimize" className="ref-image-btn">
              <Minimize2 size={12} />
            </button>
            <button onPointerDown={e => e.stopPropagation()} onClick={onDismiss} title="Dismiss" className="ref-image-btn ref-image-btn-dismiss">
              <X size={12} />
            </button>
          </div>
        </div>
        <img
          src={imageUrl}
          alt="Reference architecture diagram"
          className="ref-image-thumb"
          style={{ height: imageHeight }}
          onClick={() => setIsExpanded(true)}
        />
        {/* Resize handle — bottom-right corner */}
        <div
          className="ref-image-resize-handle"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
        />
      </div>
    </>
  );
};

export default ReferenceImageViewer;
