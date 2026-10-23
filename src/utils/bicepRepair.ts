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

  return { content: out, fixes };
}
