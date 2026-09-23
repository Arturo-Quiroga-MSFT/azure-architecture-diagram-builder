#!/usr/bin/env python3
"""Inject inline styles into <table>/<th>/<td> for Tech Community paste.

Tech Community editor strips <style> blocks and most class attributes, but
preserves inline style="..." on table elements. This rewrites every table in
the HTML file with Azure-blue headers, zebra striping, severity color chips,
and source-tag pill styling.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HEADER_BG = "#0078D4"   # Azure blue
HEADER_FG = "#FFFFFF"
ROW_ALT   = "#F3F7FB"   # very light blue
BORDER    = "#D6DEE6"
TEXT      = "#1F2937"

TABLE_STYLE = (
    "border-collapse:collapse;width:100%;margin:16px 0;"
    f"font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:{TEXT};"
    f"border:1px solid {BORDER};"
)
TH_STYLE = (
    f"background:{HEADER_BG};color:{HEADER_FG};text-align:left;"
    f"padding:10px 12px;border:1px solid {HEADER_BG};font-weight:600;"
)
TD_STYLE = f"padding:8px 12px;border:1px solid {BORDER};vertical-align:top;"
TR_ALT_STYLE = f"background:{ROW_ALT};"

SEVERITY_COLORS = {
    "critical": ("#B91C1C", "#FEE2E2"),
    "high":     ("#C2410C", "#FFEDD5"),
    "medium":   ("#A16207", "#FEF3C7"),
    "low":      ("#15803D", "#DCFCE7"),
}
SOURCE_COLORS = {
    "rule-based":  ("#1E3A8A", "#DBEAFE"),
    "ai-analysis": ("#6B21A8", "#F3E8FF"),
}


def chip(text: str, fg: str, bg: str) -> str:
    return (
        f'<span style="display:inline-block;padding:2px 8px;border-radius:10px;'
        f'background:{bg};color:{fg};font-weight:600;font-size:12px;'
        f'font-family:\'Segoe UI\',Arial,sans-serif;">{text}</span>'
    )


def style_cell_content(inner: str) -> str:
    # Strip pandoc <code> wrappers around known source tags
    for tag, (fg, bg) in SOURCE_COLORS.items():
        inner = re.sub(
            rf"<code[^>]*>{re.escape(tag)}</code>",
            chip(tag, fg, bg),
            inner,
            flags=re.IGNORECASE,
        )
    # Replace bare severity words (only if cell is exactly that word, optionally wrapped)
    stripped = re.sub(r"<[^>]+>", "", inner).strip().lower()
    if stripped in SEVERITY_COLORS:
        fg, bg = SEVERITY_COLORS[stripped]
        return chip(stripped, fg, bg)
    return inner


def style_table(match: re.Match) -> str:
    table_html = match.group(0)
    table_html = re.sub(r"<table[^>]*>", f'<table style="{TABLE_STYLE}">', table_html, count=1)
    table_html = re.sub(r"<th(?=[\s>])[^>]*>", f'<th style="{TH_STYLE}">', table_html)

    # Zebra-stripe body rows
    body_match = re.search(r"<tbody[^>]*>(.*?)</tbody>", table_html, re.DOTALL)
    if body_match:
        body = body_match.group(1)
        rows = re.split(r"(<tr[^>]*>)", body)
        new_body_parts: list[str] = [rows[0]]
        row_index = 0
        for i in range(1, len(rows), 2):
            tr_tag = rows[i]
            row_index += 1
            if row_index % 2 == 0:
                tr_tag = f'<tr style="{TR_ALT_STYLE}">'
            else:
                tr_tag = "<tr>"
            new_body_parts.append(tr_tag)
            if i + 1 < len(rows):
                new_body_parts.append(rows[i + 1])
        new_body = "".join(new_body_parts)
        table_html = table_html.replace(body_match.group(1), new_body)

    # Style each <td> and process inner content (chips for severity/source)
    def td_repl(m: re.Match) -> str:
        inner = m.group(1)
        inner = style_cell_content(inner)
        return f'<td style="{TD_STYLE}">{inner}</td>'

    table_html = re.sub(r"<td[^>]*>(.*?)</td>", td_repl, table_html, flags=re.DOTALL)
    return table_html


def main(path: str) -> None:
    p = Path(path)
    html = p.read_text(encoding="utf-8")
    new_html = re.sub(r"<table.*?</table>", style_table, html, flags=re.DOTALL)
    p.write_text(new_html, encoding="utf-8")
    print(f"Styled {len(re.findall(r'<table', new_html))} tables in {p.name}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "blog-post/post-2-waf-validation/blog-draft-waf-validation.html")
