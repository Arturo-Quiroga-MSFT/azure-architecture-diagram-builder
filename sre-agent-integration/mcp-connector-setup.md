# Register the Diagram Builder as an SRE Agent MCP connector

This guide registers the Azure Architecture Diagram Builder as a **Streamable-HTTP MCP connector**
in Azure SRE Agent, so the agent (and the [`SKILL.md`](./SKILL.md) playbook) can call its seven tools.

Reference docs: [MCP connectors in Azure SRE Agent](https://learn.microsoft.com/en-us/azure/sre-agent/mcp-connectors)
· [Create a skill](https://learn.microsoft.com/en-us/azure/sre-agent/create-skill)

---

## Step 0 — Restore the MCP server (prerequisite)

The MCP server was removed from the deployed image; `/mcp` currently returns **HTTP 405**. SRE Agent
connectors need a reachable **remote HTTPS** endpoint, so the server must be restored and redeployed
before a connector can connect.

What "restored" means for this repo (**done** — see `mcp-server/` and the Docker wiring):

1. **The `mcp-server/` directory is restored** and exposes the seven tools over both **stdio** and
   **Streamable-HTTP** transports (`list_services`, `validate_architecture`, `estimate_costs`,
   `generate_manifest`, `get_waf_rules`, `render_diagram`, `export_reactflow_scene`). It builds with `npm run build`.
2. **It is wired into the container image** and listens on `/mcp`:
   - `Dockerfile` — builds the MCP server and copies its `dist/` into the runtime stage.
   - `start.sh` — starts the MCP HTTP server (port 3030, internal) alongside the token server and nginx.
   - `nginx.conf` — reverse-proxies `location = /mcp` (and `/mcp/healthz`) to `127.0.0.1:3030`,
     sharing the ACA app's HTTPS FQDN and ingress.
3. **The endpoint supports Bearer-token auth** via the `MCP_AUTH_TOKEN` env var. When set, every
   request to `/mcp` must carry `Authorization: Bearer <token>` (the `/healthz` probe stays open).
   When unset, the endpoint is open — so **set it for any public ingress**. The token is compared in
   constant time. The SRE Agent connector sends exactly this Bearer header.
4. **Deployed as an isolated instance (done).** Because this integration is experimental, it runs as a
   **separate** Container App in its own resource group — fully decoupled from the production Diagram
   Builder, so it can be torn down without touching the live app:

   | Resource | Value |
   | --- | --- |
   | Resource group | `azure-diagrams-mcp-rg` (East US 2) |
   | ACA environment | `aca-env-mcp` |
   | Container App | `azure-diagram-builder-mcp` |
   | Image | `azure-diagram-builder-mcp:latest` (in existing ACR `acrazurediagrams1767583743`) |
   | Bearer token | stored locally in `.env.mcp-instance` (gitignored), set as ACA secret `mcp-auth-token` |

   Redeploy after code changes: `./scripts/deploy-mcp-instance.sh`.
   Tear down entirely: `az group delete -n azure-diagrams-mcp-rg --yes --no-wait`.

5. **Verify** the endpoint answers MCP (a `tools/list` call should return the tools):

   ```bash
   TOKEN=$(grep -E '^MCP_AUTH_TOKEN=' .env.mcp-instance | cut -d= -f2-)
   curl -sS -X POST "https://azure-diagram-builder-mcp.victorioussmoke-95d145bd.eastus2.azurecontainerapps.io/mcp" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
   ```

> If the Container App has Easy Auth (AAD) enabled on the front door, add an auth exclusion for the
> `/mcp` path (or use a dedicated ingress) so the connector's Bearer token — not an interactive AAD
> login — governs access.

---

## Step 1 — Add the connector in the SRE Agent portal

1. Open the [SRE Agent portal](https://sre.azure.com) and select your agent.
2. Go to **Connect your environment → Connectors → Add connector → Custom MCP server**.
3. Configure:

   | Field | Value |
   | --- | --- |
   | **Connection id / name** | `azure-diagram-builder` *(this becomes the tool name prefix)* |
   | **Transport** | Streamable-HTTP |
   | **URL** | `https://azure-diagram-builder-mcp.victorioussmoke-95d145bd.eastus2.azurecontainerapps.io/mcp` |
   | **Authentication** | Bearer token *(the value in `.env.mcp-instance`)* |

> **The URL MUST end in `/mcp`.** The wizard probes the exact URL you enter. The bare app FQDN
> (without `/mcp`) hits the web UI / SPA, not the MCP endpoint, and the connection test fails.
> Confirmed gotcha during setup — always include the `/mcp` path suffix.

4. Save. The agent connects, runs auto-discovery, and registers the seven tools namespaced as
   `azure-diagram-builder_<tool>` (for example `azure-diagram-builder_render_diagram`).

> **Naming note:** the `SKILL.md` `tools:` list uses the `azure-diagram-builder_` prefix. If you name
> the connection something else, update the prefix in `SKILL.md` to match.

---

## Step 2 — Select the tools

After the connector connects, a **Select tools** step appears. Select all seven tools (they fit easily
within the 80-tool-per-agent budget). For existing connectors, edit the connector and use the
**MCP Tools** section to check them.

---

## Step 3 — Make the tools available to the skill

Two options:

- **Agent tools (simplest):** with the seven tools selected on the connector, they are available in the
  main conversation, and the skill can call them directly.
- **Dedicated subagent (recommended for focus):** create an *Architecture* subagent
  (**Builder → Agent Canvas**), assign the skill, and bind the tools with a YAML wildcard:

  ```yaml
  mcp_tools:
    - azure-diagram-builder/*   # all seven tools, including any added later
  ```

---

## Step 4 — Add the skill

1. **Builder → Subagent builder → Create → Skill**.
2. Paste the contents of [`SKILL.md`](./SKILL.md) into the `SKILL.md` editor (front matter + body).
3. In **Files**, upload [`examples/sample-architecture-manifest.json`](./examples/sample-architecture-manifest.json)
   as a supporting file.
4. In **Tools → Choose tools**, confirm the seven `azure-diagram-builder_*` tools are attached.
5. **Create**.

---

## Step 5 — Test

Open a new chat thread and try a prompt that should trigger the skill:

> "We're seeing failed checkout requests. Render the current architecture for this incident,
> validate it against the Well-Architected Framework, and estimate the monthly cost of the
> affected resources."

Confirm the agent activates the skill, calls `generate_manifest` → `validate_architecture` →
`render_diagram` (and `estimate_costs`), and returns the structured report defined in the skill.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Connection test fails / wizard probe returns SPA HTML | **URL missing the `/mcp` suffix** | Use `https://<fqdn>/mcp`, not the bare app FQDN. |
| Connector status **Failed** | `/mcp` not deployed or wrong URL/token | Complete Step 0; re-check URL and Bearer token. |
| `tools/list` returns nothing | MCP server up but tools not registered | Confirm the server exposes all seven tools over Streamable-HTTP. |
| Agent never activates the skill | Description too narrow | Broaden the skill **description** so relevance is obvious. |
| Interactive login prompt on `/mcp` | Easy Auth intercepts the path | Exclude `/mcp` from AAD auth or use a dedicated ingress. |
| Tool calls time out | ACA scaled to zero / cold start | Set a minimum replica count, or accept first-call latency. |
