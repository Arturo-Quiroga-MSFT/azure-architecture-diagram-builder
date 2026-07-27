#!/usr/bin/env python3
"""generate-usage-html.py — Build the interactive HTML usage report from live
Application Insights data.

Queries the same custom events as scripts/usage-report-range.sh, assembles a
DATA object, and injects it (plus a locally-vendored Chart.js for offline use)
into scripts/usage-report-template.html.

Usage:
    python scripts/generate-usage-html.py [START_YYYY-MM-DD] [END_YYYY-MM-DD]

Notes:
  * END is exclusive (pass the day AFTER the last day you want included).
  * Requires the Azure CLI (`az`) logged in with reader access to the App
    Insights resource. The Retail Prices logic is unrelated to this script.
  * Chart.js is inlined from scripts/vendor/chart.umd.min.js so the output HTML
    works with zero network access. If that file is missing it falls back to the
    jsDelivr CDN.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

APP = "aq-app-insights-001"
RG = "AQ-FOUNDRY-RG"
ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "scripts" / "usage-report-template.html"
VENDOR_CHARTJS = ROOT / "scripts" / "vendor" / "chart.umd.min.js"
CDN_CHARTJS = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"
OUT_DIR = ROOT / "usage-reports"

DB_EVENTS = (
    'customEvents | where name in ("Architecture_Generated","Architecture_Validated",'
    '"DeploymentGuide_Generated","Diagram_Exported","Template_Imported",'
    '"ARM_Template_Imported","Image_Imported","Models_Compared","Recommendations_Applied",'
    '"Version_Operation","Region_Changed","Start_Fresh","AI_Model_Usage","User_Feedback")'
)

# Pretty labels for feature event names
FEATURE_LABELS = {
    "AI_Model_Usage": "AI model usage",
    "Architecture_Generated": "Architecture generated",
    "Diagram_Exported": "Diagram exported",
    "Region_Changed": "Region changed",
    "Architecture_Validated": "Architecture validated",
    "Start_Fresh": "Start fresh",
    "Image_Imported": "Image imported",
    "DeploymentGuide_Generated": "Deploy guide generated",
    "Models_Compared": "Models compared",
    "Version_Operation": "Version operation",
    "Recommendations_Applied": "Recommendations applied",
    "User_Feedback": "User feedback",
    "Template_Imported": "Template imported",
}
# Features to plot in the "feature growth over time" multi-line chart
GROWTH_FEATURES = {
    "AI_Model_Usage": "AI generation",
    "Architecture_Generated": "Architecture gen",
    "Diagram_Exported": "Diagram export",
    "Architecture_Validated": "WAF validation",
    "DeploymentGuide_Generated": "Deploy guide",
}

# ─── Duplicate-row guard ────────────────────────────────────────────────
# A diagnostic setting named "ALL" on the App Insights component (created
# 2026-07-14, deleted 2026-07-27) exported allLogs to a second Log Analytics
# workspace. The App Insights component query API returns the union of the
# native workspace data AND that exported copy, so every row from 2026-07-14
# onward comes back exactly twice. The app itself only ever sent one event —
# verified in-browser (one /v2/track payload) and against the linked workspace
# (AppEvents ratio 1.00).
#
# Deleting the setting stops future duplication, but the already-exported copy
# still lives in the second workspace, so historical queries stay 2x. Dedup on
# (session_Id, name, timestamp, user_Id) reproduces the workspace ground-truth
# count exactly (validated: 2,032 == 2,032 over a 2-day window; dropping
# user_Id under-counts at 2,014).
DEDUP_PREAMBLE = (
    "let _ce = customEvents | summarize take_any(*) by session_Id, name, timestamp, user_Id;\n"
    "let _pv = pageViews | summarize take_any(*) by session_Id, name, timestamp, user_Id;\n"
)


def dedup(query: str) -> str:
    """Point a query at deduplicated views of customEvents / pageViews."""
    q = re.sub(r"\bcustomEvents\b", "_ce", query)
    q = re.sub(r"\bpageViews\b", "_pv", q)
    return DEDUP_PREAMBLE + q


def run_kql(query: str, offset: str) -> list[list]:
    """Run a KQL query via az CLI and return the first table's rows (list of lists)."""
    cmd = [
        "az", "monitor", "app-insights", "query",
        "--app", APP, "-g", RG,
        "--analytics-query", dedup(query),
        "--offset", offset,
        "-o", "json",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"KQL query failed:\n{proc.stderr}\n---\n{query}")
    payload = json.loads(proc.stdout)
    tables = payload.get("tables") or []
    if not tables:
        return []
    return tables[0].get("rows", [])


def cols(query: str, offset: str) -> tuple[list[str], list[list]]:
    """Return (column_names, rows) for a query."""
    cmd = [
        "az", "monitor", "app-insights", "query",
        "--app", APP, "-g", RG,
        "--analytics-query", dedup(query),
        "--offset", offset,
        "-o", "json",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"KQL query failed:\n{proc.stderr}\n---\n{query}")
    payload = json.loads(proc.stdout)
    tables = payload.get("tables") or []
    if not tables:
        return [], []
    t = tables[0]
    names = [c["name"] for c in t["columns"]]
    return names, t.get("rows", [])


def fmt_int(n) -> str:
    try:
        return f"{int(n):,}"
    except (TypeError, ValueError):
        return str(n)


def main() -> int:
    today = dt.date.today()
    start = sys.argv[1] if len(sys.argv) > 1 else "2026-01-01"
    end = sys.argv[2] if len(sys.argv) > 2 else (today + dt.timedelta(days=1)).isoformat()

    start_d = dt.date.fromisoformat(start)
    span_days = (today - start_d).days + 2
    offset = f"{span_days}d"
    win = f"between (datetime({start}) .. datetime({end}))"

    print(f"▶ Querying App Insights '{APP}' for {start} → {end} (offset {offset})…")

    # Headline KPIs
    _, kpi_rows = cols(f"""
{DB_EVENTS}
| where timestamp {win}
| summarize UniqueUsers=dcount(user_Id), UniqueSessions=dcount(session_Id),
    TotalEvents=count(), UniqueCountries=dcount(client_CountryOrRegion),
    UniqueCities=dcount(strcat(client_CountryOrRegion,'/',client_City)),
    FirstEvent=min(timestamp), LastEvent=max(timestamp)
""", offset)
    if not kpi_rows:
        print("✗ No data in window. Aborting.", file=sys.stderr)
        return 1
    k = kpi_rows[0]
    unique_users, unique_sessions, total_events, unique_countries, unique_cities, first_event, last_event = k

    # Feature usage
    feat_names, feat_rows = cols(f"""
{DB_EVENTS}
| where timestamp {win}
| summarize Events=count() by Feature=name
| order by Events desc
""", offset)
    features = [[FEATURE_LABELS.get(r[0], r[0]), r[1]] for r in feat_rows]
    feat_map = {r[0]: r[1] for r in feat_rows}

    # Monthly activity
    _, mon_rows = cols(f"""
{DB_EVENTS}
| where timestamp {win}
| summarize Users=dcount(user_Id), Sessions=dcount(session_Id), Events=count()
    by Month=format_datetime(startofmonth(timestamp),'yyyy-MM')
| order by Month asc
""", offset)
    months, m_users, m_sessions, m_events = [], [], [], []
    for r in mon_rows:
        months.append(r[0])
        m_users.append(r[1]); m_sessions.append(r[2]); m_events.append(r[3])
    # Mark the current (partial) month with an asterisk
    if months and months[-1] == today.strftime("%Y-%m"):
        month_labels = [dt.date.fromisoformat(m + "-01").strftime("%b") for m in months[:-1]]
        month_labels.append(dt.date.fromisoformat(months[-1] + "-01").strftime("%b") + "*")
    else:
        month_labels = [dt.date.fromisoformat(m + "-01").strftime("%b") for m in months]

    # Feature growth (events by feature x month)
    _, fg_rows = cols(f"""
{DB_EVENTS}
| where timestamp {win}
| summarize Events=count() by Feature=name, Month=format_datetime(startofmonth(timestamp),'yyyy-MM')
""", offset)
    fg_by_feature: dict[str, dict[str, int]] = {}
    for feat, month, ev in fg_rows:
        fg_by_feature.setdefault(feat, {})[month] = ev
    feature_growth = {}
    for ev_name, label in GROWTH_FEATURES.items():
        series = [fg_by_feature.get(ev_name, {}).get(m, 0) for m in months]
        feature_growth[label] = series

    # AI model usage
    _, model_rows = cols(f"""
customEvents
| where timestamp {win} and name == 'AI_Model_Usage'
| extend model=tostring(customDimensions.model), elapsedMs=toint(customMeasurements.elapsedTimeMs),
         totalTok=toint(customMeasurements.totalTokens)
| summarize Calls=count(), AvgLatencyMs=toint(avg(elapsedMs)), TotalTokens=sum(totalTok) by model
| order by Calls desc
| take 12
""", offset)
    models = [[r[0], r[1], round((r[2] or 0) / 1000, 1)] for r in model_rows]
    # total tokens across all models
    _, tok_rows = cols(f"""
customEvents
| where timestamp {win} and name == 'AI_Model_Usage'
| summarize Calls=count(), Tokens=sum(toint(customMeasurements.totalTokens))
""", offset)
    total_calls = tok_rows[0][0] if tok_rows else 0
    total_tokens = tok_rows[0][1] if tok_rows else 0

    # Export formats
    _, exp_rows = cols(f"""
customEvents
| where timestamp {win} and name == 'Diagram_Exported'
| extend fmt=tostring(customDimensions.format)
| summarize Exports=count() by fmt
| order by Exports desc
| take 10
""", offset)
    exports = [[r[0], r[1]] for r in exp_rows]

    # Countries
    _, country_rows = cols(f"""
{DB_EVENTS}
| where timestamp {win} and isnotempty(client_CountryOrRegion)
| summarize Users=dcount(user_Id) by Country=client_CountryOrRegion
| order by Users desc
| take 12
""", offset)
    countries = [[r[0], r[1]] for r in country_rows]

    # Regions
    _, region_rows = cols(f"""
customEvents
| where timestamp {win} and name == 'Region_Changed'
| extend region=tostring(customDimensions.region)
| summarize Changes=count() by region
| order by Changes desc
| take 10
""", offset)
    regions = [[r[0], r[1]] for r in region_rows]

    # Feedback rating distribution + summary
    _, rate_rows = cols(f"""
customEvents
| where timestamp {win} and name == 'User_Feedback'
| summarize Count=count() by Rating=toint(customMeasurements.rating)
| order by Rating desc
""", offset)
    ratings = {f"{r[0]}\u2605": r[1] for r in rate_rows if r[0] is not None}
    _, fb_rows = cols(f"""
customEvents
| where timestamp {win} and name == 'User_Feedback'
| summarize Submissions=count(), AvgRating=round(avg(toint(customMeasurements.rating)),2)
""", offset)
    fb_submissions = fb_rows[0][0] if fb_rows else 0
    fb_avg = fb_rows[0][1] if fb_rows else 0

    # WAF validation scores (>=3 validations)
    _, waf_rows = cols(f"""
customEvents
| where timestamp {win} and name == 'Architecture_Validated'
| extend model=tolower(tostring(customDimensions.model)), score=todouble(customMeasurements.overallScore)
| summarize Validations=count(), AvgScore=round(avg(score),1) by model
| where Validations >= 3
| order by AvgScore desc
| take 10
""", offset)
    waf = [[r[0], r[2]] for r in waf_rows]

    # Power users
    _, pu_rows = cols(f"""
{DB_EVENTS}
| where timestamp {win} and isnotempty(user_Id)
| summarize Events=count(), Sessions=dcount(session_Id), Features=dcount(name),
    Country=any(client_CountryOrRegion), City=any(client_City) by user_Id
| order by Events desc
| take 12
""", offset)

    def anon(uid: str) -> str:
        if len(uid) <= 12:
            return uid
        return f"{uid[:7]}\u2026{uid[-5:]}"

    power = [[anon(r[0]), r[1], r[2], r[3], r[4] or "", r[5] or ""] for r in pu_rows]

    # Architectures generated (for KPI)
    arch_generated = feat_map.get("Architecture_Generated", 0)

    # Coverage window from actual data
    cov_start = str(first_event)[:10]
    cov_end = str(last_event)[:10]
    cov_days = (dt.date.fromisoformat(cov_end) - dt.date.fromisoformat(cov_start)).days + 1

    data = {
        "meta": {
            "requestedStart": start,
            "requestedEnd": (dt.date.fromisoformat(end) - dt.timedelta(days=1)).isoformat(),
            "coverageStart": cov_start,
            "coverageEnd": cov_end,
            "coverageDays": cov_days,
            "appInsights": APP,
            "generated": today.isoformat(),
        },
        "kpis": [
            {"val": fmt_int(unique_users), "lbl": "Unique users", "sub": "anonymous browsers"},
            {"val": fmt_int(unique_sessions), "lbl": "Sessions",
             "sub": f"{unique_sessions / unique_users:.1f} per user" if unique_users else ""},
            {"val": fmt_int(total_events), "lbl": "Tracked events", "sub": f"{len(feat_rows)} feature types"},
            {"val": fmt_int(arch_generated), "lbl": "Architectures generated", "sub": ""},
            {"val": fmt_int(unique_countries), "lbl": "Countries", "sub": f"{fmt_int(unique_cities)} cities"},
            {"val": str(fb_avg), "lbl": "Avg feedback rating", "sub": f"{fb_submissions} submissions"},
        ],
        "modelSub": f"{fmt_int(total_calls)} model calls \u00b7 {total_tokens/1e6:.1f}M tokens across {len(model_rows)} shown models.",
        "ratingHint": f"{fb_submissions} submissions \u00b7 avg {fb_avg} / 5",
        "months": month_labels,
        "monthlyUsers": m_users,
        "monthlySessions": m_sessions,
        "monthlyEvents": m_events,
        "featureGrowth": feature_growth,
        "features": features,
        "exports": exports,
        "models": models,
        "countries": countries,
        "regions": regions,
        "ratings": ratings,
        "waf": waf,
        "power": power,
    }

    # ---- render template ----
    template = TEMPLATE.read_text()
    if VENDOR_CHARTJS.exists():
        chartjs_tag = f"<script>\n{VENDOR_CHARTJS.read_text()}\n</script>"
        print("  ✓ inlined Chart.js (offline-ready)")
    else:
        chartjs_tag = f'<script src="{CDN_CHARTJS}"></script>'
        print("  ⚠ vendor Chart.js missing — falling back to CDN")

    html = template.replace("<!--__CHARTJS__-->", chartjs_tag)
    html = html.replace("__DATA__", json.dumps(data, ensure_ascii=False))

    OUT_DIR.mkdir(exist_ok=True)
    out_file = OUT_DIR / f"usage-report-{start}_to_{cov_end}.html"
    out_file.write_text(html)
    print(f"✅ Wrote {out_file.relative_to(ROOT)}  ({out_file.stat().st_size/1024:.0f} KB)")
    print(f"   Coverage {cov_start} → {cov_end} \u00b7 {fmt_int(unique_users)} users \u00b7 {fmt_int(total_events)} events")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
