import type { ModelType, ReasoningEffort } from '../stores/modelSettingsStore';

export interface FollowUpModelPolicy {
  model: ModelType;
  reasoningEffort: ReasoningEffort;
}

export type FollowUpSource = 'automatic_after_change' | 'what_would_you_add';

export const FOLLOW_UP_MODEL_POLICY: FollowUpModelPolicy = {
  model: 'gpt-5.6-sol',
  reasoningEffort: 'low',
};

export function getFollowUpOperation(source: FollowUpSource): string {
  return source === 'automatic_after_change'
    ? 'chat_followups_auto'
    : 'chat_followups_best';
}