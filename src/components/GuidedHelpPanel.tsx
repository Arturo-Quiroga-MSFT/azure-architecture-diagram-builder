// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useState } from 'react';
import {
  BookOpen, Check, CheckCircle2, CircleDollarSign, ClipboardCheck, Download,
  Copy, FileCode2, GitCompare, History, Image as ImageIcon, LayoutDashboard,
  Lightbulb, Map, MessageSquare, MousePointer2, Presentation,
  Rocket, Route, ShieldCheck, Sparkles, UploadCloud, Wrench, X,
} from 'lucide-react';
import { trackHelpOpened } from '../services/telemetryService';
import './GuidedHelpPanel.css';

interface GuidedHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SectionId = 'quick-start' | 'paths' | 'create' | 'assess' | 'deliver' | 'prompts' | 'faq';

const CHECKLIST_STORAGE_KEY = 'help.onboarding.v2';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'quick-start', label: 'Start Here', icon: <Rocket size={16} /> },
  { id: 'paths', label: 'Choose a Path', icon: <Route size={16} /> },
  { id: 'create', label: 'Create & Refine', icon: <Sparkles size={16} /> },
  { id: 'assess', label: 'Assess', icon: <ShieldCheck size={16} /> },
  { id: 'deliver', label: 'Deliver', icon: <Presentation size={16} /> },
  { id: 'prompts', label: 'Prompt Lab', icon: <Lightbulb size={16} /> },
  { id: 'faq', label: 'FAQ & Safety', icon: <BookOpen size={16} /> },
];

const FIRST_TOUR = [
  { id: 'create', title: 'Create or import a diagram', detail: 'Use Chat, Generate with AI, an image, an IaC template, or Import from Azure.' },
  { id: 'refine', title: 'Make one targeted change', detail: 'Ask Chat for a change or edit nodes, groups, and connections directly.' },
  { id: 'validate', title: 'Run Well-Architected validation', detail: 'Review the five pillars and identify the most important gaps.' },
  { id: 'cost', title: 'Inspect cost and region', detail: 'Choose a region, compare PAYG and 1-year savings, and inspect service estimates.' },
  { id: 'export', title: 'Export a useful artifact', detail: 'Try PowerPoint, Visio, Draw.io, PNG, HTML, workflow Markdown, or JSON.' },
];

const PATHS = [
  {
    icon: <MessageSquare size={20} />,
    title: 'Start from an idea',
    label: 'Fastest path',
    steps: ['Open Chat', 'Describe the outcome and constraints', 'Refine in plain English'],
  },
  {
    icon: <ImageIcon size={20} />,
    title: 'Start from a sketch',
    label: 'Whiteboard or screenshot',
    steps: ['Open Generate with AI', 'Upload the image', 'Review the reconstructed services and flows'],
  },
  {
    icon: <FileCode2 size={20} />,
    title: 'Start from current estate',
    label: 'IaC or live Azure',
    steps: ['Import Bicep, Terraform, or ARM', 'Or use Import from Azure', 'Correct inferred relationships on canvas'],
  },
  {
    icon: <Presentation size={20} />,
    title: 'Prepare a review or workshop',
    label: 'Customer-ready flow',
    steps: ['Generate and correct the concept', 'Validate and inspect cost', 'Export a customer deck or editable artifact'],
  },
];

const CREATE_FEATURES = [
  { icon: <MessageSquare size={18} />, title: 'Architecture Chat', body: 'Build from empty or refine the current canvas. Existing manual positions are retained during AI modifications, and each change is snapshotted.' },
  { icon: <Sparkles size={18} />, title: 'Generate with AI', body: 'Choose Topology for an editable canvas, Blueprint for a whiteboard-style PNG, or Both for the two views together.' },
  { icon: <UploadCloud size={18} />, title: 'Import', body: 'Reconstruct a diagram image, parse Bicep/Terraform/ARM, or sign in to reverse-engineer a live Azure resource group.' },
  { icon: <GitCompare size={18} />, title: 'Compare Models', body: 'Run one prompt across several models, inspect latency/tokens/topology differences, and apply the result you prefer.' },
  { icon: <MousePointer2 size={18} />, title: 'Edit on canvas', body: 'Drag services, resize groups, edit labels, reconnect edges, align selections, and choose a layout preset or edge style.' },
  { icon: <History size={18} />, title: 'Version History', body: 'A snapshot is saved before AI regeneration. Save named checkpoints and restore prior versions when an experiment does not work.' },
];

const ASSESS_FEATURES = [
  { icon: <ShieldCheck size={18} />, title: 'Well-Architected validation', body: 'Review Cost Optimization, Operational Excellence, Performance Efficiency, Reliability, and Security. Apply selected recommendations to create a new iteration.' },
  { icon: <GitCompare size={18} />, title: 'Compare Validation', body: 'Ask multiple models to review the same architecture, compare findings, and use consensus to separate recurring gaps from model-specific opinions.' },
  { icon: <CircleDollarSign size={18} />, title: 'Cost and region', body: 'Inspect per-service monthly estimates across eight regions and switch between PAYG and 1-year savings. Usage-based values remain indicative.' },
  { icon: <ClipboardCheck size={18} />, title: 'Validation handoff', body: 'After generation, use Validate now to check readiness before sharing. A concept diagram is still a hypothesis—not an approved production design.' },
];

const DELIVER_FEATURES = [
  { icon: <Download size={18} />, title: 'Editable formats', body: 'Use Visio (VSDX), Draw.io, JSON, or interactive HTML when another person needs to continue editing.' },
  { icon: <Presentation size={18} />, title: 'Presentation formats', body: 'Export PNG, SVG, a PowerPoint slide, or a multi-slide customer architecture deck.' },
  { icon: <Map size={18} />, title: 'Workflow outputs', body: 'Export a Markdown narrative or animated workflow, and use Narrate when the Speech presenter is available.' },
  { icon: <FileCode2 size={18} />, title: 'Deployment Guide', body: 'Generate a Microsoft Learn-grounded runbook and Bicep starters. Review all commands, sizing, identities, and safeguards before deployment.' },
  { icon: <CircleDollarSign size={18} />, title: 'Cost package', body: 'Download CSV or the all-formats ZIP with summaries, analysis, JSON, and multi-region comparison.' },
  { icon: <LayoutDashboard size={18} />, title: 'Demo mode', body: 'Use Focus, Hide Toolbar, collapse groups, mini-map navigation, and Fit to view to present large diagrams clearly.' },
];

const STRUCTURED_PROMPT = `Design an Azure architecture for the following workload.

Outcome: <business outcome in one sentence>
Users and channels: <who uses it, how, and approximate scale>
Data sources and destinations: <systems, documents, events, databases>
AI capabilities: <retrieval, conversation, prediction, vision, automation>
Existing investments to reuse: <Azure, Microsoft 365, Fabric, Dynamics>
Constraints:
  - Region(s): <primary and DR>
  - Identity: <Entra ID, external identities, hybrid>
  - Compliance and data sensitivity: <requirements>
  - Availability and scale: <targets>
  - Budget or delivery stage: <demo, pilot, production>
Out of scope: <explicit exclusions>

Group the design by responsibility, show primary data flows, and include identity, observability, and secrets management where required.`;

const EXAMPLE_PROMPTS = [
  'Internal RAG assistant grounded on SharePoint and policy documents, available in Teams, secured with Entra ID, with citations and feedback telemetry.',
  'Event-driven order processing at 50K orders/hour using API Management, Service Bus, Functions, Cosmos DB, Key Vault, and Application Insights.',
  'Import and modernize a three-tier application into Container Apps with private connectivity, managed identity, Azure SQL, Redis, and Front Door with WAF.',
  'AI Discovery Cards workshop concept: reduce claims triage time using Document Intelligence, anomaly detection, human review, Fabric analytics, and D365 integration.',
];

function readCompletedTour(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter((value) => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

const GuidedHelpPanel: React.FC<GuidedHelpPanelProps> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState<SectionId>('quick-start');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [completedTour, setCompletedTour] = useState<Set<string>>(readCompletedTour);

  useEffect(() => {
    if (isOpen) trackHelpOpened('quick-start');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const goToSection = (id: SectionId) => {
    setSection(id);
    trackHelpOpened(id);
  };

  const toggleTourItem = (id: string) => {
    setCompletedTour((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      trackHelpOpened(`checklist-${id}-${next.has(id) ? 'done' : 'open'}`);
      return next;
    });
  };

  const copyText = async (text: string, key: string) => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand('copy');
      textarea.remove();
    }

    if (copied) {
      setCopiedKey(key);
      trackHelpOpened(`copied-${key}`);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1600);
    }
  };

  if (!isOpen) return null;

  const completedCount = FIRST_TOUR.filter((item) => completedTour.has(item.id)).length;

  return (
    <div className="guided-help-overlay" role="dialog" aria-modal="true" aria-label="Help and Learn" onClick={onClose}>
      <div className="guided-help-modal" onClick={(event) => event.stopPropagation()}>
        <header className="guided-help-header">
          <div className="guided-help-title">
            <BookOpen size={21} />
            <div><strong>Help &amp; Learn</strong><span>From first prompt to architecture handoff</span></div>
          </div>
          <button className="guided-help-close" onClick={onClose} title="Close" aria-label="Close help"><X size={18} /></button>
        </header>

        <div className="guided-help-body">
          <nav className="guided-help-nav" aria-label="Help sections">
            {SECTIONS.map((item) => (
              <button key={item.id} className={`guided-help-nav-item${section === item.id ? ' active' : ''}`} onClick={() => goToSection(item.id)}>
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
            <div className="guided-help-nav-progress">
              <span>First tour</span><strong>{completedCount}/{FIRST_TOUR.length}</strong>
              <div><i style={{ width: `${completedCount * 100 / FIRST_TOUR.length}%` }} /></div>
            </div>
          </nav>

          <main className="guided-help-content">
            {section === 'quick-start' && (
              <section className="guided-help-section">
                <p className="guided-help-eyebrow">Your first 10 minutes</p>
                <h2>Build confidence by completing one full loop</h2>
                <p className="guided-help-lead">Create, correct, validate, inspect cost, and export. Mark each task as you try it—the checklist is saved in this browser.</p>
                <div className="guided-help-checklist">
                  {FIRST_TOUR.map((item, index) => {
                    const done = completedTour.has(item.id);
                    return <button key={item.id} className={done ? 'done' : ''} onClick={() => toggleTourItem(item.id)} aria-pressed={done}>
                      <span className="guided-help-check-state">{done ? <CheckCircle2 size={20} /> : index + 1}</span>
                      <span><strong>{item.title}</strong><small>{item.detail}</small></span>
                    </button>;
                  })}
                </div>
                <div className="guided-help-callout"><ShieldCheck size={18} /><span><strong>Important:</strong> AI output is a starting hypothesis. Correct it with domain experts, validate assumptions, and review generated deployment content before use.</span></div>
                <div className="guided-help-next"><button onClick={() => goToSection('paths')}>Choose how you want to start <Route size={16} /></button></div>
              </section>
            )}

            {section === 'paths' && (
              <section className="guided-help-section">
                <p className="guided-help-eyebrow">Choose a starting point</p>
                <h2>You do not need to begin with a perfect prompt</h2>
                <div className="guided-help-paths">{PATHS.map((path) => <article key={path.title}>
                  <div className="guided-help-path-icon">{path.icon}</div><span>{path.label}</span><h3>{path.title}</h3>
                  <ol>{path.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                </article>)}</div>
              </section>
            )}

            {section === 'create' && <FeatureSection eyebrow="Create and refine" title="Move between AI and direct canvas editing" intro="Use AI for acceleration, then use the canvas for precision. Targeted follow-up requests preserve your existing manual layout." features={CREATE_FEATURES} />}
            {section === 'assess' && <FeatureSection eyebrow="Assess" title="Turn a diagram into a review conversation" intro="Validation and cost are decision aids. They expose assumptions and tradeoffs; they do not replace sizing, security review, or architecture approval." features={ASSESS_FEATURES} />}
            {section === 'deliver' && <FeatureSection eyebrow="Deliver" title="Choose an output for the next person" intro="Export based on what the recipient needs to do next: present, edit, review, estimate, or continue implementation planning." features={DELIVER_FEATURES} />}

            {section === 'prompts' && (
              <section className="guided-help-section">
                <p className="guided-help-eyebrow">Prompt Lab</p><h2>Describe intent and constraints—not a shopping list</h2>
                <p className="guided-help-lead">A useful prompt names the outcome, users, data, existing investments, and non-functional constraints. You can leave unknowns explicit.</p>
                <div className="guided-help-template"><pre>{STRUCTURED_PROMPT}</pre><button onClick={() => copyText(STRUCTURED_PROMPT, 'template')}>{copiedKey === 'template' ? <Check size={16} /> : <Copy size={16} />}{copiedKey === 'template' ? 'Copied' : 'Copy template'}</button></div>
                <h3>Quick examples</h3><div className="guided-help-prompts">{EXAMPLE_PROMPTS.map((prompt, index) => <button key={prompt} onClick={() => copyText(prompt, `example-${index}`)}><span>{prompt}</span>{copiedKey === `example-${index}` ? <Check size={16} /> : <Copy size={16} />}</button>)}</div>
                <div className="guided-help-callout"><Wrench size={18} /><span>Best follow-ups are specific: “keep existing positions,” “use private endpoints for data services,” “show a pilot under $500/month,” or “replace App Service with Container Apps.”</span></div>
              </section>
            )}

            {section === 'faq' && (
              <section className="guided-help-section">
                <p className="guided-help-eyebrow">FAQ and responsible use</p><h2>Know what the tool does—and what still needs review</h2>
                <div className="guided-help-faq">
                  <Faq q="Which model should I use?" a="Use the selected default for most work. Compare models when the architecture is consequential or outputs vary. Higher reasoning can improve complex designs but usually takes longer." />
                  <Faq q="How do I correct an AI result?" a="Use Chat for a targeted change, then edit directly on canvas. Existing positions are preserved during refinements. Version History lets you restore an earlier state." />
                  <Faq q="Can I import existing infrastructure?" a="Yes. Import Bicep, Terraform, ARM, an architecture image, or a live Azure resource group. Review inferred connections and unsupported resources." />
                  <Faq q="Are the costs authoritative?" a="No. They are indicative catalog-based estimates. Confirm SKU, quantity, usage, discounts, networking, support, and regional availability in the Azure Pricing Calculator." />
                  <Faq q="Does a WAF score approve the design?" a="No. It is a structured review aid based on visible topology and model context. Validate findings with architects, security, operations, and workload owners." />
                  <Faq q="Can I deploy the generated Bicep directly?" a="Treat it as starter IaC. Review API versions, identities, network controls, naming, policy, sizing, dependencies, and destructive operations before deployment." />
                  <Faq q="What information should I avoid entering?" a="Do not enter passwords, keys, tokens, regulated personal data, confidential customer content, or production data unless your organization has explicitly approved that use." />
                </div>
                <h3>Trusted references</h3>
                <ul className="guided-help-resources">
                  <li><a href="https://techcommunity.microsoft.com/blog/azurearchitectureblog/from-prompt-to-production-building-azure-architecture-diagrams-with-ai/4520336" target="_blank" rel="noopener noreferrer">From Prompt to Production—AADB overview</a></li>
                  <li><a href="https://learn.microsoft.com/azure/well-architected/" target="_blank" rel="noopener noreferrer">Azure Well-Architected Framework</a></li>
                  <li><a href="https://azure.microsoft.com/pricing/calculator/" target="_blank" rel="noopener noreferrer">Azure Pricing Calculator</a></li>
                  <li><a href="https://learn.microsoft.com/azure/architecture/" target="_blank" rel="noopener noreferrer">Azure Architecture Center</a></li>
                </ul>
                <p className="guided-help-feedback">Still stuck or found something wrong? Close Help and use the <strong>Feedback</strong> button in the lower-right corner.</p>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

function FeatureSection({ eyebrow, title, intro, features }: { eyebrow: string; title: string; intro: string; features: typeof CREATE_FEATURES }) {
  return <section className="guided-help-section"><p className="guided-help-eyebrow">{eyebrow}</p><h2>{title}</h2><p className="guided-help-lead">{intro}</p><div className="guided-help-features">{features.map((feature) => <article key={feature.title}><div>{feature.icon}</div><span><strong>{feature.title}</strong><small>{feature.body}</small></span></article>)}</div></section>;
}

function Faq({ q, a }: { q: string; a: string }) {
  return <article><h3>{q}</h3><p>{a}</p></article>;
}

export default GuidedHelpPanel;