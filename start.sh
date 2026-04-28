#!/bin/sh
# Start background services, then run nginx in the foreground.
#
# 1. Speech token server (port 3001)
#    If AZURE_SPEECH_REGION is not set the token server logs a warning and
#    /api/speech-token returns 503 — the avatar "Present" button is hidden.
#
# 2. MCP HTTP server (port 3030, internal — exposed via nginx at /mcp)
#    Streamable HTTP transport for MCP clients (M365 Copilot, hosted agents,
#    VS Code with remote MCP). Health probe: GET /healthz on port 3030.
node /srv/token-server/token-server.js &

MCP_HTTP_HOST=127.0.0.1 \
MCP_HTTP_PORT="${MCP_HTTP_PORT:-3030}" \
MCP_HTTP_PATH="${MCP_HTTP_PATH:-/mcp}" \
  node /srv/mcp-server/dist/index.js --http &

nginx -g "daemon off;"
