// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import { X, Camera } from 'lucide-react';
import './SaveSnapshotModal.css';

interface SaveSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (notes: string) => void;
  diagramName: string;
  serviceCount: number;
}

const SaveSnapshotModal: React.FC<SaveSnapshotModalProps> = ({
  isOpen,
  onClose,
  onSave,
  diagramName,
  serviceCount
}) => {
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(notes);
      setNotes('');
      onClose();
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      alert('Failed to save snapshot');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content save-snapshot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Camera size={24} />
            Save Snapshot
          </h2>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="snapshot-info">
            <p className="snapshot-info-text">
              Creating a snapshot of <strong>{diagramName}</strong>
            </p>
            <p className="snapshot-info-details">
              {serviceCount} services • {new Date().toLocaleString()}
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="snapshot-notes">
              Notes (optional)
              <span className="label-hint">Describe what makes this version special</span>
            </label>
            <textarea
              id="snapshot-notes"
              className="snapshot-notes"
              placeholder="e.g., Before adding authentication, Initial production setup, Working state before experiment..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={500}
              disabled={isSaving}
            />
            <div className="character-count">
              {notes.length}/500
            </div>
          </div>

          <div className="snapshot-hint">
            💡 Snapshots are saved locally and can be restored from Version History
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="btn-secondary" 
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="spinner-small"></div>
                Saving...
              </>
            ) : (
              <>
                <Camera size={18} />
                Save Snapshot
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveSnapshotModal;
