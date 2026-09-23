#!/usr/bin/env python3
"""patch_workbook_filter.py

Patches scripts/workbook-content.json to scope every KQL tile to
diagram-builder events only, filtering out unrelated telemetry that may
share the same Application Insights resource (e.g. Foundry agent traces).

Strategy: prepend a `let DB_EVENTS = ...;` declaration to every query
and rewrite the leading `customEvents` reference to `DB_EVENTS`.
Queries that already include the right `where name == "..."` filter are
unaffected — the alias still resolves and remains valid KQL.
"""
from __future__ import annotations
import json
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "workbook-content.json"
BACKUP = SRC.with_suffix(".json.bak")

DB_EVENT_NAMES = [
    "Architecture_Generated", "Architecture_Validated", "DeploymentGuide_Generated",
    "Diagram_Exported", "Template_Imported", "ARM_Template_Imported",
    "Image_Imported", "Models_Compared", "Recommendations_Applied",
    "Version_Operation", "Region_Changed", "Start_Fresh", "AI_Model_Usage",
]
NAME_LIST = ", ".join(f'"{n}"' for n in DB_EVENT_NAMES)
PREAMBLE = f'let DB_EVENTS = customEvents | where name in ({NAME_LIST});\n'

def patch_query(q: str) -> str:
    # Skip if already patched
    if q.startswith("let DB_EVENTS"):
        return q
    # Replace the first `customEvents` token with DB_EVENTS, then prepend the let
    # Use a simple replace on the first occurrence only.
    idx = q.find("customEvents")
    if idx == -1:
        return q
    patched = q[:idx] + "DB_EVENTS" + q[idx + len("customEvents"):]
    return PREAMBLE + patched

def walk(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "query" and isinstance(v, str):
                obj[k] = patch_query(v)
            else:
                walk(v)
    elif isinstance(obj, list):
        for item in obj:
            walk(item)

def main() -> int:
    if not SRC.exists():
        print(f"ERROR: {SRC} not found", file=sys.stderr)
        return 1
    if not BACKUP.exists():
        shutil.copy2(SRC, BACKUP)
        print(f"📦 Backup written to {BACKUP}")
    data = json.loads(SRC.read_text())
    walk(data)
    SRC.write_text(json.dumps(data, indent=2))
    print(f"✅ Patched {SRC}")
    print(f"   Queries now scoped to {len(DB_EVENT_NAMES)} diagram-builder events.")
    print(f"   Redeploy with: ./scripts/deploy-workbook.sh")
    return 0

if __name__ == "__main__":
    sys.exit(main())
