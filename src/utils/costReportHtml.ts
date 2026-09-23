/**
 * Minimal Markdown → standalone HTML renderer for cost reports.
 *
 * This is intentionally NOT a general-purpose Markdown parser. It only supports
 * the subset of Markdown produced by the cost export (headings, tables, bullet
 * lists, blockquotes, horizontal rules, inline `code`/**bold**, and ```mermaid
 * fenced blocks). Because we control the input, a small line-based converter is
 * reliable and dependency-free. Mermaid diagrams are rendered client-side via a
 * CDN script so the file stays self-contained and viewable in any browser.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Convert inline `code` and **bold** spans (operates on already-escaped text). */
function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Split a Markdown table row "| a | b |" into trimmed cells. */
function splitRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
  // Respect escaped pipes (\|) by temporarily swapping them out.
  return trimmed
    .split(/(?<!\\)\|/)
    .map(cell => cell.replace(/\\\|/g, '|').trim());
}

function isTableSeparator(row: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(row.trim());
}

/** Render the Markdown body into HTML block elements. */
function renderBlocks(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Mermaid fenced block.
    if (line.trim().startsWith('```mermaid')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      out.push(`<pre class="mermaid">${escapeHtml(buf.join('\n'))}</pre>`);
      continue;
    }

    // Generic fenced code block.
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Horizontal rule.
    if (/^---\s*$/.test(line)) {
      out.push('<hr />');
      i++;
      continue;
    }

    // Headings.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(escapeHtml(heading[2]))}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote (consecutive `>` lines).
    if (line.trimStart().startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${buf.map(b => renderInline(escapeHtml(b))).join('<br />')}</blockquote>`);
      continue;
    }

    // Table (header row + separator + body rows).
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitRow(line);
      i += 2; // skip header + separator
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        bodyRows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headerCells.map(c => `<th>${renderInline(escapeHtml(c))}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${bodyRows
        .map(r => `<tr>${r.map(c => `<td>${renderInline(escapeHtml(c))}</td>`).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Bullet list (consecutive `- ` lines).
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''));
        i++;
      }
      out.push(`<ul>${items.map(it => `<li>${renderInline(escapeHtml(it))}</li>`).join('')}</ul>`);
      continue;
    }

    // Blank line.
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fallback paragraph.
    out.push(`<p>${renderInline(escapeHtml(line))}</p>`);
    i++;
  }

  return out.join('\n');
}

/**
 * Wrap rendered Markdown in a styled, self-contained HTML document.
 *
 * @param title    Document title (used in <title> and shown as a header).
 * @param markdown The Markdown body to render.
 */
export function costReportToHtml(title: string, markdown: string): string {
  const body = renderBlocks(markdown);
  const needsMermaid = markdown.includes('```mermaid');
  const mermaidScript = needsMermaid
    ? `<script type="module">
      import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
      mermaid.initialize({
        startOnLoad: true,
        theme: 'base',
        themeVariables: {
          pie1: '#0078D4', pie2: '#50E6FF', pie3: '#2EC5CE', pie4: '#8661C5',
          pie5: '#F2A900', pie6: '#3FB950', pie7: '#E3008C', pie8: '#0B5CAB',
          pie9: '#5C2D91', pie10: '#C239B3', pie11: '#00B294', pie12: '#FF8C00',
          pieStrokeColor: '#ffffff', pieStrokeWidth: '2px', pieOuterStrokeWidth: '1px',
          pieTitleTextSize: '18px', pieSectionTextSize: '13px', pieLegendTextSize: '13px',
        },
      });
    </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.55; margin: 0; padding: 2rem 1.5rem; max-width: 960px;
      margin-inline: auto; color: #1b1f23; background: #ffffff;
    }
    @media (prefers-color-scheme: dark) {
      body { color: #e6edf3; background: #0d1117; }
      th { background: #161b22 !important; }
      tr:nth-child(even) td { background: #161b22; }
      blockquote { background: #161b22; border-color: #2f81f7; }
      code { background: #161b22; }
      a { color: #58a6ff; }
    }
    h1 { font-size: 1.8rem; border-bottom: 2px solid #0078d4; padding-bottom: .3rem; }
    h2 { font-size: 1.35rem; margin-top: 2rem; border-bottom: 1px solid #d0d7de; padding-bottom: .2rem; }
    h3 { font-size: 1.1rem; margin-top: 1.4rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92rem; }
    th, td { border: 1px solid #d0d7de; padding: .45rem .7rem; text-align: left; }
    th { background: #f6f8fa; }
    td:nth-child(n+2) { text-align: right; }
    tr:nth-child(even) td { background: #f6f8fa; }
    blockquote {
      margin: 1rem 0; padding: .75rem 1rem; background: #f0f6ff;
      border-left: 4px solid #0078d4; border-radius: 4px;
    }
    code {
      font-family: 'SF Mono', Consolas, 'Courier New', monospace;
      background: #f0f1f3; padding: .1rem .35rem; border-radius: 4px; font-size: .88em;
    }
    pre.mermaid { text-align: center; margin: 1.5rem 0; }
    hr { border: none; border-top: 1px solid #d0d7de; margin: 2rem 0; }
    ul { padding-left: 1.4rem; }
    li { margin: .25rem 0; }
    footer { margin-top: 2rem; font-size: .8rem; color: #6e7681; }
  </style>
</head>
<body>
${body}
${mermaidScript}
</body>
</html>`;
}
