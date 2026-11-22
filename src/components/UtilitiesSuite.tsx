import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock,
  Copy,
  Download,
  GitBranch,
  Grid,
  LogOut,
  Network,
  Play,
  Radar,
  ScanSearch,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  ThemeMode,
  UtilitySubTab,
} from '../types/linkdraw';
import {
  buildAdjacencyMatrix,
  buildGraphTimeline,
  CLUSTER_COLORS,
  computeCentrality,
  computeGraphTelemetry,
  detectCycles,
  findConnectedComponents,
  solveBFS,
  solveDFS,
  solveDijkstra,
  solveKruskalMST,
  solveTopologicalSort,
} from '../lib/algorithms';
import { computeLayoutPositions, type LayoutName } from '../lib/layouts';
import {
  ENTITY_STYLES,
  extractOsintEntities,
  resolveDomainToIpLive,
  runOsintEnrichment,
  scanGraphForEntities,
  type OsintEntity,
} from '../lib/osint';
import { DEFAULT_SHEET_CELLS, evaluateSheetCell, type SheetGrid } from '../lib/formulaEngine';
import {
  exportCSVBundle,
  exportGraphML,
  exportGraphvizDOT,
  exportLinkDrawJSON,
  exportSVG,
  triggerFileDownload,
} from '../lib/exportEngine';
import { makeSafeId } from '../lib/firestoreSync';
import { firebaseProjectId, firestoreDatabaseId } from '../lib/firebase';

interface UtilitiesSuiteProps {
  activeSubTab: UtilitySubTab;
  onSubTabChange: (tab: UtilitySubTab) => void;
  boardTitle: string;
  graph: GraphDocument;
  theme: ThemeMode;
  userId: string;
  userEmail: string;
  userName: string;
  onChangeTheme: (t: ThemeMode) => void;
  onUpdateGraph: (next: GraphDocument, recordUndo?: boolean) => void;
  onHighlightElements: (nodeIds: string[], edgeIds: string[]) => void;
  onFocusNodeOrEdge: (targetId: string, kind: 'node' | 'edge') => void;
  onSignOut: () => void;
  onNotify: (msg: string) => void;
}

export const UtilitiesSuite: React.FC<UtilitiesSuiteProps> = ({
  activeSubTab,
  onSubTabChange,
  boardTitle,
  graph,
  theme,
  userId,
  userEmail,
  userName,
  onChangeTheme,
  onUpdateGraph,
  onHighlightElements,
  onFocusNodeOrEdge,
  onSignOut,
  onNotify,
}) => {
  // Solver Source/Target state preserved across node drags
  const [sourceNodeId, setSourceNodeId] = useState<string>('');
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [solverSummary, setSolverSummary] = useState<string>('');
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);

  // OSINT state
  const [osintInput, setOsintInput] = useState('');
  const [osintEntities, setOsintEntities] = useState<OsintEntity[]>([]);
  const [enriching, setEnriching] = useState(false);

  // Formula Sheet state
  const [sheetGrid, setSheetGrid] = useState<SheetGrid>(() => ({ ...DEFAULT_SHEET_CELLS }));
  const [selectedCell, setSelectedCell] = useState<string>('B2');

  useEffect(() => {
    if (graph.nodes.length > 0) {
      if (!sourceNodeId || !graph.nodes.some((n) => n.id === sourceNodeId)) {
        setSourceNodeId(graph.nodes[0].id);
      }
      if (!targetNodeId || !graph.nodes.some((n) => n.id === targetNodeId)) {
        setTargetNodeId(graph.nodes[Math.min(1, graph.nodes.length - 1)].id);
      }
    }
  }, [graph.nodes, sourceNodeId, targetNodeId]);

  const telemetry = useMemo(
    () => computeGraphTelemetry(graph.nodes, graph.edges),
    [graph.nodes, graph.edges]
  );

  const centralityList = useMemo(
    () => computeCentrality(graph.nodes, graph.edges),
    [graph.nodes, graph.edges]
  );

  // Apply automated layout cleanly (single atomic commit)
  const applyLayout = (layoutName: LayoutName) => {
    if (graph.nodes.length === 0) return;
    const targets = computeLayoutPositions(layoutName, graph.nodes, graph.edges);
    const now = Date.now();
    const nextNodes = graph.nodes.map((n) => {
      const dst = targets.get(n.id);
      if (!dst) return n;
      return {
        ...n,
        x: Math.round(dst.x * 10) / 10,
        y: Math.round(dst.y * 10) / 10,
        updatedAt: now,
      };
    });
    onUpdateGraph({ ...graph, nodes: nextNodes }, true);
    onNotify(`Applied ${layoutName} layout.`);
  };

  // Graph Solvers
  const runDijkstra = () => {
    if (!sourceNodeId || !targetNodeId) return;
    const res = solveDijkstra(graph.nodes, graph.edges, sourceNodeId, targetNodeId, false);
    if (!res) {
      setSolverSummary('No path found between selected nodes.');
      onHighlightElements([], []);
      return;
    }
    onHighlightElements(res.nodePath, res.edgePath);
    setSolverSummary(
      `Dijkstra Shortest Path: ${res.nodePath.length} hops, total weight ${res.totalCost.toFixed(2)}.`
    );
  };

  const runBFS = () => {
    if (!sourceNodeId) return;
    const res = solveBFS(graph.nodes, graph.edges, sourceNodeId, targetNodeId || undefined);
    onHighlightElements(res.pathToTarget ?? res.visitedOrder, res.edgeIds);
    setSolverSummary(`BFS visited ${res.visitedOrder.length} nodes.`);
  };

  const runDFS = () => {
    if (!sourceNodeId) return;
    const res = solveDFS(graph.nodes, graph.edges, sourceNodeId, targetNodeId || undefined);
    onHighlightElements(res.visitedOrder, res.edgeIds);
    setSolverSummary(`DFS visited ${res.visitedOrder.length} nodes.`);
  };

  const runMST = () => {
    const res = solveKruskalMST(graph.nodes, graph.edges);
    const nodeIds = new Set<string>();
    res.mstEdges.forEach((e) => {
      nodeIds.add(e.a);
      nodeIds.add(e.b);
    });
    onHighlightElements([...nodeIds], res.mstEdges.map((e) => e.id));
    setSolverSummary(
      `Kruskal MST: ${res.mstEdges.length} edges, total weight ${res.totalWeight.toFixed(2)}.`
    );
  };

  const runTopoSort = () => {
    const res = solveTopologicalSort(graph.nodes, graph.edges);
    const nextNodes = graph.nodes.map((n) => {
      const rank = res.ranks.get(n.id);
      return { ...n, badge: rank ? String(rank) : null };
    });
    onUpdateGraph({ ...graph, nodes: nextNodes }, true);
    onHighlightElements(res.order, []);
    setSolverSummary(
      res.hasCycle
        ? `Partial topological order (${res.order.length}/${graph.nodes.length}); graph contains cycles.`
        : `Topological order assigned rank badges 1..${res.order.length}.`
    );
  };

  const runCycles = () => {
    const res = detectCycles(graph.nodes, graph.edges);
    onHighlightElements([...res.cycleNodeIds], [...res.cycleEdgeIds]);
    setSolverSummary(
      res.cycles.length > 0
        ? `Detected ${res.cycles.length} directed cycle(s) involving ${res.cycleNodeIds.size} nodes.`
        : 'No directed cycles detected (DAG).'
    );
  };

  const runComponents = () => {
    const res = findConnectedComponents(graph.nodes, graph.edges);
    const nextNodes = graph.nodes.map((n) => {
      const cIdx = res.nodeClusterMap.get(n.id) ?? 0;
      return { ...n, color: CLUSTER_COLORS[cIdx % CLUSTER_COLORS.length] };
    });
    onUpdateGraph({ ...graph, nodes: nextNodes }, true);
    setSolverSummary(`Colored ${res.components.length} connected component cluster(s).`);
  };

  const autoSizeByCentrality = () => {
    if (centralityList.length === 0) return;
    const maxPr = Math.max(...centralityList.map((c) => c.pageRank), 0.001);
    const prMap = new Map(centralityList.map((c) => [c.id, c.pageRank / maxPr]));
    const nextNodes = graph.nodes.map((n) => {
      const norm = prMap.get(n.id) ?? 0.2;
      return {
        ...n,
        w: Math.round(126 + norm * 110),
        h: Math.round(52 + norm * 38),
        updatedAt: Date.now(),
      };
    });
    onUpdateGraph({ ...graph, nodes: nextNodes }, true);
    onNotify('Auto-sized nodes proportionally to PageRank centrality.');
  };

  // OSINT Handlers
  const handleExtractFromText = () => {
    const extracted = extractOsintEntities(osintInput);
    setOsintEntities(extracted);
    onNotify(`Extracted ${extracted.length} OSINT indicator(s).`);
  };

  const handleScanGraph = () => {
    const extracted = scanGraphForEntities(graph.nodes);
    setOsintEntities(extracted);
    onNotify(`Scanned graph: found ${extracted.length} indicator(s).`);
  };

  const handleEnrichEntity = async (entity: OsintEntity) => {
    setEnriching(true);
    try {
      const tr = runOsintEnrichment(entity);
      let extra: OsintEntity[] = [];
      if (entity.type === 'domain') {
        const ips = await resolveDomainToIpLive(entity.value);
        extra = ips.map((ip, i) => ({
          id: `dns_${Date.now()}_${i}`,
          type: 'ipv4',
          value: ip,
          sourceNodeId: entity.sourceNodeId,
        }));
      }
      const merged = [...osintEntities];
      for (const item of [...tr.derivedEntities, ...extra]) {
        if (!merged.some((m) => m.type === item.type && m.value === item.value)) {
          merged.push(item);
        }
      }
      setOsintEntities(merged);
      onNotify(`Enriched ${entity.value}: +${tr.derivedEntities.length + extra.length} entities.`);
    } finally {
      setEnriching(false);
    }
  };

  const spawnEntitiesToCanvas = () => {
    if (osintEntities.length === 0) return;
    const now = Date.now();
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    const existingByText = new Map(graph.nodes.map((n) => [n.text.toLowerCase(), n]));

    osintEntities.forEach((ent, idx) => {
      const existing = existingByText.get(ent.value.toLowerCase());
      if (existing) {
        if (ent.sourceNodeId && ent.sourceNodeId !== existing.id) {
          newEdges.push({
            id: makeSafeId('oe'),
            a: ent.sourceNodeId,
            b: existing.id,
            label: ent.type.toUpperCase(),
            color: '#475569',
            width: 1.8,
            arrow: 'forward',
            type: 'curved',
            lineStyle: 'solid',
            weight: 1,
            layer: 'Data',
            createdAt: now,
            updatedAt: now,
          });
        }
        return;
      }

      const style = ENTITY_STYLES[ent.type];
      const angle = (2 * Math.PI * idx) / Math.max(1, osintEntities.length);
      const radius = 190 + (idx % 3) * 45;
      const srcNode = ent.sourceNodeId ? graph.nodes.find((n) => n.id === ent.sourceNodeId) : null;
      const cx = srcNode?.x ?? 0;
      const cy = srcNode?.y ?? 0;
      const nid = makeSafeId('os');
      newNodes.push({
        id: nid,
        x: Math.round(cx + Math.cos(angle) * radius),
        y: Math.round(cy + Math.sin(angle) * radius),
        w: Math.max(156, Math.min(240, ent.value.length * 8 + 48)),
        h: 58,
        text: ent.value,
        shape: style.shape,
        color: style.color,
        icon: style.icon,
        iconPosition: 'left',
        tags: ['osint', ent.type],
        metadata: { indicator_type: style.label, timestamp: new Date().toISOString() },
        layer: 'Data',
        createdAt: now,
        updatedAt: now,
      });

      if (ent.sourceNodeId) {
        newEdges.push({
          id: makeSafeId('oe'),
          a: ent.sourceNodeId,
          b: nid,
          label: ent.type.toUpperCase(),
          color: '#dc2626',
          width: 1.8,
          arrow: 'forward',
          type: 'curved',
          lineStyle: 'solid',
          weight: 1,
          layer: 'Data',
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    if (newNodes.length === 0 && newEdges.length === 0) {
      onNotify('All detected indicators are already on canvas.');
      return;
    }

    onUpdateGraph(
      {
        ...graph,
        nodes: [...graph.nodes, ...newNodes],
        edges: [...graph.edges, ...newEdges],
      },
      true
    );
    onNotify(`Spawned ${newNodes.length} OSINT node(s) onto canvas.`);
  };

  // Export Helpers
  const handleExport = (fmt: 'json' | 'svg' | 'dot' | 'graphml' | 'csv', copyOnly = false) => {
    const slug = boardTitle.replace(/\s+/g, '_').toLowerCase() || 'linkdraw_graph';
    let content = '';
    let filename = `${slug}.json`;
    let mime = 'application/json';

    if (fmt === 'json') {
      content = exportLinkDrawJSON(graph, boardTitle);
    } else if (fmt === 'svg') {
      content = exportSVG(graph);
      filename = `${slug}.svg`;
      mime = 'image/svg+xml';
    } else if (fmt === 'dot') {
      content = exportGraphvizDOT(graph, boardTitle);
      filename = `${slug}.dot`;
      mime = 'text/plain';
    } else if (fmt === 'graphml') {
      content = exportGraphML(graph);
      filename = `${slug}.graphml`;
      mime = 'application/xml';
    } else {
      content = exportCSVBundle(graph);
      filename = `${slug}.csv`;
      mime = 'text/csv';
    }

    if (copyOnly) {
      navigator.clipboard.writeText(content).then(
        () => onNotify(`Copied ${fmt.toUpperCase()} to clipboard.`),
        () => onNotify('Clipboard copy failed.')
      );
    } else {
      triggerFileDownload(filename, content, mime);
      onNotify(`Exported ${filename}.`);
    }
  };

  const cols = ['A', 'B', 'C', 'D', 'E'];
  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Sub-tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Utilities &amp; Intelligence Suite</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Active Graph: {boardTitle}
            </p>
          </div>
          <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 self-start overflow-x-auto max-w-full">
            {(
              [
                { id: 'algos', label: 'Algos & Layouts' },
                { id: 'osint', label: 'OSINT Lab' },
                { id: 'formulas', label: 'Formulas' },
                { id: 'settings', label: 'Export & Settings' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => onSubTabChange(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeSubTab === t.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* SUB-TAB 1: ALGOS & LAYOUTS */}
        {activeSubTab === 'algos' && (
          <div className="space-y-6">
            {/* Telemetry Summary Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-semibold">Graph Telemetry Summary</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowMatrixModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    Adjacency Matrix &amp; Metrics
                  </button>
                  <button
                    onClick={() => setShowTimelineModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Live Graph Timeline
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                {[
                  { label: 'Nodes', val: telemetry.nodeCount },
                  { label: 'Edges', val: telemetry.edgeCount },
                  { label: 'Density', val: telemetry.density.toFixed(3) },
                  { label: 'Clusters', val: telemetry.clusters },
                  { label: 'Avg Degree', val: telemetry.avgDegree.toFixed(2) },
                  {
                    label: 'Top Hub',
                    val: telemetry.topHub ? `${telemetry.topHub.label} (${telemetry.topHub.degree})` : '—',
                  },
                  { label: 'Cycles', val: telemetry.cycleCount },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    <div className="text-slate-500 dark:text-slate-400">{m.label}</div>
                    <div className="font-mono text-sm font-semibold mt-1 truncate tabular-nums">
                      {m.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Automated Layouts */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold">Automated Graph Layouts</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'force', label: 'Force-Directed' },
                    { id: 'hierarchical', label: 'Hierarchical / Tree' },
                    { id: 'radial', label: 'Radial Concentric' },
                    { id: 'grid', label: 'Grid Matrix' },
                    { id: 'circular', label: 'Circular Ring' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => applyLayout(l.id)}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Solvers & Pathfinding */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-semibold">Graph Solvers &amp; Traversals</h2>
                  </div>
                  <button
                    onClick={() => {
                      onHighlightElements([], []);
                      setSolverSummary('');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                  >
                    Clear Highlights
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-500 mb-1">Source Node</label>
                    <select
                      value={sourceNodeId}
                      onChange={(e) => setSourceNodeId(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      {graph.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.text}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Target Node</label>
                    <select
                      value={targetNodeId}
                      onChange={(e) => setTargetNodeId(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    >
                      {graph.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.text}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={runDijkstra}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Dijkstra Shortest Path
                  </button>
                  <button
                    onClick={runBFS}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    BFS Traversal
                  </button>
                  <button
                    onClick={runDFS}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    DFS Traversal
                  </button>
                  <button
                    onClick={runMST}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Kruskal MST
                  </button>
                  <button
                    onClick={runTopoSort}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Topological Sort (Kahn)
                  </button>
                  <button
                    onClick={runCycles}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Detect Cycles
                  </button>
                  <button
                    onClick={runComponents}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Color Components
                  </button>
                </div>

                {solverSummary && (
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
                    {solverSummary}
                  </p>
                )}
              </div>

              {/* Centrality Leaderboard */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-semibold">PageRank &amp; Betweenness Centrality</h2>
                  </div>
                  <button
                    onClick={autoSizeByCentrality}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Size Nodes
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Node</th>
                        <th className="text-right px-3 py-2 font-medium">PageRank</th>
                        <th className="text-right px-3 py-2 font-medium">Betweenness</th>
                        <th className="text-right px-3 py-2 font-medium">Deg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {centralityList.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => onFocusNodeOrEdge(row.id, 'node')}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="px-3 py-2 font-medium truncate max-w-[160px]">{row.label}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {row.pageRank.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {row.betweenness.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">{row.degree}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB-TAB 2: OSINT LAB */}
        {activeSubTab === 'osint' && (
          <div className="space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-semibold">OSINT Indicator Extractor &amp; Transforms</h2>
                </div>
                <button
                  onClick={handleScanGraph}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <ScanSearch className="w-3.5 h-3.5" />
                  Scan Active Graph
                </button>
              </div>

              <textarea
                rows={4}
                value={osintInput}
                onChange={(e) => setOsintInput(e.target.value)}
                placeholder="Paste threat report, logs, IPs (185.220.101.44), CIDR (10.24.0.0/16), domains, emails, BTC wallets, SHA-256 hashes, or phone numbers..."
                className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={handleExtractFromText}
                  disabled={!osintInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" />
                  Extract Entities from Text
                </button>
                <button
                  onClick={spawnEntitiesToCanvas}
                  disabled={osintEntities.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Spawn Entities onto Canvas ({osintEntities.length})
                </button>
              </div>
            </div>

            {osintEntities.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Type</th>
                      <th className="text-left px-4 py-2.5 font-medium">Indicator Value</th>
                      <th className="text-right px-4 py-2.5 font-medium">Transform</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {osintEntities.map((ent) => {
                      const style = ENTITY_STYLES[ent.type];
                      return (
                        <tr key={ent.id}>
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                            {style.icon} {style.label}
                          </td>
                          <td className="px-4 py-2.5 font-mono break-all">{ent.value}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              disabled={enriching}
                              onClick={() => handleEnrichEntity(ent)}
                              className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Run Transform
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 3: FORMULAS */}
        {activeSubTab === 'formulas' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Live Graph Formula Sheet</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supports =SUM(B2:B3), =AVERAGE(...), =IF(...), =NODE("Name","progress"), =GRAPH("nodes")
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                  {selectedCell}
                </span>
                <input
                  type="text"
                  value={sheetGrid[selectedCell] ?? ''}
                  onChange={(e) =>
                    setSheetGrid({ ...sheetGrid, [selectedCell]: e.target.value })
                  }
                  placeholder="Enter value or =FORMULA..."
                  className="w-64 sm:w-80 px-3 py-1.5 font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500">
                    <th className="w-10 p-2 border-b border-r border-slate-200 dark:border-slate-700" />
                    {cols.map((c) => (
                      <th
                        key={c}
                        className="p-2 border-b border-r border-slate-200 dark:border-slate-700 font-mono"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-2 text-center font-mono text-slate-400 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
                        {r}
                      </td>
                      {cols.map((c) => {
                        const cellId = `${c}${r}`;
                        const isSel = selectedCell === cellId;
                        const evaluated = evaluateSheetCell(cellId, sheetGrid, graph.nodes, graph.edges);
                        return (
                          <td
                            key={cellId}
                            onClick={() => setSelectedCell(cellId)}
                            className={`p-0 border-r border-slate-100 dark:border-slate-800 min-w-[120px] cursor-cell ${
                              isSel ? 'ring-2 ring-inset ring-blue-600' : ''
                            }`}
                          >
                            {isSel ? (
                              <input
                                type="text"
                                autoFocus
                                value={sheetGrid[cellId] ?? ''}
                                onChange={(e) =>
                                  setSheetGrid({ ...sheetGrid, [cellId]: e.target.value })
                                }
                                className="w-full px-2.5 py-2 font-mono bg-blue-50/40 dark:bg-blue-950/20 focus:outline-none"
                              />
                            ) : (
                              <div className="px-2.5 py-2 font-mono tabular-nums truncate">
                                {String(evaluated)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUB-TAB 4: EXPORT & SETTINGS */}
        {activeSubTab === 'settings' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exports */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold">Export Active Graph</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {(
                  [
                    { id: 'json', label: 'LinkDraw JSON', desc: 'Full fidelity nodes, edges, tables & layers' },
                    { id: 'svg', label: 'Vector SVG', desc: 'Scalable publication graphic' },
                    { id: 'dot', label: 'Graphviz DOT', desc: 'Digraph specification for CLI tools' },
                    { id: 'graphml', label: 'GraphML XML', desc: 'Compatible with Gephi & Cytoscape' },
                    { id: 'csv', label: 'CSV Bundle', desc: 'Nodes and Edges tabular export' },
                  ] as const
                ).map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleExport(item.id, true)}
                        title="Copy to clipboard"
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleExport(item.id, false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas & Account Settings */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold">Canvas &amp; Theme Settings</h2>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Theme</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    {(
                      [
                        { id: 'light', label: 'Light' },
                        { id: 'dark', label: 'Dark' },
                        { id: 'high_contrast', label: 'High Contrast' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onChangeTheme(t.id)}
                        className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                          theme === t.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <span className="text-sm">Snap Nodes to Grid</span>
                  <input
                    type="checkbox"
                    checked={graph.settings.gridSnap}
                    onChange={(e) =>
                      onUpdateGraph(
                        {
                          ...graph,
                          settings: { ...graph.settings, gridSnap: e.target.checked },
                        },
                        false
                      )
                    }
                    className="w-4 h-4 accent-blue-600"
                  />
                </label>

                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Grid Size</span>
                    <span className="font-mono tabular-nums">{graph.settings.gridSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={graph.settings.gridSize}
                    onChange={(e) =>
                      onUpdateGraph(
                        {
                          ...graph,
                          settings: { ...graph.settings, gridSize: Number(e.target.value) },
                        },
                        false
                      )
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                <label className="flex items-center justify-between py-2 cursor-pointer">
                  <span className="text-sm">Animated Edge Flow Particles</span>
                  <input
                    type="checkbox"
                    checked={graph.settings.flowAnimation}
                    onChange={(e) =>
                      onUpdateGraph(
                        {
                          ...graph,
                          settings: { ...graph.settings, flowAnimation: e.target.checked },
                        },
                        false
                      )
                    }
                    className="w-4 h-4 accent-blue-600"
                  />
                </label>
              </div>

              {/* User Account & Android Sync Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{userName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {userEmail}
                    </div>
                  </div>
                  <button
                    onClick={onSignOut}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="font-medium text-slate-700 dark:text-slate-300">
                    Android &amp; Cross-Device Cloud Sync Target
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                    Projects sync automatically across LinkDraw Android and Web when both apps sign in with the same Google account and target the same Firebase Project and Firestore Database ID below:
                  </p>
                  <div className="space-y-1.5 pt-1 font-mono text-[11px]">
                    {[
                      { label: 'Project ID', value: firebaseProjectId },
                      { label: 'Database ID', value: firestoreDatabaseId },
                      { label: 'User UID', value: userId },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                      >
                        <span className="text-slate-500 shrink-0">{row.label}</span>
                        <span className="truncate text-slate-800 dark:text-slate-200">{row.value}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(row.value).then(
                              () => onNotify(`Copied ${row.label}.`),
                              () => onNotify('Clipboard copy failed.')
                            );
                          }}
                          title={`Copy ${row.label}`}
                          className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Real Adjacency Matrix & Metrics Modal */}
      {showMatrixModal && (
        <AdjacencyMatrixModal
          graph={graph}
          onFocusEdge={(edgeId) => {
            setShowMatrixModal(false);
            onFocusNodeOrEdge(edgeId, 'edge');
          }}
          onClose={() => setShowMatrixModal(false)}
        />
      )}

      {/* Real Live Graph Timeline Modal */}
      {showTimelineModal && (
        <GraphTimelineModal
          graph={graph}
          onFocusEntry={(targetId, kind) => {
            setShowTimelineModal(false);
            onFocusNodeOrEdge(targetId, kind);
          }}
          onClose={() => setShowTimelineModal(false)}
        />
      )}
    </div>
  );
};

// --- Modal 1: Adjacency Matrix & Metrics ---
const AdjacencyMatrixModal: React.FC<{
  graph: GraphDocument;
  onFocusEdge: (edgeId: string) => void;
  onClose: () => void;
}> = ({ graph, onFocusEdge, onClose }) => {
  const [directed, setDirected] = useState(true);
  const [mode, setMode] = useState<'weight' | 'count'>('weight');
  const [inspectedCell, setInspectedCell] = useState<{
    src: string;
    dst: string;
    edges: GraphEdge[];
  } | null>(null);

  const matrix = useMemo(
    () => buildAdjacencyMatrix(graph.nodes, graph.edges, directed),
    [graph.nodes, graph.edges, directed]
  );

  const maxVal = useMemo(() => {
    const grid = mode === 'weight' ? matrix.weights : matrix.counts;
    let m = 1;
    for (const row of grid) for (const v of row) if (v > m) m = v;
    return m;
  }, [matrix, mode]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">Adjacency Matrix &amp; Network Metrics</h2>
            <p className="text-xs text-slate-500">Click any non-zero cell to inspect parallel edges and focus on canvas.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDirected((d) => !d)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              {directed ? 'Directed' : 'Undirected'}
            </button>
            <button
              onClick={() => setMode((m) => (m === 'weight' ? 'count' : 'weight'))}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Heatmap: {mode === 'weight' ? 'Weight' : 'Count'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-auto space-y-4">
          {/* Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs">
            {[
              { label: 'Density', val: matrix.density.toFixed(3) },
              { label: 'Sparsity', val: matrix.sparsity.toFixed(3) },
              { label: 'Reciprocity', val: matrix.reciprocity.toFixed(3) },
              { label: 'Total Weight', val: matrix.totalWeight.toFixed(2) },
              { label: 'Avg W. Deg', val: matrix.avgWeightedDegree.toFixed(2) },
              { label: 'Self-Loops', val: matrix.selfLoops },
            ].map((item) => (
              <div
                key={item.label}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
              >
                <div className="text-slate-500">{item.label}</div>
                <div className="font-mono font-semibold mt-0.5 tabular-nums">{item.val}</div>
              </div>
            ))}
          </div>

          {matrix.nodes.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No nodes in graph.</p>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="p-2 border-b border-r border-slate-200 dark:border-slate-700 text-left">
                      From \ To
                    </th>
                    {matrix.nodes.map((colNode) => (
                      <th
                        key={colNode.id}
                        className="p-2 border-b border-r border-slate-200 dark:border-slate-700 font-medium max-w-[90px] truncate"
                        title={colNode.text}
                      >
                        {colNode.text}
                      </th>
                    ))}
                    <th className="p-2 border-b border-slate-200 dark:border-slate-700 font-mono">
                      OutDeg
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.nodes.map((rowNode, i) => (
                    <tr key={rowNode.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td
                        className="p-2 border-r border-slate-200 dark:border-slate-800 font-medium max-w-[130px] truncate bg-slate-50 dark:bg-slate-950"
                        title={rowNode.text}
                      >
                        {rowNode.text}
                      </td>
                      {matrix.nodes.map((colNode, j) => {
                        const val = mode === 'weight' ? matrix.weights[i][j] : matrix.counts[i][j];
                        const cellEdges = matrix.edgeLists[i][j];
                        const intensity = val > 0 ? Math.max(0.15, Math.min(0.85, val / maxVal)) : 0;
                        return (
                          <td
                            key={colNode.id}
                            onClick={() => {
                              if (cellEdges.length > 0) {
                                setInspectedCell({
                                  src: rowNode.text,
                                  dst: colNode.text,
                                  edges: cellEdges,
                                });
                              }
                            }}
                            style={
                              val > 0
                                ? { backgroundColor: `rgba(37, 99, 235, ${intensity})` }
                                : undefined
                            }
                            className={`p-2 text-center font-mono tabular-nums border-r border-slate-100 dark:border-slate-800 ${
                              val > 0
                                ? 'text-white font-semibold cursor-pointer hover:ring-2 hover:ring-blue-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {val > 0 ? (mode === 'weight' ? Number(val.toFixed(1)) : val) : '0'}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-mono font-semibold tabular-nums bg-slate-50 dark:bg-slate-950">
                        {matrix.rowSums[i]}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 dark:bg-slate-950 font-mono font-semibold">
                    <td className="p-2 border-r border-slate-200 dark:border-slate-800">InDeg</td>
                    {matrix.colSums.map((sum, j) => (
                      <td key={j} className="p-2 text-center border-r border-slate-100 dark:border-slate-800 tabular-nums">
                        {sum}
                      </td>
                    ))}
                    <td className="p-2 text-center tabular-nums">{graph.edges.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {inspectedCell && (
            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 space-y-2 text-xs">
              <div className="font-semibold">
                {inspectedCell.src} → {inspectedCell.dst} ({inspectedCell.edges.length} edge
                {inspectedCell.edges.length > 1 ? 's' : ''})
              </div>
              <div className="flex flex-wrap gap-2">
                {inspectedCell.edges.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onFocusEdge(e.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500"
                  >
                    {e.label || 'Connection'} · w={e.weight} · Focus
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Modal 2: Live Graph Timeline ---
const GraphTimelineModal: React.FC<{
  graph: GraphDocument;
  onFocusEntry: (targetId: string, kind: 'node' | 'edge') => void;
  onClose: () => void;
}> = ({ graph, onFocusEntry, onClose }) => {
  const [filter, setFilter] = useState<'all' | 'nodes' | 'edges' | 'tagged'>('all');

  const entries = useMemo(() => {
    const all = buildGraphTimeline(graph.nodes, graph.edges);
    return all.filter((e) => {
      if (filter === 'nodes') return e.kind === 'node';
      if (filter === 'edges') return e.kind === 'edge';
      if (filter === 'tagged') return e.tags.length > 0;
      return true;
    });
  }, [graph.nodes, graph.edges, filter]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">Live Graph Timeline</h2>
            <p className="text-xs text-slate-500">Derived from node/edge timestamps and metadata events.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: 'All Activity' },
              { id: 'nodes', label: 'Nodes' },
              { id: 'edges', label: 'Connections' },
              { id: 'tagged', label: 'Tagged Events' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
          {entries.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No timeline events match this filter.</p>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.id}
                onClick={() => onFocusEntry(entry.targetId, entry.kind)}
                className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 transition-colors flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{entry.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {entry.subtitle}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400 capitalize">{entry.source}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
