#!/usr/bin/env python3
"""llm-cost-report.py — What AADB costs to run, and what each model costs per use.

Joins ACTUAL Azure cost (Cost Management, the deployment target's resource
group) with App Insights ``AI_Model_Usage`` telemetry to report:

* total running cost by resource (hosting, models, Speech, data, networking);
* per-model cost, calls, users, tokens, $/call and blended $/1M tokens;
* input / output / cached cost split.

Model cost is attributed by **meter name**: Foundry meters name the model
(``5.6 sol ShortCo Opt Std Gl 1M Tokens``, ``V4 Pro Outp glbl Tokens``,
``K2.6 Thinking Inp glbl Tokens``), so no deployment tags are needed.

Usage
-----
    python3 scripts/llm-cost-report.py [--days 30]
    AADB_TARGET=mcap094150 python3 scripts/llm-cost-report.py   # old MCAPS

The resource group, App Insights, subscription and CLI profile come from the
deployment target (scripts/usage-target.sh, default: fdpo). Requires Cost
Management Reader on the resource group and Reader on the App Insights
resource. Writes markdown + CSV to ``usage-reports/`` (gitignored).
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import re
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from usage_target import load_target  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "usage-reports"
COST_API_VERSION = "2023-11-01"

# Telemetry display-name prefix -> token that appears in the meter subcategory.
FAMILIES = [
    ("gpt-", "openai"), ("deepseek ", "deepseek"), ("kimi ", "kimi"), ("grok ", "grok"),
    ("mistral ", "mistral"), ("claude ", "claude"), ("mai-", "mai"),
]


def run(cmd: list[str], stdin: str | None = None) -> str:
    proc = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"command failed ({proc.returncode}): {' '.join(cmd[:4])}…\n{proc.stderr.strip()}")
    return proc.stdout


def norm(text: str) -> str:
    return re.sub(r"[-\s]+", " ", text.lower()).strip()


def model_key(display: str) -> tuple[str, str]:
    """('gpt-5.6 sol' -> ('openai', '5.6 sol')); MAI keeps its full name."""
    s = display.lower().replace("(preview)", "").strip()
    for prefix, family in FAMILIES:
        if s.startswith(prefix):
            return family, norm(s if family == "mai" else s[len(prefix):])
    return "", norm(s)


def classify_meter(meter: str) -> str:
    """Bucket a meter into input / output / cached / other (cached checked first)."""
    m = f" {meter.lower()} "
    if " cd " in m or "cached" in m:
        return "cached"
    if " inp " in m or "input" in m:
        return "input"
    if " opt " in m or " outp " in m or "output" in m:
        return "output"
    return "other"


def query_cost(subscription: str, rg: str, days: int):
    """ActualCost for the resource group grouped by resource, meter subcategory and meter."""
    today = dt.date.today()
    body = {
        "type": "ActualCost",
        "timeframe": "Custom",
        "timePeriod": {"from": (today - dt.timedelta(days=days)).isoformat(), "to": today.isoformat()},
        "dataset": {
            "granularity": "None",
            "aggregation": {"cost": {"name": "Cost", "function": "Sum"}},
            "grouping": [
                {"type": "Dimension", "name": "ResourceId"},
                {"type": "Dimension", "name": "MeterSubCategory"},
                {"type": "Dimension", "name": "Meter"},
            ],
        },
    }
    url = (f"https://management.azure.com/subscriptions/{subscription}/resourceGroups/{rg}"
           f"/providers/Microsoft.CostManagement/query?api-version={COST_API_VERSION}")
    for attempt in range(6):
        try:
            out = run(["az", "rest", "--method", "post", "--url", url,
                       "--headers", "Content-Type=application/json", "--body", "@-"], stdin=json.dumps(body))
            break
        except RuntimeError as exc:
            if "429" in str(exc) or "Too Many Requests" in str(exc):
                wait = min(60, 5 * (2 ** attempt))
                print(f"    cost query throttled (429); retrying in {wait}s…", file=sys.stderr)
                time.sleep(wait)
                continue
            return [], str(exc)
    else:
        return [], "cost query kept being throttled"
    props = json.loads(out).get("properties", {})
    cols = [c["name"] for c in props.get("columns", [])]
    i = {n: cols.index(n) for n in ("Cost", "ResourceId", "MeterSubCategory", "Meter") if n in cols}
    rows = [{
        "cost": float(r[i["Cost"]] or 0),
        "resource": str(r[i["ResourceId"]] or "").split("/")[-1] or "(none)",
        "subcategory": str(r[i["MeterSubCategory"]] or ""),
        "meter": str(r[i["Meter"]] or ""),
    } for r in props.get("rows", [])]
    return rows, None


def query_telemetry(cfg: dict, days: int):
    kql = f"""
customEvents
| where timestamp > ago({days}d) and name == 'AI_Model_Usage'
| extend model = tostring(customDimensions.model)
| summarize Calls = count(), Users = dcount(user_Id), Sessions = dcount(session_Id),
            PromptTokens = sum(toint(customMeasurements.promptTokens)),
            CompletionTokens = sum(toint(customMeasurements.completionTokens)),
            TotalTokens = sum(toint(customMeasurements.totalTokens))
    by model
| union (customEvents | where timestamp > ago({days}d) | summarize Users = dcount(user_Id) | extend model = '__all__')
""".strip()
    try:
        out = run(["az", "monitor", "app-insights", "query", "--app", cfg["app"], "-g", cfg["ai_rg"],
                   "--subscription", cfg["subscription"], "--analytics-query", kql,
                   "--offset", f"{days + 1}d", "-o", "json"])
    except RuntimeError as exc:
        return {}, 0, str(exc)
    table = json.loads(out)["tables"][0]
    idx = {c["name"]: n for n, c in enumerate(table["columns"])}
    stats, active_users = {}, 0
    for r in table["rows"]:
        if r[idx["model"]] == "__all__":
            active_users = int(r[idx["Users"]] or 0)
            continue
        stats[r[idx["model"]] or "unknown"] = {k: int(r[idx[c]] or 0) for k, c in (
            ("calls", "Calls"), ("users", "Users"), ("sessions", "Sessions"),
            ("promptTokens", "PromptTokens"), ("completionTokens", "CompletionTokens"),
            ("totalTokens", "TotalTokens"))}
    return stats, active_users, None


def attribute(cost_rows: list[dict], telemetry: dict) -> tuple[dict, list[dict]]:
    """Assign model-token meters to telemetry models. Returns (by_model, unmatched_ai_rows)."""
    keys = {m: model_key(m) for m in telemetry}
    by_model: dict[str, dict] = {}
    unmatched = []
    for r in cost_rows:
        sub = r["subcategory"].lower()
        if not re.search(r"\btokens?\b", r["meter"], re.I) or "defender" in sub:
            continue
        meter = norm(r["meter"])
        best, best_len = None, -1
        for model, (family, key) in keys.items():
            if family and family not in sub:
                continue
            if (meter == key or meter.startswith(key + " ")) and len(key) > best_len:
                best, best_len = model, len(key)
        if best is None:
            unmatched.append(r)
            continue
        slot = by_model.setdefault(best, {"input": 0.0, "output": 0.0, "cached": 0.0, "other": 0.0})
        slot[classify_meter(r["meter"])] += r["cost"]
    return by_model, unmatched


def money(v: float) -> str:
    return f"${v:,.4f}" if 0 < abs(v) < 0.01 else f"${v:,.2f}"


def build_report(args, cfg, cost_rows, cost_err, telemetry, active_users, tele_err):
    start = (dt.date.today() - dt.timedelta(days=args.days)).isoformat()
    lines = [f"# AADB cost + LLM usage report (last {args.days} days)", "",
             f"_Generated {dt.datetime.now():%Y-%m-%d %H:%M}_ · Window: `{start}` → today · "
             f"Target: `{cfg['target']}` · RG: `{cfg['rg']}` · App Insights: `{cfg['app']}`", ""]
    for label, err in (("Cost query failed", cost_err), ("Telemetry query failed", tele_err)):
        if err:
            lines += [f"> ⚠️ **{label}.**", ">", "> ```", *[f"> {l}" for l in err.splitlines()[:6]], "> ```", ""]

    by_model, unmatched = attribute(cost_rows, telemetry)
    total = sum(r["cost"] for r in cost_rows)
    llm = sum(sum(v.values()) for v in by_model.values()) + sum(r["cost"] for r in unmatched)
    speech = sum(r["cost"] for r in cost_rows if "speech" in r["subcategory"].lower())

    rows = []
    for model in sorted(set(telemetry) | set(by_model)):
        t = telemetry.get(model, {})
        split = by_model.get(model, {"input": 0.0, "output": 0.0, "cached": 0.0, "other": 0.0})
        cost = sum(split.values())
        calls, tokens, users = t.get("calls", 0), t.get("totalTokens", 0), t.get("users", 0)
        rows.append({
            "model": model, "cost": cost,
            "inputCost": split["input"], "outputCost": split["output"],
            "cachedCost": split["cached"], "otherCost": split["other"],
            "calls": calls, "users": users, "sessions": t.get("sessions", 0),
            "promptTokens": t.get("promptTokens", 0), "completionTokens": t.get("completionTokens", 0),
            "totalTokens": tokens,
            "costPerCall": cost / calls if calls else 0.0,
            "costPerUser": cost / users if users else 0.0,
            "costPer1M": cost / (tokens / 1_000_000) if tokens else 0.0,
        })
    rows.sort(key=lambda r: (r["cost"], r["calls"]), reverse=True)
    calls = sum(r["calls"] for r in rows)
    tokens = sum(r["totalTokens"] for r in rows)
    matched_cost = sum(r["cost"] for r in rows)

    lines += ["## Headline", "", "| Metric | Value |", "| --- | --- |",
              f"| **Total cost to run AADB ({args.days}d)** | **{money(total)}** |",
              f"| Model (LLM) tokens | {money(llm)} |",
              f"| Speech (narrator avatar) | {money(speech)} |",
              f"| Everything else (hosting, registry, data, networking, logs) | {money(total - llm - speech)} |",
              f"| Active users (any feature) | {active_users:,} |"]
    if active_users:
        lines.append(f"| Cost per active user | {money(total / active_users)} |")
    lines += [f"| Model calls | {calls:,} |", f"| Tokens | {tokens:,} |"]
    if tokens:
        lines.append(f"| Blended model cost / 1M tokens | {money(matched_cost / (tokens / 1_000_000))} |")
    if calls:
        lines.append(f"| Avg model cost / call | {money(matched_cost / calls)} |")
    lines.append("")

    by_resource: dict[str, float] = {}
    for r in cost_rows:
        by_resource[r["resource"]] = by_resource.get(r["resource"], 0.0) + r["cost"]
    lines += ["## Cost by resource", "", "| Resource | Cost | Share |", "| --- | ---: | ---: |"]
    for name, cost in sorted(by_resource.items(), key=lambda kv: -kv[1]):
        if cost >= 0.005:
            lines.append(f"| `{name}` | {money(cost)} | {cost / total * 100 if total else 0:.0f}% |")
    lines.append("")

    lines += ["## Per-model cost vs usage", "",
              "| Model | Cost | Calls | Users | Total tokens | $/call | $/user | $/1M tokens | Input | Output | Cached |",
              "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for r in rows:
        lines.append(
            f"| {r['model']} | {money(r['cost'])} | {r['calls']:,} | {r['users']:,} | {r['totalTokens']:,} | "
            f"{money(r['costPerCall']) if r['calls'] else '—'} | {money(r['costPerUser']) if r['users'] else '—'} | "
            f"{money(r['costPer1M']) if r['totalTokens'] else '—'} | {money(r['inputCost'])} | "
            f"{money(r['outputCost'])} | {money(r['cachedCost'])} |")
    lines.append("")

    if unmatched:
        agg: dict[tuple, float] = {}
        for r in unmatched:
            agg[(r["subcategory"], r["meter"])] = agg.get((r["subcategory"], r["meter"]), 0.0) + r["cost"]
        lines += ["### Model cost with no matching telemetry", "",
                  "Retired models, other callers of the shared Foundry resource, or meters the matcher did not recognize.", "",
                  "| Meter subcategory | Meter | Cost |", "| --- | --- | ---: |"]
        for (sub, meter), cost in sorted(agg.items(), key=lambda kv: -kv[1]):
            if cost >= 0.005:
                lines.append(f"| {sub} | {meter} | {money(cost)} |")
        lines.append("")

    lines += ["## Notes", "",
              f"- Cost is ActualCost from Cost Management for resource group `{cfg['rg']}`; today's spend is partial and lags a few hours.",
              "- Model cost is matched to telemetry by meter name (e.g. `5.6 sol` → GPT-5.6 Sol). Calls and tokens count this app only, while cost includes every caller of the Foundry resource, so $/call is an upper bound if the resource is shared.",
              "- Models with calls but $0 cost are usually billed outside the resource group (for example Anthropic models billed through Azure Marketplace) or not yet in Cost Management.",
              "- Users are anonymous browser cookies, not verified people.", ""]
    return "\n".join(lines) + "\n", rows


def main() -> int:
    ap = argparse.ArgumentParser(description="AADB cost + LLM usage report")
    ap.add_argument("--days", type=int, default=30, help="rolling window in days (default 30)")
    args = ap.parse_args()
    cfg = load_target()

    print(f"▶ Querying Cost Management (RG {cfg['rg']}, last {args.days}d)…")
    cost_rows, cost_err = query_cost(cfg["subscription"], cfg["rg"], args.days)
    if cost_err:
        print(f"  ⚠️ cost query failed: {cost_err}", file=sys.stderr)
    print(f"▶ Querying App Insights telemetry ({cfg['app']})…")
    telemetry, active_users, tele_err = query_telemetry(cfg, args.days)
    if tele_err:
        print(f"  ⚠️ telemetry query failed: {tele_err}", file=sys.stderr)

    report, rows = build_report(args, cfg, cost_rows, cost_err, telemetry, active_users, tele_err)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    md_path = OUT_DIR / f"llm-cost-report-{cfg['target']}-{args.days}d-{stamp}.md"
    csv_path = md_path.with_suffix(".csv")
    md_path.write_text(report)
    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["model"])
        w.writeheader()
        w.writerows(rows)
    print(f"✅ Wrote {md_path}\n✅ Wrote {csv_path}")
    return 0 if not (cost_err and tele_err) else 1


if __name__ == "__main__":
    sys.exit(main())
