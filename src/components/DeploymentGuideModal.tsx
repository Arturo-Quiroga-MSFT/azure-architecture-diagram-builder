import React, { useState } from 'react';
import { X, Download, Copy, Check, ChevronDown, ChevronUp, FileCode, Package, Clock, Zap } from 'lucide-react';
import { DeploymentGuide, downloadDeploymentGuide, downloadBicepTemplate, downloadAllBicepTemplates, BicepModule } from '../services/deploymentGuideGenerator';
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
  const [expandedBicep, setExpandedBicep] = useState<Set<number>>(new Set([0]));

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

  const handleDownloadBicep = (template: BicepModule) => {
    downloadBicepTemplate(template);
  };

  const handleDownloadAllBicep = () => {
    if (!guide) return;
    downloadAllBicepTemplates(guide);
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

  const toggleBicep = (index: number) => {
    const newExpanded = new Set(expandedBicep);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBicep(newExpanded);
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
          <>
            <div className="modal-body">
            {/* Title and Overview */}
            <div className="guide-header">
              <h3>{guide.title}</h3>
              <p className="guide-overview">{guide.overview}</p>
              <div className="guide-meta">
                <span className="meta-item">
                  ⏱️ Estimated Time: <strong>{guide.estimatedTime}</strong>
                </span>
                {guide.metrics && (
                  <span className="meta-item ai-metrics-inline">
                    <Clock size={14} />
                    Generated in {(guide.metrics.elapsedTimeMs / 1000).toFixed(1)}s
                    <Zap size={14} style={{ marginLeft: '12px' }} />
                    {guide.metrics.promptTokens.toLocaleString()} in → {guide.metrics.completionTokens.toLocaleString()} out ({guide.metrics.totalTokens.toLocaleString()} tokens)
                  </span>
                )}
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

            {/* Bicep Templates - Infrastructure as Code */}
            {guide.bicepTemplates && guide.bicepTemplates.length > 0 && (
              <div className="guide-section bicep-section">
                <div className="bicep-header">
                  <h4><FileCode size={20} /> Infrastructure as Code (Bicep)</h4>
                  <button 
                    className="btn-download-all-bicep"
                    onClick={handleDownloadAllBicep}
                    title="Download all Bicep templates"
                  >
                    <Package size={16} />
                    Download All Templates
                  </button>
                </div>
                <p className="bicep-description">
                  Production-ready Bicep templates for automated infrastructure deployment. 
                  Deploy with: <code>az deployment group create --resource-group &lt;rg-name&gt; --template-file main.bicep</code>
                </p>
                <div className="bicep-templates-list">
                  {guide.bicepTemplates.map((template, index) => (
                    <div key={index} className="bicep-template-card">
                      <div 
                        className="bicep-template-header"
                        onClick={() => toggleBicep(index)}
                      >
                        <div className="bicep-template-info">
                          <FileCode size={18} className="bicep-icon" />
                          <div className="bicep-template-meta">
                            <span className="bicep-template-name">{template.name}</span>
                            <span className="bicep-template-filename">{template.filename}</span>
                          </div>
                        </div>
                        <div className="bicep-template-actions">
                          <button
                            className="btn-download-bicep"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadBicep(template);
                            }}
                            title={`Download ${template.filename}`}
                          >
                            <Download size={14} />
                          </button>
                          {expandedBicep.has(index) ? (
                            <ChevronUp size={20} />
                          ) : (
                            <ChevronDown size={20} />
                          )}
                        </div>
                      </div>

                      {expandedBicep.has(index) && (
                        <div className="bicep-template-content">
                          <p className="bicep-template-description">{template.description}</p>
                          <div className="bicep-code-block">
                            <div className="bicep-code-header">
                              <span>{template.filename}</span>
                              <button
                                className="copy-button"
                                onClick={() => handleCopy(template.content, 1000 + index)}
                                title="Copy to clipboard"
                              >
                                {copiedIndex === 1000 + index ? (
                                  <Check size={14} />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                            <pre className="bicep-code">{template.content}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

            </div>

            {/* Actions - Fixed at bottom */}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleDownload}>
                <Download size={18} />
                Download Guide
              </button>
              <button className="btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
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
