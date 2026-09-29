// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Turn Microsoft Entra sign-in failures for "Import from Azure" into guidance a
 * user can act on. Azure Service Management (user_impersonation) is a
 * high-privilege delegated permission, so many organizations require an admin
 * to approve the app before anyone can sign in.
 */

export type AzureSignInErrorKind = 'admin-consent' | 'cancelled' | 'blocked' | 'other';

export interface AzureSignInErrorInfo {
  kind: AzureSignInErrorKind;
  message: string;
}

const ADMIN_CONSENT = /AADSTS(65001|90094|90095|900941|900971)\b|consent_required|admin approval|needs? (?:admin|administrator) (?:approval|consent)/i;
const CANCELLED = /user_cancelled|AADSTS65004\b|access_denied|AADSTS50126\b/i;
const BLOCKED = /AADSTS(53003|530003|50105|700016|7000112)\b/i;

export function describeAzureSignInError(raw: unknown): AzureSignInErrorInfo {
  const text = [
    (raw as { errorCode?: string })?.errorCode,
    (raw as { errorMessage?: string })?.errorMessage,
    (raw as { message?: string })?.message,
    typeof raw === 'string' ? raw : '',
  ].filter(Boolean).join(' ');

  if (ADMIN_CONSENT.test(text)) {
    return {
      kind: 'admin-consent',
      message: 'Your organization requires an administrator to approve this app before you can sign in. '
        + 'Ask your Microsoft Entra admin to grant consent, or use the ARM template export below instead.',
    };
  }
  if (BLOCKED.test(text)) {
    return {
      kind: 'blocked',
      message: 'Your organization\'s sign-in policy blocked access to this app. '
        + 'Use the ARM template export below instead, or contact your Microsoft Entra admin.',
    };
  }
  if (CANCELLED.test(text)) {
    return { kind: 'cancelled', message: 'Sign-in was cancelled. Sign in again to import from Azure.' };
  }
  return { kind: 'other', message: 'Sign-in to Azure failed. Try again, or use the ARM template export below.' };
}
