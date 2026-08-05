// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { submitFeedback, FeedbackContext } from '../services/feedbackService';
import './FeedbackModal.css';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: FeedbackContext;
  /** Pre-selected rating carried over from the quick toast, if any. */
  preselectedRating?: number;
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, context, preselectedRating }) => {
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [comment, setComment] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactSaved, setContactSaved] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the modal is opened from the quick toast, seed the rating the user
  // already gave so they don't have to pick it twice.
  useEffect(() => {
    if (isOpen && preselectedRating != null) {
      setRating(preselectedRating);
    }
  }, [isOpen, preselectedRating]);

  const reset = () => {
    setRating(null);
    setCategory(CATEGORIES[0]);
    setComment('');
    setContactConsent(false);
    setContactEmail('');
    setContactSaved(true);
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
    const normalizedEmail = contactEmail.trim();
    if (contactConsent && (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254)) {
      setError('Enter a valid email address so we can follow up.');
      return;
    }
    setError(null);
    setIsSubmitting(true);

    // Shared helper: records sentiment in App Insights, then best-effort
    // durable storage via /api/feedback. Never throws.
    const result = await submitFeedback({
      rating,
      category,
      comment,
      context,
      contact: { consent: contactConsent, email: normalizedEmail },
    });

    setContactSaved(!contactConsent || result.persisted);
    setSubmitted(true);
    setIsSubmitting(false);
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
            <p>
              {contactSaved
                ? contactConsent
                  ? 'Your feedback was saved. The maintainer may contact you about this submission.'
                  : 'Your feedback helps us improve the Azure Architecture Diagram Builder.'
                : 'Your feedback was recorded, but we could not save your email address. Please try again later if you would like a follow-up.'}
            </p>
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

              <div className="feedback-contact">
                <div className="feedback-contact-heading">Open to a follow-up?</div>
                <label className="feedback-contact-consent" htmlFor="feedback-contact-consent">
                  <input
                    id="feedback-contact-consent"
                    type="checkbox"
                    checked={contactConsent}
                    onChange={(event) => {
                      setContactConsent(event.target.checked);
                      setError(null);
                    }}
                    disabled={isSubmitting}
                  />
                  <span>You may contact me about this feedback</span>
                </label>
                {contactConsent && (
                  <label className="feedback-contact-email" htmlFor="feedback-contact-email">
                    Email address
                    <input
                      id="feedback-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(event) => {
                        setContactEmail(event.target.value);
                        setError(null);
                      }}
                      autoComplete="email"
                      maxLength={254}
                      required
                      aria-describedby="feedback-contact-email-hint"
                      placeholder="name@company.com"
                      disabled={isSubmitting}
                    />
                    <span id="feedback-contact-email-hint">Required when follow-up is enabled. Used only to contact you about this feedback.</span>
                  </label>
                )}
              </div>

              {error && <div className="feedback-error">{error}</div>}

              <div className="feedback-hint">
                🔒 Rating and comments help improve the app. If you opt in, your email is stored only with this feedback in Cosmos DB and is not sent to analytics. Don't include other sensitive information.
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
