import type { GraphEdge, GraphNode } from '../types/linkdraw';

export interface GraphTelemetry {
  nodeCount: number;
  edgeCount: number;
  density: number;
  clusters: number;
  avgDegree: number;
  topHub: { id: string; label: string; degree: number } | null;
  cycleCount: number;
}

export interface AdjacencyMatrixData {
  nodes: GraphNode[];
  counts: number[][];
  weights: number[][];
  edgeLists: GraphEdge[][][];
  rowSums: number[];
  colSums: number[];
  density: number;
  sparsity: number;
  reciprocity: number;
  totalWeight: number;
  avgWeightedDegree: number;
  selfLoops: number;
}

export interface TimelineEntry {
  id: string;
  kind: 'node' | 'edge';
  title: string;
  subtitle: string;
  timestamp: number;
  source: 'createdAt' | 'updatedAt' | 'metadata';
  tags: string[];
  targetId: string;
}

export const CLUSTER_COLORS = [
  '#dbeafe',
  '#dcfce7',
  '#fef3c7',
  '#fce7f3',
  '#e0e7ff',
  '#ffedd5',
  '#cffafe',
  '#ede9fe',
];

function buildAdj(nodes: GraphNode[], edges: GraphEdge[], directed: boolean) {
  const adj = new Map<string, { to: string; edge: GraphEdge; weight: number }[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    const w = Math.max(0.01, Number(e.weight) || 1);
    adj.get(e.a)?.push({ to: e.b, edge: e, weight: w });
    if (!directed && e.a !== e.b) {
      adj.get(e.b)?.push({ to: e.a, edge: e, weight: w });
    }
  }
  return adj;
}

export function computeGraphTelemetry(nodes: GraphNode[], edges: GraphEdge[]): GraphTelemetry {
  const n = nodes.length;
  const m = edges.length;
  if (n === 0) {
    return {
      nodeCount: 0,
      edgeCount: 0,
      density: 0,
      clusters: 0,
      avgDegree: 0,
      topHub: null,
      cycleCount: 0,
    };
  }
  const maxEdges = n > 1 ? n * (n - 1) : 1;
  const density = n > 1 ? Math.min(1, m / maxEdges) : 0;

  const deg = new Map<string, number>();
  for (const node of nodes) deg.set(node.id, 0);
  for (const e of edges) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    if (e.a !== e.b) deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }

  let topHub: GraphTelemetry['topHub'] = null;
  let degSum = 0;
  for (const node of nodes) {
    const d = deg.get(node.id) ?? 0;
    degSum += d;
    if (!topHub || d > topHub.degree) {
      topHub = { id: node.id, label: node.text || node.id, degree: d };
    }
  }

  const comps = findConnectedComponents(nodes, edges);
  const cycles = detectCycles(nodes, edges);

  return {
    nodeCount: n,
    edgeCount: m,
    density,
    clusters: comps.components.length,
    avgDegree: degSum / n,
    topHub,
    cycleCount: cycles.cycles.length,
  };
}

export function solveDijkstra(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId: string,
  directed = false
): { nodePath: string[]; edgePath: string[]; totalCost: number } | null {
  const adj = buildAdj(nodes, edges, directed);
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edgeId: string } | null>();
  const visited = new Set<string>();

  for (const n of nodes) {
    dist.set(n.id, Infinity);
    prev.set(n.id, null);
  }
  dist.set(sourceId, 0);

  while (visited.size < nodes.length) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist.entries()) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (!u || best === Infinity) break;
    if (u === targetId) break;
    visited.add(u);

    for (const nbr of adj.get(u) ?? []) {
      const alt = best + nbr.weight;
      if (alt < (dist.get(nbr.to) ?? Infinity)) {
        dist.set(nbr.to, alt);
        prev.set(nbr.to, { node: u, edgeId: nbr.edge.id });
      }
    }
  }

  const totalCost = dist.get(targetId) ?? Infinity;
  if (!Number.isFinite(totalCost)) return null;

  const nodePath: string[] = [];
  const edgePath: string[] = [];
  let cur: string | undefined = targetId;
  while (cur) {
    nodePath.unshift(cur);
    const p = prev.get(cur);
    if (!p) break;
    edgePath.unshift(p.edgeId);
    cur = p.node;
  }
  return { nodePath, edgePath, totalCost };
}

export function solveBFS(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId?: string
): { visitedOrder: string[]; edgeIds: string[]; pathToTarget: string[] | null } {
  const adj = buildAdj(nodes, edges, false);
  const visited = new Set<string>([sourceId]);
  const parent = new Map<string, string | null>([[sourceId, null]]);
  const queue = [sourceId];
  const visitedOrder: string[] = [];
  const edgeIds: string[] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    visitedOrder.push(u);
    if (targetId && u === targetId) break;

    for (const nbr of adj.get(u) ?? []) {
      if (!visited.has(nbr.to)) {
        visited.add(nbr.to);
        parent.set(nbr.to, u);
        edgeIds.push(nbr.edge.id);
        queue.push(nbr.to);
      }
    }
  }

  let pathToTarget: string[] | null = null;
  if (targetId && parent.has(targetId)) {
    pathToTarget = [];
    let cur: string | null | undefined = targetId;
    while (cur) {
      pathToTarget.unshift(cur);
      cur = parent.get(cur) ?? null;
    }
  }
  return { visitedOrder, edgeIds, pathToTarget };
}

export function solveDFS(
  nodes: GraphNode[],
  edges: GraphEdge[],
  sourceId: string,
  targetId?: string
): { visitedOrder: string[]; edgeIds: string[] } {
  const adj = buildAdj(nodes, edges, false);
  const visited = new Set<string>();
  const visitedOrder: string[] = [];
  const edgeIds: string[] = [];
  let foundTarget = false;

  function dfs(u: string) {
    if (foundTarget) return;
    visited.add(u);
    visitedOrder.push(u);
    if (targetId && u === targetId) {
      foundTarget = true;
      return;
    }
    for (const nbr of adj.get(u) ?? []) {
      if (!visited.has(nbr.to) && !foundTarget) {
        edgeIds.push(nbr.edge.id);
        dfs(nbr.to);
      }
    }
  }

  dfs(sourceId);
  return { visitedOrder, edgeIds };
}

export function solveKruskalMST(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { mstEdges: GraphEdge[]; totalWeight: number } {
  const parent = new Map<string, string>();
  for (const n of nodes) parent.set(n.id, n.id);

  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    if (p !== x) {
      p = find(p);
      parent.set(x, p);
    }
    return p;
  };

  const sorted = [...edges]
    .filter((e) => e.a !== e.b)
    .sort((e1, e2) => (Number(e1.weight) || 1) - (Number(e2.weight) || 1));

  const mstEdges: GraphEdge[] = [];
  let totalWeight = 0;

  for (const e of sorted) {
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) {
      parent.set(ra, rb);
      mstEdges.push(e);
      totalWeight += Number(e.weight) || 1;
    }
  }
  return { mstEdges, totalWeight };
}

export function solveTopologicalSort(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { order: string[]; ranks: Map<string, number>; hasCycle: boolean } {
  const inDeg = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const n of nodes) {
    inDeg.set(n.id, 0);
    out.set(n.id, []);
  }
  for (const e of edges) {
    if (e.a === e.b) continue;
    out.get(e.a)?.push(e.b);
    inDeg.set(e.b, (inDeg.get(e.b) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, d] of inDeg.entries()) {
    if (d === 0) queue.push(id);
  }

  const order: string[] = [];
  const ranks = new Map<string, number>();

  while (queue.length > 0) {
    const u = queue.shift()!;
    order.push(u);
    ranks.set(u, order.length);
    for (const v of out.get(u) ?? []) {
      const nextDeg = (inDeg.get(v) ?? 0) - 1;
      inDeg.set(v, nextDeg);
      if (nextDeg === 0) queue.push(v);
    }
  }

  return { order, ranks, hasCycle: order.length < nodes.length };
}

export function detectCycles(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { cycles: string[][]; cycleNodeIds: Set<string>; cycleEdgeIds: Set<string> } {
  const adj = buildAdj(nodes, edges, true);
  const state = new Map<string, number>(); // 0 unvisited, 1 visiting, 2 done
  const stack: string[] = [];
  const edgeStack: string[] = [];
  const cycles: string[][] = [];
  const cycleNodeIds = new Set<string>();
  const cycleEdgeIds = new Set<string>();

  function dfs(u: string) {
    state.set(u, 1);
    stack.push(u);
    for (const nbr of adj.get(u) ?? []) {
      const vState = state.get(nbr.to) ?? 0;
      if (vState === 1) {
        const idx = stack.indexOf(nbr.to);
        if (idx !== -1) {
          const cyc = stack.slice(idx);
          cycles.push(cyc);
          cyc.forEach((id) => cycleNodeIds.add(id));
          edgeStack.slice(idx).forEach((eid) => cycleEdgeIds.add(eid));
          cycleEdgeIds.add(nbr.edge.id);
        }
      } else if (vState === 0) {
        edgeStack.push(nbr.edge.id);
        dfs(nbr.to);
        edgeStack.pop();
      }
    }
    stack.pop();
    state.set(u, 2);
  }

  for (const n of nodes) {
    if ((state.get(n.id) ?? 0) === 0) dfs(n.id);
  }

  return { cycles, cycleNodeIds, cycleEdgeIds };
}

export function findConnectedComponents(
  nodes: GraphNode[],
  edges: GraphEdge[]
): { components: string[][]; nodeClusterMap: Map<string, number> } {
  const adj = buildAdj(nodes, edges, false);
  const visited = new Set<string>();
  const components: string[][] = [];
  const nodeClusterMap = new Map<string, number>();

  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    const comp: string[] = [];
    const queue = [n.id];
    visited.add(n.id);
    while (queue.length > 0) {
      const u = queue.shift()!;
      comp.push(u);
      nodeClusterMap.set(u, components.length);
      for (const nbr of adj.get(u) ?? []) {
        if (!visited.has(nbr.to)) {
          visited.add(nbr.to);
          queue.push(nbr.to);
        }
      }
    }
    components.push(comp);
  }

  return { components, nodeClusterMap };
}

export function computeCentrality(
  nodes: GraphNode[],
  edges: GraphEdge[]
): {
  id: string;
  label: string;
  pageRank: number;
  betweenness: number;
  degree: number;
}[] {
  const n = nodes.length;
  if (n === 0) return [];

  const out = new Map<string, string[]>();
  const undirected = new Map<string, Set<string>>();
  for (const node of nodes) {
    out.set(node.id, []);
    undirected.set(node.id, new Set());
  }
  for (const e of edges) {
    if (e.a !== e.b) {
      out.get(e.a)?.push(e.b);
      undirected.get(e.a)?.add(e.b);
      undirected.get(e.b)?.add(e.a);
    }
  }

  // PageRank (25 iterations, d=0.85)
  let pr = new Map<string, number>();
  for (const node of nodes) pr.set(node.id, 1 / n);
  const d = 0.85;
  for (let iter = 0; iter < 25; iter++) {
    const next = new Map<string, number>();
    let sinkSum = 0;
    for (const node of nodes) {
      if ((out.get(node.id)?.length ?? 0) === 0) {
        sinkSum += pr.get(node.id) ?? 0;
      }
      next.set(node.id, (1 - d) / n);
    }
    for (const node of nodes) {
      const nbrs = out.get(node.id) ?? [];
      if (nbrs.length > 0) {
        const share = (d * (pr.get(node.id) ?? 0)) / nbrs.length;
        for (const v of nbrs) {
          next.set(v, (next.get(v) ?? 0) + share);
        }
      }
    }
    const sinkShare = (d * sinkSum) / n;
    for (const node of nodes) {
      next.set(node.id, (next.get(node.id) ?? 0) + sinkShare);
    }
    pr = next;
  }

  // Brandes Betweenness Centrality
  const bet = new Map<string, number>();
  for (const node of nodes) bet.set(node.id, 0);

  for (const s of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    for (const v of nodes) {
      pred.set(v.id, []);
      sigma.set(v.id, 0);
      dist.set(v.id, -1);
    }
    sigma.set(s.id, 1);
    dist.set(s.id, 0);
    const queue = [s.id];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of undirected.get(v) ?? []) {
        if ((dist.get(w) ?? -1) < 0) {
          queue.push(w);
          dist.set(w, (dist.get(v) ?? 0) + 1);
        }
        if (dist.get(w) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          pred.get(w)?.push(v);
        }
      }
    }

    const delta = new Map<string, number>();
    for (const v of nodes) delta.set(v.id, 0);
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        const c = ((sigma.get(v) ?? 0) / Math.max(1, sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + c);
      }
      if (w !== s.id) {
        bet.set(w, (bet.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  const norm = n > 2 ? (n - 1) * (n - 2) : 1;
  return nodes
    .map((node) => ({
      id: node.id,
      label: node.text || node.id,
      pageRank: pr.get(node.id) ?? 0,
      betweenness: (bet.get(node.id) ?? 0) / norm,
      degree: undirected.get(node.id)?.size ?? 0,
    }))
    .sort((a, b) => b.pageRank - a.pageRank);
}

export function buildAdjacencyMatrix(
  nodes: GraphNode[],
  edges: GraphEdge[],
  directed: boolean
): AdjacencyMatrixData {
  const n = nodes.length;
  const idxMap = new Map<string, number>();
  nodes.forEach((node, i) => idxMap.set(node.id, i));

  const counts = Array.from({ length: n }, () => Array(n).fill(0));
  const weights = Array.from({ length: n }, () => Array(n).fill(0));
  const edgeLists: GraphEdge[][][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => [])
  );

  let selfLoops = 0;
  let totalWeight = 0;

  for (const e of edges) {
    const i = idxMap.get(e.a);
    const j = idxMap.get(e.b);
    if (i === undefined || j === undefined) continue;
    const w = Number(e.weight) || 1;
    totalWeight += w;
    if (i === j) selfLoops += 1;

    counts[i][j] += 1;
    weights[i][j] += w;
    edgeLists[i][j].push(e);

    if (!directed && i !== j) {
      counts[j][i] += 1;
      weights[j][i] += w;
      edgeLists[j][i].push(e);
    }
  }

  const rowSums = counts.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = Array.from({ length: n }, (_, j) =>
    counts.reduce((acc, row) => acc + row[j], 0)
  );

  let nonZeroPairs = 0;
  let reciprocalPairs = 0;
  let directedPairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && counts[i][j] > 0) {
        nonZeroPairs++;
        directedPairs++;
        if (counts[j][i] > 0) reciprocalPairs++;
      }
    }
  }

  const possiblePairs = n > 1 ? n * (n - 1) : 1;
  const density = n > 1 ? nonZeroPairs / possiblePairs : 0;
  const sparsity = 1 - density;
  const reciprocity = directedPairs > 0 ? reciprocalPairs / directedPairs : 0;
  const avgWeightedDegree = n > 0 ? (directed ? totalWeight : totalWeight * 2) / n : 0;

  return {
    nodes,
    counts,
    weights,
    edgeLists,
    rowSums,
    colSums,
    density,
    sparsity,
    reciprocity,
    totalWeight,
    avgWeightedDegree,
    selfLoops,
  };
}

export function buildGraphTimeline(nodes: GraphNode[], edges: GraphEdge[]): TimelineEntry[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const entries: TimelineEntry[] = [];

  for (const n of nodes) {
    const metaTs = n.metadata?.timestamp ? Date.parse(n.metadata.timestamp) : NaN;
    const ts = !Number.isNaN(metaTs) ? metaTs : n.updatedAt || n.createdAt || Date.now();
    const source: TimelineEntry['source'] = !Number.isNaN(metaTs)
      ? 'metadata'
      : n.updatedAt
      ? 'updatedAt'
      : 'createdAt';
    entries.push({
      id: `tl_n_${n.id}`,
      kind: 'node',
      title: n.text || n.id,
      subtitle: `${n.shape} · ${n.tags.length > 0 ? n.tags.join(', ') : 'No tags'}`,
      timestamp: ts,
      source,
      tags: n.tags,
      targetId: n.id,
    });
  }

  for (const e of edges) {
    const srcName = nodeMap.get(e.a)?.text || e.a;
    const dstName = nodeMap.get(e.b)?.text || e.b;
    const ts = e.updatedAt || e.createdAt || Date.now();
    entries.push({
      id: `tl_e_${e.id}`,
      kind: 'edge',
      title: `${srcName} → ${dstName}`,
      subtitle: `${e.label || 'Connection'} · w=${e.weight}`,
      timestamp: ts,
      source: e.updatedAt ? 'updatedAt' : 'createdAt',
      tags: e.label ? [e.label] : [],
      targetId: e.id,
    });
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}
