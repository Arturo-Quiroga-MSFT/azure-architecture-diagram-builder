import React, { memo, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap } from 'lucide-react';
import { loadIcon } from '../utils/iconLoader';
import { NodePricingConfig } from '../types/pricing';
import { formatMonthlyCost, getCostColor } from '../utils/pricingHelpers';
import './AzureNode.css';

// Map categories to colors
const getCategoryColor = (category: string): string => {
  const colorMap: { [key: string]: string } = {
    'compute': '#0078d4',           // Azure blue
    'containers': '#0078d4',
    'databases': '#10b981',         // Green
    'storage': '#10b981',
    'data layer': '#10b981',
    'ai + machine learning': '#f59e0b', // Orange
    'analytics': '#8b5cf6',         // Purple
    'networking': '#06b6d4',        // Cyan
    'identity': '#ec4899',          // Pink
    'security': '#ef4444',          // Red
    'monitor': '#6366f1',           // Indigo
    'integration': '#14b8a6',       // Teal
    'iot': '#f97316',               // Orange
    'app services': '#3b82f6',      // Blue
    'web': '#3b82f6',
    'devops': '#8b5cf6',            // Purple
  };
  
  const normalizedCategory = category?.toLowerCase() || '';
  return colorMap[normalizedCategory] || '#6b7280'; // Default gray
};

const AzureNode: React.FC<NodeProps> = memo(({ data, selected }) => {
  const [iconUrl, setIconUrl] = useState<string>('');
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [label, setLabel] = useState(data.label || 'Azure Service');

  // Extract pricing data
  const pricing = data.pricing as NodePricingConfig | undefined;
  const hasPricing = !!pricing && pricing.estimatedCost > 0;
  const totalCost = pricing ? pricing.estimatedCost * pricing.quantity : 0;

  useEffect(() => {
    if (data.iconPath) {
      loadIcon(data.iconPath).then(url => {
        setIconUrl(url);
      });
    }
  }, [data.iconPath]);

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

  const categoryColor = getCategoryColor(data.category);
  const borderStyle = {
    borderLeft: `6px solid ${categoryColor}`,
    borderTop: '2px solid #e0e0e0',
    borderRight: '2px solid #e0e0e0',
    borderBottom: '2px solid #e0e0e0',
  };

  return (
    <div className={`azure-node ${selected ? 'selected' : ''}`} style={borderStyle}>
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="node-handle"
        isConnectable={true}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="node-handle"
        isConnectable={true}
      />
      
      <div className="node-content">
        {hasPricing && (
          <div 
            className="cost-badge" 
            title={
              pricing.isUsageBased
                ? `Usage-based pricing estimate\n~${formatMonthlyCost(totalCost)}/month\nBased on typical usage patterns\nActual cost varies with consumption\n\nTier: ${pricing.tier}\nRegion: ${pricing.region}`
                : `Estimated monthly cost\nTier: ${pricing.tier}\nQuantity: ${pricing.quantity}\nRegion: ${pricing.region}\n${pricing.isCustom ? 'Custom pricing' : 'Auto-calculated'}`
            }
            style={{ 
              background: pricing.isUsageBased
                ? `linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)`
                : `linear-gradient(135deg, ${getCostColor(totalCost)} 0%, ${getCostColor(totalCost)}dd 100%)` 
            }}
          >
            {pricing.isUsageBased && <Zap size={12} style={{ marginRight: '2px', display: 'inline-block', verticalAlign: 'middle' }} />}
            {pricing.isUsageBased && '~'}{formatMonthlyCost(totalCost)}
            {pricing.quantity > 1 && <span className="cost-quantity"> x{pricing.quantity}</span>}
          </div>
        )}
        {iconUrl ? (
          <img src={iconUrl} alt={label} className="node-icon" />
        ) : (
          <div className="node-icon-placeholder">
            <div className="loading-spinner"></div>
          </div>
        )}
        
        {isEditingLabel ? (
          <input
            type="text"
            value={label}
            onChange={handleLabelChange}
            onBlur={handleLabelBlur}
            onKeyDown={handleLabelKeyDown}
            autoFocus
            className="node-label-input"
          />
        ) : (
          <div
            className="node-label"
            onDoubleClick={handleLabelDoubleClick}
            title="Double-click to edit"
          >
            {label}
          </div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="node-handle"
        isConnectable={true}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="node-handle"
        isConnectable={true}
      />
    </div>
  );
});

AzureNode.displayName = 'AzureNode';

export default AzureNode;
