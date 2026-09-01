#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
APP_VERSION="${2:-}"
APP_NAME="${3:-}"
SOURCE_DIR="${4:-}"
APPROVAL_TEXT="${5:-}"

if [[ "$MODE" != "check-source" && "$MODE" != "confirm" ]]; then
  echo "Usage: $0 <check-source|confirm> <version> <app-name> <source-dir> [approval-text]" >&2
  exit 2
fi
if [[ -z "$APP_VERSION" || -z "$APP_NAME" || -z "$SOURCE_DIR" ]]; then
  echo "Production approval guard requires version, app name, and source directory." >&2
  exit 2
fi

if [[ -n "$(git -C "$SOURCE_DIR" status --porcelain)" ]]; then
  echo "Refusing production deployment from an uncommitted worktree." >&2
  exit 1
fi

SOURCE_BRANCH="$(git -C "$SOURCE_DIR" branch --show-current)"
if [[ "$SOURCE_BRANCH" != "main" ]]; then
  echo "Refusing production deployment from branch '$SOURCE_BRANCH'; source must be main." >&2
  exit 1
fi

HEAD_SHA="$(git -C "$SOURCE_DIR" rev-parse HEAD)"
if ! ORIGIN_MAIN_SHA="$(git -C "$SOURCE_DIR" rev-parse origin/main 2>/dev/null)"; then
  echo "Refusing production deployment: origin/main is unavailable." >&2
  exit 1
fi
if [[ "$HEAD_SHA" != "$ORIGIN_MAIN_SHA" ]]; then
  echo "Refusing production deployment: local main does not match origin/main." >&2
  exit 1
fi

if [[ "$MODE" == "check-source" ]]; then
  exit 0
fi

EXPECTED="deploy v${APP_VERSION} to ${APP_NAME}"
if [[ "$APPROVAL_TEXT" != "$EXPECTED" ]]; then
  echo "Production approval did not match the required version-specific phrase." >&2
  echo "Required: $EXPECTED" >&2
  exit 1
fi

printf 'Production approval accepted for v%s (%s) from %s.\n' "$APP_VERSION" "${HEAD_SHA:0:12}" "$SOURCE_BRANCH"
