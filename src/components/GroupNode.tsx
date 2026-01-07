import React, { memo, useState } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import './GroupNode.css';

// Detect group category from label and return appropriate colors
const getGroupColors = (label: string): { bg: string; border: string; header: string } => {
  const lowerLabel = label.toLowerCase();
  
  // Web/Frontend
  if (lowerLabel.includes('web') || lowerLabel.includes('frontend') || lowerLabel.includes('ingress') || lowerLabel.includes('edge')) {
    return { bg: 'rgba(107, 114, 128, 0.08)', border: '#6b7280', header: '#6b7280' }; // Gray
  }
  
  // Compute/Processing
  if (lowerLabel.includes('compute') || lowerLabel.includes('processing') || lowerLabel.includes('microservices') || lowerLabel.includes('api')) {
    return { bg: 'rgba(0, 120, 212, 0.08)', border: '#0078d4', header: '#0078d4' }; // Azure blue
  }
  
  // Data/Storage/Database
  if (lowerLabel.includes('data') || lowerLabel.includes('storage') || lowerLabel.includes('database') || lowerLabel.includes('persistence')) {
    return { bg: 'rgba(16, 185, 129, 0.08)', border: '#10b981', header: '#10b981' }; // Green
  }
  
  // AI/ML/Intelligence - check before compute to prioritize AI keywords
  if (lowerLabel.includes('ai') || lowerLabel.includes('intelligence') || lowerLabel.includes('analytics') || lowerLabel.includes('ml') || lowerLabel.includes('cognitive')) {
    return { bg: 'rgba(245, 158, 11, 0.08)', border: '#f59e0b', header: '#f59e0b' }; // Orange
  }
  
  // IoT/Devices
  if (lowerLabel.includes('iot') || lowerLabel.includes('device') || lowerLabel.includes('telemetry')) {
    return { bg: 'rgba(249, 115, 22, 0.08)', border: '#f97316', header: '#f97316' }; // Orange-red
  }
  
  // Security/Identity
  if (lowerLabel.includes('security') || lowerLabel.includes('auth') || lowerLabel.includes('identity') || lowerLabel.includes('vault')) {
    return { bg: 'rgba(239, 68, 68, 0.08)', border: '#ef4444', header: '#ef4444' }; // Red
  }
  
  // Monitoring/Ops
  if (lowerLabel.includes('monitor') || lowerLabel.includes('ops') || lowerLabel.includes('observability') || lowerLabel.includes('logging')) {
    return { bg: 'rgba(139, 92, 246, 0.08)', border: '#8b5cf6', header: '#8b5cf6' }; // Purple
  }
  
  // Networking/Integration
  if (lowerLabel.includes('network') || lowerLabel.includes('integration') || lowerLabel.includes('messaging') || lowerLabel.includes('event') || lowerLabel.includes('ingestion')) {
    return { bg: 'rgba(6, 182, 212, 0.08)', border: '#06b6d4', header: '#06b6d4' }; // Cyan
  }
  
  // Container/Registry
  if (lowerLabel.includes('container') || lowerLabel.includes('registry') || lowerLabel.includes('runtime')) {
    return { bg: 'rgba(0, 120, 212, 0.08)', border: '#0078d4', header: '#0078d4' }; // Azure blue
  }
  
  // Default gray
  return { bg: 'rgba(107, 114, 128, 0.05)', border: '#6b7280', header: '#6b7280' };
};

const GroupNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [label, setLabel] = useState(data.label || 'Group');

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

  const colors = getGroupColors(label);
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
      </div>
      <div className="group-node-content">
        {/* This area will contain other nodes visually */}
      </div>
    </div>
  );
});

GroupNode.displayName = 'GroupNode';

export default GroupNode;
