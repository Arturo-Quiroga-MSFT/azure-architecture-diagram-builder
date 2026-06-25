# AADB ↔ Microsoft Scout

This folder holds artifacts from using the **Azure Architecture Diagram Builder
(AADB)** as a remote **MCP server** inside [Microsoft Scout](https://learn.microsoft.com/en-us/microsoft-scout/get-started).

Scout connects to AADB's MCP server and can design, validate, cost, and render
Azure architectures conversationally.

## How it's wired

- **Server:** the AADB MCP server (`mcp-server/`) deployed to Azure Container
  Apps, Streamable-HTTP transport.
- **Endpoint:** `https://azure-diagram-builder-mcp.victorioussmoke-95d145bd.eastus2.azurecontainerapps.io/mcp`
- **Auth:** Bearer token (`MCP_AUTH_TOKEN` on the container app). Scout stores it
  encrypted and sends `Authorization: Bearer <token>`.
- **Catalog entry:** registered in the `scout-m` repo at
  `common/extensions-catalog/items/mcp-servers.ts`
  (id `mcp-azure-architecture-diagram-builder`, `microsoftOnly`).

> Only `/mcp` speaks MCP on that host; `/healthz` falls through to the web-app
> SPA, so don't use it as the server URL.

## Tools exposed

| Tool | Purpose |
| --- | --- |
| `list_services` | Browse the Azure service catalog (categories, aliases, pricing, cost ranges). |
| `validate_architecture` | Score a design against Well-Architected Framework rules (deterministic, no LLM). |
| `estimate_costs` | Estimate monthly cost for a set of services. |
| `generate_manifest` | Emit an `az prototype` interchange manifest. |
| `get_waf_rules` | Query WAF rules by pillar or service type. |
| `render_diagram` | Render an architecture diagram as SVG/HTML. |
| `export_reactflow_scene` | Produce a React Flow scene for the web app. |

## Artifacts

- [`test-1.md`](test-1.md) — a sample Scout session: generate → validate (WAF
  52) → harden (WAF 65) → cost/IaC next steps.

Generated diagram exports (`*.svg`, etc.) produced during Scout sessions are
ignored by git (see the repo `.gitignore`); only this README and the sample
`test-1.md` are tracked.
