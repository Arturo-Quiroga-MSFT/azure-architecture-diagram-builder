# Azure Diagram Builder — App Access & Authentication Guide

> **Last updated:** February 25, 2026

## Table of Contents

- [Quick Reference](#quick-reference)
- [Application URL](#application-url)
- [Authentication Overview](#authentication-overview)
- [Azure Resources](#azure-resources)
- [Entra ID App Registration](#entra-id-app-registration)
- [Enterprise Application (Service Principal)](#enterprise-application-service-principal)
- [Current User Assignments](#current-user-assignments)
- [Shared Demo Account — "Diagrammer"](#shared-demo-account--diagrammer)
- [How to Grant Access to New Users](#how-to-grant-access-to-new-users)
- [How to Revoke Access](#how-to-revoke-access)
- [How to Reset the Diagrammer Password](#how-to-reset-the-diagrammer-password)
- [How to Open Access to the Entire Tenant](#how-to-open-access-to-the-entire-tenant)
- [Troubleshooting](#troubleshooting)

---

## Quick Reference

| Item | Value |
|------|-------|
| **App URL** | https://aka.ms/diagram-builder |
| **Full FQDN** | https://azure-diagram-builder.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io |
| **Demo account** | `Diagrammer@MngEnvMCAP094150.onmicrosoft.com` |
| **Auth type** | Microsoft Entra ID (built-in ACA authentication) |
| **Assignment required** | Yes — only explicitly assigned users can sign in |

---

## Application URL

The app is accessible at:

- **Short link:** https://aka.ms/diagram-builder
- **Direct URL:** https://azure-diagram-builder.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io

Both resolve to the same Azure Container App. Unauthenticated users are automatically redirected to the Microsoft Entra ID login page.

---

## Authentication Overview

The app uses **Azure Container Apps built-in authentication** (sometimes called "Easy Auth"). This means:

1. Authentication is handled at the **infrastructure level** — no auth code in the app itself.
2. When a user navigates to the app URL, they are redirected to the **Microsoft Entra ID login page**.
3. After successful authentication, Entra ID redirects back to the app with a session token.
4. The app is configured as **single-tenant** (`AzureADMyOrg`) — only users in the `MngEnvMCAP094150.onmicrosoft.com` tenant can sign in.
5. **User assignment is required** (`appRoleAssignmentRequired: true`) — even within the tenant, only users explicitly assigned to the Enterprise Application can access the app.

### Authentication Flow

```
User visits aka.ms/diagram-builder
        │
        ▼
ACA Built-in Auth intercepts request
        │
        ▼
Redirect to login.microsoftonline.com
(Entra ID login page)
        │
        ▼
User enters credentials
        │
        ▼
Entra ID validates credentials
+ checks user is assigned to the app
        │
        ▼
Redirect back to app with session token
        │
        ▼
User sees the Azure Diagram Builder UI
```

---

## Azure Resources

| Resource | Value |
|----------|-------|
| **Subscription ID** | `7a28b21e-0d3e-4435-a686-d92889d4ee96` |
| **Resource Group** | `azure-diagrams-rg` |
| **Container App** | `azure-diagram-builder` |
| **Container App Environment** | `aca-env-azure-diagrams` |
| **Container Registry (ACR)** | `acrazurediagrams1767583743` |
| **Region** | East US 2 |

---

## Entra ID App Registration

| Property | Value |
|----------|-------|
| **Display Name** | Azure Diagram Builder Auth |
| **Application (client) ID** | `aa379890-05eb-476c-a0f5-6c2c75ab4328` |
| **Directory (tenant) ID** | `a172a259-b1c7-4944-b2e1-6d551f954711` |
| **Sign-in audience** | `AzureADMyOrg` (single tenant) |
| **Redirect URI** | `https://azure-diagram-builder.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io/.auth/login/aad/callback` |
| **Client secret setting** | `microsoft-provider-authentication-secret` (stored in ACA secrets) |
| **OpenID issuer** | `https://login.microsoftonline.com/a172a259-b1c7-4944-b2e1-6d551f954711/v2.0` |

### Portal Links

- **App Registration:** [Azure Portal → App registrations → Azure Diagram Builder Auth](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/aa379890-05eb-476c-a0f5-6c2c75ab4328)
- **Enterprise Application:** [Azure Portal → Enterprise applications → Azure Diagram Builder Auth](https://portal.azure.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/Overview/objectId/ac9261a4-8cc1-4bc3-b671-7875003e7b4b)

---

## Enterprise Application (Service Principal)

| Property | Value |
|----------|-------|
| **Display Name** | Azure Diagram Builder Auth |
| **Object ID** | `ac9261a4-8cc1-4bc3-b671-7875003e7b4b` |
| **Application ID** | `aa379890-05eb-476c-a0f5-6c2c75ab4328` |
| **App Role Assignment Required** | `true` |

Because `appRoleAssignmentRequired` is `true`, users must be explicitly assigned to this Enterprise Application before they can sign in.

---

## Current User Assignments

As of February 25, 2026:

| User | UPN | Object ID | Assigned Date |
|------|-----|-----------|---------------|
| System Administrator | `admin@MngEnvMCAP094150.onmicrosoft.com` | `3f1c2b34-07f7-4865-8dca-b4d9bc583fc8` | Feb 14, 2026 |
| Diagrammer | `Diagrammer@MngEnvMCAP094150.onmicrosoft.com` | `3a7674f9-b0a9-4281-a9b0-af13a8bf4cd8` | Feb 14, 2026 |

---

## Shared Demo Account — "Diagrammer"

This is a shared Entra ID user account created specifically for giving external people controlled access to the app without creating individual accounts for each person.

### What to Tell People

> To try the Azure Architecture Diagram Builder:
>
> 1. Go to **https://aka.ms/diagram-builder**
> 2. You'll be redirected to a Microsoft sign-in page
> 3. Sign in with:
>    - **Username:** `Diagrammer@MngEnvMCAP094150.onmicrosoft.com`
>    - **Password:** *(provided separately)*
> 4. You may see a "Stay signed in?" prompt — click **No** (recommended for shared accounts)
> 5. The app will load and you can start building Azure architecture diagrams

### Account Details

| Property | Value |
|----------|-------|
| **Display Name** | Diagrammer |
| **UPN** | `Diagrammer@MngEnvMCAP094150.onmicrosoft.com` |
| **Object ID** | `3a7674f9-b0a9-4281-a9b0-af13a8bf4cd8` |
| **Account Type** | Member (cloud-only) |

### Security Notes

- **Change the password** after each round of sharing if you want to cut off access after a demo session.
- This account has **no admin privileges** — it can only access the Diagram Builder app.
- All usage through this account appears as a single user in logs; you won't be able to distinguish who did what.
- For auditing or individual accountability, assign users individually instead (see below).

---

## How to Grant Access to New Users

### Option A: Add an individual user (by email/UPN)

First, find their Object ID:

```bash
az ad user show --id user@MngEnvMCAP094150.onmicrosoft.com --query id -o tsv
```

Then assign them:

```bash
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/ac9261a4-8cc1-4bc3-b671-7875003e7b4b/appRoleAssignedTo" \
  --body '{
    "principalId": "<USER_OBJECT_ID>",
    "resourceId": "ac9261a4-8cc1-4bc3-b671-7875003e7b4b",
    "appRoleId": "00000000-0000-0000-0000-000000000000"
  }'
```

### Option B: Add a user in one command (look up + assign)

```bash
USER_ID=$(az ad user show --id user@domain.com --query id -o tsv) && \
az rest --method POST \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/ac9261a4-8cc1-4bc3-b671-7875003e7b4b/appRoleAssignedTo" \
  --body "{\"principalId\": \"$USER_ID\", \"resourceId\": \"ac9261a4-8cc1-4bc3-b671-7875003e7b4b\", \"appRoleId\": \"00000000-0000-0000-0000-000000000000\"}"
```

### Option C: Via Azure Portal

1. Go to **Azure Portal** → **Entra ID** → **Enterprise applications**
2. Search for **"Azure Diagram Builder Auth"**
3. Click **Users and groups** → **Add user/group**
4. Select the user(s) and assign

---

## How to Revoke Access

### Remove a specific user's assignment

First, list current assignments to find the assignment ID:

```bash
az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/ac9261a4-8cc1-4bc3-b671-7875003e7b4b/appRoleAssignedTo" \
  -o json
```

Then delete the assignment (use the `id` field from the response):

```bash
az rest --method DELETE \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/ac9261a4-8cc1-4bc3-b671-7875003e7b4b/appRoleAssignedTo/<ASSIGNMENT_ID>"
```

### Disable the Diagrammer account entirely

```bash
az ad user update --id 3a7674f9-b0a9-4281-a9b0-af13a8bf4cd8 --account-enabled false
```

Re-enable later:

```bash
az ad user update --id 3a7674f9-b0a9-4281-a9b0-af13a8bf4cd8 --account-enabled true
```

---

## How to Reset the Diagrammer Password

```bash
az ad user update \
  --id 3a7674f9-b0a9-4281-a9b0-af13a8bf4cd8 \
  --password "NewSecurePassword123!" \
  --force-change-password-next-sign-in false
```

> **Tip:** Set `--force-change-password-next-sign-in true` if you want users to set their own password on first login (not recommended for a shared demo account).

---

## How to Open Access to the Entire Tenant

If you want **any user** in the `MngEnvMCAP094150.onmicrosoft.com` tenant to sign in without being explicitly assigned:

```bash
az rest --method PATCH \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/ac9261a4-8cc1-4bc3-b671-7875003e7b4b" \
  --body '{"appRoleAssignmentRequired": false}'
```

To **re-enable** assignment requirement (lock it down again):

```bash
az rest --method PATCH \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/ac9261a4-8cc1-4bc3-b671-7875003e7b4b" \
  --body '{"appRoleAssignmentRequired": true}'
```

---

## Troubleshooting

### "AADSTS50105: Your administrator has not granted you access"

The user is not assigned to the Enterprise Application. Add them using the commands in [How to Grant Access](#how-to-grant-access-to-new-users).

### "AADSTS700016: Application not found in the directory"

The user is trying to sign in from a different tenant. The app only accepts users from `MngEnvMCAP094150.onmicrosoft.com`.

### "AADSTS50034: The user account does not exist"

The username was typed incorrectly. Double-check the UPN: `Diagrammer@MngEnvMCAP094150.onmicrosoft.com`.

### User signs in but gets a blank page or error

The auth layer succeeded but the app may have an issue. Check the Container App logs:

```bash
az containerapp logs show -g azure-diagrams-rg -n azure-diagram-builder --type console --follow
```

### Check current auth configuration

```bash
az containerapp auth show -g azure-diagrams-rg -n azure-diagram-builder -o json
```

### List all currently assigned users

```bash
az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/ac9261a4-8cc1-4bc3-b671-7875003e7b4b/appRoleAssignedTo" \
  -o json
```

---

## Related Files

- Deployment script: [`scripts/update_aca.sh`](../scripts/update_aca.sh)
- Architecture overview: [`DOCS/ARCHITECTURE.md`](./ARCHITECTURE.md)
- Environment variables template: [`.env.example`](../.env.example)
