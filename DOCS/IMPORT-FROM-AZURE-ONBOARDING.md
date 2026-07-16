# Import from Azure — Onboarding for PSAs / CSAs (scan your own tenant)

> How a fellow PSA/CSA signs in with their **own** Azure account and reverse-
> engineers a resource group in **their own tenant** into a diagram.

## What this feature does

"Import from Azure" signs you in with your Microsoft Entra account and queries
**Azure Resource Graph** for a resource group you pick, then draws the
architecture automatically.

- **Read-only.** It only reads resource metadata (types, names, relationships).
- **Your RBAC only.** All queries run with **your** delegated token — the app
  never uses its own identity. You only ever see what your own permissions allow
  (Azure **Reader** on the subscription/RG is enough).
- **Nothing is stored.** The token stays in your browser session; the app has no
  server-side copy of your credentials or resources.

## Why you may see "Need admin approval" the first time

The app registration lives in one tenant but is **multi-tenant**, so when you
sign in from a *different* tenant, that tenant must **consent** to the app once
before anyone can use it. Most orgs disable *user* self-consent, which produces
the **"Need admin approval / unverified"** screen.

**Good news:** every MCAPS PSA/CSA is a **Global Administrator of their own
tenant**, so you can grant that consent yourself in ~30 seconds. You only do this
**once per tenant**.

## One-time setup: grant admin consent in your tenant

Pick either method.

### Method A — Admin-consent URL (fastest)

1. Find your tenant ID:
   ```bash
   az account show --query tenantId -o tsv
   ```
   (or use your tenant's domain, e.g. `contoso.onmicrosoft.com`.)
2. Open this URL in a browser, replacing `<TENANT>` with your tenant ID or domain:
   ```
   https://login.microsoftonline.com/<TENANT>/adminconsent?client_id=11920e90-fafe-44d8-a42a-71a32d1f2f1c
   ```
3. Sign in with your admin account and click **Accept**. This grants the app the
   two delegated permissions below, tenant-wide.

### Method B — Consent during first sign-in

1. Open the app and start **Import from Azure → Sign in to Azure**.
2. On the permissions prompt, check **"Consent on behalf of your organization"**
   (only visible to admins), then **Accept**.

### Permissions you're consenting to

| API | Permission | Type | Why |
|-----|-----------|------|-----|
| Azure Service Management | `user_impersonation` | Delegated | Read Resource Graph / ARM **as you** |
| Microsoft Graph | `User.Read` | Delegated | Show your signed-in name |

Both are **delegated** (act as the signed-in user) — no app-only/background
access, no write permissions.

## Scanning your tenant

1. Open the app: https://aka.ms/diagram-builder
2. Click **Import from Azure**.
3. Click **Sign in to Azure** — a full-page redirect takes you to the Microsoft
   sign-in, then returns you to the app signed in (the import dialog re-opens
   automatically).
4. Pick a **subscription**, then a **resource group**.
5. Click **Import** — the resource group is drawn as an architecture diagram.

## Privacy & security summary

- Delegated, read-only, per-user RBAC; the app never acts as itself.
- Your token is used **directly from the browser** to `management.azure.com`
  (Resource Graph) — it is not sent to or stored by the app's servers.
- Revoke anytime: **Entra admin center → Enterprise applications → "Azure Diagram
  Builder – Import" → Permissions → Review/Remove**, or delete the enterprise app
  from your tenant.

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| "Need admin approval / unverified" | Tenant hasn't consented yet → run the Method A URL as an admin (that's you). |
| Sign-in returns but no subscriptions | Your account has no Azure RBAC on any subscription in that tenant, or you picked the wrong directory during sign-in. |
| Wrong tenant/account signed in | Sign out (browser session) and retry; on the sign-in page choose the correct account/directory. |
| "AADSTS50011 redirect mismatch" | The host you're using isn't a registered SPA redirect URI — ping the app owner to add it. |

## Reference

- **App (client) ID:** `11920e90-fafe-44d8-a42a-71a32d1f2f1c`
- **App registration owner tenant:** ARTURO (`a172a259-b1c7-4944-b2e1-6d551f954711`)
- **Sign-in authority:** `https://login.microsoftonline.com/organizations` (multi-tenant)
- **ARM scope:** `https://management.azure.com/user_impersonation`
