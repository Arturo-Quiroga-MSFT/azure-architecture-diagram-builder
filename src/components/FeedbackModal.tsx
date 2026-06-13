// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import { X, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { trackFeedback } from '../services/telemetryService';
import './FeedbackModal.css';

interface FeedbackContext {
  diagramName?: string;
  serviceCount?: number;
  model?: string;
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: FeedbackContext;
}

const RATINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Very unhappy' },
  { value: 2, emoji: '🙁', label: 'Unhappy' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Happy' },
  { value: 5, emoji: '🤩', label: 'Love it' },
];

const CATEGORIES = [
  'General',
  'Bug / something broke',
  'Feature request',
  'Diagram quality',
  'Performance',
  'Other',
];

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, context }) => {
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setRating(null);
    setCategory(CATEGORIES[0]);
    setComment('');
    setIsSubmitting(false);
    setSubmitted(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (rating === null) {
      setError('Please pick a rating so we know how you feel.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const payload = {
      rating,
      category,
      comment: comment.trim(),
      context: {
        diagramName: context?.diagramName ?? '',
        serviceCount: context?.serviceCount ?? 0,
        model: context?.model ?? '',
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };

    // Always record sentiment in Application Insights (analytics / alerting),
    // independent of whether the durable storage endpoint is configured.
    trackFeedback({
      rating,
      category,
      hasComment: comment.trim().length > 0,
      commentLength: comment.trim().length,
    });

    try {
      // Durable storage via the token server (Cosmos DB, keyless).
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // A 503 means storage isn't configured yet — the telemetry above still
      // captured the sentiment, so we treat this as a soft success.
      if (!res.ok && res.status !== 503) {
        throw new Error(`Feedback endpoint returned ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      console.error('[feedback] submit failed:', err);
      // Telemetry already captured the rating; don't block the user on a
      // storage hiccup. Show a soft confirmation instead of an error.
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <MessageSquare size={24} />
            Share Feedback
          </h2>
          <button className="modal-close" onClick={handleClose} title="Close">
            <X size={24} />
          </button>
        </div>

        {submitted ? (
          <div className="modal-body feedback-thanks">
            <CheckCircle2 size={48} className="feedback-thanks-icon" />
            <h3>Thank you!</h3>
            <p>Your feedback helps us improve the Azure Architecture Diagram Builder.</p>
            <button className="btn-primary" onClick={handleClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="modal-body">
              <p className="feedback-intro">
                How is your experience so far? Your input shapes what we build next.
              </p>

              <div className="form-group">
                <label>How do you feel about the app?</label>
                <div className="feedback-ratings" role="radiogroup" aria-label="Rating">
                  {RATINGS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={rating === r.value}
                      aria-label={r.label}
                      title={r.label}
                      className={`feedback-rating ${rating === r.value ? 'selected' : ''}`}
                      onClick={() => { setRating(r.value); setError(null); }}
                      disabled={isSubmitting}
                    >
                      <span className="feedback-rating-emoji">{r.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="feedback-category">Category</label>
                <select
                  id="feedback-category"
                  className="feedback-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="feedback-comment">
                  Tell us more (optional)
                  <span className="label-hint">What worked well, what was confusing, what you'd love to see</span>
                </label>
                <textarea
                  id="feedback-comment"
                  className="feedback-comment"
                  placeholder="e.g., The diagram generation is great, but I'd love to export to Visio..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  disabled={isSubmitting}
                />
                <div className="character-count">{comment.length}/1000</div>
              </div>

              {error && <div className="feedback-error">{error}</div>}

              <div className="feedback-hint">
                🔒 We collect your rating and comment to improve the app. Don't include sensitive information.
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="spinner-small"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Feedback
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
