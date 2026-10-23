#!/bin/bash
# Full pipeline for one episode: narrate (only changed cues) → record → mix → encode.
# Usage: engine/run.sh episodes/01-prompt-to-architecture   [STEP=mix to skip recording]
set -euo pipefail
source "$(dirname "$0")/config.sh"
D="$(cd "$1" && pwd)"
STEP="${STEP:-all}"
if [[ "$STEP" == all ]]; then
  "$ENGINE_DIR/narrate.sh" "$D"
  node "$D/scene.mjs" 2>&1 | tee "$D/record.log"
  [[ ${PIPESTATUS[0]} -eq 0 ]] || { echo "recording failed"; exit 1; }
fi
"$PYTHON" "$ENGINE_DIR/mix.py" "$D"
"$ENGINE_DIR/encode.sh" "$D"
