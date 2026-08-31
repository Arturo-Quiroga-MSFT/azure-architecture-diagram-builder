// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Model Settings Popover
 * Toolbar dropdown for AI model selection. The body is shared with the Settings
 * pane via ModelSettingsControls.
 */

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useModelSettings, MODEL_CONFIG, FEATURE_CONFIG, FeatureType, hasFeatureOverride } from '../stores/modelSettingsStore';
import ModelSettingsControls, { getModelIcon } from './ModelSettingsControls';
import './ModelSettingsPopover.css';

interface ModelSettingsPopoverProps {
  isOpen: boolean;
  onToggle: () => void;
}

const ModelSettingsPopover = forwardRef<HTMLDivElement, ModelSettingsPopoverProps>(
  ({ isOpen, onToggle }, ref) => {
    const [settings] = useModelSettings();
    const currentConfig = MODEL_CONFIG[settings.model];
    const hasAnyOverride = (Object.keys(FEATURE_CONFIG) as FeatureType[]).some(hasFeatureOverride);

    return (
      <div className="toolbar-dropdown" ref={ref}>
        <button
          onClick={onToggle}
          className="btn btn-secondary model-popover-trigger"
          title="AI model settings"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          {getModelIcon(settings.model)}
          <span className="model-popover-label">{currentConfig.displayName}</span>
          {currentConfig.isReasoning && (
            <span className="model-popover-reasoning">{settings.reasoningEffort}</span>
          )}
          {hasAnyOverride && <span className="model-popover-override-dot" />}
          <ChevronDown size={14} style={{ marginLeft: 2 }} />
        </button>

        {isOpen && (
          <div
            className="toolbar-dropdown-menu toolbar-dropdown-menu--model-settings"
            role="menu"
            aria-label="AI model settings"
          >
            <ModelSettingsControls />
          </div>
        )}
      </div>
    );
  }
);

ModelSettingsPopover.displayName = 'ModelSettingsPopover';

export default ModelSettingsPopover;
