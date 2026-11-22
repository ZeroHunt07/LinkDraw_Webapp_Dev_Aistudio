import type { GraphEdge, GraphNode, NodeShape, StickyNote } from '../types/linkdraw';

export interface Point {
  x: number;
  y: number;
}

export interface EdgeGeometry {
  points: Point[];
  labelPos: Point;
  startAngle: number;
  endAngle: number;
  isSelfLoop: boolean;
}

/**
 * Returns shape-aware safe inner text width/height ratios so text never clips or overlaps borders.
 */
export function getShapeSafeTextBox(node: GraphNode): { maxW: number; maxH: number; offsetY: number } {
  const w = node.w;
  const h = node.h;
  switch (node.shape) {
    case 'circle':
      return { maxW: w * 0.68, maxH: h * 0.68, offsetY: 0 };
    case 'diamond':
      return { maxW: w * 0.52, maxH: h * 0.52, offsetY: 0 };
    case 'triangle':
      return { maxW: w * 0.52, maxH: h * 0.45, offsetY: h * 0.14 };
    case 'star':
      return { maxW: w * 0.48, maxH: h * 0.46, offsetY: 0.04 * h };
    case 'hexagon':
      return { maxW: w * 0.72, maxH: h * 0.76, offsetY: 0 };
    case 'cylinder':
      return { maxW: w * 0.82, maxH: h * 0.64, offsetY: h * 0.07 };
    case 'cloud':
      return { maxW: w * 0.7, maxH: h * 0.58, offsetY: h * 0.03 };
    case 'callout':
      return { maxW: w * 0.84, maxH: h * 0.66, offsetY: -h * 0.07 };
    case 'parallelogram':
      return { maxW: w * 0.68, maxH: h * 0.76, offsetY: 0 };
    default:
      return { maxW: w * 0.86, maxH: h * 0.8, offsetY: 0 };
  }
}

/**
 * Computes the exact intersection point on the outer perimeter of a node's shape
 * along the ray from node center (nx, ny) toward (fromX, fromY).
 */
export function getShapeBoundaryPoint(node: GraphNode, fromX: number, fromY: number): Point {
  const cx = node.x;
  const cy = node.y;
  const dx = fromX - cx;
  const dy = fromY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) {
    return { x: cx, y: cy - node.h / 2 };
  }
  const ux = dx / dist;
  const uy = dy / dist;
  const hw = node.w / 2;
  const hh = node.h / 2;

  switch (node.shape) {
    case 'circle': {
      const rx = hw;
      const ry = hh;
      const denom = Math.hypot(ux / rx, uy / ry);
      return { x: cx + ux / denom, y: cy + uy / denom };
    }
    case 'diamond': {
      const t = 1 / (Math.abs(ux) / hw + Math.abs(uy) / hh);
      return { x: cx + ux * t, y: cy + uy * t };
    }
    case 'triangle': {
      const poly: Point[] = [
        { x: cx, y: cy - hh },
        { x: cx + hw, y: cy + hh },
        { x: cx - hw, y: cy + hh },
      ];
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
    }
    case 'hexagon': {
      const inset = Math.min(hw * 0.28, 22);
      const poly: Point[] = [
        { x: cx - hw + inset, y: cy - hh },
        { x: cx + hw - inset, y: cy - hh },
        { x: cx + hw, y: cy },
        { x: cx + hw - inset, y: cy + hh },
        { x: cx - hw + inset, y: cy + hh },
        { x: cx - hw, y: cy },
      ];
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
    }
    case 'parallelogram': {
      const skew = Math.min(hw * 0.25, 20);
      const poly: Point[] = [
        { x: cx - hw + skew, y: cy - hh },
        { x: cx + hw, y: cy - hh },
        { x: cx + hw - skew, y: cy + hh },
        { x: cx - hw, y: cy + hh },
      ];
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
    }
    case 'star': {
      const poly = getStarPolygon(cx, cy, hw, hh);
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
    }
    case 'callout': {
      const bodyH = hh * 0.78;
      return rectIntersect(cx, cy - (hh - bodyH) * 0.3, hw, bodyH, ux, uy);
    }
    case 'cloud': {
      return rectIntersect(cx, cy, hw * 0.94, hh * 0.88, ux, uy);
    }
    default:
      return rectIntersect(cx, cy, hw, hh, ux, uy);
  }
}

function rectIntersect(cx: number, cy: number, hw: number, hh: number, ux: number, uy: number): Point {
  const tx = Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity;
  const t = Math.min(tx, ty);
  return { x: cx + ux * t, y: cy + uy * t };
}

function intersectRayPolygon(
  cx: number,
  cy: number,
  ux: number,
  uy: number,
  poly: Point[]
): Point | null {
  let bestT = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const ex = p2.x - p1.x;
    const ey = p2.y - p1.y;
    const denom = ux * ey - uy * ex;
    if (Math.abs(denom) < 1e-6) continue;
    const dx = p1.x - cx;
    const dy = p1.y - cy;
    const t = (dx * ey - dy * ex) / denom;
    const u = (dx * uy - dy * ux) / denom;
    if (t > 0 && u >= -1e-4 && u <= 1 + 1e-4 && t < bestT) {
      bestT = t;
    }
  }
  if (!Number.isFinite(bestT)) return null;
  return { x: cx + ux * bestT, y: cy + uy * bestT };
}

export function getStarPolygon(cx: number, cy: number, rx: number, ry: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const factor = i % 2 === 0 ? 1 : 0.46;
    pts.push({
      x: cx + Math.cos(angle) * rx * factor,
      y: cy + Math.sin(angle) * ry * factor,
    });
  }
  return pts;
}

/**
 * Computes parallel edge bundling offsets so multiple edges between the same pair don't collide.
 */
export function computeParallelEdgeIndexMap(edges: GraphEdge[]): Map<string, { index: number; total: number }> {
  const groups = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (e.a === e.b) continue;
    const key = e.a < e.b ? `${e.a}::${e.b}` : `${e.b}::${e.a}`;
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }
  const result = new Map<string, { index: number; total: number }>();
  for (const list of groups.values()) {
    list.forEach((e, idx) => {
      result.set(e.id, { index: idx, total: list.length });
    });
  }
  return result;
}

export function computeEdgeGeometry(
  edge: GraphEdge,
  nodeMap: Map<string, GraphNode>,
  parallelInfo?: { index: number; total: number }
): EdgeGeometry | null {
  const src = nodeMap.get(edge.a);
  const dst = nodeMap.get(edge.b);
  if (!src || !dst) return null;

  // Self-loop geometry
  if (src.id === dst.id) {
    const hh = src.h / 2;
    const hw = src.w / 2;
    const p0 = { x: src.x - Math.min(18, hw * 0.35), y: src.y - hh };
    const p1 = { x: src.x - 42, y: src.y - hh - 64 };
    const p2 = { x: src.x + 42, y: src.y - hh - 64 };
    const p3 = { x: src.x + Math.min(18, hw * 0.35), y: src.y - hh };
    const points = sampleCubicBezier(p0, p1, p2, p3, 24);
    const labelPos = points[Math.floor(points.length / 2)];
    const startAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
    const n = points.length;
    const endAngle = Math.atan2(points[n - 1].y - points[n - 2].y, points[n - 1].x - points[n - 2].x);
    return { points, labelPos, startAngle, endAngle, isSelfLoop: true };
  }

  const dx = dst.x - src.x;
  const dy = dst.y - src.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const total = parallelInfo?.total ?? 1;
  const index = parallelInfo?.index ?? 0;
  const canonicalFlip = edge.a > edge.b ? -1 : 1;
  const bundleOffset =
    total > 1
      ? (index - (total - 1) / 2) * Math.max(26, 56 / Math.sqrt(total)) * canonicalFlip
      : 0;

  if (edge.type === 'curved' || total > 1) {
    const curveBase = edge.type === 'curved' ? Math.min(48, len * 0.16) * (total > 1 ? 0 : 1) : 0;
    const offset = bundleOffset !== 0 ? bundleOffset : curveBase;
    const ctrl = {
      x: (src.x + dst.x) / 2 + nx * offset,
      y: (src.y + dst.y) / 2 + ny * offset,
    };
    const startPt = getShapeBoundaryPoint(src, ctrl.x, ctrl.y);
    const endPt = getShapeBoundaryPoint(dst, ctrl.x, ctrl.y);
    const points = sampleQuadraticBezier(startPt, ctrl, endPt, 24);
    const mid = points[Math.floor(points.length / 2)];
    const n = points.length;
    const startAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
    const endAngle = Math.atan2(points[n - 1].y - points[n - 2].y, points[n - 1].x - points[n - 2].x);
    return { points, labelPos: mid, startAngle, endAngle, isSelfLoop: false };
  }

  if (edge.type === 'elbow') {
    const corner =
      Math.abs(dx) >= Math.abs(dy) ? { x: dst.x, y: src.y } : { x: src.x, y: dst.y };
    const startPt = getShapeBoundaryPoint(src, corner.x, corner.y);
    const endPt = getShapeBoundaryPoint(dst, corner.x, corner.y);
    const points = [startPt, corner, endPt];
    const startAngle = Math.atan2(corner.y - startPt.y, corner.x - startPt.x);
    const endAngle = Math.atan2(endPt.y - corner.y, endPt.x - corner.x);
    return { points, labelPos: corner, startAngle, endAngle, isSelfLoop: false };
  }

  if (edge.type === 'orthogonal') {
    const horizontalMajor = Math.abs(dx) >= Math.abs(dy);
    const midX = (src.x + dst.x) / 2;
    const midY = (src.y + dst.y) / 2;
    const pA = horizontalMajor ? { x: midX, y: src.y } : { x: src.x, y: midY };
    const pB = horizontalMajor ? { x: midX, y: dst.y } : { x: dst.x, y: midY };
    const startPt = getShapeBoundaryPoint(src, pA.x, pA.y);
    const endPt = getShapeBoundaryPoint(dst, pB.x, pB.y);
    const points = [startPt, pA, pB, endPt];
    const labelPos = { x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2 };
    const startAngle = Math.atan2(pA.y - startPt.y, pA.x - startPt.x);
    const endAngle = Math.atan2(endPt.y - pB.y, endPt.x - pB.x);
    return { points, labelPos, startAngle, endAngle, isSelfLoop: false };
  }

  // Straight
  const startPt = getShapeBoundaryPoint(src, dst.x, dst.y);
  const endPt = getShapeBoundaryPoint(dst, src.x, src.y);
  const points = [startPt, endPt];
  const labelPos = { x: (startPt.x + endPt.x) / 2, y: (startPt.y + endPt.y) / 2 };
  const angle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);
  return { points, labelPos, startAngle: angle, endAngle: angle, isSelfLoop: false };
}

function sampleQuadraticBezier(p0: Point, p1: Point, p2: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return pts;
}

function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return pts;
}

export function distanceToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

export function hitTestEdge(
  wx: number,
  wy: number,
  geom: EdgeGeometry,
  edge: GraphEdge,
  tolerance: number
): boolean {
  for (let i = 0; i < geom.points.length - 1; i++) {
    if (distanceToSegment(wx, wy, geom.points[i], geom.points[i + 1]) <= tolerance) {
      return true;
    }
  }
  if (edge.label || edge.weight !== 1) {
    const dx = Math.abs(wx - geom.labelPos.x);
    const dy = Math.abs(wy - geom.labelPos.y);
    if (dx <= 44 && dy <= 16) return true;
  }
  return false;
}

export function hitTestNode(wx: number, wy: number, node: GraphNode): boolean {
  const hw = node.w / 2;
  const hh = node.h / 2;
  if (wx < node.x - hw || wx > node.x + hw || wy < node.y - hh || wy > node.y + hh) {
    return false;
  }
  if (node.shape === 'circle') {
    const nx = (wx - node.x) / hw;
    const ny = (wy - node.y) / hh;
    return nx * nx + ny * ny <= 1.05;
  }
  if (node.shape === 'diamond') {
    return Math.abs(wx - node.x) / hw + Math.abs(wy - node.y) / hh <= 1.05;
  }
  return true;
}

export function hitTestSticky(wx: number, wy: number, sticky: StickyNote): boolean {
  return (
    wx >= sticky.x - sticky.w / 2 &&
    wx <= sticky.x + sticky.w / 2 &&
    wy >= sticky.y - sticky.h / 2 &&
    wy <= sticky.y + sticky.h / 2
  );
}

/**
 * Mindmap collapsible tree computation:
 * Finds all downstream nodes hidden behind collapsed parent nodes,
 * and returns outgoing child counts for toggle badges.
 */
export function computeMindmapVisibility(nodes: GraphNode[], edges: GraphEdge[]) {
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    if (e.a === e.b) continue;
    const list = outgoing.get(e.a) ?? [];
    list.push(e.b);
    outgoing.set(e.a, list);
  }

  const childCounts = new Map<string, number>();
  for (const n of nodes) {
    const direct = outgoing.get(n.id) ?? [];
    if (direct.length > 0) {
      // Count total unique downstream nodes
      const seen = new Set<string>();
      const queue = [...direct];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (seen.has(cur) || cur === n.id) continue;
        seen.add(cur);
        for (const nxt of outgoing.get(cur) ?? []) {
          if (!seen.has(nxt)) queue.push(nxt);
        }
      }
      childCounts.set(n.id, seen.size);
    }
  }

  const hiddenNodes = new Set<string>();
  for (const n of nodes) {
    if (!n.collapsed) continue;
    const queue = [...(outgoing.get(n.id) ?? [])];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (hiddenNodes.has(cur) || cur === n.id) continue;
      hiddenNodes.add(cur);
      for (const nxt of outgoing.get(cur) ?? []) {
        if (!hiddenNodes.has(nxt)) queue.push(nxt);
      }
    }
  }

  return { hiddenNodes, childCounts };
}

/**
 * Text layout cache with auto-scaling and word wrapping inside safe shape bounds.
 */
interface CachedTextLayout {
  key: string;
  lines: string[];
  fontSize: number;
  lineHeight: number;
}

const textLayoutCache = new Map<string, CachedTextLayout>();

export function computeFittedTextLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxH: number,
  baseFontSize: number,
  fontWeight = '600'
): { lines: string[]; fontSize: number; lineHeight: number } {
  const key = `${text}|${Math.round(maxW)}|${Math.round(maxH)}|${baseFontSize}|${fontWeight}`;
  const cached = textLayoutCache.get(key);
  if (cached) return cached;

  let fs = Math.max(8, Math.min(22, baseFontSize));
  let bestLines: string[] = [text];
  let bestFs = fs;

  while (fs >= 8) {
    ctx.font = `${fontWeight} ${fs}px "Plus Jakarta Sans", sans-serif`;
    const wrapped = wrapTextLines(ctx, text || 'Node', Math.max(24, maxW));
    const lineHeight = fs * 1.24;
    const totalH = wrapped.length * lineHeight;
    const widest = wrapped.reduce((m, line) => Math.max(m, ctx.measureText(line).width), 0);

    if (totalH <= maxH && widest <= maxW + 2) {
      bestLines = wrapped;
      bestFs = fs;
      break;
    }
    bestLines = wrapped;
    bestFs = fs;
    fs -= 1;
  }

  // Clamp lines if still taller than maxH at minimum font size
  const lineHeight = bestFs * 1.24;
  const maxLines = Math.max(1, Math.floor(maxH / lineHeight));
  if (bestLines.length > maxLines) {
    bestLines = bestLines.slice(0, maxLines);
    const last = bestLines[maxLines - 1];
    bestLines[maxLines - 1] = last.length > 3 ? `${last.slice(0, Math.max(1, last.length - 1))}…` : last;
  }

  const result: CachedTextLayout = {
    key,
    lines: bestLines,
    fontSize: bestFs,
    lineHeight,
  };
  if (textLayoutCache.size > 1500) {
    textLayoutCache.clear();
  }
  textLayoutCache.set(key, result);
  return result;
}

export function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // Break overly long single tokens
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

export function getContrastTextColor(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  if (hex.length !== 6) return '#0f172a';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#0f172a' : '#f8fafc';
}

export const ALL_NODE_SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rounded', label: 'Rounded' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'star', label: 'Star' },
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'callout', label: 'Callout' },
  { value: 'parallelogram', label: 'Parallelogram' },
  { value: 'table', label: 'Data Table' },
  { value: 'progress_bar', label: 'Progress Card' },
  { value: 'text', label: 'Plain Text' },
];
