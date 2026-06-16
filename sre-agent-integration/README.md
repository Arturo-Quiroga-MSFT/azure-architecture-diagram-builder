# Azure Diagram Builder → Azure SRE Agent integration

This folder packages the **Azure Architecture Diagram Builder** as an enterprise capability inside
**[Azure SRE Agent](https://learn.microsoft.com/en-us/azure/sre-agent/)** — turning a tool that one
person maintains into a reusable building block that any SRE Agent in the org can call during
incident response, change validation, and post-incident documentation.

> **Idea credit:** Onur (PSA) — reframe the Diagram Builder from a standalone app into an
> SRE Agent **skill + MCP connector** so it is adopted as enterprise-grade tooling.

## Why SRE Agent

Azure SRE Agent extends itself through exactly two surfaces, and the Diagram Builder maps cleanly
onto both:

| SRE Agent surface | What it provides | Diagram Builder mapping |
| --- | --- | --- |
| **MCP connector** ([docs](https://learn.microsoft.com/en-us/azure/sre-agent/mcp-connectors)) | The *capability* — discoverable, callable tools over Streamable-HTTP | The seven MCP tools: `list_services`, `validate_architecture`, `estimate_costs`, `generate_manifest`, `get_waf_rules`, `render_diagram`, `export_reactflow_scene` |
| **Skill** ([docs](https://learn.microsoft.com/en-us/azure/sre-agent/create-skill)) | The *judgment* — a `SKILL.md` playbook the agent auto-loads when relevant | [`SKILL.md`](./SKILL.md) — when/how to call those tools during an incident |

The connector gives the agent the **hands**; the skill gives it the **playbook**. You want both.

## Files in this folder

| File | Purpose |
| --- | --- |
| [`SKILL.md`](./SKILL.md) | The SRE Agent skill. Paste into the subagent builder's `SKILL.md` editor. |
| [`mcp-connector-setup.md`](./mcp-connector-setup.md) | Step-by-step: register the Diagram Builder as a Streamable-HTTP MCP connector. |
| [`examples/sample-architecture-manifest.json`](./examples/sample-architecture-manifest.json) | Reference manifest shape — attach as a supporting file on the skill. |

## ✅ MCP server deployed to an isolated instance — live and verified

The MCP server is restored (`mcp-server/` plus the `Dockerfile` / `start.sh` / `nginx.conf` wiring) with
Bearer-token auth via `MCP_AUTH_TOKEN`, and is **deployed to a dedicated, isolated Container App** so the
experiment stays fully separate from the production Diagram Builder:

| | |
| --- | --- |
| **MCP endpoint** | `https://azure-diagram-builder-mcp.victorioussmoke-95d145bd.eastus2.azurecontainerapps.io/mcp` |
| **Resource group** | `azure-diagrams-mcp-rg` (East US 2) — delete to tear down the whole experiment |
| **Auth** | `Authorization: Bearer <token>` (token in `.env.mcp-instance`, gitignored) |

Verified end-to-end over HTTPS: `/mcp/healthz` → 200; `/mcp` rejects missing/invalid tokens with 401;
with a valid token, `tools/list` returns 7 tools and live calls to `list_services`,
`validate_architecture`, and `render_diagram` (SVG) all succeed.

> SRE Agent MCP connectors require a remote HTTPS Streamable-HTTP endpoint (a local `stdio` server on
> your laptop won't work for a cloud-hosted agent) — which this isolated instance now provides.

See [`mcp-connector-setup.md`](./mcp-connector-setup.md) for connector registration and the
`deploy-mcp-instance.sh` / teardown commands.

## Integration at a glance

```text
 ┌──────────────────────────┐      tools/list + tools/call       ┌────────────────────────────┐
 │      Azure SRE Agent      │ ──────────────────────────────────▶│  Diagram Builder MCP server │
 │                           │   Streamable-HTTP  (/mcp, Bearer)   │  on Azure Container Apps    │
 │  • loads SKILL.md         │◀──────────────────────────────────  │  7 tools, namespaced        │
 │  • calls namespaced tools │        SVG / manifest / costs        │  azure-diagram-builder_*    │
 └──────────────────────────┘                                      └────────────────────────────┘
```

## Adoption path (recommended order)

1. **Restore + redeploy the MCP server** so `/mcp` answers over HTTPS with a Bearer token.
2. **Register the MCP connector** in the SRE Agent portal (connection id `azure-diagram-builder`).
3. **Create the skill** from [`SKILL.md`](./SKILL.md) and attach the example manifest as a supporting file.
4. **Bind the seven tools** to the skill (or to a dedicated *Architecture* subagent).
5. **Test** with a prompt like *"Render the current architecture for this incident and validate it against WAF."*

See each companion file for the detailed steps.
