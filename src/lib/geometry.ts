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
  curveHandlePos?: Point;
  controlPoint?: Point;
  effectiveCurvature?: number;
}

export function stickyToProxyNode(s: StickyNote): GraphNode {
  return {
    id: s.id,
    pageId: s.pageId,
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    text: s.text,
    shape: 'rectangle',
    color: s.color,
    tags: s.tags ?? [],
    metadata: {},
    layer: s.layer,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export function buildEntityMap(nodes: GraphNode[], stickies: StickyNote[] = []): Map<string, GraphNode> {
  const map = new Map<string, GraphNode>();
  for (const n of nodes) map.set(n.id, n);
  for (const s of stickies) {
    if (!map.has(s.id)) {
      map.set(s.id, stickyToProxyNode(s));
    }
  }
  return map;
}

export function getShapeSafeTextBox(node: GraphNode): { maxW: number; maxH: number; offsetY: number } {
  const padW = Math.max(24, node.w - 22);
  const padH = Math.max(18, node.h - 16);
  switch (node.shape) {
    case 'circle':
      return { maxW: Math.max(24, node.w * 0.72), maxH: Math.max(18, node.h * 0.72), offsetY: 0 };
    case 'diamond':
      return { maxW: Math.max(24, node.w * 0.56), maxH: Math.max(18, node.h * 0.56), offsetY: 0 };
    case 'triangle':
      return { maxW: Math.max(24, node.w * 0.54), maxH: Math.max(18, node.h * 0.5), offsetY: node.h * 0.14 };
    case 'hexagon':
      return { maxW: Math.max(24, node.w * 0.68), maxH: Math.max(18, node.h * 0.76), offsetY: 0 };
    case 'star':
      return { maxW: Math.max(24, node.w * 0.44), maxH: Math.max(18, node.h * 0.44), offsetY: node.h * 0.04 };
    case 'text':
      return { maxW: Math.max(24, node.w - 8), maxH: Math.max(18, node.h - 4), offsetY: 0 };
    case 'callout':
      return { maxW: padW, maxH: Math.max(18, node.h * 0.54), offsetY: -node.h * 0.16 };
    case 'block_arrow':
      return { maxW: Math.max(24, node.w * 0.56), maxH: Math.max(18, node.h * 0.42), offsetY: 0 };
    case 'double_arrow':
      return { maxW: Math.max(24, node.w * 0.5), maxH: Math.max(18, node.h * 0.42), offsetY: 0 };
    case 'cylinder':
      return { maxW: padW, maxH: Math.max(18, node.h * 0.66), offsetY: node.h * 0.08 };
    case 'parallelogram':
      return { maxW: Math.max(24, node.w * 0.68), maxH: padH, offsetY: 0 };
    case 'cloud':
      return { maxW: Math.max(24, node.w * 0.66), maxH: Math.max(18, node.h * 0.54), offsetY: 0 };
    case 'prism':
      return { maxW: Math.max(24, node.w * 0.52), maxH: Math.max(18, node.h * 0.44), offsetY: node.h * 0.16 };
    case 'right_triangle':
    case 'incline':
      return { maxW: Math.max(24, node.w * 0.52), maxH: Math.max(18, node.h * 0.42), offsetY: node.h * 0.18 };
    case 'pyramid_3d':
    case 'cone_3d':
      return { maxW: Math.max(24, node.w * 0.55), maxH: Math.max(18, node.h * 0.44), offsetY: node.h * 0.14 };
    case 'sphere_3d':
    case 'meter_circle':
      return { maxW: Math.max(24, node.w * 0.72), maxH: Math.max(18, node.h * 0.72), offsetY: 0 };
    case 'axes_2d':
    case 'axes_3d':
    case 'parabola':
    case 'sine_graph':
    case 'bell_curve':
    case 'venn_3':
    case 'punnett_grid':
    case 'energy_profile':
    case 'scatter_plot':
    case 'bar_chart':
      return { maxW: padW, maxH: 24, offsetY: -node.h * 0.4 };
    case 'opamp':
      return { maxW: Math.max(24, node.w * 0.44), maxH: Math.max(18, node.h * 0.45), offsetY: 0 };
    case 'resistor':
    case 'capacitor':
    case 'inductor':
    case 'battery':
    case 'ground':
    case 'diode':
    case 'bulb':
    case 'switch_sym':
    case 'transistor':
    case 'xor_gate':
    case 'transformer':
    case 'fuse_sym':
    case 'potentiometer':
    case 'spring':
    case 'pulley':
    case 'lens':
    case 'concave_lens':
    case 'concave_mirror':
    case 'convex_mirror':
    case 'pendulum':
    case 'solenoid':
    case 'field_lines':
    case 'lever_fulcrum':
    case 'cart_wheels':
    case 'thermometer':
    case 'piston_cylinder':
    case 'projectile_arc':
    case 'ray_source':
    case 'wave':
    case 'number_line':
    case 'unit_circle':
    case 'ellipse_conic':
    case 'vector_arrow':
    case 'angle_arc':
    case 'pie_chart':
    case 'box_plot':
    case 'fraction_bar':
    case 'cell_animal':
    case 'cell_plant':
    case 'dna_helix':
    case 'mitochondria':
    case 'chloroplast':
    case 'neuron':
    case 'antibody':
    case 'virus_capsid':
    case 'leaf_organ':
    case 'ribosome':
    case 'golgi_body':
    case 'lipid_bilayer':
    case 'chromosome':
    case 'petri_dish':
    case 'microscope':
    case 'heart_chamber':
    case 'synapse_cleft':
    case 'beaker':
    case 'erlenmeyer_flask':
    case 'round_flask':
    case 'test_tube':
    case 'burette':
    case 'funnel_filter':
    case 'graduated_cylinder':
    case 'condenser_tube':
    case 'bunsen_burner':
    case 'benzene_ring':
    case 'cyclohexane_chair':
    case 'atom_bohr':
    case 'reaction_arrow':
    case 'bond_double':
    case 'bond_triple':
    case 'molecule_h2o':
    case 'tetrahedral_mol':
      return { maxW: Math.max(48, node.w + 24), maxH: 24, offsetY: node.h * 0.46 };
    default:
      return { maxW: padW, maxH: padH, offsetY: 0 };
  }
}

export function getShapeBoundaryPoint(node: GraphNode, fromX: number, fromY: number): Point {
  const cx = node.x;
  const cy = node.y;
  const hw = node.w / 2;
  const hh = node.h / 2;
  const dx = fromX - cx;
  const dy = fromY - cy;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return { x: cx, y: cy };
  const ux = dx / len;
  const uy = dy / len;

  switch (node.shape) {
    case 'circle':
    case 'meter_circle':
    case 'sphere_3d':
    case 'pie_chart':
    case 'cell_animal':
    case 'petri_dish':
    case 'unit_circle': {
      const denom = Math.hypot(ux / Math.max(1, hw), uy / Math.max(1, hh)) || 1;
      return { x: cx + ux / denom, y: cy + uy / denom };
    }
    case 'diamond': {
      const denom = (Math.abs(ux) / Math.max(1, hw) + Math.abs(uy) / Math.max(1, hh)) || 1;
      return { x: cx + ux / denom, y: cy + uy / denom };
    }
    case 'triangle':
    case 'prism':
    case 'pyramid_3d': {
      const poly: Point[] = [
        { x: cx, y: cy - hh },
        { x: cx + hw, y: cy + hh },
        { x: cx - hw, y: cy + hh },
      ];
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
    }
    case 'hexagon':
    case 'benzene_ring':
    case 'cyclohexane_chair':
    case 'cell_plant': {
      const inset = hw * 0.3;
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
    case 'star': {
      const poly = getStarPolygon(cx, cy, hw, hh);
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
    }
    case 'block_arrow': {
      const headLen = Math.min(hw * 0.72, node.h * 0.65);
      const shaftHh = hh * 0.44;
      const neckX = cx + hw - headLen;
      const poly: Point[] = [
        { x: cx - hw, y: cy - shaftHh },
        { x: neckX, y: cy - shaftHh },
        { x: neckX, y: cy - hh },
        { x: cx + hw, y: cy },
        { x: neckX, y: cy + hh },
        { x: neckX, y: cy + shaftHh },
        { x: cx - hw, y: cy + shaftHh },
      ];
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
    }
    case 'double_arrow': {
      const headLen = Math.min(hw * 0.46, node.h * 0.58);
      const shaftHh = hh * 0.42;
      const leftNeckX = cx - hw + headLen;
      const rightNeckX = cx + hw - headLen;
      const poly: Point[] = [
        { x: cx - hw, y: cy },
        { x: leftNeckX, y: cy - hh },
        { x: leftNeckX, y: cy - shaftHh },
        { x: rightNeckX, y: cy - shaftHh },
        { x: rightNeckX, y: cy - hh },
        { x: cx + hw, y: cy },
        { x: rightNeckX, y: cy + hh },
        { x: rightNeckX, y: cy + shaftHh },
        { x: leftNeckX, y: cy + shaftHh },
        { x: leftNeckX, y: cy + hh },
      ];
      return intersectRayPolygon(cx, cy, ux, uy, poly) ?? rectIntersect(cx, cy, hw, hh, ux, uy);
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

function intersectRayPolygon(cx: number, cy: number, ux: number, uy: number, poly: Point[]): Point | null {
  let bestT = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const sx = b.x - a.x;
    const sy = b.y - a.y;
    const denom = ux * sy - uy * sx;
    if (Math.abs(denom) < 1e-6) continue;
    const qpx = a.x - cx;
    const qpy = a.y - cy;
    const t = (qpx * sy - qpy * sx) / denom;
    const u = (qpx * uy - qpy * ux) / denom;
    if (t >= 0 && u >= -1e-4 && u <= 1 + 1e-4 && t < bestT) {
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
    const scale = i % 2 === 0 ? 1 : 0.46;
    pts.push({
      x: cx + Math.cos(angle) * rx * scale,
      y: cy + Math.sin(angle) * ry * scale,
    });
  }
  return pts;
}

export function computeParallelEdgeIndexMap(edges: GraphEdge[]): Map<string, { index: number; total: number }> {
  const groups = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    if (edge.a === edge.b) continue;
    const key = edge.a < edge.b ? `${edge.a}::${edge.b}` : `${edge.b}::${edge.a}`;
    const list = groups.get(key) ?? [];
    list.push(edge);
    groups.set(key, list);
  }
  const result = new Map<string, { index: number; total: number }>();
  for (const list of groups.values()) {
    const total = list.length;
    list.forEach((edge, index) => {
      result.set(edge.id, { index, total });
    });
  }
  return result;
}

/**
 * Computes signed edge curvature (control-point perpendicular offset in world px)
 * from a world drag point (wx, wy) so the curve passes through (wx, wy) at t = 0.5.
 */
export function computeEdgeCurvatureFromPoint(
  src: GraphNode,
  dst: GraphNode,
  wx: number,
  wy: number
): number {
  if (src.id === dst.id) {
    const dy = wy - src.y;
    const hh = src.h / 2;
    const dir = dy >= 0 ? -1 : 1; // negative curvature flips loop below node
    const distPastBoundary = Math.max(28, Math.min(260, Math.abs(dy) - hh + 12));
    return Math.round(dir * distPastBoundary);
  }
  const dx = dst.x - src.x;
  const dy = dst.y - src.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (src.x + dst.x) / 2;
  const my = (src.y + dst.y) / 2;
  const signedDist = (wx - mx) * nx + (wy - my) * ny;
  const raw = Math.round(signedDist * 2);
  if (Math.abs(raw) <= 6) return 0;
  return Math.max(-350, Math.min(350, raw));
}

export function computeEdgeGeometry(
  edge: GraphEdge,
  nodeMap: Map<string, GraphNode>,
  parallelInfo?: { index: number; total: number }
): EdgeGeometry | null {
  const src = nodeMap.get(edge.a);
  const dst = nodeMap.get(edge.b);
  if (!src || !dst) return null;

  const hasCustomCurvature =
    edge.curvature !== undefined &&
    edge.curvature !== null &&
    Number.isFinite(Number(edge.curvature));

  // Self-loop geometry
  if (src.id === dst.id) {
    const hh = src.h / 2;
    const hw = src.w / 2;
    const signed = hasCustomCurvature ? Number(edge.curvature) : 64;
    const dir = signed < 0 ? 1 : -1;
    const reach = Math.max(28, Math.min(260, Math.abs(signed) || 64));
    const spread = Math.max(36, reach * 0.65);
    const anchorY = dir < 0 ? src.y - hh : src.y + hh;
    const p0 = { x: src.x - Math.min(18, hw * 0.35), y: anchorY };
    const p1 = { x: src.x - spread, y: anchorY + dir * reach };
    const p2 = { x: src.x + spread, y: anchorY + dir * reach };
    const p3 = { x: src.x + Math.min(18, hw * 0.35), y: anchorY };
    const points = sampleCubicBezier(p0, p1, p2, p3, 24);
    const labelPos = points[Math.floor(points.length / 2)];
    const startAngle = Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
    const n = points.length;
    const endAngle = Math.atan2(points[n - 1].y - points[n - 2].y, points[n - 1].x - points[n - 2].x);
    return {
      points,
      labelPos,
      startAngle,
      endAngle,
      isSelfLoop: true,
      curveHandlePos: labelPos,
      effectiveCurvature: dir < 0 ? reach : -reach,
    };
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

  if (edge.type === 'curved' || (total > 1 && edge.type === 'straight')) {
    const defaultOffset =
      bundleOffset !== 0 ? bundleOffset : edge.type === 'curved' ? Math.min(48, len * 0.16) : 0;
    const offset = hasCustomCurvature
      ? Math.max(-350, Math.min(350, Number(edge.curvature)))
      : defaultOffset;
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
    return {
      points,
      labelPos: mid,
      startAngle,
      endAngle,
      isSelfLoop: false,
      curveHandlePos: mid,
      controlPoint: ctrl,
      effectiveCurvature: offset,
    };
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
  return {
    points,
    labelPos,
    startAngle: angle,
    endAngle: angle,
    isSelfLoop: false,
    curveHandlePos: labelPos,
    effectiveCurvature: 0,
  };
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
  if (
    node.shape === 'circle' ||
    node.shape === 'meter_circle' ||
    node.shape === 'sphere_3d' ||
    node.shape === 'pie_chart' ||
    node.shape === 'petri_dish'
  ) {
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
  fontWeight = '600',
  fontStyle: 'normal' | 'italic' = 'normal'
): { lines: string[]; fontSize: number; lineHeight: number } {
  const key = `${text}|${Math.round(maxW)}|${Math.round(maxH)}|${baseFontSize}|${fontWeight}|${fontStyle}`;
  const cached = textLayoutCache.get(key);
  if (cached) return cached;

  let fs = Math.max(8, Math.min(36, baseFontSize));
  let bestLines: string[] = [text];
  let bestFs = fs;
  const fontPrefix = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight}`;

  while (fs >= 8) {
    ctx.font = `${fontPrefix} ${fs}px "Plus Jakarta Sans", sans-serif`;
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
  { value: 'block_arrow', label: 'Arrow (Block)' },
  { value: 'double_arrow', label: 'Double Arrow' },
  { value: 'parallelogram', label: 'Parallelogram' },
  { value: 'table', label: 'Data Table' },
  { value: 'progress_bar', label: 'Progress Card' },
  { value: 'text', label: 'Plain Text' },
  { value: 'resistor', label: 'Resistor (Schematic)' },
  { value: 'capacitor', label: 'Capacitor (Schematic)' },
  { value: 'inductor', label: 'Inductor / Coil' },
  { value: 'battery', label: 'DC Source / Battery' },
  { value: 'ground', label: 'Ground (GND)' },
  { value: 'diode', label: 'Diode / LED' },
  { value: 'bulb', label: 'Lamp / Load' },
  { value: 'switch_sym', label: 'Switch' },
  { value: 'and_gate', label: 'AND Gate' },
  { value: 'or_gate', label: 'OR Gate' },
  { value: 'not_gate', label: 'NOT Gate (Inverter)' },
  { value: 'xor_gate', label: 'XOR Gate (Logic)' },
  { value: 'opamp', label: 'Op-Amp Amplifier' },
  { value: 'transistor', label: 'Transistor (BJT)' },
  { value: 'transformer', label: 'AC Transformer' },
  { value: 'fuse_sym', label: 'Fuse (Protection)' },
  { value: 'potentiometer', label: 'Potentiometer (Var R)' },
  { value: 'spring', label: 'Helical Spring (Physics)' },
  { value: 'pulley', label: 'Pulley (Physics)' },
  { value: 'incline', label: 'Inclined Plane / Wedge' },
  { value: 'lens', label: 'Convex Lens (Optics)' },
  { value: 'concave_lens', label: 'Concave Lens (Optics)' },
  { value: 'prism', label: 'Optical Prism (Physics)' },
  { value: 'concave_mirror', label: 'Concave Mirror (Optics)' },
  { value: 'convex_mirror', label: 'Convex Mirror (Optics)' },
  { value: 'ray_source', label: 'Laser / Ray Emitter' },
  { value: 'pendulum', label: 'Simple Pendulum (Physics)' },
  { value: 'magnet_bar', label: 'Bar Magnet N/S (Physics)' },
  { value: 'meter_circle', label: 'Meter V/A/Ω (Physics)' },
  { value: 'solenoid', label: 'Solenoid / Electromagnet' },
  { value: 'field_lines', label: 'Electric / Magnetic Field' },
  { value: 'lever_fulcrum', label: 'Lever & Fulcrum (Torque)' },
  { value: 'cart_wheels', label: 'Dynamics Cart (Momentum)' },
  { value: 'thermometer', label: 'Thermometer (Thermal)' },
  { value: 'piston_cylinder', label: 'Gas Piston Cylinder' },
  { value: 'projectile_arc', label: 'Projectile Trajectory' },
  { value: 'wave', label: 'Sine Wave (Physics)' },
  { value: 'axes_2d', label: '2D Coordinate Axes (Math)' },
  { value: 'axes_3d', label: '3D Isometric Axes (Math)' },
  { value: 'number_line', label: '1D Number Line (Math)' },
  { value: 'parabola', label: 'Parabola Curve (Math)' },
  { value: 'sine_graph', label: 'Sinusoidal Plot (Math)' },
  { value: 'unit_circle', label: 'Unit Circle Trig (Math)' },
  { value: 'ellipse_conic', label: 'Conic Ellipse & Foci' },
  { value: 'vector_arrow', label: 'Vector / Force Arrow' },
  { value: 'angle_arc', label: 'Angle Arc (Geometry)' },
  { value: 'right_triangle', label: 'Right Triangle (Trig)' },
  { value: 'venn_2', label: '2-Set Venn Diagram' },
  { value: 'venn_3', label: '3-Set Venn Diagram' },
  { value: 'bell_curve', label: 'Normal Bell Curve' },
  { value: 'pie_chart', label: 'Pie / Sector Chart' },
  { value: 'bar_chart', label: 'Bar Chart / Histogram' },
  { value: 'scatter_plot', label: 'Scatter Plot & Fit' },
  { value: 'box_plot', label: 'Box-and-Whisker Plot' },
  { value: 'fraction_bar', label: 'Fraction / Ratio Bar' },
  { value: 'cube_3d', label: '3D Prism / Cube' },
  { value: 'sphere_3d', label: '3D Sphere (Math)' },
  { value: 'cone_3d', label: '3D Cone' },
  { value: 'pyramid_3d', label: '3D Pyramid (Math)' },
  { value: 'matrix_box', label: 'Bracketed Matrix' },
  { value: 'cell_animal', label: 'Animal Cell (Biology)' },
  { value: 'cell_plant', label: 'Plant Cell (Biology)' },
  { value: 'dna_helix', label: 'DNA Double Helix (Biology)' },
  { value: 'mitochondria', label: 'Mitochondrion (Biology)' },
  { value: 'chloroplast', label: 'Chloroplast (Biology)' },
  { value: 'ribosome', label: 'Ribosome & mRNA (Biology)' },
  { value: 'golgi_body', label: 'Golgi Apparatus (Biology)' },
  { value: 'lipid_bilayer', label: 'Lipid Bilayer Membrane' },
  { value: 'chromosome', label: 'Chromosome X (Genetics)' },
  { value: 'neuron', label: 'Neuron / Nerve Cell (Biology)' },
  { value: 'synapse_cleft', label: 'Synaptic Cleft (Neuro)' },
  { value: 'antibody', label: 'Antibody IgG (Biology)' },
  { value: 'virus_capsid', label: 'Virus / Bacteriophage (Biology)' },
  { value: 'petri_dish', label: 'Petri Culture Dish (Micro)' },
  { value: 'microscope', label: 'Compound Microscope' },
  { value: 'heart_chamber', label: '4-Chamber Heart (Anatomy)' },
  { value: 'leaf_organ', label: 'Leaf Vascular Organ (Biology)' },
  { value: 'punnett_grid', label: 'Punnett Square 2×2 (Biology)' },
  { value: 'beaker', label: 'Lab Beaker (Chemistry)' },
  { value: 'erlenmeyer_flask', label: 'Erlenmeyer Flask (Chemistry)' },
  { value: 'round_flask', label: 'Round-Bottom Flask (Chemistry)' },
  { value: 'test_tube', label: 'Test Tube (Chemistry)' },
  { value: 'burette', label: 'Titration Burette (Chem)' },
  { value: 'funnel_filter', label: 'Filter Funnel (Chemistry)' },
  { value: 'graduated_cylinder', label: 'Graduated Cylinder (Chem)' },
  { value: 'condenser_tube', label: 'Liebig Condenser (Chem)' },
  { value: 'bunsen_burner', label: 'Bunsen Burner (Chemistry)' },
  { value: 'benzene_ring', label: 'Benzene Aromatic Ring (Chem)' },
  { value: 'cyclohexane_chair', label: 'Cyclohexane Chair (Org Chem)' },
  { value: 'atom_bohr', label: 'Bohr Atom Model (Chemistry)' },
  { value: 'reaction_arrow', label: 'Equilibrium Arrow ⇌ (Chem)' },
  { value: 'bond_double', label: 'Double Covalent Bond (Chem)' },
  { value: 'bond_triple', label: 'Triple Covalent Bond (Chem)' },
  { value: 'molecule_h2o', label: 'Molecular Geometry (Chemistry)' },
  { value: 'tetrahedral_mol', label: 'Tetrahedral sp³ Molecule' },
  { value: 'energy_profile', label: 'Activation Energy Curve' },
];
