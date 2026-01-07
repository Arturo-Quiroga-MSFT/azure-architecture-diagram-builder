import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import './WorkflowPanel.css';

interface WorkflowStep {
  step: number;
  description: string;
  services: string[];
}

interface WorkflowPanelProps {
  workflow: WorkflowStep[];
  onServiceHover?: (serviceIds: string[]) => void;
  onServiceLeave?: () => void;
}

const WorkflowPanel: React.FC<WorkflowPanelProps> = ({ 
  workflow, 
  onServiceHover, 
  onServiceLeave 
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!workflow || workflow.length === 0) return null;

  return (
    <div className={`workflow-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="workflow-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="workflow-title">
          <ListOrdered size={20} />
          <h3>Architecture Workflow</h3>
          <span className="workflow-count">{workflow.length} steps</span>
        </div>
        <button className="workflow-toggle">
          {isExpanded ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>
      
      {isExpanded && (
        <div className="workflow-content">
          <div className="workflow-steps">
            {workflow.map((step) => (
              <div
                key={step.step}
                className="workflow-step"
                onMouseEnter={() => onServiceHover?.(step.services)}
                onMouseLeave={() => onServiceLeave?.()}
              >
                <div className="step-number">{step.step}</div>
                <div className="step-description">
                  <p>{step.description}</p>
                  {step.services && step.services.length > 0 && (
                    <div className="step-services">
                      <span className="services-label">Services:</span>
                      <span className="services-count">{step.services.length} service{step.services.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowPanel;
