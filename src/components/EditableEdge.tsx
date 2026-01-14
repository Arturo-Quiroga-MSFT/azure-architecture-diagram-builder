import React, { useState } from 'react';
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

  const handleLabelDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
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
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
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
              onDoubleClick={handleLabelDoubleClick}
              style={{
                padding: '4px 8px',
                backgroundColor: '#ffe4a3',
                borderRadius: '3px',
                border: '2px solid #000',
                cursor: 'text',
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
              }}
              title={editLabel || 'Double-click to edit label'}
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
