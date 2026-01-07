import React from 'react';
import { 
  AlignHorizontalDistributeCenter, 
  AlignVerticalDistributeCenter,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal
} from 'lucide-react';
import { Node } from 'reactflow';
import './AlignmentToolbar.css';

interface AlignmentToolbarProps {
  selectedNodes: Node[];
  onAlign: (type: string) => void;
}

const AlignmentToolbar: React.FC<AlignmentToolbarProps> = ({ selectedNodes, onAlign }) => {
  if (selectedNodes.length < 2) return null;

  return (
    <div className="alignment-toolbar">
      <div className="toolbar-section">
        <span className="toolbar-label">Align:</span>
        <button 
          onClick={() => onAlign('left')} 
          title="Align Left"
          className="toolbar-btn"
        >
          <AlignStartHorizontal size={18} />
        </button>
        <button 
          onClick={() => onAlign('center-h')} 
          title="Align Center Horizontal"
          className="toolbar-btn"
        >
          <AlignCenterHorizontal size={18} />
        </button>
        <button 
          onClick={() => onAlign('right')} 
          title="Align Right"
          className="toolbar-btn"
        >
          <AlignEndHorizontal size={18} />
        </button>
      </div>

      <div className="toolbar-separator"></div>

      <div className="toolbar-section">
        <button 
          onClick={() => onAlign('top')} 
          title="Align Top"
          className="toolbar-btn"
        >
          <AlignStartVertical size={18} />
        </button>
        <button 
          onClick={() => onAlign('center-v')} 
          title="Align Center Vertical"
          className="toolbar-btn"
        >
          <AlignCenterVertical size={18} />
        </button>
        <button 
          onClick={() => onAlign('bottom')} 
          title="Align Bottom"
          className="toolbar-btn"
        >
          <AlignEndVertical size={18} />
        </button>
      </div>

      <div className="toolbar-separator"></div>

      <div className="toolbar-section">
        <span className="toolbar-label">Distribute:</span>
        <button 
          onClick={() => onAlign('distribute-h')} 
          title="Distribute Horizontally"
          className="toolbar-btn"
        >
          <AlignHorizontalDistributeCenter size={18} />
        </button>
        <button 
          onClick={() => onAlign('distribute-v')} 
          title="Distribute Vertically"
          className="toolbar-btn"
        >
          <AlignVerticalDistributeCenter size={18} />
        </button>
      </div>

      <div className="toolbar-info">
        {selectedNodes.length} nodes selected
      </div>
    </div>
  );
};

export default AlignmentToolbar;
