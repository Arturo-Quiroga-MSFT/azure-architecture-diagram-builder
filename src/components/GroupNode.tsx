import React, { memo, useState } from 'react';
import { NodeProps, NodeResizer, useReactFlow } from 'reactflow';
import { Palette, Minimize2 } from 'lucide-react';
import './GroupNode.css';

// Predefined color palette for groups
const COLOR_PALETTE = [
  { name: 'Gray', bg: 'rgba(107, 114, 128, 0.25)', border: '#6b7280', header: '#6b7280' },
  { name: 'Blue', bg: 'rgba(0, 120, 212, 0.25)', border: '#0078d4', header: '#0078d4' },
  { name: 'Green', bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', header: '#10b981' },
  { name: 'Orange', bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', header: '#f59e0b' },
  { name: 'Red', bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444', header: '#ef4444' },
  { name: 'Purple', bg: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6', header: '#8b5cf6' },
  { name: 'Cyan', bg: 'rgba(6, 182, 212, 0.25)', border: '#06b6d4', header: '#06b6d4' },
  { name: 'Pink', bg: 'rgba(236, 72, 153, 0.25)', border: '#ec4899', header: '#ec4899' },
  { name: 'Yellow', bg: 'rgba(234, 179, 8, 0.25)', border: '#eab308', header: '#eab308' },
  { name: 'Teal', bg: 'rgba(20, 184, 166, 0.25)', border: '#14b8a6', header: '#14b8a6' },
];

// Detect group category from label and return appropriate colors
const getGroupColors = (label: string): { bg: string; border: string; header: string } => {
  const lowerLabel = label.toLowerCase();
  
  // Web/Frontend
  if (lowerLabel.includes('web') || lowerLabel.includes('frontend') || lowerLabel.includes('ingress') || lowerLabel.includes('edge')) {
    return { bg: 'rgba(107, 114, 128, 0.25)', border: '#6b7280', header: '#6b7280' }; // Gray
  }
  
  // Compute/Processing
  if (lowerLabel.includes('compute') || lowerLabel.includes('processing') || lowerLabel.includes('microservices') || lowerLabel.includes('api')) {
    return { bg: 'rgba(0, 120, 212, 0.25)', border: '#0078d4', header: '#0078d4' }; // Azure blue
  }
  
  // Data/Storage/Database
  if (lowerLabel.includes('data') || lowerLabel.includes('storage') || lowerLabel.includes('database') || lowerLabel.includes('persistence')) {
    return { bg: 'rgba(16, 185, 129, 0.25)', border: '#10b981', header: '#10b981' }; // Green
  }
  
  // AI/ML/Intelligence - check before compute to prioritize AI keywords
  if (lowerLabel.includes('ai') || lowerLabel.includes('intelligence') || lowerLabel.includes('analytics') || lowerLabel.includes('ml') || lowerLabel.includes('cognitive')) {
    return { bg: 'rgba(245, 158, 11, 0.25)', border: '#f59e0b', header: '#f59e0b' }; // Orange
  }
  
  // IoT/Devices
  if (lowerLabel.includes('iot') || lowerLabel.includes('device') || lowerLabel.includes('telemetry')) {
    return { bg: 'rgba(249, 115, 22, 0.25)', border: '#f97316', header: '#f97316' }; // Orange-red
  }
  
  // Security/Identity
  if (lowerLabel.includes('security') || lowerLabel.includes('auth') || lowerLabel.includes('identity') || lowerLabel.includes('vault')) {
    return { bg: 'rgba(239, 68, 68, 0.25)', border: '#ef4444', header: '#ef4444' }; // Red
  }
  
  // Monitoring/Ops
  if (lowerLabel.includes('monitor') || lowerLabel.includes('ops') || lowerLabel.includes('observability') || lowerLabel.includes('logging')) {
    return { bg: 'rgba(139, 92, 246, 0.25)', border: '#8b5cf6', header: '#8b5cf6' }; // Purple
  }
  
  // Networking/Integration
  if (lowerLabel.includes('network') || lowerLabel.includes('integration') || lowerLabel.includes('messaging') || lowerLabel.includes('event') || lowerLabel.includes('ingestion')) {
    return { bg: 'rgba(6, 182, 212, 0.25)', border: '#06b6d4', header: '#06b6d4' }; // Cyan
  }
  
  // Container/Registry
  if (lowerLabel.includes('container') || lowerLabel.includes('registry') || lowerLabel.includes('runtime')) {
    return { bg: 'rgba(0, 120, 212, 0.25)', border: '#0078d4', header: '#0078d4' }; // Azure blue
  }
  
  // Default gray
  return { bg: 'rgba(107, 114, 128, 0.20)', border: '#6b7280', header: '#6b7280' };
};

const GroupNode: React.FC<NodeProps> = memo(({ id, data, selected }) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [label, setLabel] = useState(data.label || 'Group');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState(data.customColor || null);
  const { getNodes, setNodes } = useReactFlow();

  const handleFitToContent = () => {
    const allNodes = getNodes();
    const children = allNodes.filter(n => n.parentNode === id);
    if (children.length === 0) return;

    const padding = 40;
    const headerHeight = 50;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    children.forEach(child => {
      const x = child.position.x;
      const y = child.position.y;
      const w = child.width || 160;
      const h = child.height || 100;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    const offsetX = minX - padding;
    const offsetY = minY - padding - headerHeight;
    const newWidth = (maxX - minX) + padding * 2;
    const newHeight = (maxY - minY) + padding * 2 + headerHeight;

    setNodes(nds => nds.map(n => {
      if (n.id === id) {
        return { ...n, style: { ...n.style, width: newWidth, height: newHeight } };
      }
      if (n.parentNode === id) {
        return { ...n, position: { x: n.position.x - offsetX, y: n.position.y - offsetY } };
      }
      return n;
    }));
  };

  const handleLabelDoubleClick = () => {
    setIsEditingLabel(true);
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
    data.label = e.target.value;
  };

  const handleLabelBlur = () => {
    setIsEditingLabel(false);
  };

  const handleLabelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditingLabel(false);
    }
  };

  const handleColorSelect = (colorScheme: typeof COLOR_PALETTE[0]) => {
    setCustomColor(colorScheme);
    data.customColor = colorScheme;
    setShowColorPicker(false);
  };

  const colors = customColor || getGroupColors(label);
  const groupStyle = {
    backgroundColor: colors.bg,
    borderColor: colors.border,
  };
  const headerStyle = {
    backgroundColor: `${colors.header}15`,
    borderBottomColor: colors.border,
  };
  const labelStyle = {
    color: colors.header,
  };

  return (
    <div className={`group-node ${selected ? 'selected' : ''}`} style={groupStyle}>
      <NodeResizer
        color="#0078d4"
        isVisible={selected}
        minWidth={200}
        minHeight={150}
      />
      <div className="group-node-header" style={headerStyle}>
        <div className="group-header-content">
          {isEditingLabel ? (
            <input
              type="text"
              value={label}
              onChange={handleLabelChange}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              autoFocus
              className="group-label-input"
            />
          ) : (
            <div
              className="group-label"
              onDoubleClick={handleLabelDoubleClick}
              title="Double-click to edit"
              style={labelStyle}
            >
              {label}
            </div>
          )}
          <button
            className="fit-to-content-button"
            onClick={handleFitToContent}
            title="Fit to content"
            style={{ color: colors.header }}
          >
            <Minimize2 size={16} />
          </button>
          <button
            className="color-picker-button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Change color"
            style={{ color: colors.header }}
          >
            <Palette size={18} />
          </button>
        </div>
        
        {showColorPicker && (
          <div className="color-picker-panel">
            <div className="color-picker-title">Choose Color</div>
            <div className="color-picker-grid">
              {COLOR_PALETTE.map((colorScheme) => (
                <button
                  key={colorScheme.name}
                  className={`color-option ${customColor?.name === colorScheme.name ? 'active' : ''}`}
                  onClick={() => handleColorSelect(colorScheme)}
                  style={{
                    backgroundColor: colorScheme.bg,
                    borderColor: colorScheme.border,
                  }}
                  title={colorScheme.name}
                >
                  <div
                    className="color-option-inner"
                    style={{ backgroundColor: colorScheme.border }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="group-node-content">
        {/* This area will contain other nodes visually */}
      </div>
    </div>
  );
});

GroupNode.displayName = 'GroupNode';

export default GroupNode;
