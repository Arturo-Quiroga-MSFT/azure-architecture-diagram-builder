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

# ── Read the azd environment ───────────────────────────────────────────────────
AZD_ENV=$(azd env get-values 2>/dev/null || true)

get_val() {
  echo "$AZD_ENV" | grep "^${1}=" | head -1 | sed "s/^${1}=//" | tr -d '"'
}

# ── Write .env.build ───────────────────────────────────────────────────────────
cat > .env.build << EOF
VITE_AZURE_OPENAI_ENDPOINT=$(get_val AZURE_OPENAI_ENDPOINT)
VITE_AZURE_OPENAI_API_KEY=$(get_val AZURE_OPENAI_API_KEY)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT51=$(get_val AZURE_OPENAI_DEPLOYMENT_NAME)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT52=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT52)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT52CODEX)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT53CODEX)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT54=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT54)
VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI=$(get_val AZURE_OPENAI_DEPLOYMENT_GPT54MINI)
VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK=$(get_val AZURE_OPENAI_DEPLOYMENT_DEEPSEEK)
VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST=$(get_val AZURE_OPENAI_DEPLOYMENT_GROK4FAST)
VITE_SPEECH_REGION=$(get_val AZURE_SPEECH_REGION)
EOF

echo "✅ .env.build written"

# ── Write .env.appinsights ─────────────────────────────────────────────────────
CONN_STR=$(get_val APPLICATIONINSIGHTS_CONNECTION_STRING)
if [ -n "$CONN_STR" ]; then
  echo "VITE_APPINSIGHTS_CONNECTION_STRING=${CONN_STR}" > .env.appinsights
  echo "✅ .env.appinsights written"
else
  echo "ℹ️  APPLICATIONINSIGHTS_CONNECTION_STRING not set — skipping .env.appinsights"
fi
