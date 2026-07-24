#!/usr/bin/env bash
# Local validation for the Physical Architecture Studio.
# Runs the deterministic test suite, emits the artifact package, and validates
# the generated Bicep and Terraform LOCALLY. No Azure write access required.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Unit + snapshot tests"
npx vitest run

echo "==> Emit artifact package (out/)"
npx tsx scripts/emit.ts out

echo "==> az bicep build (local compile)"
if command -v az >/dev/null 2>&1; then
  az bicep build --file out/main.bicep --stdout >/dev/null
  echo "    Bicep build: PASSED"
else
  echo "    SKIPPED (az CLI not found)"
fi

echo "==> terraform validate (local)"
if command -v terraform >/dev/null 2>&1; then
  workdir="$(mktemp -d)"
  cp out/main.tf "$workdir/main.tf"
  ( cd "$workdir" && terraform init -backend=false -input=false >/dev/null && terraform validate )
  rm -rf "$workdir"
  echo "    Terraform validate: PASSED"
else
  echo "    SKIPPED (terraform not found)"
fi

echo "==> All local validation complete"
