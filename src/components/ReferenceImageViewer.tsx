// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import { Image, X, Maximize2, Minimize2 } from 'lucide-react';
import './ReferenceImageViewer.css';

interface ReferenceImageViewerProps {
  imageUrl: string;
  onDismiss: () => void;
}

const ReferenceImageViewer: React.FC<ReferenceImageViewerProps> = ({ imageUrl, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <div className="ref-image-viewer ref-image-collapsed" onClick={() => setIsCollapsed(false)}>
        <Image size={16} />
        <span>Reference</span>
      </div>
    );
  }

  return (
    <>
      {/* Expanded overlay */}
      {isExpanded && (
        <div className="ref-image-overlay" onClick={() => setIsExpanded(false)}>
          <div className="ref-image-overlay-content" onClick={(e) => e.stopPropagation()}>
            <div className="ref-image-overlay-header">
              <span><Image size={16} /> Reference Diagram</span>
              <button onClick={() => setIsExpanded(false)} className="ref-image-close-btn" title="Close">
                <X size={18} />
              </button>
            </div>
            <img src={imageUrl} alt="Reference architecture diagram" className="ref-image-full" />
          </div>
        </div>
      )}

      {/* Floating thumbnail */}
      <div className="ref-image-viewer ref-image-thumbnail">
        <div className="ref-image-header">
          <span className="ref-image-label">
            <Image size={12} />
            Reference
          </span>
          <div className="ref-image-actions">
            <button onClick={() => setIsExpanded(true)} title="Expand" className="ref-image-btn">
              <Maximize2 size={12} />
            </button>
            <button onClick={() => setIsCollapsed(true)} title="Minimize" className="ref-image-btn">
              <Minimize2 size={12} />
            </button>
            <button onClick={onDismiss} title="Dismiss" className="ref-image-btn ref-image-btn-dismiss">
              <X size={12} />
            </button>
          </div>
        </div>
        <img
          src={imageUrl}
          alt="Reference architecture diagram"
          className="ref-image-thumb"
          onClick={() => setIsExpanded(true)}
        />
      </div>
    </>
  );
};

export default ReferenceImageViewer;
