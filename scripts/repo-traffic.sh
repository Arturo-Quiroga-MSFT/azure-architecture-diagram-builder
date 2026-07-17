#!/usr/bin/env bash
#
# repo-traffic.sh — Show GitHub traffic for this repo: views + unique visitors,
# clones + unique cloners (last 14 days), top paths, top referrers, forks,
# stars, and release asset download counts. Requires `gh` authenticated as a
# user with push access.
#
# Usage:
#   ./scripts/repo-traffic.sh                    # auto-detect repo from git remote
#   ./scripts/repo-traffic.sh owner/name         # explicit repo
#   ./scripts/repo-traffic.sh --csv [path]       # ALSO append a metrics row to CSV
#   ./scripts/repo-traffic.sh owner/name --csv    # combine
#
# The --csv option appends one timestamped row (snapshot of the 14-day window +
# all-time stars/forks) so you can build a longer-term trend the API doesn't keep.
# Default CSV path: usage-reports/repo-traffic-log.csv
# ============================================================================
set -euo pipefail

REPO=""
CSV_MODE=0
CSV_PATH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --csv) CSV_MODE=1; if [[ -n "${2:-}" && "$2" != --* ]]; then CSV_PATH="$2"; shift; fi ;;
    *) REPO="$1" ;;
  esac
  shift
done
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)}"
[[ -n "$REPO" ]] || { echo "❌ Could not determine repo. Pass owner/name."; exit 1; }
CSV_PATH="${CSV_PATH:-usage-reports/repo-traffic-log.csv}"
echo "Repo: $REPO"
echo

echo "── Repo stats (all time) ────────────────────────────────────────────"
gh api "repos/$REPO" \
  --jq '"Stars: \(.stargazers_count)   Forks: \(.forks_count)   Watchers: \(.subscribers_count)   Open issues/PRs: \(.open_issues_count)"'
echo

echo "── Forks ────────────────────────────────────────────────────────────"
FORKS="$(gh api "repos/$REPO/forks" --paginate --jq 'length' | awk '{s+=$1} END{print s+0}')"
if [[ "$FORKS" == "0" ]]; then
  echo "  (no forks yet)"
else
  gh api "repos/$REPO/forks" --paginate \
    --jq '.[] | "  \(.created_at[0:10])   \(.full_name)   ⭐\(.stargazers_count)"'
fi
echo

echo "── Views (last 14 days) ─────────────────────────────────────────────"
gh api "repos/$REPO/traffic/views" \
  --jq '"Total views: \(.count)   Unique visitors: \(.uniques)"'
gh api "repos/$REPO/traffic/views" \
  --jq '.views[] | "  \(.timestamp[0:10])   views: \(.count)   unique: \(.uniques)"'
echo

echo "── Clones (last 14 days) ────────────────────────────────────────────"
gh api "repos/$REPO/traffic/clones" \
  --jq '"Total clones: \(.count)   Unique cloners: \(.uniques)"'
gh api "repos/$REPO/traffic/clones" \
  --jq '.clones[] | "  \(.timestamp[0:10])   clones: \(.count)   unique: \(.uniques)"'
echo

echo "── Top paths (last 14 days) ─────────────────────────────────────────"
gh api "repos/$REPO/traffic/popular/paths" \
  --jq '.[] | "  \(.count)v / \(.uniques)u   \(.path)"' | head -10
echo

echo "── Top referrers (last 14 days) ─────────────────────────────────────"
gh api "repos/$REPO/traffic/popular/referrers" \
  --jq '.[] | "  \(.count)v / \(.uniques)u   \(.referrer)"' | head -10
echo

echo "── Release asset downloads (all time) ───────────────────────────────"
RELS="$(gh api "repos/$REPO/releases" --jq 'length')"
if [[ "$RELS" == "0" ]]; then
  echo "  (no releases — GitHub does NOT track source-code ZIP/tarball downloads)"
else
  gh api "repos/$REPO/releases" \
    --jq '.[] | "  \(.tag_name):" , (.assets[] | "     \(.download_count)×  \(.name)")'
fi

# ── Optional: append a snapshot row to a CSV for long-term trend tracking ────
if [[ "$CSV_MODE" == "1" ]]; then
  read -r V VU < <(gh api "repos/$REPO/traffic/views"  --jq '"\(.count) \(.uniques)"')
  read -r C CU < <(gh api "repos/$REPO/traffic/clones" --jq '"\(.count) \(.uniques)"')
  read -r ST FK WA < <(gh api "repos/$REPO" --jq '"\(.stargazers_count) \(.forks_count) \(.subscribers_count)"')
  mkdir -p "$(dirname "$CSV_PATH")"
  [[ -f "$CSV_PATH" ]] || echo "captured_at,repo,views_14d,unique_visitors_14d,clones_14d,unique_cloners_14d,stars,forks,watchers" > "$CSV_PATH"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ),$REPO,$V,$VU,$C,$CU,$ST,$FK,$WA" >> "$CSV_PATH"
  echo
  echo "📈 Appended snapshot to $CSV_PATH"
fi
