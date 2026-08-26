#!/usr/bin/env bash
# Publish the AADB showcase page to VibeHub (https://vibehub.microsoft.com).
#
# Published project
# -----------------
#   Project ID : arturoqu-lm_mlu
#   Live URL   : https://vibehub.microsoft.com/app/azure-architecture-diagram-builder/
#   Source     : vibehub-showcase/  (index.html + images/)
#
# The API key is read ONLY from the environment so it never appears in argv or
# shell history. Create one at VibeHub > Settings > API Keys, then:
#
#   read -rs VIBEHUB_API_KEY && export VIBEHUB_API_KEY
#
# Updating the published page (the normal case)
# ---------------------------------------------
# Edit vibehub-showcase/index.html (or swap images), then just run:
#
#   ./scripts/vibehub-publish.sh
#
# This updates the project above IN PLACE by default. The URL and project ID
# stay the same, and VibeHub keeps the prior version so you can roll back from
# the project's version history.
#
# Creating a brand-new project
# ----------------------------
# Only for a genuinely different project -- doing this for the showcase page
# would create a duplicate:
#
#   VIBEHUB_NEW_PROJECT=1 ./scripts/vibehub-publish.sh
#
# Override the target project with VIBEHUB_PROJECT_ID=<id>.
#
# Preview locally before publishing:
#
#   (cd vibehub-showcase && python3 -m http.server 4178 --bind 127.0.0.1)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/vibehub-showcase"
ZIP_PATH="$REPO_ROOT/vibehub-showcase/aadb-showcase.zip"
API_BASE="${VIBEHUB_API_BASE:-https://vibehub.microsoft.com}"
PROJECT_ID="${VIBEHUB_PROJECT_ID:-arturoqu-lm_mlu}"

if [[ -z "${VIBEHUB_API_KEY:-}" ]]; then
  echo "ERROR: VIBEHUB_API_KEY is not set." >&2
  echo "  read -rs VIBEHUB_API_KEY && export VIBEHUB_API_KEY" >&2
  exit 1
fi

if [[ ! -f "$SRC_DIR/index.html" ]]; then
  echo "ERROR: $SRC_DIR/index.html not found." >&2
  exit 1
fi

echo "==> Packaging $SRC_DIR"
rm -f "$ZIP_PATH"
( cd "$SRC_DIR" && zip -r -X "$ZIP_PATH" index.html images -x '.*' >/dev/null )
echo "    $(du -h "$ZIP_PATH" | cut -f1)  $(basename "$ZIP_PATH")"

DESCRIPTION='Design, validate, cost, and export Azure architectures from plain English. \
An AI-powered canvas with official Azure icons, live Retail Prices API costing, \
Well-Architected validation, Bicep/ARM export, and an MCP server for agents.'

declare -a ARGS=(
  --silent --show-error --fail-with-body
  --request POST "$API_BASE/api/external/push"
  --header "X-API-Key: $VIBEHUB_API_KEY"
  --form "file=@$ZIP_PATH;type=application/zip"
  --form "name=Azure Architecture Diagram Builder"
  --form "slug=azure-architecture-diagram-builder"
  --form "description=$DESCRIPTION"
  --form "tags=azure,architecture,diagrams,ai,cost-estimation,well-architected,mcp"
  --form "isPrivate=false"
  --form "xrayEnabled=true"
)

if [[ -n "${VIBEHUB_NEW_PROJECT:-}" ]]; then
  echo "==> Creating a NEW project (VIBEHUB_NEW_PROJECT is set)"
else
  echo "==> Updating existing project $PROJECT_ID in place"
  ARGS+=( --form "projectId=$PROJECT_ID" --form "overwrite=true" )
fi

echo "==> POST $API_BASE/api/external/push"
curl "${ARGS[@]}"
echo
echo "==> Done."
