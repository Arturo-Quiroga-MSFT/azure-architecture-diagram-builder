// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Info, Download, RefreshCw, Clock, Zap } from 'lucide-react';
import { ArchitectureValidation, ValidationFinding, formatValidationReport } from '../services/architectureValidator';
import { generateModelFilename } from '../utils/modelNaming';
import './ValidationModal.css';

/**
 * Props for ValidationModal component
 */
interface ValidationModalProps {
  validation: ArchitectureValidation | null; // Validation results from GPT-5.2 agent
  isOpen: boolean; // Controls modal visibility
  onClose: () => void; // Handler for closing modal
  isLoading?: boolean; // Shows loading state during validation
  onApplyRecommendations?: (selectedFindings: ValidationFinding[]) => void; // Handler for applying selected recommendations
  onRevalidate?: () => void; // Optional handler to rerun validation
}

/**
 * Modal displaying Azure Well-Architected Framework validation results.
 * Shows overall score, pillar-specific assessments, findings, and quick wins.
 * Includes download functionality for markdown report.
 */
const ValidationModal: React.FC<ValidationModalProps> = ({ validation, isOpen, onClose, isLoading, onApplyRecommendations, onRevalidate }) => {
  // Track selected findings for applying recommendations
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());
  
  if (!isOpen) return null;

  /**
   * Toggle selection of a finding
   */
  const toggleFinding = (findingKey: string) => {
    setSelectedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingKey)) {
        next.delete(findingKey);
      } else {
        next.add(findingKey);
      }
      return next;
    });
  };

  /**
   * Get all findings as a flat array with unique keys
   */
  const getAllFindings = (): Array<ValidationFinding & { key: string }> => {
    if (!validation) return [];
    
    const findings: Array<ValidationFinding & { key: string }> = [];
    
    // Add pillar findings
    validation.pillars.forEach((pillar, pIndex) => {
      pillar.findings.forEach((finding, fIndex) => {
        findings.push({
          ...finding,
          key: `pillar-${pIndex}-${fIndex}`
        });
      });
    });
    
    // Add quick wins
    validation.quickWins.forEach((win, wIndex) => {
      findings.push({
        ...win,
        key: `quickwin-${wIndex}`
      });
    });
    
    return findings;
  };

  /**
   * Apply selected recommendations
   */
  const handleApplyRecommendations = () => {
    const allFindings = getAllFindings();
    const selected = allFindings.filter(f => selectedFindings.has(f.key));
    
    if (onApplyRecommendations && selected.length > 0) {
      onApplyRecommendations(selected);
    }
  };

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
    const ts = new Date(validation.timestamp).getTime();
    const report = formatValidationReport(validation);
    
    // Download markdown report
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = generateModelFilename('architecture-validation', 'md', ts);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Download diagram PNG if captured
    if (validation.diagramImageDataUrl) {
      const imgLink = document.createElement('a');
      imgLink.href = validation.diagramImageDataUrl;
      imgLink.download = generateModelFilename('architecture-validation-diagram', 'png', ts);
      document.body.appendChild(imgLink);
      imgLink.click();
      document.body.removeChild(imgLink);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content validation-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔍 Architecture Validation</h2>
          <button className="modal-close" onClick={onClose} title="Hide">
            <X size={24} />
          </button>
        </div>

        {isLoading ? (
          <div className="modal-loading">
            <div className="spinner"></div>
            <div className="loading-content">
              <h3>Analyzing architecture against Azure Well-Architected Framework...</h3>
              <p className="loading-description">
                The Azure Well-Architected Framework (WAF) is a set of guiding principles and best practices 
                that help you build secure, high-performing, resilient, and efficient cloud architectures.
              </p>
              <div className="pillars-info">
                <h4>Five Pillars of Azure Well-Architected Framework:</h4>
                <ul className="pillars-list">
                  <li>
                    <strong>Cost Optimization</strong> - Manage costs to maximize value delivered
                  </li>
                  <li>
                    <strong>Operational Excellence</strong> - Operations processes that keep systems running in production
                  </li>
                  <li>
                    <strong>Performance Efficiency</strong> - Ability to scale and adapt to changes in load
                  </li>
                  <li>
                    <strong>Reliability</strong> - Ability to recover from failures and continue to function
                  </li>
                  <li>
                    <strong>Security</strong> - Protect applications and data from threats
                  </li>
                </ul>
              </div>
            </div>
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
                {validation.metrics && (
                  <div className="ai-metrics-validation">
                    <span className="metric">
                      <Clock size={14} />
                      {(validation.metrics.elapsedTimeMs / 1000).toFixed(1)}s
                    </span>
                    <span className="metric">
                      <Zap size={14} />
                      {validation.metrics.promptTokens.toLocaleString()} in → {validation.metrics.completionTokens.toLocaleString()} out ({validation.metrics.totalTokens.toLocaleString()} total)
                    </span>
                  </div>
                )}
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
                      {pillar.findings.map((finding, fIndex) => {
                        const findingKey = `pillar-${index}-${fIndex}`;
                        const isSelected = selectedFindings.has(findingKey);
                        
                        return (
                          <div key={fIndex} className={`finding-item severity-${finding.severity} ${isSelected ? 'selected' : ''}`}>
                            <div className="finding-header">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleFinding(findingKey)}
                                className="finding-checkbox"
                              />
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
                        );
                      })}
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
            {onRevalidate && (
              <button className="btn-secondary" onClick={onRevalidate} disabled={!!isLoading} title="Run validation again">
                <RefreshCw size={18} />
                Revalidate
              </button>
            )}
            {selectedFindings.size > 0 && onApplyRecommendations && (
              <button className="btn-success" onClick={handleApplyRecommendations}>
                <RefreshCw size={18} />
                Apply {selectedFindings.size} Recommendation{selectedFindings.size > 1 ? 's' : ''}
              </button>
            )}
            <button className="btn-primary" onClick={onClose}>
              Hide
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
