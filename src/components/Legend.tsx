import React, { useState, useEffect } from 'react';
import { Zap, DollarSign } from 'lucide-react';
import './Legend.css';

interface LegendProps {
  forceCollapsed?: number;
}

const Legend: React.FC<LegendProps> = ({ forceCollapsed }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (forceCollapsed) setIsCollapsed(true);
  }, [forceCollapsed]);

  return (
    <div className={`legend ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="legend-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="legend-title">LEGEND</span>
        <span className="legend-toggle">{isCollapsed ? '▼' : '▲'}</span>
      </div>
      
      {!isCollapsed && (
        <div className="legend-content">
          <div className="legend-section">
            <div className="legend-section-title">Connection Types</div>
            
            <div className="legend-item">
              <svg width="60" height="20" className="legend-line">
                <line x1="5" y1="10" x2="55" y2="10" stroke="#0078d4" strokeWidth="2" />
              </svg>
              <div className="legend-description">
                <strong>Synchronous</strong>
                <span>Real-time, request-response (HTTP, SQL)</span>
              </div>
            </div>
            
            <div className="legend-item">
              <svg width="60" height="20" className="legend-line">
                <line x1="5" y1="10" x2="55" y2="10" stroke="#0078d4" strokeWidth="2" strokeDasharray="5, 5" />
              </svg>
              <div className="legend-description">
                <strong>Asynchronous</strong>
                <span>Message-based, event-driven (queues, events)</span>
              </div>
            </div>
            
            <div className="legend-item">
              <svg width="60" height="20" className="legend-line">
                <line x1="5" y1="10" x2="55" y2="10" stroke="#0078d4" strokeWidth="2" strokeDasharray="2, 4" opacity="0.6" />
              </svg>
              <div className="legend-description">
                <strong>Optional</strong>
                <span>Conditional, fallback paths</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <div className="legend-section-title">Service Categories</div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#6b7280' }}></div>
              <div className="legend-description">
                <strong>Web & Frontend</strong>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#0078d4' }}></div>
              <div className="legend-description">
                <strong>Compute & API</strong>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#10b981' }}></div>
              <div className="legend-description">
                <strong>Data & Storage</strong>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#f59e0b' }}></div>
              <div className="legend-description">
                <strong>AI & Analytics</strong>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#f97316' }}></div>
              <div className="legend-description">
                <strong>IoT & Devices</strong>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#ef4444' }}></div>
              <div className="legend-description">
                <strong>Security & Identity</strong>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#8b5cf6' }}></div>
              <div className="legend-description">
                <strong>Monitoring & Ops</strong>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-color-box" style={{ backgroundColor: '#06b6d4' }}></div>
              <div className="legend-description">
                <strong>Networking & Integration</strong>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <div className="legend-section-title">Pricing Types</div>
            
            <div className="legend-item">
              <div className="legend-badge fixed-pricing">
                <DollarSign size={12} />
                $XX
              </div>
              <div className="legend-description">
                <strong>Fixed Pricing</strong>
                <span>Predictable monthly cost</span>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-badge usage-pricing">
                <Zap size={12} />
                ~$XX
              </div>
              <div className="legend-description">
                <strong>Usage-Based</strong>
                <span>Varies with consumption</span>
              </div>
            </div>
          </div>

          <div className="legend-section">
            <div className="legend-section-title">Cost Levels</div>
            
            <div className="legend-item">
              <div className="legend-badge cost-low">
                <DollarSign size={12} />
              </div>
              <div className="legend-description">
                <strong>Free / Low</strong>
                <span>Under $100/month</span>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-badge cost-medium">
                <DollarSign size={12} />
              </div>
              <div className="legend-description">
                <strong>Medium</strong>
                <span>$100 - $500/month</span>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-badge cost-high">
                <DollarSign size={12} />
              </div>
              <div className="legend-description">
                <strong>High</strong>
                <span>$500 - $1,000/month</span>
              </div>
            </div>
            
            <div className="legend-item">
              <div className="legend-badge cost-very-high">
                <DollarSign size={12} />
              </div>
              <div className="legend-description">
                <strong>Very High</strong>
                <span>Over $1,000/month</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Legend;
