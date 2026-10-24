#!/bin/bash
# Build the video tour media image in ACR and roll it out to its Container App.
# Usage: deploy-media.sh <acr-name> <container-app> <resource-group> [<container-apps-environment>]
# Run demo-videos/engine/publish-web.sh first. The environment is only needed the first time, to create the app.
# Prints the app URL; build AADB with VITE_VIDEO_BASE_URL=<url>/videos.
set -euo pipefail
ACR="${1:?acr name}"; APP="${2:?container app name}"; RG="${3:?resource group}"; ENV_NAME="${4:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${MEDIA_DIR:-$(cd "$HERE/../../.." && pwd)/public/media/videos}"
[[ -f "$SRC/videos.json" ]] || { echo "No $SRC/videos.json: run demo-videos/engine/publish-web.sh first" >&2; exit 1; }
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
cp "$HERE/Dockerfile" "$HERE/nginx.conf" "$HERE/cors.conf" "$STAGE/"
mkdir "$STAGE/videos" && cp "$SRC"/*.mp4 "$SRC"/*.vtt "$SRC"/*.jpg "$SRC/videos.json" "$STAGE/videos/"
TAG="$(date -u +%Y%m%d-%H%M)-$(shasum "$SRC/videos.json" | cut -c1-8)"
IMAGE="$ACR.azurecr.io/$APP:$TAG"
echo "Building $IMAGE ($(du -sh "$STAGE/videos" | cut -f1))"
az acr build -r "$ACR" --image "$APP:$TAG" --no-logs -o none "$STAGE"
if az containerapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  az containerapp update -n "$APP" -g "$RG" --image "$IMAGE" -o none
else
  [[ -n "$ENV_NAME" ]] || { echo "Container App $APP does not exist: pass the environment name to create it" >&2; exit 1; }
  az containerapp create -n "$APP" -g "$RG" --environment "$ENV_NAME" --image "$IMAGE" \
    --registry-server "$ACR.azurecr.io" --registry-identity system \
    --ingress external --target-port 80 --transport auto --revisions-mode single \
    --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 3 -o none
fi
URL="https://$(az containerapp show -n "$APP" -g "$RG" --query properties.configuration.ingress.fqdn -o tsv)"
for _ in 1 2 3 4 5 6; do curl -fsS -m 30 "$URL/healthz" >/dev/null 2>&1 && break; sleep 10; done
curl -fsS -m 30 "$URL/videos/videos.json" | python3 -c "import json,sys;m=json.load(sys.stdin);print(f\"{len(m['videos'])} videos live\")"
echo "Deployed $IMAGE"
echo "VITE_VIDEO_BASE_URL=$URL/videos"
