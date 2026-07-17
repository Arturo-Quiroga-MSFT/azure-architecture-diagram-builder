#!/usr/bin/env bash
#
# repo-traffic-cron.sh — Non-interactive wrapper for scheduled (launchd/cron)
# capture of GitHub traffic into the CSV trend log. Designed to be safe to run
# unattended: it fixes up PATH (so Homebrew `gh` is found), cd's into the repo,
# appends one snapshot row to usage-reports/repo-traffic-log.csv, and logs both
# stdout and stderr to usage-reports/repo-traffic-cron.log.
#
# GitHub's traffic API only keeps a rolling 14-day window, so capturing daily
# is what lets you build a long-term trend the API itself will not retain.
#
# Manual test:
#   ./scripts/repo-traffic-cron.sh
#
# Scheduled via launchd — see scripts/launchd/com.arturoquiroga.repo-traffic.plist
# ============================================================================
set -euo pipefail

# launchd starts with a minimal PATH; make sure Homebrew + system tools resolve.
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# Repo root = two levels up from this script (scripts/ -> repo root).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

LOG_DIR="$REPO_ROOT/usage-reports"
LOG_FILE="$LOG_DIR/repo-traffic-cron.log"
mkdir -p "$LOG_DIR"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  echo "=== $TS  repo-traffic capture start ==="
  if ! command -v gh >/dev/null 2>&1; then
    echo "ERROR: gh CLI not found on PATH ($PATH)"
    exit 127
  fi
  if ! gh auth status >/dev/null 2>&1; then
    echo "ERROR: gh is not authenticated. Run 'gh auth login' as the scheduled user."
    exit 1
  fi
  ./scripts/repo-traffic.sh --csv
  echo "=== $TS  repo-traffic capture done ==="
  echo
} >>"$LOG_FILE" 2>&1
