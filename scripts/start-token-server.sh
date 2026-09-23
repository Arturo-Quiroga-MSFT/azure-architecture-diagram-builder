#!/usr/bin/env bash
# Dev helper: starts both the speech token server and the Vite dev server.
# Reads AZURE_SPEECH_REGION and AZURE_SPEECH_RESOURCE_ID from .env if present.
#
# Usage:
#   ./scripts/start-token-server.sh        # run both (token server + vite)
#   npm run dev:avatar                     # same, via npm
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

# Load .env if present
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${AZURE_SPEECH_REGION:?AZURE_SPEECH_REGION must be set (in .env or environment)}"
: "${AZURE_SPEECH_RESOURCE_ID:?AZURE_SPEECH_RESOURCE_ID must be set (in .env or environment)}"

# Bridge the client (VITE_) values to the server-side names used by the
# /api/openai proxy, so AI generation/chat work in local dev. Prefer an
# explicit server-side value if one is already set; otherwise fall back to the
# VITE_ value from .env. Keyless auth (az login / DefaultAzureCredential) is
# used when AZURE_OPENAI_API_KEY is empty.
export AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT:-${VITE_AZURE_OPENAI_ENDPOINT:-}}"
export AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY:-${VITE_AZURE_OPENAI_API_KEY:-}}"

echo "[token-server] Starting on 127.0.0.1:3001 (region=$AZURE_SPEECH_REGION)"
echo "[token-server] OpenAI proxy endpoint: ${AZURE_OPENAI_ENDPOINT:-<unset>} (key auth: $([ -n "${AZURE_OPENAI_API_KEY:-}" ] && echo yes || echo 'no — using managed identity')))"
exec node "$ROOT/server/token-server.js"
