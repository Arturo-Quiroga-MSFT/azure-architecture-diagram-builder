#!/bin/sh
#
# azd-prepackage.sh
# =================
# Pre-package hook: reads the azd environment and writes two files that the
# Dockerfile picks up during the image build:
#
#   .env.build        — all VITE_* build arguments (OpenAI endpoints, model
#                       deployment names, speech region)
#   .env.appinsights  — App Insights connection string (semicolons in the value
#                       prevent it from being passed as a --build-arg, so it gets
#                       its own file — the Dockerfile already handles this)
#
# This hook runs automatically before 'azd package' (which invokes docker build).
# It is safe to run multiple times; each run overwrites the previous output.
#
# Manual deployments (scripts/update_aca.sh) continue to use .env directly and
# do not call this script.

set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

get_val() {
  # azd injects the selected environment into lifecycle hooks. Avoid invoking a
  # nested azd process from inside a hook because it can return no values while
  # the parent deployment holds the environment lock.
  value="$(printenv "$1" 2>/dev/null || true)"
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi

  environment_name="$(printenv AZURE_ENV_NAME 2>/dev/null || true)"
  if [ -n "$environment_name" ]; then
    environment_file="${REPO_ROOT}/.azure/${environment_name}/.env"
    if [ -f "$environment_file" ]; then
      value="$(grep "^${1}=" "$environment_file" | head -1 | sed "s/^${1}=//" | tr -d '"')"
      if [ -n "$value" ]; then
        printf '%s' "$value"
        return
      fi
    fi
  fi

  # Manual invocation fallback outside an azd lifecycle.
  if value="$(azd env get-value "$1" 2>/dev/null)"; then
    printf '%s' "$value"
  fi
}

# ── Write .env.build ───────────────────────────────────────────────────────────
cat > .env.build << EOF
VITE_AZURE_OPENAI_ENDPOINT=$(get_val AZURE_OPENAI_ENDPOINT)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT51=$(get_val AZURE_OPENAI_DEPLOYMENT_NAME)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT52)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT52CODEX)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT53CODEX)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT54=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT54)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT54MINI)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT56SOL=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT56SOL)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT56TERRA=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT56TERRA)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT56LUNA=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT56LUNA)
VITE_AZURE_OPENAI_DEPLOYMENT_MAI_THINKING_1=$(get_val AZURE_OPENAI_DEPLOYMENT_MAI_THINKING_1)
VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK=$(get_val AZURE_OPENAI_DEPLOYMENT_DEEPSEEK)
VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO=$(get_val AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO)
VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST=$(get_val AZURE_OPENAI_DEPLOYMENT_GROK4FAST)
VITE_AZURE_OPENAI_DEPLOYMENT_GROK43=$(get_val AZURE_OPENAI_DEPLOYMENT_GROK43)
VITE_AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3=$(get_val AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3)
VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK25=$(get_val AZURE_OPENAI_DEPLOYMENT_KIMIK25)
VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK27CODE=$(get_val AZURE_OPENAI_DEPLOYMENT_KIMIK27CODE)
VITE_SPEECH_REGION=$(get_val AZURE_SPEECH_REGION)
VITE_AZURE_AD_CLIENT_ID=$(get_val AZURE_AD_CLIENT_ID)
VITE_AZURE_AD_AUTHORITY=$(get_val AZURE_AD_AUTHORITY)
VITE_ARM_SCOPE=$(get_val ARM_SCOPE)
EOF

if grep -Ev '^[A-Z0-9_]+=.*$' .env.build >/dev/null; then
  echo "ERROR: .env.build contains a malformed line; refusing to package the web app." >&2
  exit 1
fi

if ! grep -Eq '^VITE_AZURE_OPENAI_ENDPOINT=.+$' .env.build; then
  echo "ERROR: AZURE_OPENAI_ENDPOINT is missing; refusing to build an AI-disabled web app." >&2
  exit 1
fi

if ! grep -Eq '^VITE_AZURE_OPENAI_DEPLOYMENT_[A-Z0-9_]+=.+$' .env.build; then
  echo "ERROR: No Azure OpenAI model deployment is configured; refusing to build an AI-disabled web app." >&2
  exit 1
fi

echo "✅ .env.build written"

# ── Write .env.appinsights ─────────────────────────────────────────────────────
CONN_STR=$(get_val APPLICATIONINSIGHTS_CONNECTION_STRING)
if [ -n "$CONN_STR" ]; then
  echo "VITE_APPINSIGHTS_CONNECTION_STRING=${CONN_STR}" > .env.appinsights
  echo "✅ .env.appinsights written"
else
  echo "ℹ️  APPLICATIONINSIGHTS_CONNECTION_STRING not set — skipping .env.appinsights"
fi
