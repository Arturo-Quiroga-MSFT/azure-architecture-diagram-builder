// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef } from 'react';
import {
  EdgeProps,
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';

const EditableEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  markerStart,
  data,
  label,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(label?.toString() || '');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const pathStyle = (data as any)?.pathStyle as 'straight' | 'smooth' | 'orthogonal' | undefined;

  const pathFn =
    pathStyle === 'straight'
      ? getStraightPath
      : pathStyle === 'orthogonal'
        ? getSmoothStepPath
        : getBezierPath;

  const [edgePath, labelX, labelY] = pathFn({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  } as any);

  // Get stored offset from edge data
  const offsetX = (data as any)?.labelOffsetX ?? 0;
  const offsetY = (data as any)?.labelOffsetY ?? 0;

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) {
      setIsEditing(true);
    }
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditLabel(e.target.value);
  };

  const handleLabelBlur = () => {
    setIsEditing(false);
    // Update the edge data
    if (data?.onLabelChange) {
      data.onLabelChange(id, editLabel);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLabelBlur();
    } else if (e.key === 'Escape') {
      setEditLabel(label?.toString() || '');
      setIsEditing(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX,
      offsetY,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    const newOffsetX = dragStartRef.current.offsetX + dx;
    const newOffsetY = dragStartRef.current.offsetY + dy;
    
    // Update edge data with new offset
    if (data?.onLabelOffsetChange) {
      data.onLabelOffsetChange(id, newOffsetX, newOffsetY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Add/remove global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, offsetX, offsetY]);

  const direction = (data?.direction ?? 'forward') as 'forward' | 'reverse' | 'bidirectional';
  const flowMode = (data?.flowMode ?? (direction === 'bidirectional' ? 'pulse' : 'directional')) as
    | 'directional'
    | 'pulse';

  const flowAnimated = Boolean(data?.flowAnimated);
  const shouldDirectionalFlow = flowAnimated && flowMode === 'directional' && (direction === 'forward' || direction === 'reverse');
  const shouldPulseFlow = flowAnimated && flowMode === 'pulse' && direction === 'bidirectional';
  const dashArray = (style as any)?.strokeDasharray;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          ...style,
          ...(shouldPulseFlow
            ? {
                animation: 'edge-pulse 1.4s ease-in-out infinite',
              }
            : shouldDirectionalFlow
              ? {
                  strokeDasharray: dashArray ?? '6 6',
                  animation:
                    direction === 'reverse'
                      ? 'edge-dash-reverse 1s linear infinite'
                      : 'edge-dash-forward 1s linear infinite',
                }
              : {
                  animation: undefined,
                }),
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX + offsetX}px,${labelY + offsetY}px)`,
            fontSize: 14,
            fontWeight: 'bold',
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {isEditing ? (
            <input
              type="text"
              value={editLabel}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              style={{
                fontSize: 14,
                fontWeight: 'bold',
                padding: '4px 8px',
                border: '1px solid #0078d4',
                borderRadius: '3px',
                backgroundColor: '#ffe4a3',
                minWidth: '100px',
                maxWidth: '300px',
                textAlign: 'center',
              }}
            />
          ) : (
            <div
              onMouseDown={handleMouseDown}
              onDoubleClick={handleLabelDoubleClick}
              style={{
                padding: '4px 8px',
                backgroundColor: '#ffe4a3',
                borderRadius: '3px',
                border: '2px solid #000',
                cursor: isDragging ? 'grabbing' : 'grab',
                minWidth: '40px',
                maxWidth: '180px',
                textAlign: 'center',
                color: '#333',
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                lineHeight: '1.3',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                userSelect: 'none',
              }}
              title={`${editLabel || 'Double-click to edit label'}\n(Drag to reposition)`}
            >
              {editLabel || '(click to add label)'}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default EditableEdge;
