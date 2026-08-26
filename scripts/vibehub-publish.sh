#!/usr/bin/env bash
# Publish the AADB showcase page to VibeHub (https://vibehub.microsoft.com).
#
# The API key is read ONLY from the environment so it never appears in argv or
# shell history. Create one at VibeHub > Settings > API Keys, then:
#
#   read -rs VIBEHUB_API_KEY && export VIBEHUB_API_KEY
#   ./scripts/vibehub-publish.sh
#
# To update the existing project in place instead of creating a new one:
#
#   VIBEHUB_PROJECT_ID=<id> ./scripts/vibehub-publish.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/vibehub-showcase"
ZIP_PATH="$REPO_ROOT/vibehub-showcase/aadb-showcase.zip"
API_BASE="${VIBEHUB_API_BASE:-https://vibehub.microsoft.com}"

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

if [[ -n "${VIBEHUB_PROJECT_ID:-}" ]]; then
  echo "==> Updating existing project $VIBEHUB_PROJECT_ID"
  ARGS+=( --form "projectId=$VIBEHUB_PROJECT_ID" --form "overwrite=true" )
else
  echo "==> Creating a new project"
fi

echo "==> POST $API_BASE/api/external/push"
curl "${ARGS[@]}"
echo
echo "==> Done."
