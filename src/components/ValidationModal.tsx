import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, Download } from 'lucide-react';
import { ArchitectureValidation, ValidationFinding, formatValidationReport } from '../services/architectureValidator';
import './ValidationModal.css';

/**
 * Props for ValidationModal component
 */
interface ValidationModalProps {
  validation: ArchitectureValidation | null; // Validation results from GPT-5.2 agent
  isOpen: boolean; // Controls modal visibility
  onClose: () => void; // Handler for closing modal
  isLoading?: boolean; // Shows loading state during validation
}

/**
 * Modal displaying Azure Well-Architected Framework validation results.
 * Shows overall score, pillar-specific assessments, findings, and quick wins.
 * Includes download functionality for markdown report.
 */
const ValidationModal: React.FC<ValidationModalProps> = ({ validation, isOpen, onClose, isLoading }) => {
  if (!isOpen) return null;

  /**
   * Returns appropriate icon component for finding severity level
   */
  /**
   * Returns appropriate icon component for finding severity level
   */
  const getSeverityIcon = (severity: ValidationFinding['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="severity-icon critical" />;
      case 'high': return <AlertTriangle className="severity-icon high" />;
      case 'medium': return <Info className="severity-icon medium" />;
      case 'low': return <CheckCircle className="severity-icon low" />;
    }
  };

  /**
   * Returns color based on validation score (0-100)
   * Green: 80+, Yellow: 60-79, Orange: 40-59, Red: <40
   */
  /**
   * Returns color based on validation score (0-100)
   * Green: 80+, Yellow: 60-79, Orange: 40-59, Red: <40
   */
  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981'; // Green
    if (score >= 60) return '#f59e0b'; // Yellow
    if (score >= 40) return '#f97316'; // Orange
    return '#ef4444'; // Red
  };

  /**
   * Downloads validation results as markdown file with timestamp
   */
  const handleDownload = () => {
    if (!validation) return;
    const report = formatValidationReport(validation);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `architecture-validation-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content validation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔍 Architecture Validation</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {isLoading ? (
          <div className="modal-loading">
            <div className="spinner"></div>
            <p>Analyzing architecture against Azure Well-Architected Framework...</p>
          </div>
        ) : validation ? (
          <>
            <div className="modal-body">
            {/* Overall Score Section - Circular progress indicator with score */}
            <div className="validation-score">
              <div 
                className="score-circle" 
                style={{ 
                  background: `conic-gradient(${getScoreColor(validation.overallScore)} ${validation.overallScore * 3.6}deg, #e5e7eb 0deg)` 
                }}
              >
                <div className="score-inner">
                  <span className="score-value">{validation.overallScore}</span>
                  <span className="score-label">/100</span>
                </div>
              </div>
              <div className="score-summary">
                <h3>Overall Assessment</h3>
                <p>{validation.summary}</p>
              </div>
            </div>

            {/* Five Pillars Section - Individual assessments for each WAF pillar */}
            <div className="pillars-section">
              <h3>Five Pillars Assessment</h3>
              {validation.pillars.map((pillar, index) => (
                <div key={index} className="pillar-card">
                  <div className="pillar-header">
                    <h4>{pillar.pillar}</h4>
                    <span 
                      className="pillar-score"
                      style={{ color: getScoreColor(pillar.score) }}
                    >
                      {pillar.score}/100
                    </span>
                  </div>
                  
                  {pillar.findings.length > 0 && (
                    <div className="findings-list">
                      {pillar.findings.map((finding, fIndex) => (
                        <div key={fIndex} className={`finding-item severity-${finding.severity}`}>
                          <div className="finding-header">
                            {getSeverityIcon(finding.severity)}
                            <span className="finding-category">{finding.category}</span>
                            <span className={`severity-badge ${finding.severity}`}>
                              {finding.severity}
                            </span>
                          </div>
                          <div className="finding-content">
                            <p className="finding-issue"><strong>Issue:</strong> {finding.issue}</p>
                            <p className="finding-recommendation">
                              <strong>Recommendation:</strong> {finding.recommendation}
                            </p>
                            {finding.resources && finding.resources.length > 0 && (
                              <p className="finding-resources">
                                <strong>Affected:</strong> {finding.resources.join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Wins Section - High-priority actionable items */}
            {validation.quickWins.length > 0 && (
              <div className="quickwins-section">
                <h3>⚡ Quick Wins</h3>
                <div className="quickwins-list">
                  {validation.quickWins.map((win, index) => (
                    <div key={index} className="quickwin-item">
                      <div className="quickwin-header">
                        <CheckCircle className="quickwin-icon" />
                        <span className="quickwin-category">{win.category}</span>
                      </div>
                      <p className="quickwin-recommendation">{win.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Action Buttons - Sticky footer with download and close */}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={handleDownload}>
              <Download size={18} />
              Download Report
            </button>
            <button className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
        ) : (
          <div className="modal-empty">
            <p>No validation results available.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationModal;
