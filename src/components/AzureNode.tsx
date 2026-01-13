import React, { memo, useEffect, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plus, X, Zap } from 'lucide-react';
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

  const [badges, setBadges] = useState<string[]>(() => Array.isArray((data as any).badges) ? (data as any).badges : []);
  const [isAddingBadge, setIsAddingBadge] = useState(false);
  const [newBadgeText, setNewBadgeText] = useState('');
  const [editingBadgeIndex, setEditingBadgeIndex] = useState<number | null>(null);
  const [editingBadgeText, setEditingBadgeText] = useState('');

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

  useEffect(() => {
    // Keep node data in sync for save/load/export.
    (data as any).badges = badges;
  }, [badges, data]);

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

        <div className="node-badges nodrag nopan">
          {badges.map((b, idx) => {
            const lower = String(b).toLowerCase();
            const tone =
              lower.includes('prod') ? 'danger' :
              lower.includes('dev') ? 'info' :
              lower.includes('test') || lower.includes('stage') ? 'warning' :
              lower.includes('zone') ? 'purple' :
              lower.includes('rpo') || lower.includes('rto') ? 'teal' :
              'neutral';

            const isEditing = editingBadgeIndex === idx;

            return (
              <span
                key={`${b}-${idx}`}
                className={`node-badge node-badge--${tone}`}
                title="Double-click to edit badge"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingBadgeIndex(idx);
                  setEditingBadgeText(String(b));
                }}
              >
                {isEditing ? (
                  <input
                    className="node-badge-input"
                    value={editingBadgeText}
                    autoFocus
                    onChange={(e) => setEditingBadgeText(e.target.value)}
                    onBlur={() => {
                      const next = editingBadgeText.trim();
                      setEditingBadgeIndex(null);

                      if (!next) {
                        setBadges((prev) => prev.filter((_, i) => i !== idx));
                        return;
                      }

                      setBadges((prev) => prev.map((v, i) => (i === idx ? next : v)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.currentTarget as HTMLInputElement).blur();
                      }
                      if (e.key === 'Escape') {
                        setEditingBadgeIndex(null);
                        setEditingBadgeText('');
                      }
                    }}
                  />
                ) : (
                  <>
                    <span className="node-badge-text">{b}</span>
                    <button
                      className="node-badge-remove"
                      title="Remove badge"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBadges((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <X size={12} />
                    </button>
                  </>
                )}
              </span>
            );
          })}

          {isAddingBadge ? (
            <input
              className="node-badge-input node-badge-input--add"
              value={newBadgeText}
              placeholder="e.g. Prod, Zone 1, RPO 15m"
              autoFocus
              onChange={(e) => setNewBadgeText(e.target.value)}
              onBlur={() => {
                const next = newBadgeText.trim();
                setIsAddingBadge(false);
                setNewBadgeText('');
                if (!next) return;
                setBadges((prev) => [...prev, next]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.currentTarget as HTMLInputElement).blur();
                }
                if (e.key === 'Escape') {
                  setIsAddingBadge(false);
                  setNewBadgeText('');
                }
              }}
            />
          ) : (
            <button
              className="node-badge-add"
              title="Add badge"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingBadge(true);
              }}
            >
              <Plus size={14} />
              Badge
            </button>
          )}
        </div>
        
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
