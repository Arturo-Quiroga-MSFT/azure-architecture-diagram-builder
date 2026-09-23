// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Microsoft Entra ID (MSAL) delegated auth for "Import from Azure".
 *
 * When VITE_AZURE_AD_CLIENT_ID is configured, the browser signs the user in and
 * acquires an Azure Resource Manager token FOR THAT USER, so all Resource Graph
 * calls run with the user's own RBAC — never the app's identity. This is the
 * path used by the hosted multi-tenant app.
 *
 * When it is NOT configured, the app falls back to the server-identity routes
 * (AZURE_IMPORT_ENABLED) for local / self-host use.
 */

import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
  type Configuration,
} from '@azure/msal-browser';

const CLIENT_ID = (import.meta.env.VITE_AZURE_AD_CLIENT_ID as string | undefined) || '';
const AUTHORITY = (import.meta.env.VITE_AZURE_AD_AUTHORITY as string | undefined)
  || 'https://login.microsoftonline.com/organizations';
const REDIRECT_URI = (import.meta.env.VITE_AZURE_AD_REDIRECT_URI as string | undefined)
  || (typeof window !== 'undefined' ? window.location.origin : '');
const ARM_SCOPE = (import.meta.env.VITE_ARM_SCOPE as string | undefined)
  || 'https://management.azure.com/user_impersonation';

// Marker so the app can re-open the "Import from Azure" modal after the
// full-page sign-in redirect returns.
const REOPEN_KEY = 'azimp_reopen_after_signin';

/** Whether per-user delegated auth is configured (client ID present). */
export function isDelegatedAuthConfigured(): boolean {
  return CLIENT_ID.length > 0;
}

let pca: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

function getPca(): PublicClientApplication {
  if (!pca) {
    const config: Configuration = {
      auth: { clientId: CLIENT_ID, authority: AUTHORITY, redirectUri: REDIRECT_URI },
      cache: { cacheLocation: 'sessionStorage' },
    };
    pca = new PublicClientApplication(config);
  }
  return pca;
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const p = getPca();
      await p.initialize();
      // Consume any pending redirect response (and clear a dangling #code= from
      // the URL) so leftover interaction state can't wedge later popup calls.
      try {
        const result = await p.handleRedirectPromise();
        if (result?.account) p.setActiveAccount(result.account);
      } catch (err) {
        console.warn('MSAL handleRedirectPromise failed:', err);
      }
    })();
  }
  return initPromise;
}

function activeAccount(): AccountInfo | null {
  const p = getPca();
  return p.getActiveAccount() || p.getAllAccounts()[0] || null;
}

/** The signed-in user's display name / UPN, or undefined when not signed in. */
export async function getSignedInName(): Promise<string | undefined> {
  await ensureInitialized();
  return activeAccount()?.username;
}

/**
 * Begin an interactive sign-in via full-page redirect. Popup flow is avoided
 * because the Microsoft login page's Cross-Origin-Opener-Policy severs the
 * popup↔opener channel, causing MSAL popup handshakes to time out. Sets a marker
 * so the app can re-open the import modal when the redirect returns. This call
 * navigates away and does not resolve.
 */
export async function signIn(): Promise<void> {
  await ensureInitialized();
  try { sessionStorage.setItem(REOPEN_KEY, '1'); } catch { /* ignore */ }
  await getPca().loginRedirect({ scopes: [ARM_SCOPE], redirectUri: REDIRECT_URI });
}

/** Whether the app returned from a sign-in redirect that should re-open import. */
export function consumeReopenFlag(): boolean {
  try {
    const v = sessionStorage.getItem(REOPEN_KEY) === '1';
    if (v) sessionStorage.removeItem(REOPEN_KEY);
    return v;
  } catch { return false; }
}

/**
 * Acquire an ARM access token for the signed-in user. Uses a silent refresh
 * when possible; if interaction is required it falls back to a full-page
 * redirect (which navigates away and does not resolve).
 */
export async function getArmToken(): Promise<string> {
  await ensureInitialized();
  const p = getPca();
  const account = activeAccount();
  if (account) {
    try {
      const res = await p.acquireTokenSilent({ scopes: [ARM_SCOPE], account });
      p.setActiveAccount(res.account);
      return res.accessToken;
    } catch (err) {
      if (!(err instanceof InteractionRequiredAuthError)) {
        console.warn('Silent ARM token failed; falling back to redirect:', err);
      }
    }
  }
  try { sessionStorage.setItem(REOPEN_KEY, '1'); } catch { /* ignore */ }
  await p.acquireTokenRedirect({ scopes: [ARM_SCOPE], redirectUri: REDIRECT_URI });
  // acquireTokenRedirect navigates away; this is effectively unreachable.
  throw new Error('Redirecting to sign in…');
}

/** Sign the current user out of this app's MSAL cache. */
export async function signOut(): Promise<void> {
  await ensureInitialized();
  const p = getPca();
  const account = activeAccount();
  await p.clearCache(account ? { account } : undefined);
}
