
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_config

FQDN="$(az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$ANALYTICS_APP_NAME" --query properties.configuration.ingress.fqdn -o tsv)"
MIN_REPLICAS="$(az containerapp show -g "$AZURE_RESOURCE_GROUP" -n "$ANALYTICS_APP_NAME" --query properties.template.scale.minReplicas -o tsv)"
AUTH_ENABLED="$(az containerapp auth show -g "$AZURE_RESOURCE_GROUP" -n "$ANALYTICS_APP_NAME" --query platform.enabled -o tsv)"
[[ "$MIN_REPLICAS" == "1" ]] || { echo "Expected minReplicas=1, found $MIN_REPLICAS" >&2; exit 1; }
[[ "$AUTH_ENABLED" == "true" ]] || { echo "Container Apps authentication is not enabled" >&2; exit 1; }
STATUS="$(curl -sS -o /dev/null -w '%{http_code}' "https://$FQDN/api/health")"
[[ "$STATUS" == "302" || "$STATUS" == "401" ]] || { echo "Expected authenticated health endpoint, received HTTP $STATUS" >&2; exit 1; }
printf 'Verified https://%s (auth enabled, minReplicas=1).\n' "$FQDN"