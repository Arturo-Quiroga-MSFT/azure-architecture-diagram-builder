// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useState } from 'react';
import {
  X, Rocket, Sparkles, MessageSquare, Image as ImageIcon, PenTool, ShieldCheck,
  GitCompare, DollarSign, FileText, Mic, History, Lightbulb, BookOpen, Copy, Check,
  Download, Map,
} from 'lucide-react';
import { trackHelpOpened } from '../services/telemetryService';
import './HelpLearnPanel.css';

interface HelpLearnPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SectionId = 'quick-start' | 'features' | 'prompts' | 'tips' | 'resources';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'quick-start', label: 'Quick Start', icon: <Rocket size={16} /> },
  { id: 'features', label: 'Feature Tour', icon: <Sparkles size={16} /> },
  { id: 'prompts', label: 'Example Prompts', icon: <Lightbulb size={16} /> },
  { id: 'tips', label: 'Tips & FAQ', icon: <BookOpen size={16} /> },
  { id: 'resources', label: 'Resources', icon: <FileText size={16} /> },
];

const EXAMPLE_PROMPTS = [
  'A web application with a React frontend, Node.js backend API, PostgreSQL database, and blob storage for images',
  'A microservices architecture with Container Apps, API gateway, message queue, and Redis cache',
  'A zero trust enterprise network with Azure Firewall, Application Gateway with WAF, Private Link for PaaS, Bastion for VM access, and Microsoft Entra ID with Conditional Access',
  'A HIPAA-compliant healthcare platform with FHIR APIs, de-identification pipeline, and audit logging',
  'An event-driven order processing system handling 50K orders/hour with Event Hubs, Functions, and Cosmos DB',
];

const FEATURES: { icon: React.ReactNode; title: string; body: string }[] = [
  { icon: <Sparkles size={18} />, title: 'AI Architecture Generation', body: 'Describe your architecture in plain English and pick a model — the AI lays out a complete, grouped diagram. Upload an existing diagram image to recreate it as editable nodes.' },
  { icon: <MessageSquare size={18} />, title: 'Architecture Chat', body: 'Your fastest starting point — the Chat panel opens automatically with ready‑made starter patterns. Build or refine in plain English (“add Front Door with WAF”, then “make it zone‑redundant”), and it even suggests the most valuable missing pieces based on what’s on the canvas. Every change is auto‑saved to version history.' },
  { icon: <ImageIcon size={18} />, title: 'Image Import', body: 'Drop a screenshot, whiteboard photo, or exported PNG into the AI generator and it reconstructs the architecture with proper Azure service mapping.' },
  { icon: <PenTool size={18} />, title: 'Blueprint Diagrams', body: 'Generate a hand‑drawn, whiteboard‑style blueprint PNG with numbered, labeled flows — great for presentations. Use Topology, Blueprint, or Both.' },
  { icon: <ShieldCheck size={18} />, title: 'Well‑Architected Validation', body: 'Score your design across the five WAF pillars, review findings, and regenerate an improved architecture from selected recommendations.' },
  { icon: <GitCompare size={18} />, title: 'Multi‑Model Comparison', body: 'Run the same prompt across models and compare service counts, tokens, latency, and WAF scores side‑by‑side, then apply the winner.' },
  { icon: <DollarSign size={18} />, title: 'Cost Estimation', body: 'See estimated monthly cost across 8 Azure regions with per‑service breakdowns, and export CSV / multi‑format cost reports.' },
  { icon: <FileText size={18} />, title: 'Deployment Guides', body: 'Generate step‑by‑step deployment docs with Bicep templates — now grounded in official Microsoft Learn docs with citations.' },
  { icon: <Download size={18} />, title: 'Export Anywhere', body: 'Export to PNG, SVG, Visio (VSDX), Draw.io, PowerPoint, interactive HTML, a Markdown workflow narrative, or a re‑importable JSON manifest — plus CSV/ZIP cost reports.' },
  { icon: <Map size={18} />, title: 'Navigate Large Diagrams', body: 'Drag or scroll the mini‑map (bottom‑right) to move around, click Fit‑to‑view to frame everything, or use Focus mode / Hide Toolbar to maximize canvas space for demos.' },
  { icon: <Mic size={18} />, title: 'Avatar Presenter', body: 'Have a photorealistic avatar narrate the model comparison or walk through each workflow step with live closed captions.' },
  { icon: <History size={18} />, title: 'Version History', body: 'A snapshot is auto‑saved before each AI regeneration. Browse and restore previous versions at any time.' },
];

const HelpLearnPanel: React.FC<HelpLearnPanelProps> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState<SectionId>('quick-start');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Telemetry: panel open.
  useEffect(() => {
    if (isOpen) trackHelpOpened('quick-start');
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const goToSection = (id: SectionId) => {
    setSection(id);
    trackHelpOpened(id);
  };

  const copyPrompt = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((c) => (c === index ? null : c)), 1500);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  if (!isOpen) return null;

  return (
    <div className="help-overlay" role="dialog" aria-modal="true" aria-label="Help and Learn" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <div className="help-title">
            <BookOpen size={20} />
            <span>Help &amp; Learn</span>
          </div>
          <button className="help-close" onClick={onClose} title="Close" aria-label="Close help">
            <X size={18} />
          </button>
        </div>

        <div className="help-body">
          <nav className="help-nav" aria-label="Help sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`help-nav-item${section === s.id ? ' active' : ''}`}
                onClick={() => goToSection(s.id)}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </nav>

          <div className="help-content">
            {section === 'quick-start' && (
              <div className="help-section">
                <h3>Get your first diagram in 3 steps</h3>
                <ol className="help-steps">
                  <li>
                    <strong>Start it.</strong> Describe your architecture in the <em>Chat</em>
                    panel (it opens automatically) — or click <em>Generate with AI</em> to type a
                    prompt or upload a diagram image — then pick a model.
                  </li>
                  <li>
                    <strong>Refine it.</strong> Keep chatting to ask for changes —
                    e.g. “add a load balancer in front of the VMs”. The canvas updates and each
                    change is saved to version history.
                  </li>
                  <li>
                    <strong>Use it.</strong> <em>Validate</em> against the Well‑Architected
                    Framework, estimate <em>Cost</em>, generate a <em>Deployment Guide</em>, or
                    export to PNG / Visio / Draw.io / PowerPoint.
                  </li>
                </ol>
                <p className="help-callout">
                  💡 New here? Skim the <button className="help-link" onClick={() => goToSection('features')}>Feature Tour</button> and try an
                  <button className="help-link" onClick={() => goToSection('prompts')}>Example Prompt</button>.
                </p>
              </div>
            )}

            {section === 'features' && (
              <div className="help-section">
                <h3>What the tool can do</h3>
                <div className="help-feature-list">
                  {FEATURES.map((f) => (
                    <div key={f.title} className="help-feature">
                      <div className="help-feature-icon">{f.icon}</div>
                      <div>
                        <div className="help-feature-title">{f.title}</div>
                        <div className="help-feature-body">{f.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section === 'prompts' && (
              <div className="help-section">
                <h3>Example prompts</h3>
                <p className="help-muted">Click to copy, then paste into <em>Generate with AI</em>.</p>
                <div className="help-prompts">
                  {EXAMPLE_PROMPTS.map((p, i) => (
                    <button key={i} className="help-prompt" onClick={() => copyPrompt(p, i)} title="Copy prompt">
                      <span>{p}</span>
                      {copiedIndex === i ? <Check size={16} className="help-prompt-icon copied" /> : <Copy size={16} className="help-prompt-icon" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {section === 'tips' && (
              <div className="help-section">
                <h3>Tips &amp; FAQ</h3>
                <div className="help-faq">
                  <div className="help-faq-item">
                    <div className="help-faq-q">Which model should I use?</div>
                    <div className="help-faq-a">Start with the recommended default (GPT‑5.2) for balanced quality. Use higher reasoning effort for complex enterprise architectures; lighter models are faster and cheaper for quick drafts.</div>
                  </div>
                  <div className="help-faq-item">
                    <div className="help-faq-q">My diagram isn’t quite right — what now?</div>
                    <div className="help-faq-a">Use <em>Chat</em> to make targeted edits instead of regenerating from scratch. You can also drag nodes, edit connections, and resize groups directly on the canvas.</div>
                  </div>
                  <div className="help-faq-item">
                    <div className="help-faq-q">I can’t see my whole diagram — how do I navigate?</div>
                    <div className="help-faq-a">Scroll to zoom and right‑click‑drag to pan, or drag the mini‑map (bottom‑right) to move around. Click <em>Fit‑to‑view</em> to frame the whole diagram, and use <em>Focus</em> / <em>Hide Toolbar</em> for more space.</div>
                  </div>
                  <div className="help-faq-item">
                    <div className="help-faq-q">Can I import existing infrastructure?</div>
                    <div className="help-faq-a">Yes — import a Bicep, Terraform, or ARM template, or upload a diagram image, and the AI reconstructs an editable diagram.</div>
                  </div>
                  <div className="help-faq-item">
                    <div className="help-faq-q">How do I undo an AI change?</div>
                    <div className="help-faq-a">Open <em>Version History</em> — a snapshot is saved automatically before each AI regeneration, so you can restore any prior state.</div>
                  </div>
                  <div className="help-faq-item">
                    <div className="help-faq-q">Are deployment guides accurate?</div>
                    <div className="help-faq-a">They’re grounded in official Microsoft Learn docs with citations. Always review commands and Bicep before running them in your environment.</div>
                  </div>
                </div>
              </div>
            )}

            {section === 'resources' && (
              <div className="help-section">
                <h3>Resources</h3>
                <ul className="help-resources">
                  <li>
                    <a href="https://techcommunity.microsoft.com/blog/azurearchitectureblog/from-prompt-to-production-building-azure-architecture-diagrams-with-ai/4520336" target="_blank" rel="noopener noreferrer">
                      From Prompt to Production — blog post
                    </a>
                  </li>
                  <li>Share feedback any time via the <em>Feedback</em> button (bottom‑right).</li>
                </ul>
                <p className="help-muted">More guided content is on the way — see the Help &amp; Learn plan in the repo docs.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpLearnPanel;
