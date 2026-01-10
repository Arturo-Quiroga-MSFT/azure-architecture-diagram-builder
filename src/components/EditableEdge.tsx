import React, { useState } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

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

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

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

  return (
    <>markerStart={markerStart} 
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
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
                backgroundColor: 'white',
                minWidth: '100px',
                textAlign: 'center',
              }}
            />
          ) : (
            <div
              onDoubleClick={handleLabelDoubleClick}
              style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '3px',
                border: '2px solid #000',
                cursor: 'text',
                minWidth: '40px',
                textAlign: 'center',
                color: '#333',
              }}
              title="Double-click to edit label"
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
