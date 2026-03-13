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

echo "[token-server] Starting on 127.0.0.1:3001 (region=$AZURE_SPEECH_REGION)"
exec node "$ROOT/server/token-server.js"
