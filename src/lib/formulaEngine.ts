import type { GraphEdge, GraphNode } from '../types/linkdraw';
import { computeGraphTelemetry } from './algorithms';

export type SheetGrid = Record<string, string>;

export const DEFAULT_SHEET_CELLS: SheetGrid = {};

function colToIndex(col: string): number {
  let res = 0;
  for (let i = 0; i < col.length; i++) {
    res = res * 26 + (col.charCodeAt(i) - 64);
  }
  return res - 1;
}

function indexToCol(idx: number): string {
  let s = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  return { col: colToIndex(m[1].toUpperCase()), row: parseInt(m[2], 10) };
}

function expandRange(rangeStr: string): string[] {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [];
  const r1 = Math.min(start.row, end.row);
  const r2 = Math.max(start.row, end.row);
  const c1 = Math.min(start.col, end.col);
  const c2 = Math.max(start.col, end.col);
  const refs: string[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      refs.push(`${indexToCol(c)}${r}`);
    }
  }
  return refs;
}

function splitTopLevelArgs(argStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < argStr.length; i++) {
    const ch = argStr[i];
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

export function evaluateSheetCell(
  cellId: string,
  grid: SheetGrid,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visiting = new Set<string>()
): string | number {
  const raw = grid[cellId];
  if (raw === undefined || raw === '') return '';
  if (!raw.startsWith('=')) {
    const num = Number(raw);
    return raw.trim() !== '' && !Number.isNaN(num) ? num : raw;
  }

  if (visiting.has(cellId)) return '#CYCLE!';
  visiting.add(cellId);

  try {
    const expr = raw.slice(1).trim();
    const res = evalExpression(expr, grid, nodes, edges, visiting);
    visiting.delete(cellId);
    return res;
  } catch {
    visiting.delete(cellId);
    return '#ERR';
  }
}

function evalExpression(
  expr: string,
  grid: SheetGrid,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visiting: Set<string>
): string | number {
  const trimmed = expr.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }

  // Replace function calls iteratively from innermost/known top-level patterns
  const resolved = resolveFunctionsAndRefs(trimmed, grid, nodes, edges, visiting);
  if (typeof resolved === 'number') return resolved;
  if (typeof resolved === 'string' && !/^[0-9.+\-*/^()\s]+$/.test(resolved)) {
    // Strip outer quotes if string literal returned
    if (resolved.startsWith('"') && resolved.endsWith('"')) return resolved.slice(1, -1);
    return resolved;
  }

  // Safe arithmetic evaluator (no eval / Function)
  return evalArithmetic(String(resolved));
}

function resolveFunctionsAndRefs(
  input: string,
  grid: SheetGrid,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visiting: Set<string>
): string | number {
  // Handle IF(cond, trueVal, falseVal)
  const ifMatch = /^IF\((.*)\)$/i.exec(input);
  if (ifMatch) {
    const args = splitTopLevelArgs(ifMatch[1]);
    if (args.length >= 3) {
      const condRes = evalCondition(args[0], grid, nodes, edges, visiting);
      return evalExpression(condRes ? args[1] : args[2], grid, nodes, edges, visiting);
    }
  }

  // Replace function calls inside expression
  let out = input;
  const fnPattern = /\b(SUM|AVERAGE|AVG|MIN|MAX|COUNT|NODE|GRAPH)\(([^()]*)\)/gi;
  let guard = 0;
  while (fnPattern.test(out) && guard < 20) {
    guard++;
    out = out.replace(fnPattern, (_, fnName: string, rawArgs: string) => {
      const fn = fnName.toUpperCase();
      const args = splitTopLevelArgs(rawArgs);

      if (fn === 'GRAPH') {
        const metric = (args[0] ?? '').replace(/^"|"$/g, '').toLowerCase();
        const telemetry = computeGraphTelemetry(nodes, edges);
        if (metric === 'nodes') return String(telemetry.nodeCount);
        if (metric === 'edges') return String(telemetry.edgeCount);
        if (metric === 'density') return telemetry.density.toFixed(3);
        if (metric === 'clusters') return String(telemetry.clusters);
        if (metric === 'cycles') return String(telemetry.cycleCount);
        if (metric === 'avgdegree') return telemetry.avgDegree.toFixed(2);
        return '0';
      }

      if (fn === 'NODE') {
        const target = (args[0] ?? '').replace(/^"|"$/g, '').toLowerCase();
        const prop = (args[1] ?? '').replace(/^"|"$/g, '').toLowerCase();
        const found = nodes.find(
          (n) => n.id.toLowerCase() === target || n.text.toLowerCase() === target
        );
        if (!found) return '0';
        if (prop === 'progress') return String(found.progress ?? 0);
        if (prop === 'w' || prop === 'width') return String(found.w);
        if (prop === 'h' || prop === 'height') return String(found.h);
        if (prop === 'x') return String(Math.round(found.x));
        if (prop === 'y') return String(Math.round(found.y));
        if (prop === 'tags') return String(found.tags.length);
        if (found.metadata && prop in found.metadata) {
          const mv = found.metadata[prop];
          return Number.isNaN(Number(mv)) ? `"${mv}"` : String(Number(mv));
        }
        return `"${found.text}"`;
      }

      // Range / numeric aggregate functions
      const values: number[] = [];
      for (const a of args) {
        if (a.includes(':')) {
          for (const ref of expandRange(a)) {
            const val = evaluateSheetCell(ref, grid, nodes, edges, visiting);
            const num = Number(val);
            if (val !== '' && !Number.isNaN(num)) values.push(num);
          }
        } else {
          const val = evalExpression(a, grid, nodes, edges, visiting);
          const num = Number(val);
          if (val !== '' && !Number.isNaN(num)) values.push(num);
        }
      }

      if (fn === 'SUM') return String(values.reduce((s, v) => s + v, 0));
      if (fn === 'AVERAGE' || fn === 'AVG') {
        return values.length ? String(Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(3))) : '0';
      }
      if (fn === 'MIN') return values.length ? String(Math.min(...values)) : '0';
      if (fn === 'MAX') return values.length ? String(Math.max(...values)) : '0';
      if (fn === 'COUNT') return String(values.length);
      return '0';
    });
  }

  // Replace standalone cell references outside quotes
  out = replaceCellRefs(out, grid, nodes, edges, visiting);
  return out;
}

function replaceCellRefs(
  expr: string,
  grid: SheetGrid,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visiting: Set<string>
): string {
  // Split by string literals to avoid replacing inside quotes
  const segments = expr.split(/("[^"]*")/g);
  return segments
    .map((seg, idx) => {
      if (idx % 2 === 1) return seg;
      return seg.replace(/\b([A-Z]+\d+)\b/gi, (match) => {
        const val = evaluateSheetCell(match.toUpperCase(), grid, nodes, edges, visiting);
        if (val === '') return '0';
        return typeof val === 'number' ? String(val) : `"${val}"`;
      });
    })
    .join('');
}

function evalCondition(
  cond: string,
  grid: SheetGrid,
  nodes: GraphNode[],
  edges: GraphEdge[],
  visiting: Set<string>
): boolean {
  const ops = ['>=', '<=', '!=', '<>', '==', '=', '>', '<'];
  for (const op of ops) {
    const idx = cond.indexOf(op);
    if (idx !== -1) {
      const lhs = evalExpression(cond.slice(0, idx), grid, nodes, edges, visiting);
      const rhs = evalExpression(cond.slice(idx + op.length), grid, nodes, edges, visiting);
      const ln = Number(lhs);
      const rn = Number(rhs);
      const bothNum = lhs !== '' && rhs !== '' && !Number.isNaN(ln) && !Number.isNaN(rn);
      if (op === '>=' && bothNum) return ln >= rn;
      if (op === '<=' && bothNum) return ln <= rn;
      if (op === '>' && bothNum) return ln > rn;
      if (op === '<' && bothNum) return ln < rn;
      if (op === '!=' || op === '<>') return bothNum ? ln !== rn : String(lhs) !== String(rhs);
      if (op === '=' || op === '==') return bothNum ? ln === rn : String(lhs) === String(rhs);
    }
  }
  const v = evalExpression(cond, grid, nodes, edges, visiting);
  return Boolean(v && v !== '0' && v !== 'false');
}

function evalArithmetic(expr: string): number | string {
  const tokens: string[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, '');
  while (i < s.length) {
    const ch = s[i];
    if ('+-*/^()'.includes(ch)) {
      // Unary minus
      if (
        ch === '-' &&
        (tokens.length === 0 || '+-*/^('.includes(tokens[tokens.length - 1]))
      ) {
        let num = '-';
        i++;
        while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
        tokens.push(num);
        continue;
      }
      tokens.push(ch);
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
      tokens.push(num);
    } else {
      return expr;
    }
  }

  let pos = 0;
  function parseExpr(): number {
    let val = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }
  function parseTerm(): number {
    let val = parsePow();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const rhs = parsePow();
      val = op === '*' ? val * rhs : rhs === 0 ? 0 : val / rhs;
    }
    return val;
  }
  function parsePow(): number {
    let val = parseFactor();
    while (pos < tokens.length && tokens[pos] === '^') {
      pos++;
      val = Math.pow(val, parseFactor());
    }
    return val;
  }
  function parseFactor(): number {
    const tok = tokens[pos++];
    if (tok === '(') {
      const v = parseExpr();
      if (tokens[pos] === ')') pos++;
      return v;
    }
    const n = Number(tok);
    return Number.isNaN(n) ? 0 : n;
  }

  const out = parseExpr();
  return Number.isFinite(out) ? Number(out.toFixed(4)) : '#ERR';
}
