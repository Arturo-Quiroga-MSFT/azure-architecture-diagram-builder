#!/bin/sh
set -eu

APP_URL="${1:?Usage: require-version-bump.sh <deployed-app-url>}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
LOCAL_VERSION="$(node -p "require('${REPO_ROOT}/package.json').version")"

if ! printf '%s' "$LOCAL_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "ERROR: package.json version must use stable semantic versioning (x.y.z): $LOCAL_VERSION" >&2
  exit 1
fi

if [ "${ALLOW_VERSION_REDEPLOY:-false}" = "true" ]; then
  echo "WARNING: version redeploy override enabled for v$LOCAL_VERSION"
  exit 0
fi

VERSION_FILE="$(mktemp)"
trap 'rm -f "$VERSION_FILE"' EXIT
HTTP_STATUS="$(curl -sS --max-time 15 -o "$VERSION_FILE" -w '%{http_code}' "${APP_URL%/}/version.json" || true)"

if [ "$HTTP_STATUS" = "404" ]; then
  echo "Version gate: existing app has no version manifest; allowing first versioned deployment v$LOCAL_VERSION"
  exit 0
fi

if [ "$HTTP_STATUS" != "200" ]; then
  echo "ERROR: cannot verify deployed app version at ${APP_URL%/}/version.json (HTTP $HTTP_STATUS)." >&2
  exit 1
fi

if grep -Eqi '^\s*<!doctype html' "$VERSION_FILE"; then
  echo "Version gate: existing app has no version manifest; allowing first versioned deployment v$LOCAL_VERSION"
  exit 0
fi

DEPLOYED_VERSION="$(node -e "const fs=require('fs'); const value=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).version; if(typeof value !== 'string') process.exit(1); process.stdout.write(value)" "$VERSION_FILE")" \
  || { echo "ERROR: deployed version manifest is malformed." >&2; exit 1; }

if ! printf '%s' "$DEPLOYED_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "ERROR: deployed app version is not stable semantic versioning: $DEPLOYED_VERSION" >&2
  exit 1
fi

if ! node -e "const current=process.argv[1].split('.').map(Number); const next=process.argv[2].split('.').map(Number); for(let index=0; index<3; index+=1){if(next[index]>current[index])process.exit(0);if(next[index]<current[index])process.exit(1)}process.exit(1)" "$DEPLOYED_VERSION" "$LOCAL_VERSION"; then
  echo "ERROR: deployment requires a version newer than v$DEPLOYED_VERSION; package.json is v$LOCAL_VERSION." >&2
  echo "Run 'npm version patch --no-git-tag-version', or set ALLOW_VERSION_REDEPLOY=true only for recovery." >&2
  exit 1
fi

echo "Version gate passed: v$DEPLOYED_VERSION -> v$LOCAL_VERSION"