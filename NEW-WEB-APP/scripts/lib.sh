
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$SCRIPT_DIR/config.sh" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/config.sh"
fi

require_var() {
  local name="$1"
  [[ -n "${!name:-}" ]] || { echo "Missing required variable: $name" >&2; exit 1; }
}

load_config() {
  require_var AZURE_RESOURCE_GROUP
  require_var AZURE_LOCATION
  require_var CONTAINER_APP_ENVIRONMENT
  require_var AZURE_CONTAINER_REGISTRY
  require_var ANALYTICS_LOG_ANALYTICS_WORKSPACE
  require_var SOURCE_LOG_ANALYTICS_WORKSPACE_RESOURCE_GROUP
  require_var SOURCE_LOG_ANALYTICS_WORKSPACE
  export ANALYTICS_APP_NAME="${ANALYTICS_APP_NAME:-aadb-usage-analytics}"
  export ANALYTICS_IDENTITY_NAME="${ANALYTICS_IDENTITY_NAME:-id-aadb-usage-analytics}"
  export ANALYTICS_ENTRA_APP_NAME="${ANALYTICS_ENTRA_APP_NAME:-AADB Product Analytics}"
}