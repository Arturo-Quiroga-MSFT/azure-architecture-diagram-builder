// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface ValidationFreshnessTransition {
  keepResult: boolean;
  needsRefresh: boolean;
}

export function resolveValidationFreshness(
  hasValidationResult: boolean,
  preserveForRecheck: boolean,
): ValidationFreshnessTransition {
  if (hasValidationResult && preserveForRecheck) {
    return { keepResult: true, needsRefresh: true };
  }

  return { keepResult: false, needsRefresh: false };
}