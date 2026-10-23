#!/bin/bash
# Publish finished episodes for the in-app video tour (see publish-web.py).
# Usage: publish-web.sh [--dest DIR] [--upload STORAGE_ACCOUNT] [--container NAME]
set -euo pipefail
source "$(dirname "$0")/config.sh"
exec "$PYTHON" "$ENGINE_DIR/publish-web.py" "$@"
