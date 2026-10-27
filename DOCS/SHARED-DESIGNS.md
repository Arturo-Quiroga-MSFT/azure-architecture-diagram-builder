# Shared Designs: Save to Cloud and Share Links

> **Status:** phase 1 (share links) built and validated; released in v2.1.18. This document is updated as each part is built, tested and validated; see the [Progress log](#progress-log).

## Using it

1. **Share:** click **Share** in the toolbar (next to Save and Load). Check the title, pick how long the link lasts (7, 30 or 90 days), and tick **Include the brief** only if the prompt is fine to share. **Create link** copies the link.
2. **Viewing:** anyone with the link opens `/d/<id>`: the diagram (pan and zoom, nothing editable), services, monthly run rate, the Well-Architected band if a current review exists, the request flow and the brief when included. No sign-in.
3. **Open a copy:** the viewer's **Open a copy in the editor** loads the design into their own editor. If they had work in progress, it is saved to their Version History first ("Kept automatically before opening a shared design").
4. **Manage:** the Share dialog lists the links this browser created, with views and expiry. Copy, **update** (replace what the link shows with the current design; the link and its expiry stay the same) or **remove** it.

## Why

Every design a user makes lives only in their own browser (IndexedDB), and handing one to someone else means exporting a file. Usage data (Sep 28 – Oct 26, 2026) shows the cost of that:

- **JSON is the most-used export** (151), ahead of PNG (111). JSON is only useful for reopening a design in AADB, so people are emailing design files to each other as a substitute for a link.
- Where AADB is heading needs a design to be addressable: partner and self-service handoffs, the Acceleration Hub, Solutioning Agent integration, SEs attaching an architecture to every POC, and MCP agents that could return a link instead of a file.
- There is no way to measure a design reaching its audience. A link that is opened is that evidence.

## Goals

1. **Share link.** One click turns the current design into a link. Anyone with the link sees a read-only view: the diagram, its services and connections, the monthly cost, and the Well-Architected result if one was run. "Open a copy" loads it into the editor as a new design.
2. **Owner control.** The person who shared a design can update it, see when it was last opened, and revoke the link at any time. Links expire.
3. **Cloud-saved designs** ("My designs" across devices) are phase 2, after sign-in is decided (see [Identity](#identity-the-one-decision-that-shapes-everything)).

## Non-goals (phase 1)

- Real-time co-editing. A shared design is a snapshot; the owner can publish a newer version to the same link.
- Comments, permissions per person, or organisation-wide galleries.
- Making the Cosmos account public. It stays behind its private endpoint; only the app's server talks to it.

## Identity: the one decision that shapes everything

AADB has no user sign-in today. The browser signs in only for "Import from Azure" (delegated ARM token, never sent to our server for identity), and the MCP server's Entra sign-in was retired because Microsoft's S360 MISE compliance KPI requires token validation through MISE, which this Node.js server does not use. Adding Entra token validation to the web server would hit the same rule.

So phase 1 needs ownership **without** user accounts:

- **Capability links.** The share link carries a 128-bit random id that can't be guessed: anyone holding it can view. Nothing is listed or searchable.
- **Owner key.** Creating a share returns a second secret, the owner key, kept in the creator's browser. Updating or revoking requires it. The server stores only its SHA-256 hash, as `MCP_CLIENT_KEYS` already does. Losing the browser data means losing the ability to edit or revoke; the link still expires on its own.

This is the same trust model as an unlisted document link. Phase 2 can attach shares to a signed-in account (Entra through a compliant path, or the App Service / Container Apps built-in authentication, which validates tokens for us) without changing links that already exist.

## Privacy and safety defaults

| Concern | Default |
| --- | --- |
| Designs can name customers | Nothing is shared until the user clicks Share, which explains who can see it; the share dialog shows the title and lets the user rename it first |
| Links forwarded too widely | Links expire (default **30 days**; choice of 7, 30 or 90); the owner can revoke at any time |
| Search engines and previews | The view page sends `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` |
| Stored data | Only the diagram (the same JSON as the Save button), its title, cost and Well-Architected summary. No prompts unless the user ticks "Include the brief", no IP addresses, no user identifiers |
| Content abuse | 256 KB limit per design; per-client rate limit on creation; a design is data, never executable (rendered by the app, never as HTML) |
| Retention | Cosmos TTL deletes each share when it expires; revoked shares are deleted immediately |

## How it works

```mermaid
sequenceDiagram
  participant O as Owner's browser
  participant A as AADB server (/api/shares)
  participant C as Cosmos DB (diagrams container, private endpoint)
  participant V as Viewer's browser
  O->>A: POST /api/shares {design, title, expiresInDays}
  A->>A: validate, size limit, rate limit
  A->>C: create {id, design, ownerKeyHash, expiresAt, ttl}
  A-->>O: {id, url: /d/<id>, ownerKey}
  O->>O: keep ownerKey in IndexedDB ("My shared links")
  V->>A: GET /api/shares/<id>
  A->>C: read by id (point read)
  A-->>V: design (read-only), title, expiresAt
  V->>V: render /d/<id> read-only; "Open a copy" loads it into the editor
  O->>A: PUT or DELETE /api/shares/<id> (X-Owner-Key)
```

### API

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/shares` | anyone | Create a share; returns `id`, `url`, `ownerKey`, `expiresAt` |
| `GET` | `/api/shares/:id` | anyone with the id | Read a share (404 when missing, revoked or expired) |
| `PUT` | `/api/shares/:id` | owner key | Publish a newer version of the design to the same link |
| `DELETE` | `/api/shares/:id` | owner key | Revoke |

### Stored document (Cosmos container `diagrams`, partition key `/id`)

```json
{
  "id": "<22-char base64url, 128 random bits>",
  "type": "share",
  "schemaVersion": 1,
  "title": "Clinic booking",
  "design": { "nodes": [], "edges": [], "metadata": {}, "workflow": [] },
  "summary": { "services": 8, "monthlyCost": 118.83, "region": "eastus2", "wafBand": "Adequate" },
  "ownerKeyHash": "<sha256 hex>",
  "createdAt": "…", "updatedAt": "…", "expiresAt": "…",
  "views": 0, "lastViewedAt": null,
  "appVersion": "2.1.18",
  "ttl": 2592000
}
```

## Implementation

| Part | Where |
| --- | --- |
| API, validation, owner keys, limits, storage | `server/shares.js`, mounted in `server/token-server.js` (its 300 KB JSON parser is registered before the global 16 KB one) |
| Storage | Cosmos `diagrams-db/diagrams` (partition `/id`, per-item TTL on; `scripts/production/00-foundation.sh` turns TTL on). `SHARES_STORE=memory` keeps links in process memory for local development, because the account is reachable only through its private endpoint |
| Client and owner keys | `src/services/shareService.ts` (owner keys in `localStorage` under `aadb.shares.v1`) |
| Share dialog | `src/components/ShareDialog.tsx`, opened from the toolbar in `src/App.tsx`; `buildSharePayload` snapshots the design and its summary |
| Read-only view | `src/components/SharedDesignPage.tsx`, routed from `src/main.tsx` for `/d/<22-char id>`; renders with the editor's own node and edge components, read-only |
| Open a copy | `stashCopyForEditor` / `takeCopyForEditor` (sessionStorage) and an effect in `App.tsx` that keeps the previous draft in Version History |
| Headers | `nginx-security-headers.conf`: `noindex, nofollow` and `Referrer-Policy: no-referrer` on `/d/…`; the API sets `no-store` and `noindex` |
| Telemetry | `Share_Link` events: `created`, `updated`, `revoked`, `copied-link`, `opened`, `open-failed`, `opened-copy`; no ids, titles or content |

**Rate limits:** 60 shares created and 120 updates or removals per client address per hour, per replica. The client address is the last `X-Forwarded-For` hop, the one Container Apps ingress appends; earlier hops can be forged.

## Validation

- `npm run test:shares` (in the deterministic suite): a real Express server with the in-memory store. Covers create/read/update/revoke, 128-bit ids, owner key never stored (hash only), wrong or missing keys refused, the brief left out unless asked, expiry choices, TTL recomputed on update, expired links refused before Cosmos deletes them, the 256 KB design limit and the 300 KB request limit (JSON errors, never an HTML stack trace), rate limiting by the ingress-appended address, owner check-ins not counted as views, malformed ids, and 503 when storage is not configured.
- Release smoke test `a shared design link opens a read-only view with its connections drawn`: the view renders all services and **all connections across the diagram** (a guard proven to fail when edges collapse; see below), shows the cost and Well-Architected band, can't be edited, and an unknown link shows a clear message.
- End to end with two separate browsers (owner and viewer) against the local app: 19/19 checks. Title prefilled; brief off by default; link created and copied; viewer sees the title, 8 services and the run rate, can't move nodes, edit labels or change prices; **Open a copy** loads 8 services and keeps the viewer's previous work in Version History; the owner sees exactly 1 view, updates the link (still works), removes it; removed and unknown links show "This link has expired or was removed".
- nginx headers checked in Docker for `/`, `/videos`, `/d/<id>`, `/index.html` and a static asset.

### Found and fixed while building

- **Connections missing in the read-only view.** Hiding the node handles with `display: none` removed the anchor points React Flow measures to draw edges, so every connection collapsed near the origin. Handles are now invisible (`opacity: 0`) instead. Caught by reviewing screenshots; the smoke test now measures how far the edges span relative to the services (0.09 when broken, 0.88 when correct; it requires more than 0.5) and was confirmed to fail on the broken build.
- **One visit counted as two views.** The view page could fetch the share twice (React StrictMode runs effects twice in development, and re-renders could too). It now fetches once per page load.
- **Security headers missing on the app's own page (pre-existing).** nginx drops server-level `add_header` directives in any location that sets its own, and `location = /index.html` sets `Cache-Control`, so `/` and every SPA route were served without `X-Frame-Options`, `X-Content-Type-Options` or `Cross-Origin-Opener-Policy` in production. The headers now live in `nginx-security-headers.conf`, included at server level and in each location that adds a header.

## Phases

1. **Share links (this branch):** API, Cosmos TTL, the share dialog, the read-only `/d/<id>` view with "Open a copy", "My shared links" (update, copy, revoke) kept in the browser, telemetry (`Share_Created`, `Share_Opened`, `Share_Copied`, `Share_Revoked`), tests.
2. **Cloud-saved designs and sign-in:** "My designs" across devices once identity is decided.
3. **Agents and partners:** MCP `export_reactflow_scene` can return a share link; Acceleration Hub and Solutioning Agent hand-offs link to designs.

## Progress log

- 2026-10-26: Access model decided: anyone with the link can view, no sign-in; owner key for update and removal.
- 2026-10-26: Server API and tests, Cosmos TTL turned on for `diagrams` (`--ttl -1`), share dialog, read-only view, Open a copy. Validated end to end locally (19/19) and with the release smoke tests; three fixes above.
- 2026-10-26: Design written. Existing pieces confirmed: serverless Cosmos `diagrams-db` with an unused `diagrams` container (partition key `/id`), private endpoint only, managed identity, local auth disabled; typical design 16 KB.
