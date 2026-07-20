
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"
load_config

TAG="$(date -u +%Y%m%d%H%M%S)"
ACR_SERVER="$(az acr show -g "$AZURE_RESOURCE_GROUP" -n "$AZURE_CONTAINER_REGISTRY" --query loginServer -o tsv)"
IMAGE="$ACR_SERVER/aadb-product-analytics:$TAG"
az acr build -g "$AZURE_RESOURCE_GROUP" -r "$AZURE_CONTAINER_REGISTRY" -t "aadb-product-analytics:$TAG" "$APP_DIR"
az containerapp update -g "$AZURE_RESOURCE_GROUP" -n "$ANALYTICS_APP_NAME" --image "$IMAGE" --revision-suffix "$TAG" >/dev/null
"$SCRIPT_DIR/03-verify.sh"