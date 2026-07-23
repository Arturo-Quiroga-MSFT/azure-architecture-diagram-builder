// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import './ValidationHandoffToast.css';

interface ValidationHandoffToastProps {
  isOpen: boolean;
  isModification: boolean;
  isChatOpen: boolean;
  onValidate: () => void;
  onDismiss: () => void;
}

const ValidationHandoffToast: React.FC<ValidationHandoffToastProps> = ({
  isOpen,
  isModification,
  isChatOpen,
  onValidate,
  onDismiss,
}) => {
  if (!isOpen) return null;

  return (
    <aside
      className={`validation-handoff${isChatOpen ? ' validation-handoff-with-chat' : ''}`}
      aria-label="Validate generated architecture"
    >
      <button
        type="button"
        className="validation-handoff-close"
        onClick={onDismiss}
        title="Not now"
        aria-label="Dismiss validation suggestion"
      >
        <X size={16} />
      </button>

      <div className="validation-handoff-icon" aria-hidden="true">
        <ShieldCheck size={22} />
      </div>
      <div className="validation-handoff-content">
        <strong>{isModification ? 'Architecture updated' : 'Architecture generated'}</strong>
        <span>Check Well-Architected readiness before you export or share it.</span>
        <div className="validation-handoff-actions">
          <button type="button" className="validation-handoff-primary" onClick={onValidate}>
            <ShieldCheck size={16} />
            Validate now
          </button>
          <button type="button" className="validation-handoff-secondary" onClick={onDismiss}>
            Not now
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ValidationHandoffToast;