#!/usr/bin/env python3
"""llm-cost-report.py — Combined LLM cost + telemetry report.

Joins ACTUAL Azure cost (Cost Management) with App Insights token telemetry
(``AI_Model_Usage`` events) to compute cost-per-call, cost-per-user, and
blended cost-per-1M-tokens for each model deployment.

Data sources
------------
1. Azure Cost Management query API (via ``az rest``) — scoped to the Foundry
   resource group, grouped by the ``deployment`` tag and by Meter.
2. Application Insights (via ``az monitor app-insights query``) — the
   ``AI_Model_Usage`` custom events emitted by the app.

The two sources are joined on the model deployment: telemetry records the
model's display name (e.g. ``GPT-5.1``) while cost rows carry the deployment
tag (e.g. ``gpt-5.1``). The mapping below bridges them via ``.env``.

Usage
-----
    python3 scripts/llm-cost-report.py [--days 30]

Requires: Azure CLI logged in (``az login``) with Cost Management Reader on the
subscription and Reader on the Application Insights resource.

Outputs a markdown + CSV report under ``Azure_cost_breakdowns/llm-cost-reports/``.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import subprocess
import sys
import time
from pathlib import Path

# Repo root = parent of this script's directory.
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "Azure_cost_breakdowns" / "llm-cost-reports"

# Defaults (overridable via CLI flags).
DEFAULT_SUBSCRIPTION = "7a28b21e-0d3e-4435-a686-d92889d4ee96"
DEFAULT_RG = "AQ-FOUNDRY-RG"
DEFAULT_APPINSIGHTS = "aq-app-insights-001"
COST_API_VERSION = "2023-11-01"

# Maps the .env deployment env var -> the model display name used in telemetry.
# Mirrors MODEL_CONFIG in src/stores/modelSettingsStore.ts.
ENVVAR_TO_DISPLAY = {
    "VITE_AZURE_OPENAI_DEPLOYMENT_GPT51": "GPT-5.1",
    "VITE_AZURE_OPENAI_DEPLOYMENT_GPT52": "GPT-5.2",
    "VITE_AZURE_OPENAI_DEPLOYMENT_GPT52CODEX": "GPT-5.2 Codex",
    "VITE_AZURE_OPENAI_DEPLOYMENT_GPT53CODEX": "GPT-5.3 Codex",
    "VITE_AZURE_OPENAI_DEPLOYMENT_GPT54": "GPT-5.4",
    "VITE_AZURE_OPENAI_DEPLOYMENT_GPT54MINI": "GPT-5.4 Mini",
    "VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK": "DeepSeek V3.2 Speciale",
    "VITE_AZURE_OPENAI_DEPLOYMENT_DEEPSEEK_V4_PRO": "DeepSeek V4 Pro",
    "VITE_AZURE_OPENAI_DEPLOYMENT_GROK4FAST": "Grok 4.1 Fast",
    "VITE_AZURE_OPENAI_DEPLOYMENT_GROK43": "Grok 4.3",
    "VITE_AZURE_OPENAI_DEPLOYMENT_MISTRALLARGE3": "Mistral Large 3",
    "VITE_AZURE_OPENAI_DEPLOYMENT_KIMIK25": "Kimi K2.5",
}


def run(cmd: list[str], stdin: str | None = None) -> str:
    """Run a command, returning stdout. Raises with stderr on failure."""
    proc = subprocess.run(
        cmd, input=stdin, capture_output=True, text=True
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"command failed ({proc.returncode}): {' '.join(cmd)}\n{proc.stderr.strip()}"
        )
    return proc.stdout


def load_env_deployments(env_path: Path) -> dict[str, str]:
    """Parse .env -> {display_name: deployment_id} for configured models."""
    raw: dict[str, str] = {}
    if not env_path.exists():
        return {}
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key in ENVVAR_TO_DISPLAY and val:
            raw[ENVVAR_TO_DISPLAY[key]] = val
    return raw


def classify_meter(meter: str) -> str:
    """Bucket a Cost Management meter name into input / output / cached / other.

    Foundry token meters look like ``GPT 5.2 inp Gl 1M Tokens`` (input),
    ``GPT 5.2 opt Gl 1M Tokens`` (output), ``GPT 5.2 cd inp Gl 1M Tokens``
    (cached input), ``o4-mini 0416 cached Inp glbl Tokens`` (cached),
    ``V3.2 SP Outp glbl Tokens`` (output). Cached is checked first because
    cached meters also contain the ``inp`` token.
    """
    m = f" {meter.lower()} "
    if " cd " in m or "cached" in m:
        return "cached"
    if "inp" in m or "input" in m:
        return "input"
    if "opt" in m or "outp" in m or "output" in m:
        return "output"
    return "other"


def query_cost(subscription: str, rg: str, days: int):
    """Query Cost Management with a single deployment×meter grouping.

    Returns ``(cost_by_deployment, cost_by_meter, cost_by_deployment_split, error)``
    where ``cost_by_deployment_split`` maps ``deployment -> {input, output,
    cached, other}``.
    """
    today = dt.date.today()
    start = today - dt.timedelta(days=days)
    scope = f"/subscriptions/{subscription}/resourceGroups/{rg}"
    url = (
        f"https://management.azure.com{scope}"
        f"/providers/Microsoft.CostManagement/query?api-version={COST_API_VERSION}"
    )

    body = {
        "type": "ActualCost",
        "timeframe": "Custom",
        "timePeriod": {"from": start.isoformat(), "to": today.isoformat()},
        "dataset": {
            "granularity": "None",
            "aggregation": {"totalCost": {"name": "Cost", "function": "Sum"}},
            "grouping": [
                {"type": "TagKey", "name": "deployment"},
                {"type": "Dimension", "name": "Meter"},
            ],
        },
    }

    # Cost Management is aggressively throttled — retry 429s with backoff.
    last_exc: Exception | None = None
    out = ""
    for attempt in range(6):
        try:
            out = run(
                [
                    "az", "rest", "--method", "post", "--url", url,
                    "--headers", "Content-Type=application/json",
                    "--body", "@-",
                ],
                stdin=json.dumps(body),
            )
            break
        except RuntimeError as exc:
            last_exc = exc
            if "429" in str(exc) or "Too Many Requests" in str(exc):
                wait = min(60, 5 * (2 ** attempt))
                print(f"    cost query throttled (429); retrying in {wait}s "
                      f"(attempt {attempt + 1}/6)…", file=sys.stderr)
                time.sleep(wait)
                continue
            return {}, {}, {}, str(exc)
    else:
        return {}, {}, {}, str(last_exc or "cost query failed")

    try:
        data = json.loads(out)
        props = data.get("properties", {})
        cols = [c["name"] for c in props.get("columns", [])]
        rows = props.get("rows", [])
        cost_idx = next(
            (i for i, n in enumerate(cols) if n.lower() in ("cost", "pretaxcost")), 0
        )
        dep_idx = cols.index("TagValue") if "TagValue" in cols else 2
        meter_idx = cols.index("Meter") if "Meter" in cols else 3
    except Exception as exc:  # noqa: BLE001
        return {}, {}, {}, str(exc)

    by_dep: dict[str, float] = {}
    by_meter: dict[str, float] = {}
    by_dep_split: dict[str, dict[str, float]] = {}
    for r in rows:
        dep = str(r[dep_idx]) if r[dep_idx] not in (None, "") else "(untagged)"
        dep = dep.lower()
        meter = str(r[meter_idx]) if r[meter_idx] not in (None, "") else "(no meter)"
        cost = float(r[cost_idx])
        by_dep[dep] = by_dep.get(dep, 0.0) + cost
        by_meter[meter] = by_meter.get(meter, 0.0) + cost
        bucket = classify_meter(meter)
        split = by_dep_split.setdefault(
            dep, {"input": 0.0, "output": 0.0, "cached": 0.0, "other": 0.0}
        )
        split[bucket] += cost
    return by_dep, by_meter, by_dep_split, None



def query_telemetry(app: str, rg: str, days: int) -> tuple[dict, str | None]:
    """Query App Insights AI_Model_Usage. Returns ({display_name: stats}, error)."""
    kql = f"""
customEvents
| where timestamp > ago({days}d) and name == 'AI_Model_Usage'
| extend model = tostring(customDimensions.model),
         promptTok = toint(customMeasurements.promptTokens),
         compTok   = toint(customMeasurements.completionTokens),
         totalTok  = toint(customMeasurements.totalTokens)
| summarize Calls = count(),
            Users = dcount(user_Id),
            PromptTokens = sum(promptTok),
            CompletionTokens = sum(compTok),
            TotalTokens = sum(totalTok)
    by model
| order by Calls desc
""".strip()
    try:
        out = run(
            [
                "az", "monitor", "app-insights", "query",
                "--app", app, "-g", rg,
                "--analytics-query", kql,
                "--offset", f"{days}d",
            ]
        )
    except Exception as exc:  # noqa: BLE001
        return {}, str(exc)
    data = json.loads(out)
    table = data.get("tables", [{}])[0]
    cols = [c["name"] for c in table.get("columns", [])]
    idx = {n: i for i, n in enumerate(cols)}
    stats: dict[str, dict] = {}
    for r in table.get("rows", []):
        model = r[idx["model"]]
        stats[model] = {
            "calls": int(r[idx["Calls"]] or 0),
            "users": int(r[idx["Users"]] or 0),
            "promptTokens": int(r[idx["PromptTokens"]] or 0),
            "completionTokens": int(r[idx["CompletionTokens"]] or 0),
            "totalTokens": int(r[idx["TotalTokens"]] or 0),
        }
    return stats, None


def fmt_money(v: float) -> str:
    return f"${v:,.4f}" if 0 < abs(v) < 0.01 else f"${v:,.2f}"


def fmt_int(v: int) -> str:
    return f"{v:,}"


def build_report(args, env_deployments, cost_by_dep, cost_by_meter,
                 cost_by_dep_split, cost_err, telemetry,
                 tele_err) -> tuple[str, list[dict]]:
    now = dt.datetime.now()
    start = (dt.date.today() - dt.timedelta(days=args.days)).isoformat()
    end = dt.date.today().isoformat()

    lines: list[str] = []
    lines.append(f"# LLM Cost + Usage Report (last {args.days} days)")
    lines.append("")
    lines.append(
        f"_Generated {now:%Y-%m-%d %H:%M}_ · Window: `{start}` → `{end}` · "
        f"RG: `{args.rg}` · App Insights: `{args.app}`"
    )
    lines.append("")

    if cost_err:
        lines.append("> ⚠️ **Cost query failed** — actuals unavailable. Check Cost "
                     "Management Reader role and `az login`.")
        lines.append(">")
        lines.append(f"> ```\n> {cost_err}\n> ```")
        lines.append("")
    if tele_err:
        lines.append("> ⚠️ **Telemetry query failed** — token counts unavailable.")
        lines.append(">")
        lines.append(f"> ```\n> {tele_err}\n> ```")
        lines.append("")

    # Build the joined per-model rows.
    rows: list[dict] = []
    matched_deps: set[str] = set()
    for display, dep in sorted(env_deployments.items()):
        dep_l = dep.lower()
        matched_deps.add(dep_l)
        cost = cost_by_dep.get(dep_l, 0.0)
        split = cost_by_dep_split.get(dep_l, {})
        t = telemetry.get(display, {})
        calls = t.get("calls", 0)
        users = t.get("users", 0)
        total_tok = t.get("totalTokens", 0)
        rows.append({
            "model": display,
            "deployment": dep,
            "cost": cost,
            "inputCost": split.get("input", 0.0),
            "outputCost": split.get("output", 0.0),
            "cachedCost": split.get("cached", 0.0),
            "otherCost": split.get("other", 0.0),
            "calls": calls,
            "users": users,
            "promptTokens": t.get("promptTokens", 0),
            "completionTokens": t.get("completionTokens", 0),
            "totalTokens": total_tok,
            "costPerCall": (cost / calls) if calls else 0.0,
            "costPerUser": (cost / users) if users else 0.0,
            "costPer1M": (cost / (total_tok / 1_000_000)) if total_tok else 0.0,
        })

    rows.sort(key=lambda r: r["cost"], reverse=True)

    total_cost = sum(r["cost"] for r in rows)
    total_input = sum(r["inputCost"] for r in rows)
    total_output = sum(r["outputCost"] for r in rows)
    total_cached = sum(r["cachedCost"] for r in rows)
    total_calls = sum(r["calls"] for r in rows)
    total_tokens = sum(r["totalTokens"] for r in rows)
    total_prompt = sum(r["promptTokens"] for r in rows)
    total_completion = sum(r["completionTokens"] for r in rows)
    blended_1m = (total_cost / (total_tokens / 1_000_000)) if total_tokens else 0.0

    # Headline KPIs.
    lines.append("## Headline")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("| --- | --- |")
    lines.append(f"| Total LLM cost ({args.days}d) | **{fmt_money(total_cost)}** |")
    lines.append(f"| Total model calls | {fmt_int(total_calls)} |")
    lines.append(f"| Total tokens | {fmt_int(total_tokens)} "
                 f"({fmt_int(total_prompt)} in / {fmt_int(total_completion)} out) |")
    lines.append(f"| Blended cost / 1M tokens | {fmt_money(blended_1m)} |")
    if total_calls:
        lines.append(f"| Avg cost / call | {fmt_money(total_cost / total_calls)} |")
    cost_split = total_input + total_output + total_cached
    if cost_split:
        lines.append(
            f"| Cost by token type | {fmt_money(total_input)} input / "
            f"{fmt_money(total_output)} output / {fmt_money(total_cached)} cached |"
        )
    lines.append("")

    # Per-model joined table.
    lines.append("## Per-model cost vs usage")
    lines.append("")
    lines.append("| Model | Deployment | Cost | Calls | Users | Total Tokens | "
                 "$/Call | $/User | $/1M Tok |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for r in rows:
        lines.append(
            f"| {r['model']} | `{r['deployment']}` | {fmt_money(r['cost'])} | "
            f"{fmt_int(r['calls'])} | {fmt_int(r['users'])} | "
            f"{fmt_int(r['totalTokens'])} | "
            f"{fmt_money(r['costPerCall']) if r['calls'] else '—'} | "
            f"{fmt_money(r['costPerUser']) if r['users'] else '—'} | "
            f"{fmt_money(r['costPer1M']) if r['totalTokens'] else '—'} |"
        )
    lines.append(f"| **Total** | | **{fmt_money(total_cost)}** | "
                 f"**{fmt_int(total_calls)}** | | **{fmt_int(total_tokens)}** | | | "
                 f"**{fmt_money(blended_1m)}** |")
    lines.append("")

    # Per-model cost split by token type (input / output / cached).
    lines.append("## Per-model cost by token type")
    lines.append("")
    lines.append("| Model | Deployment | Input | Output | Cached | Other | Total | "
                 "Out % |")
    lines.append("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for r in rows:
        billable = r["inputCost"] + r["outputCost"] + r["cachedCost"] + r["otherCost"]
        if billable:
            out_pct = r["outputCost"] / billable * 100
            other = fmt_money(r["otherCost"]) if r["otherCost"] else "—"
            lines.append(
                f"| {r['model']} | `{r['deployment']}` | "
                f"{fmt_money(r['inputCost'])} | {fmt_money(r['outputCost'])} | "
                f"{fmt_money(r['cachedCost'])} | {other} | "
                f"{fmt_money(r['cost'])} | {out_pct:.0f}% |"
            )
        else:
            lines.append(
                f"| {r['model']} | `{r['deployment']}` | — | — | — | — | "
                f"{fmt_money(r['cost'])} | — |"
            )
    total_other = sum(r["otherCost"] for r in rows)
    total_billable = total_input + total_output + total_cached + total_other
    total_out_pct = (total_output / total_billable * 100) if total_billable else 0.0
    lines.append(
        f"| **Total** | | **{fmt_money(total_input)}** | "
        f"**{fmt_money(total_output)}** | **{fmt_money(total_cached)}** | "
        f"**{fmt_money(total_other) if total_other else '—'}** | "
        f"**{fmt_money(total_cost)}** | **{total_out_pct:.0f}%** |"
    )
    lines.append("")

    # Telemetry models with no matching configured deployment (e.g. legacy).
    extra_tele = sorted(set(telemetry) - set(env_deployments))
    if extra_tele:
        lines.append("### Telemetry models not in current .env config")
        lines.append("")
        lines.append("| Model (telemetry) | Calls | Users | Total Tokens |")
        lines.append("| --- | ---: | ---: | ---: |")
        for m in extra_tele:
            t = telemetry[m]
            lines.append(f"| {m} | {fmt_int(t['calls'])} | {fmt_int(t['users'])} | "
                         f"{fmt_int(t['totalTokens'])} |")
        lines.append("")

    # Cost rows tagged with a deployment that isn't in .env, plus untagged.
    unmatched_cost = {k: v for k, v in cost_by_dep.items()
                      if k not in matched_deps and v}
    if unmatched_cost:
        lines.append("### Tagged cost without a configured model (or untagged)")
        lines.append("")
        lines.append("| Deployment tag | Cost |")
        lines.append("| --- | ---: |")
        for k, v in sorted(unmatched_cost.items(), key=lambda kv: kv[1], reverse=True):
            lines.append(f"| `{k}` | {fmt_money(v)} |")
        lines.append("")

    # Meter-level breakdown (input vs output vs cached).
    if cost_by_meter:
        lines.append("## Cost by meter (input / output / cached)")
        lines.append("")
        lines.append("| Meter | Cost |")
        lines.append("| --- | ---: |")
        for k, v in sorted(cost_by_meter.items(), key=lambda kv: kv[1], reverse=True):
            if v:
                lines.append(f"| {k} | {fmt_money(v)} |")
        lines.append("")

    # Caveats.
    lines.append("## Notes & caveats")
    lines.append("")
    lines.append(f"- **Cost** is ActualCost from Azure Cost Management for RG "
                 f"`{args.rg}`, grouped by the `deployment` tag. Today's spend is "
                 "partial and may lag a few hours.")
    lines.append("- **Tokens / calls / users** come from App Insights "
                 "`AI_Model_Usage` events — these reflect *this app only*, while "
                 "cost reflects *all traffic* to each deployment (other apps, the "
                 "portal playground, and Foundry agents share the same Foundry "
                 "resource). $/call and $/1M-token are therefore upper-bound "
                 "estimates where the deployment is shared.")
    lines.append("- Models with cost but no telemetry (e.g. image models like "
                 "`flux.2-pro`) appear under the unmatched-cost table.")
    lines.append("- Join key: telemetry display name ↔ `.env` "
                 "`VITE_AZURE_OPENAI_DEPLOYMENT_*` ↔ cost `deployment` tag "
                 "(case-insensitive).")
    lines.append("")

    return "\n".join(lines) + "\n", rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=30, help="rolling window (default 30)")
    ap.add_argument("--subscription", default=DEFAULT_SUBSCRIPTION)
    ap.add_argument("--rg", default=DEFAULT_RG)
    ap.add_argument("--app", default=DEFAULT_APPINSIGHTS)
    ap.add_argument("--env", default=str(REPO_ROOT / ".env"))
    args = ap.parse_args()

    env_deployments = load_env_deployments(Path(args.env))
    if not env_deployments:
        print(f"⚠️  No deployment vars found in {args.env}", file=sys.stderr)

    print(f"▶ Querying Cost Management (RG {args.rg}, last {args.days}d)…")
    cost_by_dep, cost_by_meter, cost_by_dep_split, cost_err = query_cost(
        args.subscription, args.rg, args.days
    )
    if cost_err:
        print(f"  ⚠️ cost query failed: {cost_err}", file=sys.stderr)

    print(f"▶ Querying App Insights telemetry ({args.app})…")
    telemetry, tele_err = query_telemetry(args.app, args.rg, args.days)
    if tele_err:
        print(f"  ⚠️ telemetry query failed: {tele_err}", file=sys.stderr)

    report, rows = build_report(
        args, env_deployments, cost_by_dep, cost_by_meter, cost_by_dep_split,
        cost_err, telemetry, tele_err,
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    md_path = OUT_DIR / f"llm-cost-report-{args.days}d-{ts}.md"
    csv_path = OUT_DIR / f"llm-cost-report-{args.days}d-{ts}.csv"
    md_path.write_text(report)

    with csv_path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=[
            "model", "deployment", "cost",
            "inputCost", "outputCost", "cachedCost", "otherCost",
            "calls", "users",
            "promptTokens", "completionTokens", "totalTokens",
            "costPerCall", "costPerUser", "costPer1M",
        ])
        w.writeheader()
        for r in rows:
            w.writerow(r)

    print(f"✅ Wrote {md_path}")
    print(f"✅ Wrote {csv_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
