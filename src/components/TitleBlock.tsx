import React, { useState } from 'react';
import './TitleBlock.css';

interface TitleBlockProps {
  architectureName?: string;
  author?: string;
  version?: string;
  date?: string;
  onUpdate?: (data: { architectureName?: string; author?: string; version?: string }) => void;
}

const TitleBlock: React.FC<TitleBlockProps> = ({
  architectureName = 'Untitled Architecture',
  author = 'Unknown',
  version = '1.0',
  date = new Date().toLocaleDateString(),
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    architectureName,
    author,
    version,
  });
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: window.innerHeight - 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
    onUpdate?.(editData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({ architectureName, author, version });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start dragging if clicking on inputs or buttons
    if (isEditing || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  return (
    <div 
      className={`title-block ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : (isEditing ? 'default' : 'grab'),
      }}
      onMouseDown={handleMouseDown}
    >
      {isEditing ? (
        <div className="title-block-edit">
          <div className="title-block-row">
            <label>Name:</label>
            <input
              type="text"
              value={editData.architectureName}
              onChange={(e) => setEditData({ ...editData, architectureName: e.target.value })}
              placeholder="Architecture name"
            />
          </div>
          <div className="title-block-row">
            <label>Author:</label>
            <input
              type="text"
              value={editData.author}
              onChange={(e) => setEditData({ ...editData, author: e.target.value })}
              placeholder="Your name"
            />
          </div>
          <div className="title-block-row">
            <label>Version:</label>
            <input
              type="text"
              value={editData.version}
              onChange={(e) => setEditData({ ...editData, version: e.target.value })}
              placeholder="1.0"
            />
          </div>
          <div className="title-block-actions">
            <button onClick={handleSave} className="btn-save">Save</button>
            <button onClick={handleCancel} className="btn-cancel">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="title-block-display" onDoubleClick={handleEdit}>
          <div className="title-block-header">
            <span className="title-block-label">ARCHITECTURE DIAGRAM</span>
          </div>
          <div className="title-block-content">
            <div className="title-block-row">
              <span className="title-block-field">Name:</span>
              <span className="title-block-value">{architectureName}</span>
            </div>
            <div className="title-block-row">
              <span className="title-block-field">Author:</span>
              <span className="title-block-value">{author}</span>
            </div>
            <div className="title-block-row">
              <span className="title-block-field">Date:</span>
              <span className="title-block-value">{date}</span>
            </div>
            <div className="title-block-row">
              <span className="title-block-field">Version:</span>
              <span className="title-block-value">{version}</span>
            </div>
          </div>
          <div className="title-block-hint">Double-click to edit</div>
        </div>
      )}
    </div>
  );
};

export default TitleBlock;
