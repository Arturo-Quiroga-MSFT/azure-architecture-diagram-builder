// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Docs Grounding Service
 * Phase 1: ground AI output in official Microsoft Learn documentation via the
 * server-side /api/docs-search proxy (Microsoft Learn MCP). Best-effort — a
 * failure returns an empty list so callers can proceed ungrounded.
 */

export interface DocSource {
  title: string;
  url: string;
  excerpt?: string;
}

/**
 * Search official Microsoft Learn documentation.
 * @param query Natural-language search query.
 * @param top   Max number of sources to return (1–10).
 */
export async function searchMicrosoftDocs(query: string, top = 6): Promise<DocSource[]> {
  try {
    const response = await fetch('/api/docs-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const results: DocSource[] = Array.isArray(data?.results) ? data.results : [];
    // Keep only entries with a usable URL.
    return results.filter((r) => r && typeof r.url === 'string' && r.url.length > 0);
  } catch {
    return [];
  }
}

/**
 * Render a compact grounding block for injection into a prompt. Returns an
 * empty string when there are no sources.
 */
export function renderGroundingBlock(sources: DocSource[]): string {
  if (sources.length === 0) return '';
  const items = sources
    .map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${(s.excerpt || '').trim()}`)
    .join('\n\n');
  return `GROUNDING SOURCES — Official Microsoft Learn documentation (use these to ensure current API versions, CLI flags, and Bicep resource schemas; cite the relevant URLs):\n\n${items}`;
}
