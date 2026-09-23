// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import { X, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import { submitFeedback, FeedbackContext } from '../services/feedbackService';
import './FeedbackToast.css';

interface FeedbackToastProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open the full modal (for a comment), carrying the rating the user just gave. */
  onAddComment: (rating: number) => void;
  context?: FeedbackContext;
}

const RATINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Very unhappy' },
  { value: 2, emoji: '🙁', label: 'Unhappy' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Happy' },
  { value: 5, emoji: '🤩', label: 'Love it' },
];

const FeedbackToast: React.FC<FeedbackToastProps> = ({ isOpen, onClose, onAddComment, context }) => {
  const [rated, setRated] = useState<number | null>(null);

  const handleRate = (rating: number) => {
    setRated(rating);
    // Fire-and-forget; the rating is captured immediately.
    void submitFeedback({ rating, category: 'Quick rating', comment: '', context });
    // Auto-dismiss the thank-you after a few seconds.
    window.setTimeout(() => onClose(), 4500);
  };

  if (!isOpen) return null;

  return (
    <div className={`feedback-toast ${rated ? 'rated' : ''}`} role="dialog" aria-label="Quick feedback">
      <button className="feedback-toast-close" onClick={onClose} title="Dismiss" aria-label="Dismiss">
        <X size={16} />
      </button>

      {rated ? (
        <div className="feedback-toast-thanks">
          <CheckCircle2 size={18} className="feedback-toast-thanks-icon" />
          <span>Thanks! Want to add a quick note?</span>
          <button className="feedback-toast-link" onClick={() => onAddComment(rated)}>
            <MessageSquarePlus size={15} />
            Add a comment
          </button>
        </div>
      ) : (
        <>
          <div className="feedback-toast-prompt">How did that diagram turn out?</div>
          <div className="feedback-toast-ratings" role="radiogroup" aria-label="Rating">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked="false"
                aria-label={r.label}
                title={r.label}
                className="feedback-toast-rating"
                onClick={() => handleRate(r.value)}
              >
                {r.emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FeedbackToast;
