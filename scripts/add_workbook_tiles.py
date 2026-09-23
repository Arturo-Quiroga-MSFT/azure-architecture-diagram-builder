#!/usr/bin/env python3
"""add_workbook_tiles.py — append new analytics tiles to workbook-content.json.

Idempotent: each new tile uses a unique `name`; if already present, skipped.
"""
from __future__ import annotations
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "workbook-content.json"

DB_EVENTS = (
    'let DB_EVENTS = customEvents | where name in ('
    '"Architecture_Generated", "Architecture_Validated", "DeploymentGuide_Generated", '
    '"Diagram_Exported", "Template_Imported", "ARM_Template_Imported", '
    '"Image_Imported", "Models_Compared", "Recommendations_Applied", '
    '"Version_Operation", "Region_Changed", "Start_Fresh", "AI_Model_Usage");\n'
)

def text_section(title: str, name: str) -> dict:
    return {"type": 1, "content": {"json": f"## {title}"}, "name": name}

def kql_tile(name: str, title: str, query: str, visualization: str,
             size: int = 0, width: str | None = None,
             chart_settings: dict | None = None,
             grid_settings: dict | None = None) -> dict:
    content = {
        "version": "KqlItem/1.0",
        "query": DB_EVENTS + query,
        "size": size,
        "title": title,
        "timeContextFromParameter": "TimeRange",
        "queryType": 0,
        "resourceType": "microsoft.insights/components",
        "visualization": visualization,
    }
    if chart_settings:
        content["chartSettings"] = chart_settings
    if grid_settings:
        content["gridSettings"] = grid_settings
    tile = {"type": 3, "content": content, "name": name}
    if width:
        tile["customWidth"] = width
    return tile

NEW_TILES: list[dict] = [
    text_section("Growth & Engagement", "growth-header"),
    kql_tile(
        name="mau-trend",
        title="Monthly Active Users",
        visualization="barchart",
        query=(
            "DB_EVENTS\n"
            "| where isnotempty(user_Id)\n"
            "| summarize MAU = dcount(user_Id) by Month = startofmonth(timestamp)\n"
            "| order by Month asc"
        ),
        chart_settings={"xAxis": "Month", "yAxis": ["MAU"], "showLegend": False},
        width="50",
    ),
    kql_tile(
        name="new-vs-returning",
        title="New vs Returning Users (by week)",
        visualization="barchart",
        query=(
            "let firstSeen = DB_EVENTS\n"
            "  | where isnotempty(user_Id)\n"
            "  | summarize FirstSeen = min(timestamp) by user_Id;\n"
            "DB_EVENTS\n"
            "| where isnotempty(user_Id)\n"
            "| join kind=leftouter firstSeen on user_Id\n"
            "| extend Week = startofweek(timestamp),\n"
            "         UserType = iff(startofweek(FirstSeen) == startofweek(timestamp), \"New\", \"Returning\")\n"
            "| summarize Users = dcount(user_Id) by Week, UserType\n"
            "| order by Week asc"
        ),
        chart_settings={"xAxis": "Week", "yAxis": ["Users"], "group": "UserType", "showLegend": True},
        width="50",
    ),
    kql_tile(
        name="region-preferences",
        title="Top Azure Regions Selected (Region_Changed)",
        visualization="piechart",
        query=(
            "DB_EVENTS\n"
            "| where name == \"Region_Changed\"\n"
            "| extend region = tolower(tostring(customDimensions.region))\n"
            "| summarize Count = count() by region\n"
            "| top 12 by Count desc"
        ),
        width="50",
    ),
    kql_tile(
        name="deployment-guides",
        title="Deployment Guides Generated (by model)",
        visualization="table",
        query=(
            "DB_EVENTS\n"
            "| where name == \"DeploymentGuide_Generated\"\n"
            "| extend model = tolower(tostring(customDimensions.model))\n"
            "| extend serviceCount = todouble(customMeasurements.serviceCount)\n"
            "| extend bicepFiles = todouble(customMeasurements.bicepFileCount)\n"
            "| extend timeSec = round(todouble(customMeasurements.elapsedTimeMs) / 1000, 1)\n"
            "| summarize\n"
            "    Guides = count(),\n"
            "    Users = dcount(user_Id),\n"
            "    AvgServices = round(avg(serviceCount), 1),\n"
            "    AvgBicepFiles = round(avg(bicepFiles), 1),\n"
            "    AvgTimeSec = round(avg(timeSec), 1)\n"
            "  by model\n"
            "| order by Guides desc"
        ),
        grid_settings={"sortBy": [{"itemKey": "Guides", "sortOrder": 2}]},
        width="50",
    ),
    kql_tile(
        name="cohort-retention",
        title="Weekly Cohort Retention (% returning in week N)",
        visualization="table",
        query=(
            "let cohorts = DB_EVENTS\n"
            "  | where isnotempty(user_Id)\n"
            "  | summarize FirstSeen = startofweek(min(timestamp)) by user_Id;\n"
            "DB_EVENTS\n"
            "| where isnotempty(user_Id)\n"
            "| extend Week = startofweek(timestamp)\n"
            "| join kind=inner cohorts on user_Id\n"
            "| extend WeekOffset = datetime_diff('week', Week, FirstSeen)\n"
            "| summarize Users = dcount(user_Id) by Cohort = FirstSeen, WeekOffset\n"
            "| evaluate pivot(WeekOffset, sum(Users))\n"
            "| order by Cohort desc"
        ),
    ),
]

def main() -> int:
    data = json.loads(SRC.read_text())
    items = data.get("items", [])
    existing = {it.get("name") for it in items}
    added = 0
    for tile in NEW_TILES:
        if tile["name"] in existing:
            continue
        items.append(tile)
        added += 1
    SRC.write_text(json.dumps(data, indent=2))
    print(f"✅ Added {added} new tiles to {SRC} (total items: {len(items)})")
    return 0

if __name__ == "__main__":
    sys.exit(main())
