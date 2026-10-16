"""Resolve the usage-report target for the Python reports (see usage-target.sh)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

_FIELDS = ("target", "app", "ai_rg", "subscription", "rg", "azure_config_dir", "aca_env")


def load_target() -> dict[str, str]:
    """Source usage-target.sh and return its settings; exports AZURE_CONFIG_DIR."""
    helper = Path(__file__).with_name("usage-target.sh")
    script = (
        f'source "{helper}" && printf "%s\\n" "$AADB_TARGET" "$APP" "$AI_RG" '
        '"$SUBSCRIPTION" "$RG" "${AZURE_CONFIG_DIR:-}" "$ACA_ENV"'
    )
    proc = subprocess.run(["bash", "-c", script], capture_output=True, text=True)
    if proc.returncode != 0:
        sys.exit(proc.stderr.strip() or "Could not resolve the usage-report target.")
    values = proc.stdout.split("\n")
    cfg = dict(zip(_FIELDS, (v.strip() for v in values)))
    if cfg.get("azure_config_dir"):
        os.environ["AZURE_CONFIG_DIR"] = cfg["azure_config_dir"]
    return cfg
