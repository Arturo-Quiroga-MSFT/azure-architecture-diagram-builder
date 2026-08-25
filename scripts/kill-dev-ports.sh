#!/usr/bin/env bash
# Free the ports required by the local AADB development stack.
#
# Usage:
#   ./scripts/kill-dev-ports.sh          # ports 3000 and 3001
#   ./scripts/kill-dev-ports.sh 4174     # also clear an ad hoc Vite port
#   ./scripts/kill-dev-ports.sh --help
set -euo pipefail

DEFAULT_PORTS=(3000 3001)
PORTS=("${DEFAULT_PORTS[@]}")

usage() {
  cat <<'EOF'
Usage: ./scripts/kill-dev-ports.sh [additional-port ...]

Stops processes listening on the ports needed by the local app:
  3000  Vite dev server
  3001  token, speech, and Azure OpenAI proxy

Any numeric arguments are added to that list. For example, pass 4174 when a
Vite instance was started manually on that port.
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    *[!0-9]*|'')
      printf '[fail] Invalid port: %s\n' "$arg" >&2
      exit 2
      ;;
    *)
      if (( arg < 1 || arg > 65535 )); then
        printf '[fail] Port must be between 1 and 65535: %s\n' "$arg" >&2
        exit 2
      fi
      PORTS+=("$arg")
      ;;
  esac
done

command -v lsof >/dev/null 2>&1 || {
  printf '[fail] lsof is required but was not found.\n' >&2
  exit 1
}

# Deduplicate while preserving order.
UNIQUE_PORTS=()
for port_number in "${PORTS[@]}"; do
  already_added=0
  for existing_port in "${UNIQUE_PORTS[@]:-}"; do
    if [[ "$existing_port" == "$port_number" ]]; then
      already_added=1
      break
    fi
  done
  if (( already_added == 0 )); then
    UNIQUE_PORTS+=("$port_number")
  fi
done

listener_pids() {
  local port_number=$1
  lsof -nP -tiTCP:"$port_number" -sTCP:LISTEN 2>/dev/null | sort -u || true
}

for port_number in "${UNIQUE_PORTS[@]}"; do
  pids=$(listener_pids "$port_number")
  if [[ -z "$pids" ]]; then
    printf '[ ok ] Port %s is already free.\n' "$port_number"
    continue
  fi

  printf '[stop] Port %s listener(s):\n' "$port_number"
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    command_name=$(ps -p "$pid" -o comm= 2>/dev/null || printf 'unknown')
    printf '       PID %s (%s)\n' "$pid" "$command_name"
    kill -TERM "$pid" 2>/dev/null || true
  done <<< "$pids"

  # Give graceful shutdown up to two seconds without imposing a fixed delay.
  deadline=$((SECONDS + 2))
  while [[ -n "$(listener_pids "$port_number")" ]] && (( SECONDS < deadline )); do
    :
  done

  survivors=$(listener_pids "$port_number")
  if [[ -n "$survivors" ]]; then
    printf '[warn] Port %s did not stop gracefully; forcing remaining listener(s).\n' "$port_number"
    while IFS= read -r pid; do
      [[ -n "$pid" ]] || continue
      kill -KILL "$pid" 2>/dev/null || true
    done <<< "$survivors"
  fi

  if [[ -n "$(listener_pids "$port_number")" ]]; then
    printf '[fail] Port %s is still in use.\n' "$port_number" >&2
    exit 1
  fi
  printf '[ ok ] Port %s is free.\n' "$port_number"
done

printf '[done] Local development ports are ready.\n'
