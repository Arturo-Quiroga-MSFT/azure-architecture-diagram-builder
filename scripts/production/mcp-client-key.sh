#!/usr/bin/env bash
#
# mcp-client-key.sh — manage named API keys for the remote MCP server.
# ============================================================================
# Client keys let service-to-service integrations from other tenants (for
# example Azure Copilot's custom MCP connector) call the server without Entra
# guest accounts or cross-tenant consent. Each key is named, revocable on its
# own, and its calls are attributed to that name in usage telemetry.
#
# - The server only receives SHA-256 hashes (MCP_CLIENT_KEYS in
#   .env.mcp.<target>, gitignored).
# - Raw keys are printed once and kept in .env.mcp-keys.<target> (gitignored,
#   mode 600) so you can re-share them; delete that file if you prefer not to.
# - Changes take effect on the next deploy-mcp.sh run, which updates the
#   secret and restarts the active revision when needed.
#
# Usage:
#   AADB_TARGET=fdpo ./scripts/production/mcp-client-key.sh add <name>
#   AADB_TARGET=fdpo ./scripts/production/mcp-client-key.sh revoke <name>
#   AADB_TARGET=fdpo ./scripts/production/mcp-client-key.sh list
# ============================================================================
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
AADB_TARGET="${AADB_TARGET:-mcap094150}"
TOKEN_FILE="$SOURCE_DIR/.env.mcp.$AADB_TARGET"
KEYS_FILE="$SOURCE_DIR/.env.mcp-keys.$AADB_TARGET"
ACTION="${1:-}"
NAME="$(printf '%s' "${2:-}" | tr '[:upper:]' '[:lower:]')"

for f in "$TOKEN_FILE" "$KEYS_FILE"; do
  git -C "$SOURCE_DIR" check-ignore -q "$f" || { echo "❌ $f is not gitignored" >&2; exit 1; }
done
touch "$TOKEN_FILE" "$KEYS_FILE"
chmod 600 "$TOKEN_FILE" "$KEYS_FILE"

current_entries() {
  sed -n 's/^MCP_CLIENT_KEYS=//p' "$TOKEN_FILE" | tr ',' '\n' | sed '/^$/d'
}

write_entries() {
  local joined
  joined="$(paste -sd, - | sed 's/,$//')"
  grep -v '^MCP_CLIENT_KEYS=' "$TOKEN_FILE" > "$TOKEN_FILE.tmp" || true
  [[ -n "$joined" ]] && printf 'MCP_CLIENT_KEYS=%s\n' "$joined" >> "$TOKEN_FILE.tmp"
  mv "$TOKEN_FILE.tmp" "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
}

require_name() {
  [[ "$NAME" =~ ^[a-z0-9][a-z0-9-]{0,62}$ ]] \
    || { echo "❌ Client name must be lowercase letters, digits and dashes (e.g. azure-copilot)" >&2; exit 1; }
}

case "$ACTION" in
  add)
    require_name
    if current_entries | grep -q "^$NAME="; then
      echo "❌ Client '$NAME' already has a key. Revoke it first to rotate." >&2; exit 1
    fi
    KEY="aadb_ck_$(openssl rand -hex 32)"
    HASH="$(printf '%s' "$KEY" | openssl dgst -sha256 -r | cut -d' ' -f1)"
    { current_entries; printf '%s=%s\n' "$NAME" "$HASH"; } | write_entries
    printf '%s=%s\n' "$NAME" "$KEY" >> "$KEYS_FILE"
    echo "🔑 Key for '$NAME' (share privately; send as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'):"
    echo ""
    echo "   $KEY"
    echo ""
    echo "Saved to $(basename "$KEYS_FILE"). Run deploy-mcp.sh to activate it."
    ;;
  revoke)
    require_name
    current_entries | grep -q "^$NAME=" || { echo "❌ No key for '$NAME'" >&2; exit 1; }
    current_entries | grep -v "^$NAME=" | write_entries
    grep -v "^$NAME=" "$KEYS_FILE" > "$KEYS_FILE.tmp" || true
    mv "$KEYS_FILE.tmp" "$KEYS_FILE"
    chmod 600 "$KEYS_FILE"
    echo "🗑  Revoked '$NAME'. Run deploy-mcp.sh to apply."
    ;;
  list)
    current_entries | cut -d= -f1 | sed 's/^/  - /'
    ;;
  *)
    sed -n '17,21p' "$0" | sed 's/^# //'
    exit 1
    ;;
esac
