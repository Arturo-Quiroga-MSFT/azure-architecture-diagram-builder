
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_config

PRINCIPAL="${1:-}"
[[ -n "$PRINCIPAL" ]] || { echo "Usage: $0 <user-upn-or-object-id>" >&2; exit 1; }

CLIENT_ID="$(az ad app list --display-name "$ANALYTICS_ENTRA_APP_NAME" --query '[0].appId' -o tsv)"
[[ -n "$CLIENT_ID" ]] || { echo "Entra app not found. Run 01-provision.sh first." >&2; exit 1; }
RESOURCE_ID="$(az ad sp show --id "$CLIENT_ID" --query id -o tsv)"
PRINCIPAL_ID="$(az ad user show --id "$PRINCIPAL" --query id -o tsv)"

az rest --method POST --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$RESOURCE_ID/appRoleAssignedTo" \
  --headers Content-Type=application/json \
  --body "{\"principalId\":\"$PRINCIPAL_ID\",\"resourceId\":\"$RESOURCE_ID\",\"appRoleId\":\"00000000-0000-0000-0000-000000000000\"}" >/dev/null
printf 'Granted %s access to %s.\n' "$PRINCIPAL" "$ANALYTICS_ENTRA_APP_NAME"