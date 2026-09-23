#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PARAMETERS_FILE="${AADB_FOUNDRY_PARAMETERS_FILE:-${REPO_ROOT}/infra/main.parameters.json}"

if [ ! -f "$PARAMETERS_FILE" ]; then
  echo "ERROR: Foundry parameter file not found: $PARAMETERS_FILE" >&2
  exit 1
fi

read_parameter() {
  node -e '
    const fs = require("node:fs");
    const parameters = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).parameters;
    process.stdout.write(String(parameters[process.argv[2]].value));
  ' "$PARAMETERS_FILE" "$1"
}

DEPLOY_FOUNDRY="$(read_parameter deployFoundry)"
MODEL_NAME="$(read_parameter foundryModelName)"
MODEL_VERSION="$(read_parameter foundryModelVersion)"
MODEL_SKU="$(read_parameter foundryModelSkuName)"
MODEL_CAPACITY="$(read_parameter foundryModelCapacity)"

if [ "$DEPLOY_FOUNDRY" = "false" ]; then
  echo "Foundry capacity check skipped: deployFoundry=false in $PARAMETERS_FILE"
  exit 0
fi

SUBSCRIPTION_ID="$(azd env get-value AZURE_SUBSCRIPTION_ID 2>/dev/null || true)"
LOCATION="$(azd env get-value AZURE_LOCATION 2>/dev/null || true)"

if [ -z "$SUBSCRIPTION_ID" ] || [ -z "$LOCATION" ]; then
  echo "ERROR: Select an azd environment with AZURE_SUBSCRIPTION_ID and AZURE_LOCATION before provisioning." >&2
  exit 1
fi

case "$MODEL_CAPACITY" in
  ''|*[!0-9]*)
    echo "ERROR: AADB_FOUNDRY_MODEL_CAPACITY must be a positive integer." >&2
    exit 1
    ;;
esac

if [ "$MODEL_CAPACITY" -lt 1 ]; then
  echo "ERROR: AADB_FOUNDRY_MODEL_CAPACITY must be at least 1." >&2
  exit 1
fi

MODEL_CATALOG="$(az cognitiveservices model list \
  --subscription "$SUBSCRIPTION_ID" \
  --location "$LOCATION" \
  --output json)"

MODEL_MATCH="$(printf '%s' "$MODEL_CATALOG" | \
  MODEL_NAME="$MODEL_NAME" MODEL_VERSION="$MODEL_VERSION" MODEL_SKU="$MODEL_SKU" \
  node -e '
    let input = "";
    process.stdin.on("data", chunk => { input += chunk; });
    process.stdin.on("end", () => {
      const models = JSON.parse(input);
      const match = models.some(({ model }) =>
        model?.name === process.env.MODEL_NAME &&
        model?.version === process.env.MODEL_VERSION &&
        model?.skus?.some(({ name }) => name === process.env.MODEL_SKU));
      process.stdout.write(match ? "true" : "false");
    });
  ')"

if [ "$MODEL_MATCH" != "true" ]; then
  echo "ERROR: $MODEL_NAME version $MODEL_VERSION with SKU $MODEL_SKU is not available in $LOCATION." >&2
  echo "Choose a supported region/version/SKU before provisioning; no fallback model will be deployed." >&2
  exit 1
fi

USAGE_NAME="OpenAI.${MODEL_SKU}.${MODEL_NAME}"
QUOTA_PAYLOAD="$(az rest --method get \
  --url "https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/providers/Microsoft.CognitiveServices/locations/${LOCATION}/usages?api-version=2023-05-01" \
  --output json)"

AVAILABLE_CAPACITY="$(printf '%s' "$QUOTA_PAYLOAD" | \
  USAGE_NAME="$USAGE_NAME" node -e '
    let input = "";
    process.stdin.on("data", chunk => { input += chunk; });
    process.stdin.on("end", () => {
      const payload = JSON.parse(input);
      const quota = payload.value?.find(({ name }) => name?.value === process.env.USAGE_NAME);
      process.stdout.write(quota ? String(quota.limit - quota.currentValue) : "-1");
    });
  ')"

if [ "$AVAILABLE_CAPACITY" -lt "$MODEL_CAPACITY" ]; then
  echo "ERROR: Insufficient $USAGE_NAME quota in $LOCATION." >&2
  echo "Requested capacity: $MODEL_CAPACITY; available capacity: $AVAILABLE_CAPACITY." >&2
  echo "Request quota, lower capacity, or choose another supported region before provisioning." >&2
  exit 1
fi

echo "Foundry preflight passed: $MODEL_NAME $MODEL_VERSION, $MODEL_SKU capacity $MODEL_CAPACITY in $LOCATION ($AVAILABLE_CAPACITY available)."
