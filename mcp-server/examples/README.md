# MCP client configuration examples

Drop-in configurations for connecting MCP-compatible clients to the Azure
Architecture Diagram Builder MCP server.

## Server transport modes

The server supports two transports, selected via env var or CLI flag:

| Transport | Start command | Use case |
|-----------|---------------|----------|
| `stdio` (default) | `node dist/index.js` | Local clients (VS Code, Claude Desktop, `az prototype`) |
| `streamable-http` | `node dist/index.js --http` | Remote / hosted clients (M365 Copilot, hosted agents, ACA) |

HTTP env vars (all optional):

```
MCP_TRANSPORT=http        # alternative to --http
MCP_HTTP_HOST=0.0.0.0     # default
MCP_HTTP_PORT=3030        # default
MCP_HTTP_PATH=/mcp        # default
```

Health probe: `GET /healthz` returns `{ "status": "ok", ... }`.

## Files in this folder

| File | Client | Transport |
|------|--------|-----------|
| `vscode-mcp-stdio.json` | VS Code Copilot Chat | stdio |
| `vscode-mcp-http.json` | VS Code Copilot Chat | streamable HTTP |
| `claude-desktop-stdio.json` | Claude Desktop | stdio |
| `m365-copilot-declarative-agent.json` | Microsoft 365 Copilot | streamable HTTP (HTTPS in production) |

## Quick test (HTTP)

```bash
# Terminal 1 — start server
cd mcp-server
npm run build
MCP_HTTP_HOST=127.0.0.1 MCP_HTTP_PORT=3030 node dist/index.js --http

# Terminal 2 — initialize a session and list tools
INIT=$(curl -sS -i -X POST http://127.0.0.1:3030/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}')
SID=$(echo "$INIT" | grep -i '^mcp-session-id:' | awk '{print $2}' | tr -d '\r')

curl -sS -X POST http://127.0.0.1:3030/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

curl -sS -X POST http://127.0.0.1:3030/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H "mcp-session-id: $SID" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

## Production hosting notes (M365 Copilot target)

- M365 Copilot requires the MCP endpoint to be reachable over public **HTTPS**.
- Recommended hosting: deploy the MCP server as a separate Azure Container Apps
  revision (or alongside the existing app) and front it with API Management or
  the built-in ACA ingress for HTTPS termination.
- The streamable-HTTP transport is stateful: ensure the ingress preserves the
  `mcp-session-id` request/response header and supports SSE (`text/event-stream`).
- Consider adding bearer-token auth (Entra ID) at the ingress before exposing
  publicly.
