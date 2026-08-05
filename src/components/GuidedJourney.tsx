// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import {
  Check,
  FileCode2,
  Import,
  MessageSquare,
  Presentation,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import './GuidedJourney.css';

export type JourneyStep = 'create' | 'refine' | 'validate' | 'deliver';

interface JourneyStripProps {
  hasDiagram: boolean;
  hasValidation: boolean;
  hasDeploymentGuide: boolean;
  isValidating?: boolean;
  isGeneratingGuide?: boolean;
  onStep: (step: JourneyStep) => void;
}

const STEPS: Array<{
  id: JourneyStep;
  number: number;
  title: string;
  detail: string;
  Icon: LucideIcon;
}> = [
  { id: 'create', number: 1, title: 'Create', detail: 'Chat, brief, image, or import', Icon: Sparkles },
  { id: 'refine', number: 2, title: 'Refine', detail: 'Chat or edit the canvas', Icon: Wrench },
  { id: 'validate', number: 3, title: 'Validate & Improve', detail: 'Review, apply, and revalidate', Icon: ShieldCheck },
  { id: 'deliver', number: 4, title: 'Share or Build', detail: 'Export or create deployment artifacts', Icon: Presentation },
];

export const JourneyStrip: React.FC<JourneyStripProps> = ({
  hasDiagram,
  hasValidation,
  hasDeploymentGuide,
  isValidating,
  isGeneratingGuide,
  onStep,
}) => {
  const active: JourneyStep = !hasDiagram
    ? 'create'
    : isValidating
      ? 'validate'
      : isGeneratingGuide || hasDeploymentGuide
        ? 'deliver'
        : hasValidation
          ? 'deliver'
          : 'refine';

  const complete = (step: JourneyStep) => {
    if (step === 'create') return hasDiagram;
    if (step === 'refine') return hasDiagram && (hasValidation || hasDeploymentGuide);
    if (step === 'validate') return hasValidation;
    return hasDeploymentGuide;
  };

  return (
    <nav className="journey-strip" aria-label="Recommended architecture workflow">
      <span className="journey-strip-label">Recommended workflow</span>
      <div className="journey-steps">
        {STEPS.map(({ id, number, title, detail, Icon }, index) => {
          const isActive = active === id;
          const isComplete = complete(id);
          return (
            <React.Fragment key={id}>
              {index > 0 && <span className={`journey-connector${isComplete ? ' complete' : ''}`} aria-hidden="true" />}
              <button
                type="button"
                className={`journey-step${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}`}
                onClick={() => onStep(id)}
                aria-current={isActive ? 'step' : undefined}
                title={`${number}. ${title}: ${detail}`}
              >
                <span className="journey-step-number" aria-hidden="true">
                  {isComplete ? <Check size={13} /> : number}
                </span>
                <Icon size={16} />
                <span className="journey-step-copy">
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

interface StartChooserProps {
  onGuidedChat: () => void;
  onGenerate: () => void;
  onImportTemplate: () => void;
  onImportAzure: () => void;
}

export const StartChooser: React.FC<StartChooserProps> = ({
  onGuidedChat,
  onGenerate,
  onImportTemplate,
  onImportAzure,
}) => (
  <div className="start-chooser" role="region" aria-label="Choose how to start">
    <div className="start-chooser-heading">
      <span className="start-chooser-kicker">Step 1 · Create</span>
      <h2>How would you like to start?</h2>
      <p>Choose a path now. All paths lead to the same editable canvas and Guided Chat refinement.</p>
    </div>
    <div className="start-choice-grid">
      <button type="button" className="start-choice recommended" onClick={onGuidedChat}>
        <span className="start-choice-icon"><MessageSquare size={24} /></span>
        <span className="start-choice-badge">Recommended for first-time users</span>
        <strong>Guided Chat</strong>
        <span>Describe the outcome, create the first diagram, and keep refining in one conversation.</span>
      </button>
      <button type="button" className="start-choice" onClick={onGenerate}>
        <span className="start-choice-icon"><Sparkles size={24} /></span>
        <strong>Generate Diagram</strong>
        <span>Use a detailed prompt, upload a sketch, and choose Topology, Blueprint, or both.</span>
      </button>
      <div className="start-choice import-choice">
        <span className="start-choice-icon"><Import size={24} /></span>
        <strong>Import Existing</strong>
        <span>Start from infrastructure code or reverse-engineer a live Azure resource group.</span>
        <div className="start-choice-actions">
          <button type="button" onClick={onImportTemplate}><FileCode2 size={15} /> Template</button>
          <button type="button" onClick={onImportAzure}><Import size={15} /> Azure</button>
        </div>
      </div>
    </div>
  </div>
);

interface DeliverChooserProps {
  onShare: () => void;
  onBuild: () => void;
  onClose: () => void;
  isBuilding?: boolean;
}

export const DeliverChooser: React.FC<DeliverChooserProps> = ({ onShare, onBuild, onClose, isBuilding }) => (
  <div className="deliver-chooser-backdrop" role="presentation" onClick={onClose}>
    <div className="deliver-chooser" role="dialog" aria-modal="true" aria-label="Choose a delivery outcome" onClick={event => event.stopPropagation()}>
      <span className="start-chooser-kicker">Step 4 · Share or Build</span>
      <h2>What do you need next?</h2>
      <p>Share the architecture for review, or create deployment guidance when the design is ready.</p>
      <div className="deliver-choice-grid">
        <button type="button" onClick={onShare}>
          <Presentation size={22} />
          <strong>Share</strong>
          <span>PowerPoint, Visio, Draw.io, PNG, HTML, JSON, and other review formats.</span>
        </button>
        <button type="button" onClick={onBuild} disabled={isBuilding}>
          <FileCode2 size={22} />
          <strong>{isBuilding ? 'Creating guide…' : 'Build'}</strong>
          <span>Generate a deployment guide and starter infrastructure artifacts for review.</span>
        </button>
      </div>
      <button type="button" className="deliver-chooser-close" onClick={onClose}>Cancel</button>
    </div>
  </div>
);
