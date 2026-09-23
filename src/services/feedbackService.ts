// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { trackFeedback, trackFeedbackPersistFailed } from './telemetryService';

export interface FeedbackContext {
  diagramName?: string;
  serviceCount?: number;
  model?: string;
}

export interface FeedbackInput {
  rating: number;
  category: string;
  comment: string;
  context?: FeedbackContext;
  contact?: {
    consent: boolean;
    email?: string;
  };
}

export interface FeedbackSubmitResult {
  persisted: boolean;
}

/** sessionStorage key set once feedback has been given, to suppress re-prompting. */
export const FEEDBACK_DONE_KEY = 'aqdb_feedback_done';

/**
 * Submit feedback to both Application Insights (sentiment) and the durable
 * /api/feedback endpoint (Cosmos). Shared by the modal and the quick toast so
 * the telemetry shape and storage payload stay identical.
 *
 * Never throws — a storage hiccup must not block the user. The rating is always
 * captured in telemetry first.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackSubmitResult> {
  const comment = (input.comment || '').trim();
  const contactEmail = input.contact?.consent ? (input.contact.email || '').trim() : '';

  // Always record sentiment in App Insights, independent of durable storage.
  trackFeedback({
    rating: input.rating,
    category: input.category,
    hasComment: comment.length > 0,
    commentLength: comment.length,
  });

  const payload = {
    rating: input.rating,
    category: input.category,
    comment,
    contact: {
      consent: input.contact?.consent === true,
      email: contactEmail,
    },
    context: {
      diagramName: input.context?.diagramName ?? '',
      serviceCount: input.context?.serviceCount ?? 0,
      model: input.context?.model ?? '',
      url: window.location.href,
      userAgent: navigator.userAgent,
    },
  };

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // A non-2xx means the durable write did not happen (503 = storage not
    // configured, 500 = Cosmos unreachable, e.g. a network policy disabled
    // public access). In that case capture the comment text in telemetry so
    // it is never silently lost.
    if (!res.ok && comment.length > 0) {
      trackFeedbackPersistFailed({
        rating: input.rating,
        category: input.category,
        comment,
        diagramName: input.context?.diagramName,
        model: input.context?.model,
        reason: `http_${res.status}`,
      });
    }
    return { persisted: res.ok };
  } catch (err) {
    console.error('[feedback] submit failed:', err);
    // Network error reaching the proxy/Cosmos — preserve the comment in telemetry.
    if (comment.length > 0) {
      trackFeedbackPersistFailed({
        rating: input.rating,
        category: input.category,
        comment,
        diagramName: input.context?.diagramName,
        model: input.context?.model,
        reason: 'network_error',
      });
    }
    return { persisted: false };
  } finally {
    try {
      sessionStorage.setItem(FEEDBACK_DONE_KEY, '1');
    } catch {
      /* sessionStorage unavailable — ignore */
    }
  }
}
