#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GUARD="$ROOT/scripts/production/require-production-approval.sh"
FIXTURE="$(mktemp -d)"
trap 'rm -rf "$FIXTURE"' EXIT

assert_fails() {
  local expected="$1"
  shift
  local output
  if output="$("$@" 2>&1)"; then
    echo "Expected command to fail: $*" >&2
    exit 1
  fi
  if [[ "$output" != *"$expected"* ]]; then
    echo "Failure did not contain '$expected': $output" >&2
    exit 1
  fi
}

git -C "$FIXTURE" init -q -b main
git -C "$FIXTURE" config user.name "AADB governance test"
git -C "$FIXTURE" config user.email "aadb-governance@example.invalid"
printf 'fixture\n' > "$FIXTURE/source.txt"
git -C "$FIXTURE" add source.txt
git -C "$FIXTURE" commit -q -m fixture
git -C "$FIXTURE" update-ref refs/remotes/origin/main HEAD

"$GUARD" check-source 9.9.9 aadb-fixture "$FIXTURE"
"$GUARD" confirm 9.9.9 aadb-fixture "$FIXTURE" "deploy v9.9.9 to aadb-fixture"
assert_fails "did not match" "$GUARD" confirm 9.9.9 aadb-fixture "$FIXTURE" "deploy v9.9.8 to aadb-fixture"

git -C "$FIXTURE" switch -q -c feature/test
assert_fails "source must be main" "$GUARD" check-source 9.9.9 aadb-fixture "$FIXTURE"
git -C "$FIXTURE" switch -q main

printf 'dirty\n' >> "$FIXTURE/source.txt"
assert_fails "uncommitted worktree" "$GUARD" check-source 9.9.9 aadb-fixture "$FIXTURE"
git -C "$FIXTURE" restore source.txt

printf 'ahead\n' >> "$FIXTURE/source.txt"
git -C "$FIXTURE" add source.txt
git -C "$FIXTURE" commit -q -m ahead
assert_fails "does not match origin/main" "$GUARD" check-source 9.9.9 aadb-fixture "$FIXTURE"

echo "Production approval guard tests passed: valid, phrase, branch, dirty, and origin synchronization"
