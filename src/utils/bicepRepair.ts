// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Deterministic repair for common syntax slips in model-written Bicep.
 *
 * Models often compress objects onto one line without separators
 * (`{ name: 'Basic' tier: 'Basic' }`) or use semicolons
 * (`{ name: 'A'; value: b }`). Bicep accepts single-line objects and arrays
 * only when items are comma-separated, so these fail with BCP236 / BCP022.
 * This pass inserts the missing commas and turns stray semicolons into
 * commas, leaving strings, interpolations and comments untouched. It never
 * changes semantics; anything it cannot fix safely is left for the compiler
 * check and the model repair round.
 */

type Frame = { open: '{' | '[' | '('; line: number; start: number };

const VALUE_END = /[A-Za-z0-9_'\])}]/;
const VALUE_START = /[A-Za-z0-9_'[{(]/;
const KEYWORDS = new Set(['for', 'in', 'if']);

function wordBefore(out: string): string {
  const m = /([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(out);
  return m ? m[1] : '';
}

function startsWithFor(src: string, from: number): boolean {
  return /^\[\s*for\b/.test(src.slice(from, from + 20));
}

export interface BicepRepairResult {
  content: string;
  /** Number of separators inserted or semicolons rewritten. */
  fixes: number;
}

export function repairBicep(src: string): BicepRepairResult {
  let out = '';
  let fixes = 0;
  let line = 0;
  const stack: Frame[] = [];
  let i = 0;
  const n = src.length;

  const top = () => stack[stack.length - 1];

  while (i < n) {
    const c = src[i];

    // Comments
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += src.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      const chunk = src.slice(i, stop);
      line += (chunk.match(/\n/g) || []).length;
      out += chunk;
      i = stop;
      continue;
    }

    // Multi-line strings (no interpolation in Bicep)
    if (c === "'" && src.startsWith("'''", i)) {
      const end = src.indexOf("'''", i + 3);
      const stop = end === -1 ? n : end + 3;
      const chunk = src.slice(i, stop);
      line += (chunk.match(/\n/g) || []).length;
      out += chunk;
      i = stop;
      continue;
    }

    // Regular strings with ${...} interpolation
    if (c === "'") {
      out += c;
      i++;
      while (i < n && src[i] !== "'" && src[i] !== '\n') {
        if (src[i] === '\\') {
          out += src.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (src[i] === '$' && src[i + 1] === '{') {
          // Copy the interpolation verbatim, tracking nested braces and strings.
          let depth = 0;
          let j = i + 1;
          let inStr = false;
          for (; j < n; j++) {
            const d = src[j];
            if (inStr) {
              if (d === '\\') j++;
              else if (d === "'") inStr = false;
            } else if (d === "'") inStr = true;
            else if (d === '{') depth++;
            else if (d === '}') {
              depth--;
              if (depth === 0) break;
            }
          }
          out += src.slice(i, j + 1);
          i = j + 1;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n && src[i] === "'") {
        out += "'";
        i++;
      }
      continue;
    }

    if (c === '\n') {
      line++;
      out += c;
      i++;
      continue;
    }

    if (c === '{' || c === '[' || c === '(') {
      stack.push({ open: c, line, start: i });
      out += c;
      i++;
      continue;
    }
    if (c === '}' || c === ']' || c === ')') {
      stack.pop();
      out += c;
      i++;
      continue;
    }

    const frame = top();
    const inlineCollection = frame && (frame.open === '{' || frame.open === '[') && frame.line === line;

    if (c === ';') {
      let k = i + 1;
      while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
      if (k >= n || src[k] === '\n' || src[k] === '/') {
        fixes++;
        i++;
        continue;
      }
      if (inlineCollection) {
        out = out.replace(/[ \t]+$/, '');
        out += ',';
        fixes++;
        i++;
        continue;
      }
    }

    if ((c === ' ' || c === '\t') && inlineCollection) {
      let k = i;
      while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
      const next = src[k];
      const prev = out.replace(/[ \t]+$/, '').slice(-1);
      const rest = src.slice(k, k + 200);
      let insert = false;
      if (prev && VALUE_END.test(prev) && next && !KEYWORDS.has(wordBefore(out))) {
        if (frame.open === '{') {
          insert = /^(?:[A-Za-z_][A-Za-z0-9_]*|'[^'\n]*')\s*:(?!:)/.test(rest);
        } else if (!startsWithFor(src, frame.start)) {
          const nextWord = /^[A-Za-z_]\w*/.exec(rest)?.[0] ?? '';
          insert = VALUE_START.test(next) && !KEYWORDS.has(nextWord);
        }
      }
      // Skip a run of whitespace in one step.
      if (insert) {
        out = out.replace(/[ \t]+$/, '') + ',';
        fixes++;
      }
      out += src.slice(i, k);
      i = k;
      continue;
    }

    out += c;
    i++;
  }

  const stable = stabilizeGuidNames(out);
  return { content: stable.content, fixes: fixes + stable.fixes };
}

function splitTopLevel(args: string): string[] {
  const parts: string[] = [];
  let depth = 0, inStr = false, cur = '';
  for (const ch of args) {
    if (ch === "'") inStr = !inStr;
    if (!inStr) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

// Values only known after deployment starts: module outputs, runtime properties, identities.
const RUNTIME_REF = /\.outputs\.|\.properties\.|\.identity\.|\.principalId\b|\breference\(|\blist[A-Z]\w*\(/;

/**
 * `name: guid(scope.id, mod.outputs.principalId, 'role')` fails with BCP120:
 * a resource name must be computable when the deployment starts. Replace the
 * runtime arguments with a stable literal derived from the expression; the
 * remaining arguments (scope, role) keep the name unique and deterministic.
 */
export function stabilizeGuidNames(src: string): BicepRepairResult {
  let fixes = 0;
  const content = src.replace(/^(\s*name:\s*guid\()(.*)(\)\s*(?:\/\/.*)?)$/gm, (whole, head: string, args: string, tail: string) => {
    if (!RUNTIME_REF.test(args) || args.includes("'''")) return whole;
    const parts = splitTopLevel(args);
    if (parts.length === 0 || parts.some((p) => p.trim() === '')) return whole;
    let changed = false;
    const next = parts.map((p) => {
      const t = p.trim();
      if (!RUNTIME_REF.test(t) || t.startsWith("'")) return p;
      changed = true;
      const literal = t.replace(/[^A-Za-z0-9.]+/g, '-').replace(/\.(outputs|properties|identity)\./g, '.').replace(/^-+|-+$/g, '');
      return p.replace(t, `'${literal}'`);
    });
    if (!changed) return whole;
    fixes++;
    return head + next.join(',') + tail;
  });
  return { content, fixes };
}
