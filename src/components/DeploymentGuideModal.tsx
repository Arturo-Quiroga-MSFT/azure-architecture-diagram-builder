import React, { useState } from 'react';
import { X, Download, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { DeploymentGuide, downloadDeploymentGuide } from '../services/deploymentGuideGenerator';
import './DeploymentGuideModal.css';

interface DeploymentGuideModalProps {
  guide: DeploymentGuide | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
}

const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({ guide, isOpen, onClose, isLoading }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  if (!isOpen) return null;

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleDownload = () => {
    if (!guide) return;
    downloadDeploymentGuide(guide);
  };

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content deployment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📋 Deployment Guide</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {isLoading ? (
          <div className="modal-loading">
            <div className="spinner"></div>
            <p>Generating comprehensive deployment guide...</p>
          </div>
        ) : guide ? (
          <div className="modal-body">
            {/* Title and Overview */}
            <div className="guide-header">
              <h3>{guide.title}</h3>
              <p className="guide-overview">{guide.overview}</p>
              <div className="guide-meta">
                <span className="meta-item">
                  ⏱️ Estimated Time: <strong>{guide.estimatedTime}</strong>
                </span>
              </div>
            </div>

            {/* Prerequisites */}
            <div className="guide-section">
              <h4>✅ Prerequisites</h4>
              <ul className="prerequisites-list">
                {guide.prerequisites.map((prereq, index) => (
                  <li key={index}>{prereq}</li>
                ))}
              </ul>
            </div>

            {/* Deployment Steps */}
            <div className="guide-section">
              <h4>🚀 Deployment Steps</h4>
              <div className="steps-list">
                {guide.deploymentSteps.map((step, index) => (
                  <div key={index} className="step-card">
                    <div 
                      className="step-header"
                      onClick={() => toggleSection(index)}
                    >
                      <div className="step-title">
                        <span className="step-number">{index + 1}</span>
                        <span>{step.title}</span>
                      </div>
                      {expandedSections.has(index) ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </div>

                    {expandedSections.has(index) && (
                      <div className="step-content">
                        <p className="step-description">{step.description}</p>
                        
                        {step.commands && step.commands.length > 0 && (
                          <div className="commands-section">
                            <div className="commands-header">
                              <span>Commands</span>
                            </div>
                            {step.commands.map((cmd, cmdIndex) => (
                              <div key={cmdIndex} className="command-block">
                                <pre>{cmd}</pre>
                                <button
                                  className="copy-button"
                                  onClick={() => handleCopy(cmd, index * 100 + cmdIndex)}
                                  title="Copy to clipboard"
                                >
                                  {copiedIndex === index * 100 + cmdIndex ? (
                                    <Check size={16} />
                                  ) : (
                                    <Copy size={16} />
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {step.notes && (
                          <div className="step-notes">
                            <strong>📝 Note:</strong> {step.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration */}
            {guide.configuration && guide.configuration.length > 0 && (
              <div className="guide-section">
                <h4>⚙️ Configuration</h4>
                {guide.configuration.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="configuration-section">
                    <h5>{section.section}</h5>
                    <div className="configuration-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Setting</th>
                            <th>Value</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.settings.map((config, index) => (
                            <tr key={index}>
                              <td className="config-key">{config.name}</td>
                              <td className="config-value">
                                <code>{config.value}</code>
                              </td>
                              <td className="config-description">{config.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Post-Deployment */}
            {guide.postDeployment && guide.postDeployment.length > 0 && (
              <div className="guide-section">
                <h4>✔️ Post-Deployment Validation</h4>
                <ul className="validation-list">
                  {guide.postDeployment.map((item, index) => (
                    <li key={index}>
                      <input type="checkbox" id={`validation-${index}`} />
                      <label htmlFor={`validation-${index}`}>{item}</label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Troubleshooting */}
            {guide.troubleshooting && guide.troubleshooting.length > 0 && (
              <div className="guide-section troubleshooting-section">
                <h4>🔧 Troubleshooting</h4>
                <div className="troubleshooting-list">
                  {guide.troubleshooting.map((item, index) => (
                    <div key={index} className="troubleshooting-item">
                      <div className="troubleshooting-problem">
                        <strong>Problem:</strong> {item.issue}
                      </div>
                      <div className="troubleshooting-solution">
                        <strong>Solution:</strong> {item.solution}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleDownload}>
                <Download size={18} />
                Download Guide
              </button>
              <button className="btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="modal-empty">
            <p>No deployment guide available.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeploymentGuideModal;
