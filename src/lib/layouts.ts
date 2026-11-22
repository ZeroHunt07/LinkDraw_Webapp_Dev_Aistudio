import type { GraphEdge, GraphNode } from '../types/linkdraw';

export type LayoutName = 'force' | 'hierarchical' | 'radial' | 'grid' | 'circular';

export function computeLayoutPositions(
  layout: LayoutName,
  nodes: GraphNode[],
  edges: GraphEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const n = nodes.length;
  if (n === 0) return positions;

  if (layout === 'grid') {
    const cols = Math.ceil(Math.sqrt(n));
    const stepX = 210;
    const stepY = 140;
    const rows = Math.ceil(n / cols);
    const offsetX = ((cols - 1) * stepX) / 2;
    const offsetY = ((rows - 1) * stepY) / 2;
    nodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(node.id, {
        x: node.locked ? node.x : col * stepX - offsetX,
        y: node.locked ? node.y : row * stepY - offsetY,
      });
    });
    return positions;
  }

  if (layout === 'circular') {
    const r = Math.max(160, n * 38);
    nodes.forEach((node, i) => {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2;
      positions.set(node.id, {
        x: node.locked ? node.x : Math.cos(theta) * r,
        y: node.locked ? node.y : Math.sin(theta) * r,
      });
    });
    return positions;
  }

  if (layout === 'hierarchical') {
    const out = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    nodes.forEach((node) => {
      out.set(node.id, []);
      inDeg.set(node.id, 0);
    });
    edges.forEach((e) => {
      if (e.a !== e.b) {
        out.get(e.a)?.push(e.b);
        inDeg.set(e.b, (inDeg.get(e.b) ?? 0) + 1);
      }
    });

    const roots = nodes.filter((nd) => (inDeg.get(nd.id) ?? 0) === 0).map((nd) => nd.id);
    if (roots.length === 0) roots.push(nodes[0].id);

    const level = new Map<string, number>();
    const queue = [...roots];
    roots.forEach((r) => level.set(r, 0));

    while (queue.length > 0) {
      const u = queue.shift()!;
      const lu = level.get(u) ?? 0;
      for (const v of out.get(u) ?? []) {
        if (!level.has(v)) {
          level.set(v, lu + 1);
          queue.push(v);
        }
      }
    }
    nodes.forEach((nd) => {
      if (!level.has(nd.id)) level.set(nd.id, 0);
    });

    const layers = new Map<number, GraphNode[]>();
    nodes.forEach((nd) => {
      const lv = level.get(nd.id) ?? 0;
      const arr = layers.get(lv) ?? [];
      arr.push(nd);
      layers.set(lv, arr);
    });

    const sortedLevels = [...layers.keys()].sort((a, b) => a - b);
    const totalH = (sortedLevels.length - 1) * 145;
    sortedLevels.forEach((lv, rowIdx) => {
      const rowNodes = layers.get(lv) ?? [];
      const rowW = (rowNodes.length - 1) * 205;
      rowNodes.forEach((nd, colIdx) => {
        positions.set(nd.id, {
          x: nd.locked ? nd.x : colIdx * 205 - rowW / 2,
          y: nd.locked ? nd.y : rowIdx * 145 - totalH / 2,
        });
      });
    });
    return positions;
  }

  if (layout === 'radial') {
    const deg = new Map<string, number>();
    const adj = new Map<string, string[]>();
    nodes.forEach((nd) => {
      deg.set(nd.id, 0);
      adj.set(nd.id, []);
    });
    edges.forEach((e) => {
      if (e.a !== e.b) {
        deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
        deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
        adj.get(e.a)?.push(e.b);
        adj.get(e.b)?.push(e.a);
      }
    });

    const root = [...nodes].sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0))[0];
    const depth = new Map<string, number>([[root.id, 0]]);
    const queue = [root.id];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const d = depth.get(u) ?? 0;
      for (const v of adj.get(u) ?? []) {
        if (!depth.has(v)) {
          depth.set(v, d + 1);
          queue.push(v);
        }
      }
    }
    nodes.forEach((nd) => {
      if (!depth.has(nd.id)) depth.set(nd.id, 1);
    });

    const rings = new Map<number, GraphNode[]>();
    nodes.forEach((nd) => {
      const d = depth.get(nd.id) ?? 0;
      const arr = rings.get(d) ?? [];
      arr.push(nd);
      rings.set(d, arr);
    });

    for (const [d, ringNodes] of rings.entries()) {
      if (d === 0 && ringNodes.length === 1) {
        const nd = ringNodes[0];
        positions.set(nd.id, { x: nd.locked ? nd.x : 0, y: nd.locked ? nd.y : 0 });
        continue;
      }
      const radius = d * 185;
      ringNodes.forEach((nd, i) => {
        const angle = (2 * Math.PI * i) / ringNodes.length - Math.PI / 2;
        positions.set(nd.id, {
          x: nd.locked ? nd.x : Math.cos(angle) * radius,
          y: nd.locked ? nd.y : Math.sin(angle) * radius,
        });
      });
    }
    return positions;
  }

  // Fruchterman-Reingold Force-Directed Layout
  const area = Math.max(900 * 700, n * 58000);
  const k = Math.sqrt(area / n);
  const pos = nodes.map((nd, i) => ({
    id: nd.id,
    locked: Boolean(nd.locked),
    x: nd.x || Math.cos((2 * Math.PI * i) / n) * 180,
    y: nd.y || Math.sin((2 * Math.PI * i) / n) * 180,
  }));
  const idxMap = new Map(pos.map((p, i) => [p.id, i]));
  let temp = 180;

  for (let iter = 0; iter < 90; iter++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    // Repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1) {
          dx = (i % 2 === 0 ? 1 : -1) * 2;
          dy = (j % 2 === 0 ? 1 : -1) * 2;
          dist = Math.hypot(dx, dy);
        }
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        disp[i].x += fx;
        disp[i].y += fy;
        disp[j].x -= fx;
        disp[j].y -= fy;
      }
    }

    // Attraction
    for (const e of edges) {
      const i = idxMap.get(e.a);
      const j = idxMap.get(e.b);
      if (i === undefined || j === undefined || i === j) continue;
      const dx = pos[i].x - pos[j].x;
      const dy = pos[i].y - pos[j].y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      disp[i].x -= fx;
      disp[i].y -= fy;
      disp[j].x += fx;
      disp[j].y += fy;
    }

    // Center gravity + apply
    for (let i = 0; i < n; i++) {
      if (pos[i].locked) continue;
      disp[i].x -= pos[i].x * 0.04;
      disp[i].y -= pos[i].y * 0.04;
      const dLen = Math.max(1, Math.hypot(disp[i].x, disp[i].y));
      const step = Math.min(dLen, temp);
      pos[i].x += (disp[i].x / dLen) * step;
      pos[i].y += (disp[i].y / dLen) * step;
    }
    temp *= 0.95;
  }

  pos.forEach((p) => positions.set(p.id, { x: p.x, y: p.y }));
  return positions;
}
