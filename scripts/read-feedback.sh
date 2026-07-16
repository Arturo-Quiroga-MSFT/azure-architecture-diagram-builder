#!/usr/bin/env bash
#
# read-feedback.sh — Read user feedback stored in Cosmos DB via the app's admin
# endpoint (GET /api/feedback/list). Reads FEEDBACK_ADMIN_TOKEN from repo-root
# .env and never prints the token.
#
# Usage:
#   ./scripts/read-feedback.sh                # summary + comments (default host)
#   ./scripts/read-feedback.sh --raw          # raw JSON
#   FEEDBACK_HOST=https://my-app... ./scripts/read-feedback.sh
# ============================================================================
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$SOURCE_DIR/.env"
[[ -f "$ENV_FILE" ]] || { echo "❌ .env not found at $ENV_FILE"; exit 1; }

get_val() {
  { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- \
    | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//"; } || true
}

TOKEN="$(get_val FEEDBACK_ADMIN_TOKEN)"
[[ -n "$TOKEN" ]] || { echo "❌ FEEDBACK_ADMIN_TOKEN not set in .env"; exit 1; }

# Default to the VNet-integrated app (reaches Cosmos over the private endpoint).
HOST="${FEEDBACK_HOST:-https://azure-diagram-builder-vnet.thankfulbeach-7e8f01bc.eastus2.azurecontainerapps.io}"
URL="$HOST/api/feedback/list"

RESP="$(curl -s -w $'\n%{http_code}' -H "Authorization: Bearer $TOKEN" "$URL")"
CODE="$(tail -1 <<<"$RESP")"
BODY="$(sed '$d' <<<"$RESP")"

if [[ "$CODE" != "200" ]]; then
  echo "❌ HTTP $CODE from $URL"
  echo "$BODY" | head -20
  exit 1
fi

if [[ "${1:-}" == "--raw" ]]; then
  echo "$BODY" | jq .
  exit 0
fi

echo "Source: $URL"
echo "$BODY" | jq -r '
  (.items // .feedback // .) as $items
  | ($items | length) as $n
  | "Total entries: \($n)\n"
  + "Rating breakdown:\n"
  + ([ $items[] | (.rating // .stars // "n/a") | tostring ]
       | group_by(.) | map("  \(.[0])★: \(length)") | sort | join("\n"))
  + "\n\nComments:\n"
  + ([ $items[]
       | select((.comment // .message // .text // "") | gsub("^\\s+|\\s+$";"") | length > 0)
       | "─────────────────────────────────────\n"
         + "  rating: \(.rating // .stars // "n/a")★"
         + (if .context.model then "  |  model: \(.context.model)" else "" end)
         + (if .context.diagramName then "  |  diagram: \(.context.diagramName)" else "" end)
         + (if (.createdAt // .timestamp // ._ts) then "  |  when: \(.createdAt // .timestamp // ._ts)" else "" end)
         + "\n  \(.comment // .message // .text)"
     ] | if length == 0 then "  (no written comments — all entries are quick star ratings)" else join("\n") end)
'
