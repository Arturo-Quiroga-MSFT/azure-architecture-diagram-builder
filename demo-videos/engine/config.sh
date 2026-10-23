#!/bin/bash
# Shared settings for the shell steps. Sourced by run.sh, narrate.sh and encode.sh.
# Values come from the environment, then demo-videos/.env (git-ignored; see .env.example).
ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
VIDEOS_ROOT="$(cd "$ENGINE_DIR/.." && pwd -P)"
if [[ -f "$VIDEOS_ROOT/.env" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    key="${key// /}"
    [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && continue
    printenv "$key" >/dev/null && continue
    value="${value%\"}"; value="${value#\"}"
    export "$key=$value"
  done < "$VIDEOS_ROOT/.env"
fi
FFMPEG="${FFMPEG:-ffmpeg}"
FFPROBE="${FFPROBE:-ffprobe}"
if [[ -z "${PYTHON:-}" ]]; then
  if [[ -x "$ENGINE_DIR/.venv/bin/python" ]]; then PYTHON="$ENGINE_DIR/.venv/bin/python"; else PYTHON=python3; fi
fi
OUTPUT_DIR="${OUTPUT_DIR:-$VIDEOS_ROOT/videos}"
export FFMPEG FFPROBE PYTHON OUTPUT_DIR
