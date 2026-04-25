#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# dev-all.sh — Start everything needed to test the app locally before pushing.
#
# Components started:
#   1. Speech token server  (Node, 127.0.0.1:3001)  -> /api/speech-token, /api/ice-token
#   2. Vite dev server      (3000, proxies /api/* to 3001)
#   3. MCP server           (optional, on demand — built once if --with-mcp)
#
# Pre-flight checks:
#   - .env loaded; required AZURE_SPEECH_* vars present
#   - Active Azure CLI login on the expected subscription
#   - Ports 3000 and 3001 are free
#   - npm dependencies installed
#
# Usage:
#   ./scripts/dev-all.sh                 # token server + vite
#   ./scripts/dev-all.sh --with-mcp      # also build & start MCP server
#   ./scripts/dev-all.sh --skip-az-check # skip az login verification
#
# Press Ctrl-C once to stop all child processes.
# ------------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
cd "$ROOT"

WITH_MCP=0
SKIP_AZ_CHECK=0
EXPECTED_SUB="7a28b21e-0d3e-4435-a686-d92889d4ee96"

for arg in "$@"; do
  case "$arg" in
    --with-mcp)       WITH_MCP=1 ;;
    --skip-az-check)  SKIP_AZ_CHECK=1 ;;
    -h|--help)
      sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# -- Colors ---------------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET="\033[0m"; C_BOLD="\033[1m"
  C_GREEN="\033[32m"; C_YELLOW="\033[33m"; C_RED="\033[31m"; C_CYAN="\033[36m"
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_CYAN=""
fi
log()  { printf "${C_CYAN}[dev-all]${C_RESET} %s\n" "$*"; }
ok()   { printf "${C_GREEN}[ ok ]${C_RESET} %s\n" "$*"; }
warn() { printf "${C_YELLOW}[warn]${C_RESET} %s\n" "$*"; }
die()  { printf "${C_RED}[fail]${C_RESET} %s\n" "$*" >&2; exit 1; }

# -- Load .env ------------------------------------------------------------------
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
  ok ".env loaded"
else
  warn ".env not found at $ROOT/.env"
fi

# -- Required vars --------------------------------------------------------------
: "${AZURE_SPEECH_REGION:?AZURE_SPEECH_REGION must be set in .env}"
: "${AZURE_SPEECH_RESOURCE_ID:?AZURE_SPEECH_RESOURCE_ID must be set in .env}"
ok "Speech region: $AZURE_SPEECH_REGION"

# -- Tooling --------------------------------------------------------------------
command -v node >/dev/null || die "node not found"
command -v npm  >/dev/null || die "npm not found"
ok "node $(node --version) / npm $(npm --version)"

# -- Azure CLI login check ------------------------------------------------------
if [ "$SKIP_AZ_CHECK" -eq 0 ]; then
  if ! command -v az >/dev/null; then
    warn "az CLI not found — skipping login check (use --skip-az-check to silence)"
  else
    if ! az account show >/dev/null 2>&1; then
      die "Not signed in to Azure. Run: az login --tenant <yourTenantId>"
    fi
    SUB_ID=$(az account show --query id -o tsv)
    USER=$(az account show --query user.name -o tsv)
    TENANT=$(az account show --query tenantId -o tsv)
    if [ "$SUB_ID" != "$EXPECTED_SUB" ]; then
      warn "Active subscription is $SUB_ID, expected $EXPECTED_SUB"
      warn "Run: az account set --subscription $EXPECTED_SUB"
    fi
    ok "Azure: $USER (tenant=$TENANT, sub=$SUB_ID)"
  fi
fi

# -- Free ports? ----------------------------------------------------------------
check_port() {
  local port=$1 name=$2
  if lsof -iTCP:"$port" -sTCP:LISTEN -nP >/dev/null 2>&1; then
    die "Port $port is already in use (needed for $name). Stop it and retry."
  fi
}
check_port 3001 "speech token server"
check_port 3000 "Vite dev server"
ok "Ports 3000 and 3001 are free"

# -- Install deps if missing ----------------------------------------------------
if [ ! -d "$ROOT/node_modules" ]; then
  log "Installing root npm dependencies (first run)…"
  npm install
fi
if [ ! -d "$ROOT/server/node_modules" ]; then
  log "Installing server/ npm dependencies…"
  (cd "$ROOT/server" && npm install)
fi
if [ "$WITH_MCP" -eq 1 ]; then
  if [ ! -d "$ROOT/mcp-server/node_modules" ]; then
    log "Installing mcp-server/ npm dependencies…"
    (cd "$ROOT/mcp-server" && npm install)
  fi
  log "Building MCP server…"
  npm run --silent mcp:build
fi

# -- Process management ---------------------------------------------------------
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"
PIDS=()

cleanup() {
  echo
  log "Shutting down child processes…"
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  # Give them a moment, then SIGKILL anything still alive
  sleep 1
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  ok "All processes stopped."
}
trap cleanup INT TERM EXIT

start_bg() {
  local name=$1; shift
  local logfile="$LOG_DIR/$name.log"
  log "starting $name (logs: $logfile)"
  ( "$@" >"$logfile" 2>&1 ) &
  local pid=$!
  PIDS+=("$pid")
  printf "       pid=%s\n" "$pid"
}

# 1) Token server
start_bg "token-server" node "$ROOT/server/token-server.js"

# 2) MCP server (optional)
if [ "$WITH_MCP" -eq 1 ]; then
  start_bg "mcp-server" node "$ROOT/mcp-server/dist/index.js"
fi

# 3) Vite — keep in foreground so its colored output is visible & Ctrl-C reaches it
log "starting Vite dev server (foreground)…"
sleep 1  # let token server bind first

# Quick health probe (best-effort)
if curl -fsS -o /dev/null -m 3 http://127.0.0.1:3001/api/speech-token 2>/dev/null; then
  ok "/api/speech-token → 200"
else
  warn "/api/speech-token did not return 200 yet — check $LOG_DIR/token-server.log"
fi

printf "\n${C_BOLD}Open: http://localhost:3000${C_RESET}\n\n"
npm run dev
