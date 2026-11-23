import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignLeft,
  AlignStartVertical,
  Columns3,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  Layers,
  Lock,
  Map as MapIcon,
  Maximize2,
  MessageSquare,
  MousePointer2,
  Pen,
  PlusSquare,
  Redo2,
  Rows3,
  Search,
  SlidersHorizontal,
  Spline,
  StickyNote as StickyIcon,
  Trash2,
  Undo2,
  Unlock,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  CanvasLayerName,
  CollabPresence,
  FreehandStroke,
  GraphDocument,
  GraphEdge,
  GraphNode,
  StickyNote,
  ThemeMode,
  ToolMode,
  WorkspaceBoard,
} from '../types/linkdraw';
import {
  computeEdgeCurvatureFromPoint,
  computeEdgeGeometry,
  computeFittedTextLayout,
  computeMindmapVisibility,
  computeParallelEdgeIndexMap,
  getContrastTextColor,
  getShapeSafeTextBox,
  getStarPolygon,
  hitTestEdge,
  hitTestNode,
  hitTestSticky,
  wrapTextLines,
} from '../lib/geometry';
import { makeSafeId } from '../lib/firestoreSync';

interface CanvasWorkspaceProps {
  board: WorkspaceBoard;
  uid: string;
  graph: GraphDocument;
  theme: ThemeMode;
  presence: CollabPresence[];
  commentCount: number;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  selectedStickyId: string | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  focusRequest: { x: number; y: number; ts: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onCommitGraph: (nextGraph: GraphDocument, recordUndo?: boolean) => void;
  onSelectionChange: (nodeIds: string[], edgeId: string | null, stickyId: string | null) => void;
  onInspectNode: (node: GraphNode) => void;
  onInspectEdge: (edge: GraphEdge) => void;
  onInspectSticky: (sticky: StickyNote) => void;
  onOpenComments: () => void;
  onOpenCollaborators: () => void;
}

interface Camera {
  ox: number;
  oy: number;
  scale: number;
}

interface BadgeHitTarget {
  nodeId: string;
  wx: number;
  wy: number;
  r: number;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  board,
  uid,
  graph,
  theme,
  presence,
  commentCount,
  selectedNodeIds,
  selectedEdgeId,
  selectedStickyId,
  highlightedNodeIds,
  highlightedEdgeIds,
  focusRequest,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCommitGraph,
  onSelectionChange,
  onInspectNode,
  onInspectEdge,
  onInspectSticky,
  onOpenComments,
  onOpenCollaborators,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<ToolMode>('select');
  const [multiMode, setMultiMode] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [zoomPct, setZoomPct] = useState(100);

  // Ephemeral camera & drag state stored in refs for 60fps loop without React re-render overhead
  const cameraRef = useRef<Camera>({ ox: 420, oy: 280, scale: 1 });
  const liveGraphRef = useRef<GraphDocument>(graph);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<
    | { mode: 'none' }
    | { mode: 'pan'; lastX: number; lastY: number }
    | { mode: 'pinch'; lastDist: number; lastCx: number; lastCy: number }
    | { mode: 'drag_nodes'; startWx: number; startWy: number; origins: Map<string, { x: number; y: number }>; moved: boolean }
    | { mode: 'drag_sticky'; id: string; startWx: number; startWy: number; origX: number; origY: number; moved: boolean }
    | { mode: 'drag_edge_curve'; id: string; isSelfLoop: boolean; labelYOffset: number; moved: boolean }
    | { mode: 'marquee'; startWx: number; startWy: number; currWx: number; currWy: number }
    | { mode: 'draw_stroke'; stroke: FreehandStroke }
    | { mode: 'erase_stroke'; onlyHighlight: boolean; lastWx: number; lastWy: number; erasedAny: boolean }
  >({ mode: 'none' });
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const badgeHitsRef = useRef<BadgeHitTarget[]>([]);
  const edgeCurveHandleRef = useRef<{
    edgeId: string;
    x: number;
    y: number;
    isSelfLoop: boolean;
    labelYOffset: number;
    curvature: number;
  } | null>(null);
  const minimapDragRef = useRef(false);
  const minimapBoundsRef = useRef<{ minX: number; minY: number; scale: number; w: number; h: number } | null>(null);
  const flowPhaseRef = useRef(0);
  const spaceDownRef = useRef(false);
  const lastTapRef = useRef<{ time: number; id: string | null }>({ time: 0, id: null });

  // Sync liveGraphRef whenever prop graph updates (only if not mid-drag)
  useEffect(() => {
    if (
      gestureRef.current.mode !== 'drag_nodes' &&
      gestureRef.current.mode !== 'drag_sticky' &&
      gestureRef.current.mode !== 'drag_edge_curve' &&
      gestureRef.current.mode !== 'draw_stroke' &&
      gestureRef.current.mode !== 'erase_stroke'
    ) {
      liveGraphRef.current = graph;
    }
  }, [graph]);

  // Center camera on first mount or board change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (graph.nodes.length > 0) {
      let sumX = 0;
      let sumY = 0;
      for (const n of graph.nodes) {
        sumX += n.x;
        sumY += n.y;
      }
      const cx = sumX / graph.nodes.length;
      const cy = sumY / graph.nodes.length;
      cameraRef.current = {
        ox: rect.width / 2 - cx,
        oy: rect.height / 2 - cy,
        scale: 1,
      };
    } else {
      cameraRef.current = { ox: rect.width / 2, oy: rect.height / 2, scale: 1 };
    }
    setZoomPct(Math.round(cameraRef.current.scale * 100));
  }, [board.id]);

  // Handle focus requests (e.g. from Comments, Timeline, Adjacency Matrix, Notes)
  useEffect(() => {
    if (!focusRequest || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cam = cameraRef.current;
    cam.ox = rect.width / 2 - focusRequest.x * cam.scale;
    cam.oy = rect.height / 2 - focusRequest.y * cam.scale;
  }, [focusRequest]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.code === 'Space') {
        spaceDownRef.current = true;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(true);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      } else if (e.key === 'Escape') {
        setConnectSourceId(null);
        setTool('select');
      } else if (!e.metaKey && !e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') setTool('select');
        else if (k === 'n') setTool('add_node');
        else if (k === 'c' || k === 'e') setTool('connect');
        else if (k === 's') setTool('sticky');
        else if (k === 'p') setTool('pen');
        else if (k === 'h') setTool('highlight');
        else if (k === 'x') setTool(e.shiftKey ? 'highlight_eraser' : 'eraser');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  const toWorld = useCallback((sx: number, sy: number) => {
    const cam = cameraRef.current;
    return {
      x: (sx - cam.ox) / cam.scale,
      y: (sy - cam.oy) / cam.scale,
    };
  }, []);

  const zoomAtPoint = useCallback((factor: number, screenX: number, screenY: number) => {
    const cam = cameraRef.current;
    const oldScale = cam.scale;
    const newScale = Math.max(0.15, Math.min(4.0, oldScale * factor));
    cam.ox = screenX - (screenX - cam.ox) * (newScale / oldScale);
    cam.oy = screenY - (screenY - cam.oy) * (newScale / oldScale);
    cam.scale = newScale;
    setZoomPct(Math.round(newScale * 100));
  }, []);

  const handleZoomButton = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAtPoint(factor, rect.width / 2, rect.height / 2);
  };

  const handleResetView = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nodes = liveGraphRef.current.nodes;
    if (nodes.length === 0) {
      cameraRef.current = { ox: rect.width / 2, oy: rect.height / 2, scale: 1 };
    } else {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x - n.w / 2);
        minY = Math.min(minY, n.y - n.h / 2);
        maxX = Math.max(maxX, n.x + n.w / 2);
        maxY = Math.max(maxY, n.y + n.h / 2);
      }
      const gw = Math.max(200, maxX - minX + 120);
      const gh = Math.max(200, maxY - minY + 120);
      const fitScale = Math.max(0.25, Math.min(1.2, Math.min(rect.width / gw, rect.height / gh)));
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      cameraRef.current = {
        ox: rect.width / 2 - cx * fitScale,
        oy: rect.height / 2 - cy * fitScale,
        scale: fitScale,
      };
    }
    setZoomPct(Math.round(cameraRef.current.scale * 100));
  };

  const handleDeleteSelected = useCallback(() => {
    const g = liveGraphRef.current;
    if (selectedNodeIds.length === 0 && !selectedEdgeId && !selectedStickyId) return;
    const selSet = new Set(selectedNodeIds);
    const next: GraphDocument = {
      ...g,
      nodes: g.nodes.filter((n) => !selSet.has(n.id)),
      edges: g.edges.filter(
        (e) => e.id !== selectedEdgeId && !selSet.has(e.a) && !selSet.has(e.b)
      ),
      stickies: g.stickies.filter((s) => s.id !== selectedStickyId),
    };
    liveGraphRef.current = next;
    onSelectionChange([], null, null);
    onCommitGraph(next, true);
  }, [onCommitGraph, onSelectionChange, selectedEdgeId, selectedNodeIds, selectedStickyId]);

  const snapCoord = (v: number) => {
    const { gridSnap, gridSize } = liveGraphRef.current.settings;
    if (!gridSnap || gridSize <= 1) return v;
    return Math.round(v / gridSize) * gridSize;
  };

  // Alignment & Layer Operations
  const alignSelected = (op: 'left' | 'centerH' | 'top' | 'distH' | 'distV') => {
    if (selectedNodeIds.length < 2) return;
    const selSet = new Set(selectedNodeIds);
    const targets = graph.nodes.filter((n) => selSet.has(n.id) && !n.locked);
    if (targets.length < 2) return;

    const nextPos = new Map<string, { x: number; y: number }>();
    if (op === 'left') {
      const minLeft = Math.min(...targets.map((n) => n.x - n.w / 2));
      targets.forEach((n) => nextPos.set(n.id, { x: minLeft + n.w / 2, y: n.y }));
    } else if (op === 'centerH') {
      const avgX = targets.reduce((s, n) => s + n.x, 0) / targets.length;
      targets.forEach((n) => nextPos.set(n.id, { x: avgX, y: n.y }));
    } else if (op === 'top') {
      const minTop = Math.min(...targets.map((n) => n.y - n.h / 2));
      targets.forEach((n) => nextPos.set(n.id, { x: n.x, y: minTop + n.h / 2 }));
    } else if (op === 'distH') {
      const sorted = [...targets].sort((a, b) => a.x - b.x);
      const minX = sorted[0].x;
      const maxX = sorted[sorted.length - 1].x;
      const step = (maxX - minX) / (sorted.length - 1);
      sorted.forEach((n, i) => nextPos.set(n.id, { x: minX + i * step, y: n.y }));
    } else if (op === 'distV') {
      const sorted = [...targets].sort((a, b) => a.y - b.y);
      const minY = sorted[0].y;
      const maxY = sorted[sorted.length - 1].y;
      const step = (maxY - minY) / (sorted.length - 1);
      sorted.forEach((n, i) => nextPos.set(n.id, { x: n.x, y: minY + i * step }));
    }

    const nextGraph: GraphDocument = {
      ...graph,
      nodes: graph.nodes.map((n) => {
        const p = nextPos.get(n.id);
        return p ? { ...n, x: p.x, y: p.y, updatedAt: Date.now() } : n;
      }),
    };
    onCommitGraph(nextGraph, true);
  };

  const toggleLayerProp = (name: CanvasLayerName, prop: 'visible' | 'locked') => {
    const nextGraph: GraphDocument = {
      ...graph,
      layers: graph.layers.map((l) => (l.name === name ? { ...l, [prop]: !l[prop] } : l)),
    };
    onCommitGraph(nextGraph, false);
  };

  const clearFreehandInk = () => {
    if (graph.strokes.length === 0) return;
    onCommitGraph({ ...graph, strokes: [] }, true);
  };

  const clearHighlightInk = () => {
    const remaining = graph.strokes.filter((s) => s.tool !== 'highlight');
    if (remaining.length === graph.strokes.length) return;
    onCommitGraph({ ...graph, strokes: remaining }, true);
  };

  // Sweep-erase strokes along world segment (x1,y1)->(x2,y2)
  const applyEraserSweep = useCallback(
    (x1: number, y1: number, x2: number, y2: number, onlyHighlight: boolean): boolean => {
      const g = liveGraphRef.current;
      if (g.strokes.length === 0) return false;
      const layerMap = new Map(g.layers.map((l) => [l.name, l]));
      const baseRadius = (onlyHighlight ? 16 : 14) / cameraRef.current.scale;
      let removedAny = false;

      const kept = g.strokes.filter((st) => {
        if (onlyHighlight && st.tool !== 'highlight') return true;
        const layer = layerMap.get(st.layer);
        if (layer && (!layer.visible || layer.locked)) return true;
        if (st.points.length === 0) return false;

        const tol = baseRadius + st.width / 2;
        if (st.points.length === 1) {
          const hit =
            pointToSegmentDistSq(st.points[0].x, st.points[0].y, x1, y1, x2, y2) <= tol * tol;
          if (hit) removedAny = true;
          return !hit;
        }
        for (let i = 0; i < st.points.length - 1; i++) {
          const p0 = st.points[i];
          const p1 = st.points[i + 1];
          if (segmentsIntersectOrClose(x1, y1, x2, y2, p0.x, p0.y, p1.x, p1.y, tol)) {
            removedAny = true;
            return false;
          }
        }
        return true;
      });

      if (removedAny) {
        liveGraphRef.current = { ...g, strokes: kept };
      }
      return removedAny;
    },
    []
  );

  // Search matching set
  const matchingNodeIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const n of graph.nodes) {
      const metaStr = Object.entries(n.metadata || {})
        .map(([k, v]) => `${k}:${v}`)
        .join(' ')
        .toLowerCase();
      if (
        n.text.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        metaStr.includes(q)
      ) {
        set.add(n.id);
      }
    }
    return set;
  }, [graph.nodes, searchQuery]);

  // Legend entries
  const legendEntries = useMemo(() => {
    const seen = new Map<string, { color: string; shape: string; label: string }>();
    for (const n of graph.nodes) {
      const tag = n.tags[0] || n.shape;
      const key = `${n.color}::${tag}`;
      if (!seen.has(key)) {
        seen.set(key, { color: n.color, shape: n.shape, label: tag });
      }
    }
    return [...seen.values()].slice(0, 8);
  }, [graph.nodes]);

  // --- Pointer Events State Machine ---
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement> | React.WheelEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { sx, sy } = getCanvasCoords(e);
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    zoomAtPoint(factor, sx, sy);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const { sx, sy } = getCanvasCoords(e);
    activePointersRef.current.set(e.pointerId, { x: sx, y: sy });

    // 2-finger pinch gesture immediately supersedes any single-pointer drag
    if (activePointersRef.current.size === 2) {
      const pts = [...activePointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      gestureRef.current = { mode: 'pinch', lastDist: dist, lastCx: cx, lastCy: cy };
      return;
    }

    if (activePointersRef.current.size > 2) return;

    const { x: wx, y: wy } = toWorld(sx, sy);
    pointerWorldRef.current = { x: wx, y: wy };
    const g = liveGraphRef.current;
    const layerMap = new Map(g.layers.map((l) => [l.name, l]));
    const isLayerInteractive = (layerName: CanvasLayerName) => {
      const l = layerMap.get(layerName);
      return l ? l.visible && !l.locked : true;
    };

    // Middle click or Space+click -> Pan
    if (e.button === 1 || spaceDownRef.current) {
      gestureRef.current = { mode: 'pan', lastX: sx, lastY: sy };
      return;
    }

    // Check Mindmap Collapse Toggle Badge first
    for (const b of badgeHitsRef.current) {
      if (Math.hypot(wx - b.wx, wy - b.wy) <= b.r + 6) {
        const nextGraph: GraphDocument = {
          ...g,
          nodes: g.nodes.map((n) => (n.id === b.nodeId ? { ...n, collapsed: !n.collapsed, updatedAt: Date.now() } : n)),
        };
        liveGraphRef.current = nextGraph;
        onCommitGraph(nextGraph, true);
        return;
      }
    }

    // Check Selected Edge Curvature Handle
    const curveHandle = edgeCurveHandleRef.current;
    if (
      tool === 'select' &&
      selectedEdgeId &&
      curveHandle &&
      curveHandle.edgeId === selectedEdgeId &&
      Math.hypot(wx - curveHandle.x, wy - curveHandle.y) <= 14 / cameraRef.current.scale
    ) {
      gestureRef.current = {
        mode: 'drag_edge_curve',
        id: curveHandle.edgeId,
        isSelfLoop: curveHandle.isSelfLoop,
        labelYOffset: curveHandle.labelYOffset,
        moved: false,
      };
      return;
    }

    // Tool: Add Node
    if (tool === 'add_node') {
      const now = Date.now();
      const newNode: GraphNode = {
        id: makeSafeId('n'),
        x: snapCoord(wx),
        y: snapCoord(wy),
        w: 156,
        h: 60,
        text: `Node ${g.nodes.length + 1}`,
        shape: 'rounded',
        color: '#dbeafe',
        icon: '',
        iconPosition: 'inline',
        tags: [],
        metadata: {},
        layer: 'Data',
        createdAt: now,
        updatedAt: now,
      };
      const next = { ...g, nodes: [...g.nodes, newNode] };
      liveGraphRef.current = next;
      onSelectionChange([newNode.id], null, null);
      onCommitGraph(next, true);
      setTool('select');
      return;
    }

    // Tool: Sticky
    if (tool === 'sticky') {
      const now = Date.now();
      const newSticky: StickyNote = {
        id: makeSafeId('s'),
        x: snapCoord(wx),
        y: snapCoord(wy),
        w: 176,
        h: 112,
        text: 'Sticky note...',
        color: '#fef08a',
        layer: 'Annotations',
        createdAt: now,
        updatedAt: now,
      };
      const next = { ...g, stickies: [...g.stickies, newSticky] };
      liveGraphRef.current = next;
      onSelectionChange([], null, newSticky.id);
      onCommitGraph(next, true);
      setTool('select');
      return;
    }

    // Tool: Pen or Highlight
    if (tool === 'pen' || tool === 'highlight') {
      const stroke: FreehandStroke = {
        id: makeSafeId('st'),
        points: [{ x: wx, y: wy }],
        color: tool === 'pen' ? (theme === 'light' ? '#1e293b' : '#f8fafc') : '#facc15',
        width: tool === 'pen' ? 3 : 16,
        tool,
        layer: 'Annotations',
        createdAt: Date.now(),
      };
      gestureRef.current = { mode: 'draw_stroke', stroke };
      return;
    }

    // Tool: Eraser or Highlighter Eraser
    if (tool === 'eraser' || tool === 'highlight_eraser') {
      const onlyHighlight = tool === 'highlight_eraser';
      const erased = applyEraserSweep(wx, wy, wx, wy, onlyHighlight);
      gestureRef.current = {
        mode: 'erase_stroke',
        onlyHighlight,
        lastWx: wx,
        lastWy: wy,
        erasedAny: erased,
      };
      return;
    }

    // Compute visible nodes (excluding collapsed mindmap subtrees)
    const { hiddenNodes } = computeMindmapVisibility(g.nodes, g.edges);
    const visibleNodes = g.nodes.filter(
      (n) => !hiddenNodes.has(n.id) && isLayerInteractive(n.layer)
    );

    // Hit-test nodes (top-most last)
    let hitNode: GraphNode | null = null;
    for (let i = visibleNodes.length - 1; i >= 0; i--) {
      if (hitTestNode(wx, wy, visibleNodes[i])) {
        hitNode = visibleNodes[i];
        break;
      }
    }

    // Tool: Connect
    if (tool === 'connect') {
      if (hitNode) {
        if (!connectSourceId) {
          setConnectSourceId(hitNode.id);
          onSelectionChange([hitNode.id], null, null);
        } else {
          const now = Date.now();
          const newEdge: GraphEdge = {
            id: makeSafeId('e'),
            a: connectSourceId,
            b: hitNode.id,
            label: connectSourceId === hitNode.id ? 'Self-Loop' : '',
            color: '#475569',
            width: 2,
            arrow: 'forward',
            type: 'curved',
            lineStyle: 'solid',
            weight: 1,
            layer: 'Data',
            createdAt: now,
            updatedAt: now,
          };
          const next = { ...g, edges: [...g.edges, newEdge] };
          liveGraphRef.current = next;
          setConnectSourceId(null);
          onSelectionChange([], newEdge.id, null);
          onCommitGraph(next, true);
        }
      } else {
        setConnectSourceId(null);
      }
      return;
    }

    // Tool: Select
    if (hitNode) {
      const now = Date.now();
      if (lastTapRef.current.id === hitNode.id && now - lastTapRef.current.time < 320) {
        lastTapRef.current = { time: 0, id: null };
        onInspectNode(hitNode);
        return;
      }
      lastTapRef.current = { time: now, id: hitNode.id };

      let nextSel = selectedNodeIds;
      if (multiMode || e.shiftKey) {
        nextSel = selectedNodeIds.includes(hitNode.id)
          ? selectedNodeIds.filter((id) => id !== hitNode.id)
          : [...selectedNodeIds, hitNode.id];
      } else if (!selectedNodeIds.includes(hitNode.id)) {
        nextSel = [hitNode.id];
      }
      onSelectionChange(nextSel, null, null);

      if (!hitNode.locked) {
        const origins = new Map<string, { x: number; y: number }>();
        for (const id of nextSel) {
          const found = g.nodes.find((n) => n.id === id);
          if (found && !found.locked) origins.set(id, { x: found.x, y: found.y });
        }
        gestureRef.current = {
          mode: 'drag_nodes',
          startWx: wx,
          startWy: wy,
          origins,
          moved: false,
        };
      }
      return;
    }

    // Hit-test sticky notes
    const visibleStickies = g.stickies.filter((s) => isLayerInteractive(s.layer));
    let hitSticky: StickyNote | null = null;
    for (let i = visibleStickies.length - 1; i >= 0; i--) {
      if (hitTestSticky(wx, wy, visibleStickies[i])) {
        hitSticky = visibleStickies[i];
        break;
      }
    }
    if (hitSticky) {
      const now = Date.now();
      if (lastTapRef.current.id === hitSticky.id && now - lastTapRef.current.time < 320) {
        lastTapRef.current = { time: 0, id: null };
        onInspectSticky(hitSticky);
        return;
      }
      lastTapRef.current = { time: now, id: hitSticky.id };
      onSelectionChange([], null, hitSticky.id);
      gestureRef.current = {
        mode: 'drag_sticky',
        id: hitSticky.id,
        startWx: wx,
        startWy: wy,
        origX: hitSticky.x,
        origY: hitSticky.y,
        moved: false,
      };
      return;
    }

    // Hit-test edges
    const nodeMap = new Map(g.nodes.map((n) => [n.id, n]));
    const visibleEdges = g.edges.filter(
      (edge) =>
        !hiddenNodes.has(edge.a) &&
        !hiddenNodes.has(edge.b) &&
        isLayerInteractive(edge.layer)
    );
    const parallelMap = computeParallelEdgeIndexMap(visibleEdges);
    const tol = 12 / cameraRef.current.scale;
    let hitEdge: GraphEdge | null = null;
    for (let i = visibleEdges.length - 1; i >= 0; i--) {
      const edge = visibleEdges[i];
      const geom = computeEdgeGeometry(edge, nodeMap, parallelMap.get(edge.id));
      if (geom && hitTestEdge(wx, wy, geom, edge, tol)) {
        hitEdge = edge;
        break;
      }
    }
    if (hitEdge) {
      const now = Date.now();
      if (lastTapRef.current.id === hitEdge.id && now - lastTapRef.current.time < 320) {
        lastTapRef.current = { time: 0, id: null };
        onInspectEdge(hitEdge);
        return;
      }
      lastTapRef.current = { time: now, id: hitEdge.id };
      onSelectionChange([], hitEdge.id, null);
      return;
    }

    // Empty canvas click
    onSelectionChange([], null, null);
    if (multiMode || e.shiftKey) {
      gestureRef.current = { mode: 'marquee', startWx: wx, startWy: wy, currWx: wx, currWy: wy };
    } else {
      gestureRef.current = { mode: 'pan', lastX: sx, lastY: sy };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { sx, sy } = getCanvasCoords(e);
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: sx, y: sy });
    }
    const { x: wx, y: wy } = toWorld(sx, sy);
    pointerWorldRef.current = { x: wx, y: wy };

    const gest = gestureRef.current;
    if (gest.mode === 'pinch' && activePointersRef.current.size === 2) {
      const pts = [...activePointersRef.current.values()];
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;

      const cam = cameraRef.current;
      // Pan by centroid movement
      cam.ox += cx - gest.lastCx;
      cam.oy += cy - gest.lastCy;
      // Zoom around centroid
      if (gest.lastDist > 5) {
        const factor = dist / gest.lastDist;
        zoomAtPoint(factor, cx, cy);
      }
      gest.lastDist = dist;
      gest.lastCx = cx;
      gest.lastCy = cy;
      return;
    }

    if (gest.mode === 'pan') {
      cameraRef.current.ox += sx - gest.lastX;
      cameraRef.current.oy += sy - gest.lastY;
      gest.lastX = sx;
      gest.lastY = sy;
      return;
    }

    if (gest.mode === 'drag_nodes') {
      const dx = wx - gest.startWx;
      const dy = wy - gest.startWy;
      if (Math.hypot(dx, dy) > 2) gest.moved = true;
      const g = liveGraphRef.current;
      liveGraphRef.current = {
        ...g,
        nodes: g.nodes.map((n) => {
          const orig = gest.origins.get(n.id);
          if (!orig) return n;
          return {
            ...n,
            x: snapCoord(orig.x + dx),
            y: snapCoord(orig.y + dy),
          };
        }),
      };
      return;
    }

    if (gest.mode === 'drag_sticky') {
      const dx = wx - gest.startWx;
      const dy = wy - gest.startWy;
      if (Math.hypot(dx, dy) > 2) gest.moved = true;
      const g = liveGraphRef.current;
      liveGraphRef.current = {
        ...g,
        stickies: g.stickies.map((s) =>
          s.id === gest.id
            ? { ...s, x: snapCoord(gest.origX + dx), y: snapCoord(gest.origY + dy) }
            : s
        ),
      };
      return;
    }

    if (gest.mode === 'drag_edge_curve') {
      const g = liveGraphRef.current;
      const edge = g.edges.find((item) => item.id === gest.id);
      if (edge) {
        const src = g.nodes.find((n) => n.id === edge.a);
        const dst = g.nodes.find((n) => n.id === edge.b);
        if (src && dst) {
          const nextCurvature = computeEdgeCurvatureFromPoint(
            src,
            dst,
            wx,
            wy - gest.labelYOffset
          );
          gest.moved = true;
          liveGraphRef.current = {
            ...g,
            edges: g.edges.map((item) =>
              item.id === gest.id
                ? { ...item, type: 'curved', curvature: nextCurvature }
                : item
            ),
          };
        }
      }
      return;
    }

    if (gest.mode === 'marquee') {
      gest.currWx = wx;
      gest.currWy = wy;
      return;
    }

    if (gest.mode === 'draw_stroke') {
      const pts = gest.stroke.points;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(wx - last.x, wy - last.y) >= 3) {
        pts.push({ x: wx, y: wy });
      }
      return;
    }

    if (gest.mode === 'erase_stroke') {
      const erased = applyEraserSweep(gest.lastWx, gest.lastWy, wx, wy, gest.onlyHighlight);
      if (erased) gest.erasedAny = true;
      gest.lastWx = wx;
      gest.lastWy = wy;
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    const gest = gestureRef.current;

    if (gest.mode === 'pinch') {
      if (activePointersRef.current.size < 2) {
        gestureRef.current = { mode: 'none' };
      }
      return;
    }

    if (gest.mode === 'drag_nodes') {
      gestureRef.current = { mode: 'none' };
      if (gest.moved) {
        const now = Date.now();
        const committed: GraphDocument = {
          ...liveGraphRef.current,
          nodes: liveGraphRef.current.nodes.map((n) =>
            gest.origins.has(n.id) ? { ...n, updatedAt: now } : n
          ),
        };
        liveGraphRef.current = committed;
        onCommitGraph(committed, true);
      }
      return;
    }

    if (gest.mode === 'drag_sticky') {
      gestureRef.current = { mode: 'none' };
      if (gest.moved) {
        const now = Date.now();
        const committed: GraphDocument = {
          ...liveGraphRef.current,
          stickies: liveGraphRef.current.stickies.map((s) =>
            s.id === gest.id ? { ...s, updatedAt: now } : s
          ),
        };
        liveGraphRef.current = committed;
        onCommitGraph(committed, true);
      }
      return;
    }

    if (gest.mode === 'drag_edge_curve') {
      gestureRef.current = { mode: 'none' };
      if (gest.moved) {
        const now = Date.now();
        const committed: GraphDocument = {
          ...liveGraphRef.current,
          edges: liveGraphRef.current.edges.map((item) =>
            item.id === gest.id ? { ...item, updatedAt: now } : item
          ),
        };
        liveGraphRef.current = committed;
        onCommitGraph(committed, true);
      }
      return;
    }

    if (gest.mode === 'marquee') {
      const minX = Math.min(gest.startWx, gest.currWx);
      const maxX = Math.max(gest.startWx, gest.currWx);
      const minY = Math.min(gest.startWy, gest.currWy);
      const maxY = Math.max(gest.startWy, gest.currWy);
      gestureRef.current = { mode: 'none' };
      const picked = liveGraphRef.current.nodes
        .filter((n) => n.x + n.w / 2 >= minX && n.x - n.w / 2 <= maxX && n.y + n.h / 2 >= minY && n.y - n.h / 2 <= maxY)
        .map((n) => n.id);
      onSelectionChange(picked, null, null);
      return;
    }

    if (gest.mode === 'draw_stroke') {
      gestureRef.current = { mode: 'none' };
      if (gest.stroke.points.length >= 2) {
        const next: GraphDocument = {
          ...liveGraphRef.current,
          strokes: [...liveGraphRef.current.strokes, gest.stroke],
        };
        liveGraphRef.current = next;
        onCommitGraph(next, true);
      }
      return;
    }

    if (gest.mode === 'erase_stroke') {
      gestureRef.current = { mode: 'none' };
      if (gest.erasedAny) {
        onCommitGraph(liveGraphRef.current, true);
      }
      return;
    }

    gestureRef.current = { mode: 'none' };
  };

  // Minimap click/drag pan
  const panFromMinimapEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const mm = minimapRef.current;
    const bounds = minimapBoundsRef.current;
    const container = containerRef.current;
    if (!mm || !bounds || !container) return;
    const rect = mm.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wx = bounds.minX + mx / bounds.scale;
    const wy = bounds.minY + my / bounds.scale;
    const cRect = container.getBoundingClientRect();
    cameraRef.current.ox = cRect.width / 2 - wx * cameraRef.current.scale;
    cameraRef.current.oy = cRect.height / 2 - wy * cameraRef.current.scale;
  };

  // --- 60fps requestAnimationFrame Render Loop ---
  useEffect(() => {
    let rafId = 0;

    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          const bg = theme === 'light' ? '#f8fafc' : theme === 'dark' ? '#090d16' : '#000000';
          const gridColor =
            theme === 'light'
              ? 'rgba(148, 163, 184, 0.25)'
              : theme === 'dark'
              ? 'rgba(148, 163, 184, 0.14)'
              : 'rgba(255, 255, 255, 0.22)';
          ctx.fillStyle = bg;
          ctx.fillRect(0, 0, w, h);

          const cam = cameraRef.current;
          const g = liveGraphRef.current;
          if (g.settings.flowAnimation) {
            flowPhaseRef.current = (flowPhaseRef.current + 0.014) % 1;
          }

          // World-space grid
          const step = Math.max(12, g.settings.gridSize) * cam.scale;
          if (step >= 8) {
            const startX = ((cam.ox % step) + step) % step;
            const startY = ((cam.oy % step) + step) % step;
            ctx.fillStyle = gridColor;
            for (let gx = startX; gx < w; gx += step) {
              for (let gy = startY; gy < h; gy += step) {
                ctx.fillRect(gx - 0.8, gy - 0.8, 1.6, 1.6);
              }
            }
          }

          // World Transform
          ctx.save();
          ctx.translate(cam.ox, cam.oy);
          ctx.scale(cam.scale, cam.scale);

          const viewMinX = -cam.ox / cam.scale - 120;
          const viewMinY = -cam.oy / cam.scale - 120;
          const viewMaxX = (w - cam.ox) / cam.scale + 120;
          const viewMaxY = (h - cam.oy) / cam.scale + 120;

          const layerVisible = new Map(g.layers.map((l) => [l.name, l.visible]));
          const { hiddenNodes, childCounts } = computeMindmapVisibility(g.nodes, g.edges);
          const nodeMap = new Map(g.nodes.map((n) => [n.id, n]));
          const selNodeSet = new Set(selectedNodeIds);

          // 1. Freehand strokes (Background/Data/Annotations)
          const allStrokes =
            gestureRef.current.mode === 'draw_stroke'
              ? [...g.strokes, gestureRef.current.stroke]
              : g.strokes;

          for (const st of allStrokes) {
            if (layerVisible.get(st.layer) === false || st.points.length < 2) continue;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(st.points[0].x, st.points[0].y);
            for (let i = 1; i < st.points.length; i++) {
              ctx.lineTo(st.points[i].x, st.points[i].y);
            }
            ctx.strokeStyle = st.color;
            ctx.lineWidth = st.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = st.tool === 'highlight' ? 0.35 : 0.92;
            ctx.stroke();
            ctx.restore();
          }

          // 2. Edges
          const visibleEdges = g.edges.filter(
            (e) =>
              layerVisible.get(e.layer) !== false &&
              !hiddenNodes.has(e.a) &&
              !hiddenNodes.has(e.b)
          );
          const parallelMap = computeParallelEdgeIndexMap(visibleEdges);
          let nextCurveHandle: {
            edgeId: string;
            x: number;
            y: number;
            isSelfLoop: boolean;
            labelYOffset: number;
            curvature: number;
          } | null = null;

          for (const edge of visibleEdges) {
            const geom = computeEdgeGeometry(edge, nodeMap, parallelMap.get(edge.id));
            if (!geom) continue;

            // Viewport culling for edges
            let minEx = Infinity;
            let maxEx = -Infinity;
            let minEy = Infinity;
            let maxEy = -Infinity;
            for (const p of geom.points) {
              if (p.x < minEx) minEx = p.x;
              if (p.x > maxEx) maxEx = p.x;
              if (p.y < minEy) minEy = p.y;
              if (p.y > maxEy) maxEy = p.y;
            }
            if (maxEx < viewMinX || minEx > viewMaxX || maxEy < viewMinY || minEy > viewMaxY) {
              continue;
            }

            const isSelected = edge.id === selectedEdgeId;
            const isAlgoHighlighted = highlightedEdgeIds.has(edge.id);
            const dimmed =
              matchingNodeIds &&
              !matchingNodeIds.has(edge.a) &&
              !matchingNodeIds.has(edge.b);

            ctx.save();
            ctx.globalAlpha = dimmed ? 0.18 : 1;

            // Selection / Algo Halo
            if (isSelected || isAlgoHighlighted) {
              ctx.beginPath();
              geom.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
              ctx.strokeStyle = isAlgoHighlighted ? '#f59e0b' : '#2563eb';
              ctx.lineWidth = edge.width + 5;
              ctx.globalAlpha = dimmed ? 0.12 : 0.35;
              ctx.stroke();
              ctx.globalAlpha = dimmed ? 0.18 : 1;
            }

            // Main Edge Line
            ctx.beginPath();
            geom.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
            ctx.strokeStyle = isAlgoHighlighted
              ? '#d97706'
              : theme === 'high_contrast'
              ? '#22d3ee'
              : edge.color;
            ctx.lineWidth = edge.width;
            if (edge.lineStyle === 'dashed') ctx.setLineDash([8, 5]);
            else if (edge.lineStyle === 'dotted') ctx.setLineDash([2.5, 4.5]);
            else ctx.setLineDash([]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Boundary Arrowheads (placed at exact perimeter endpoint)
            const arrowSize = Math.max(9, edge.width * 3.8);
            const endPt = geom.points[geom.points.length - 1];
            const startPt = geom.points[0];
            if (edge.arrow === 'forward' || edge.arrow === 'both') {
              drawArrowhead(ctx, endPt.x, endPt.y, geom.endAngle, arrowSize, ctx.strokeStyle as string);
            }
            if (edge.arrow === 'backward' || edge.arrow === 'both') {
              drawArrowhead(
                ctx,
                startPt.x,
                startPt.y,
                geom.startAngle + Math.PI,
                arrowSize,
                ctx.strokeStyle as string
              );
            }

            // Marching Flow Particles
            if (g.settings.flowAnimation && geom.points.length >= 2) {
              const pPos = samplePointAlongPolyline(geom.points, flowPhaseRef.current);
              ctx.beginPath();
              ctx.arc(pPos.x, pPos.y, Math.max(2.6, edge.width * 1.4), 0, Math.PI * 2);
              ctx.fillStyle = isAlgoHighlighted ? '#fbbf24' : '#3b82f6';
              ctx.fill();
            }

            // Edge Label Pill (LOD: hide below 0.35x zoom)
            const showsLabelPill = cam.scale >= 0.35 && Boolean(edge.label || edge.weight !== 1);
            if (showsLabelPill) {
              const labelText = edge.label
                ? edge.weight !== 1
                  ? `${edge.label} (${edge.weight})`
                  : edge.label
                : `w:${edge.weight}`;
              ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
              const tw = ctx.measureText(labelText).width;
              const pw = tw + 14;
              const ph = 20;
              ctx.fillStyle = theme === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
              ctx.strokeStyle = theme === 'light' ? '#cbd5e1' : '#334155';
              ctx.lineWidth = 1;
              drawRoundedRect(ctx, geom.labelPos.x - pw / 2, geom.labelPos.y - ph / 2, pw, ph, 6);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = theme === 'light' ? '#0f172a' : '#f1f5f9';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(labelText, geom.labelPos.x, geom.labelPos.y + 0.5);
            }

            // Selected Edge Curvature Drag Handle
            if (
              isSelected &&
              geom.curveHandlePos &&
              (edge.type === 'curved' || edge.type === 'straight' || geom.isSelfLoop)
            ) {
              const labelYOffset = showsLabelPill ? 18 : 0;
              const hx = geom.curveHandlePos.x;
              const hy = geom.curveHandlePos.y + labelYOffset;
              const effCurv = Math.round(geom.effectiveCurvature ?? 0);
              nextCurveHandle = {
                edgeId: edge.id,
                x: hx,
                y: hy,
                isSelfLoop: geom.isSelfLoop,
                labelYOffset,
                curvature: effCurv,
              };

              const isDraggingThisCurve =
                gestureRef.current.mode === 'drag_edge_curve' &&
                gestureRef.current.id === edge.id;

              if (isDraggingThisCurve) {
                ctx.beginPath();
                ctx.moveTo(startPt.x, startPt.y);
                ctx.lineTo(geom.curveHandlePos.x, geom.curveHandlePos.y);
                ctx.lineTo(endPt.x, endPt.y);
                ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
                ctx.lineWidth = 1.2 / cam.scale;
                ctx.setLineDash([4 / cam.scale, 3 / cam.scale]);
                ctx.stroke();
                ctx.setLineDash([]);
              }

              const knobR = (isDraggingThisCurve ? 7.5 : 6) / cam.scale;
              ctx.beginPath();
              ctx.arc(hx, hy, knobR, 0, Math.PI * 2);
              ctx.fillStyle = '#2563eb';
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2 / cam.scale;
              ctx.fill();
              ctx.stroke();

              if (isDraggingThisCurve) {
                const badgeText = effCurv === 0 ? 'Flat (0 px)' : `Bend: ${effCurv > 0 ? '+' : ''}${effCurv} px`;
                ctx.font = '600 11px "JetBrains Mono", monospace';
                const bw = ctx.measureText(badgeText).width + 14;
                const bh = 20;
                const bx = hx - bw / 2;
                const by = hy - knobR - bh - 6;
                ctx.fillStyle = '#0f172a';
                drawRoundedRect(ctx, bx, by, bw, bh, 6);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, hx, by + bh / 2);
              }
            }
            ctx.restore();
          }
          edgeCurveHandleRef.current = nextCurveHandle;

          // Rubber-band line during Connect mode
          if (tool === 'connect' && connectSourceId && pointerWorldRef.current) {
            const src = nodeMap.get(connectSourceId);
            if (src) {
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(src.x, src.y);
              ctx.lineTo(pointerWorldRef.current.x, pointerWorldRef.current.y);
              ctx.strokeStyle = '#2563eb';
              ctx.lineWidth = 2;
              ctx.setLineDash([6, 4]);
              ctx.stroke();
              ctx.restore();
            }
          }

          // 3. Nodes (with viewport culling & presence selection rings)
          const badgeHits: BadgeHitTarget[] = [];
          const presenceByNode = new Map<string, CollabPresence[]>();
          for (const p of presence) {
            if (p.uid !== uid && p.selectedNodeId) {
              const arr = presenceByNode.get(p.selectedNodeId) ?? [];
              arr.push(p);
              presenceByNode.set(p.selectedNodeId, arr);
            }
          }

          for (const node of g.nodes) {
            if (hiddenNodes.has(node.id) || layerVisible.get(node.layer) === false) continue;
            if (
              node.x + node.w / 2 < viewMinX ||
              node.x - node.w / 2 > viewMaxX ||
              node.y + node.h / 2 < viewMinY ||
              node.y - node.h / 2 > viewMaxY
            ) {
              continue;
            }

            const isSelected = selNodeSet.has(node.id);
            const isAlgoHighlight = highlightedNodeIds.has(node.id);
            const isConnectSrc = connectSourceId === node.id;
            const dimmed = matchingNodeIds ? !matchingNodeIds.has(node.id) : false;

            ctx.save();
            ctx.globalAlpha = dimmed ? 0.2 : 1;

            // Collaborator live presence ring + pill
            const collabs = presenceByNode.get(node.id);
            if (collabs && collabs.length > 0) {
              const first = collabs[0];
              ctx.save();
              ctx.strokeStyle = first.colorHex;
              ctx.lineWidth = 3;
              ctx.setLineDash([5, 3]);
              drawRoundedRect(
                ctx,
                node.x - node.w / 2 - 7,
                node.y - node.h / 2 - 7,
                node.w + 14,
                node.h + 14,
                14
              );
              ctx.stroke();
              ctx.setLineDash([]);
              const pillText =
                collabs.length > 1
                  ? `${first.displayName} +${collabs.length - 1}`
                  : first.displayName;
              ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
              const pw = ctx.measureText(pillText).width + 12;
              ctx.fillStyle = first.colorHex;
              drawRoundedRect(ctx, node.x - node.w / 2 - 6, node.y - node.h / 2 - 26, pw, 17, 6);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText(pillText, node.x - node.w / 2, node.y - node.h / 2 - 17.5);
              ctx.restore();
            }

            // Selection / Algo Highlight Ring
            if (isSelected || isAlgoHighlight || isConnectSrc) {
              ctx.save();
              ctx.strokeStyle = isAlgoHighlight ? '#f59e0b' : '#2563eb';
              ctx.lineWidth = 3;
              drawRoundedRect(
                ctx,
                node.x - node.w / 2 - 5,
                node.y - node.h / 2 - 5,
                node.w + 10,
                node.h + 10,
                13
              );
              ctx.stroke();
              ctx.restore();
            }

            // Draw Node Shape
            const fill = theme === 'high_contrast' ? '#000000' : node.color || '#dbeafe';
            const border =
              theme === 'high_contrast'
                ? '#ffffff'
                : isSelected
                ? '#2563eb'
                : theme === 'dark'
                ? '#475569'
                : '#334155';

            drawNodeShape(ctx, node, fill, border);

            // Render Content (Table vs Progress vs Standard Label + Icon)
            if (node.shape === 'table' && node.tableData) {
              drawTableContent(ctx, node, theme);
            } else {
              drawNodeLabelAndIcon(ctx, node, theme);
            }

            // Progress Bar Overlay
            if (node.progress !== null && node.progress !== undefined) {
              const pct = Math.max(0, Math.min(100, node.progress));
              const barW = Math.max(30, node.w - 24);
              const barH = 5;
              const bx = node.x - barW / 2;
              const by = node.y + node.h / 2 - 11;
              ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
              drawRoundedRect(ctx, bx, by, barW, barH, 2.5);
              ctx.fill();
              ctx.fillStyle = pct >= 80 ? '#16a34a' : pct >= 40 ? '#2563eb' : '#d97706';
              if (pct > 0) {
                drawRoundedRect(ctx, bx, by, (barW * pct) / 100, barH, 2.5);
                ctx.fill();
              }
            }

            // Topological Rank Badge
            if (node.badge) {
              const bx = node.x - node.w / 2 + 4;
              const by = node.y - node.h / 2 - 6;
              ctx.fillStyle = '#0f172a';
              drawRoundedRect(ctx, bx, by, 22, 16, 8);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.font = '600 10px "JetBrains Mono", monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.badge, bx + 11, by + 8.5);
            }

            // Collapsible Mindmap Child Toggle Badge (▶ count / ▼)
            const childCount = childCounts.get(node.id) ?? 0;
            if (childCount > 0) {
              const bx = node.x + node.w / 2 + 12;
              const by = node.y;
              const badgeLabel = node.collapsed ? `▶ ${childCount}` : '▼';
              ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
              const bw = Math.max(22, ctx.measureText(badgeLabel).width + 10);
              const bh = 20;
              ctx.fillStyle = node.collapsed ? '#2563eb' : '#ffffff';
              ctx.strokeStyle = node.collapsed ? '#1d4ed8' : '#64748b';
              ctx.lineWidth = 1.2;
              drawRoundedRect(ctx, bx - bw / 2, by - bh / 2, bw, bh, 10);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = node.collapsed ? '#ffffff' : '#0f172a';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeLabel, bx, by + 0.5);
              badgeHits.push({ nodeId: node.id, wx: bx, wy: by, r: Math.max(12, bw / 2) });
            }

            ctx.restore();
          }
          badgeHitsRef.current = badgeHits;

          // 4. Sticky Notes
          for (const sticky of g.stickies) {
            if (layerVisible.get(sticky.layer) === false) continue;
            if (
              sticky.x + sticky.w / 2 < viewMinX ||
              sticky.x - sticky.w / 2 > viewMaxX ||
              sticky.y + sticky.h / 2 < viewMinY ||
              sticky.y - sticky.h / 2 > viewMaxY
            ) {
              continue;
            }
            ctx.save();
            ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = sticky.color || '#fef08a';
            ctx.strokeStyle = sticky.id === selectedStickyId ? '#2563eb' : 'rgba(15,23,42,0.16)';
            ctx.lineWidth = sticky.id === selectedStickyId ? 2.5 : 1;
            drawRoundedRect(
              ctx,
              sticky.x - sticky.w / 2,
              sticky.y - sticky.h / 2,
              sticky.w,
              sticky.h,
              8
            );
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
            ctx.stroke();

            ctx.fillStyle = '#1e293b';
            ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const lines = wrapTextLines(ctx, sticky.text, sticky.w - 20);
            const lh = 16;
            const maxLines = Math.max(1, Math.floor((sticky.h - 16) / lh));
            lines.slice(0, maxLines).forEach((ln, idx) => {
              ctx.fillText(ln, sticky.x - sticky.w / 2 + 10, sticky.y - sticky.h / 2 + 10 + idx * lh);
            });
            ctx.restore();
          }

          // 5. Marquee Selection Box
          if (gestureRef.current.mode === 'marquee') {
            const m = gestureRef.current;
            const mx = Math.min(m.startWx, m.currWx);
            const my = Math.min(m.startWy, m.currWy);
            const mw = Math.abs(m.currWx - m.startWx);
            const mh = Math.abs(m.currWy - m.startWy);
            ctx.save();
            ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.fillRect(mx, my, mw, mh);
            ctx.strokeRect(mx, my, mw, mh);
            ctx.restore();
          }

          // 6. Eraser / Highlighter Eraser Cursor Ring
          if ((tool === 'eraser' || tool === 'highlight_eraser') && pointerWorldRef.current) {
            const p = pointerWorldRef.current;
            const r = (tool === 'highlight_eraser' ? 16 : 14) / cam.scale;
            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fillStyle =
              tool === 'highlight_eraser'
                ? 'rgba(250, 204, 21, 0.22)'
                : 'rgba(239, 68, 68, 0.14)';
            ctx.strokeStyle = tool === 'highlight_eraser' ? '#eab308' : '#ef4444';
            ctx.lineWidth = 1.5 / cam.scale;
            ctx.setLineDash([4 / cam.scale, 3 / cam.scale]);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          ctx.restore(); // End world transform
          ctx.restore(); // End DPR scale

          // Render Interactive Minimap Radar
          if (showMinimap && minimapRef.current) {
            drawMinimap(minimapRef.current, g, cam, w, h, theme, (bounds) => {
              minimapBoundsRef.current = bounds;
            });
          }
        }
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [
    connectSourceId,
    highlightedEdgeIds,
    highlightedNodeIds,
    matchingNodeIds,
    presence,
    selectedEdgeId,
    selectedNodeIds,
    selectedStickyId,
    showMinimap,
    theme,
    tool,
    uid,
  ]);

  const hasSelection = selectedNodeIds.length > 0 || selectedEdgeId !== null || selectedStickyId !== null;

  const inspectActiveSelection = () => {
    if (selectedNodeIds.length > 0) {
      const n = graph.nodes.find((item) => item.id === selectedNodeIds[0]);
      if (n) onInspectNode(n);
    } else if (selectedEdgeId) {
      const e = graph.edges.find((item) => item.id === selectedEdgeId);
      if (e) onInspectEdge(e);
    } else if (selectedStickyId) {
      const s = graph.stickies.find((item) => item.id === selectedStickyId);
      if (s) onInspectSticky(s);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      {/* Main 60fps HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onPointerLeave={() => {
          pointerWorldRef.current = null;
        }}
        className={`w-full h-full block touch-none ${
          tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
      />

      {/* Top Floating Workspace Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xs max-w-full">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px] sm:max-w-[260px]">
            {board.title}
          </span>
          <span className="text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
            {graph.nodes.length}N / {graph.edges.length}E
          </span>
          {board.kind === 'shared' && board.inviteCode && (
            <>
              <span className="text-xs text-slate-400">·</span>
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400">
                {board.inviteCode}
              </span>
            </>
          )}
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xs">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            onClick={() => setShowSearch((s) => !s)}
            title="Search & Filter Nodes (Ctrl+F)"
            className={`p-1.5 rounded-lg transition-colors ${
              showSearch || searchQuery
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowLayersPanel((s) => !s)}
            title="Layers & Alignment"
            className={`p-1.5 rounded-lg transition-colors ${
              showLayersPanel
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowLegend((s) => !s)}
            title="Toggle Legend"
            className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
              showLegend
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Legend
          </button>

          {board.kind === 'shared' && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
              <button
                onClick={onOpenComments}
                title="Board Comments"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="tabular-nums">{commentCount}</span>
              </button>
              <button
                onClick={onOpenCollaborators}
                title="Collaborators & Invite"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="tabular-nums">{board.memberUids?.length ?? 1}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search / Filter Floating Bar */}
      {showSearch && (
        <div className="absolute top-16 right-3 z-20 w-72 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by label, tag, metadata..."
            className="flex-1 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          {searchQuery && (
            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
              {matchingNodeIds?.size ?? 0}
            </span>
          )}
          <button
            onClick={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Layers & Alignment Popover */}
      {showLayersPanel && (
        <div className="absolute top-16 right-3 z-20 w-72 p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5 text-xs text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Layers</span>
            <button
              onClick={() => setShowLayersPanel(false)}
              className="p-0.5 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5">
            {graph.layers.map((layer) => (
              <div
                key={layer.name}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
              >
                <span className="font-medium">{layer.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleLayerProp(layer.name, 'visible')}
                    title={layer.visible ? 'Hide layer' : 'Show layer'}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  <button
                    onClick={() => toggleLayerProp(layer.name, 'locked')}
                    title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <span className="font-semibold block">
              Alignment ({selectedNodeIds.length} selected)
            </span>
            <div className="grid grid-cols-5 gap-1">
              <button
                onClick={() => alignSelected('left')}
                disabled={selectedNodeIds.length < 2}
                title="Align Left"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex justify-center"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => alignSelected('centerH')}
                disabled={selectedNodeIds.length < 2}
                title="Center Horizontal"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex justify-center"
              >
                <AlignCenterHorizontal className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => alignSelected('top')}
                disabled={selectedNodeIds.length < 2}
                title="Align Top"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex justify-center"
              >
                <AlignStartVertical className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => alignSelected('distH')}
                disabled={selectedNodeIds.length < 2}
                title="Distribute Horizontal"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex justify-center"
              >
                <Columns3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => alignSelected('distV')}
                disabled={selectedNodeIds.length < 2}
                title="Distribute Vertical"
                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 flex justify-center"
              >
                <Rows3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={clearHighlightInk}
              disabled={!graph.strokes.some((s) => s.tool === 'highlight')}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-700 dark:hover:text-amber-300 disabled:opacity-40"
            >
              <Eraser className="w-3.5 h-3.5 text-amber-500" />
              Clear Highlights Only ({graph.strokes.filter((s) => s.tool === 'highlight').length})
            </button>
            <button
              onClick={clearFreehandInk}
              disabled={graph.strokes.length === 0}
              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 disabled:opacity-40"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear All Freehand Ink ({graph.strokes.length})
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Floating Legend */}
      {showLegend && legendEntries.length > 0 && (
        <div className="absolute top-16 left-3 z-20 p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5 text-xs text-slate-900 dark:text-slate-100 min-w-[160px]">
          <div className="font-semibold text-[11px] text-slate-500">Legend</div>
          {legendEntries.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded border border-slate-400 shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate capitalize">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Connect Mode Banner */}
      {tool === 'connect' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium shadow-sm">
          {connectSourceId
            ? 'Click target node (or same node for self-loop)'
            : 'Click source node to start connection'}
        </div>
      )}

      {/* Bottom Mode & Zoom Toolbar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-nowrap items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto max-w-full">
          {(
            [
              { id: 'select', icon: MousePointer2, label: 'Select', title: 'Select (V)' },
              { id: 'add_node', icon: PlusSquare, label: 'Add Node', title: 'Add Node (N)' },
              { id: 'connect', icon: Spline, label: 'Connect', title: 'Connect (C)' },
              { id: 'sticky', icon: StickyIcon, label: 'Sticky', title: 'Sticky Note (S)' },
              { id: 'pen', icon: Pen, label: 'Pen', title: 'Pen (P)' },
              { id: 'highlight', icon: Highlighter, label: 'Highlight', title: 'Highlighter (H)' },
              { id: 'eraser', icon: Eraser, label: 'Eraser', title: 'Ink Eraser (X)' },
              {
                id: 'highlight_eraser',
                icon: Eraser,
                label: 'HL Eraser',
                title: 'Highlighter Eraser — erases highlights only (Shift+X)',
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tool === item.id;
            const isHlEraser = item.id === 'highlight_eraser';
            return (
              <button
                key={item.id}
                onClick={() => {
                  setConnectSourceId(null);
                  setTool(item.id);
                }}
                title={item.title}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? isHlEraser
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="relative inline-flex items-center">
                  <Icon className="w-3.5 h-3.5" />
                  {isHlEraser && (
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                        active ? 'bg-slate-950' : 'bg-amber-400'
                      }`}
                    />
                  )}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}

          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

          <button
            onClick={() => setMultiMode((m) => !m)}
            title="Toggle Multi-Select"
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              multiMode
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Multi
          </button>

          {hasSelection && (
            <>
              <button
                onClick={inspectActiveSelection}
                title="Inspect Selected Element"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Inspect</span>
              </button>
              <button
                onClick={handleDeleteSelected}
                title="Delete Selected"
                className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Zoom + Minimap Toggle */}
        <div className="pointer-events-auto flex items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xs text-xs text-slate-700 dark:text-slate-200">
          <button
            onClick={() => handleZoomButton(0.85)}
            title="Zoom Out"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono px-1.5 min-w-[44px] text-center tabular-nums">{zoomPct}%</span>
          <button
            onClick={() => handleZoomButton(1.18)}
            title="Zoom In"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleResetView}
            title="Fit / Reset View"
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <button
            onClick={() => setShowMinimap((m) => !m)}
            title="Toggle Minimap Radar"
            className={`p-1.5 rounded-lg ${
              showMinimap
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Minimap Radar (bottom-right above toolbar) */}
      {showMinimap && (
        <div className="absolute bottom-24 sm:bottom-16 right-3 z-20 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-sm bg-white/90 dark:bg-slate-900/90">
          <canvas
            ref={minimapRef}
            width={176}
            height={116}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              minimapDragRef.current = true;
              panFromMinimapEvent(e);
            }}
            onPointerMove={(e) => {
              if (minimapDragRef.current) panFromMinimapEvent(e);
            }}
            onPointerUp={() => {
              minimapDragRef.current = false;
            }}
            onPointerCancel={() => {
              minimapDragRef.current = false;
            }}
            className="block cursor-pointer touch-none"
          />
        </div>
      )}
    </div>
  );
};

// --- Canvas Drawing Primitives ---

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.48);
  ctx.lineTo(-size * 0.78, 0);
  ctx.lineTo(-size, size * 0.48);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function samplePointAlongPolyline(pts: { x: number; y: number }[], t: number) {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(l);
    total += l;
  }
  if (total === 0) return pts[0];
  let target = t * total;
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i] || i === segLens.length - 1) {
      const frac = segLens[i] > 0 ? target / segLens[i] : 0;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * frac,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * frac,
      };
    }
    target -= segLens[i];
  }
  return pts[pts.length - 1];
}

function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  fill: string,
  border: string
) {
  const { x, y, w, h, shape } = node;
  const hw = w / 2;
  const hh = h / 2;
  ctx.fillStyle = fill;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.6;

  switch (shape) {
    case 'text':
      return;
    case 'rectangle':
    case 'table':
      ctx.beginPath();
      ctx.rect(x - hw, y - hh, w, h);
      ctx.fill();
      ctx.stroke();
      return;
    case 'square': {
      const side = Math.min(w, h);
      drawRoundedRect(ctx, x - side / 2, y - side / 2, side, side, 6);
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'circle':
      ctx.beginPath();
      ctx.ellipse(x, y, hw, hh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(x, y + hh);
      ctx.lineTo(x - hw, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x, y - hh);
      ctx.lineTo(x + hw, y + hh);
      ctx.lineTo(x - hw, y + hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    case 'hexagon': {
      const inset = Math.min(hw * 0.28, 22);
      ctx.beginPath();
      ctx.moveTo(x - hw + inset, y - hh);
      ctx.lineTo(x + hw - inset, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(x + hw - inset, y + hh);
      ctx.lineTo(x - hw + inset, y + hh);
      ctx.lineTo(x - hw, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'parallelogram': {
      const skew = Math.min(hw * 0.25, 20);
      ctx.beginPath();
      ctx.moveTo(x - hw + skew, y - hh);
      ctx.lineTo(x + hw, y - hh);
      ctx.lineTo(x + hw - skew, y + hh);
      ctx.lineTo(x - hw, y + hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'star': {
      const pts = getStarPolygon(x, y, hw, hh);
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'cylinder': {
      const cap = Math.min(14, hh * 0.28);
      ctx.beginPath();
      ctx.moveTo(x - hw, y - hh + cap);
      ctx.lineTo(x - hw, y + hh - cap);
      ctx.ellipse(x, y + hh - cap, hw, cap, 0, Math.PI, 0, true);
      ctx.lineTo(x + hw, y - hh + cap);
      ctx.ellipse(x, y - hh + cap, hw, cap, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - hh + cap, hw, cap, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'cloud': {
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.55, y + hh * 0.65);
      ctx.bezierCurveTo(x - hw * 1.05, y + hh * 0.65, x - hw * 1.0, y - hh * 0.3, x - hw * 0.55, y - hh * 0.35);
      ctx.bezierCurveTo(x - hw * 0.45, y - hh * 1.0, x + hw * 0.35, y - hh * 1.0, x + hw * 0.48, y - hh * 0.38);
      ctx.bezierCurveTo(x + hw * 1.0, y - hh * 0.35, x + hw * 1.05, y + hh * 0.65, x + hw * 0.52, y + hh * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'callout': {
      const bodyBottom = y + hh * 0.58;
      ctx.beginPath();
      ctx.moveTo(x - hw + 10, y - hh);
      ctx.lineTo(x + hw - 10, y - hh);
      ctx.quadraticCurveTo(x + hw, y - hh, x + hw, y - hh + 10);
      ctx.lineTo(x + hw, bodyBottom - 10);
      ctx.quadraticCurveTo(x + hw, bodyBottom, x + hw - 10, bodyBottom);
      ctx.lineTo(x - hw * 0.2, bodyBottom);
      ctx.lineTo(x - hw * 0.48, y + hh);
      ctx.lineTo(x - hw * 0.45, bodyBottom);
      ctx.lineTo(x - hw + 10, bodyBottom);
      ctx.quadraticCurveTo(x - hw, bodyBottom, x - hw, bodyBottom - 10);
      ctx.lineTo(x - hw, y - hh + 10);
      ctx.quadraticCurveTo(x - hw, y - hh, x - hw + 10, y - hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'progress_bar':
    case 'rounded':
    default:
      drawRoundedRect(ctx, x - hw, y - hh, w, h, 12);
      ctx.fill();
      ctx.stroke();
  }
}

function drawNodeLabelAndIcon(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  theme: ThemeMode
) {
  const safe = getShapeSafeTextBox(node);
  const icon = node.icon?.trim() || '';
  const pos = node.iconPosition ?? 'inline';
  const textColor =
    theme === 'high_contrast'
      ? '#ffffff'
      : node.shape === 'text'
      ? theme === 'dark'
        ? '#f8fafc'
        : '#0f172a'
      : node.textColor || getContrastTextColor(node.color);

  const label = icon && pos === 'inline' ? `${icon} ${node.text}` : node.text;
  let availW = safe.maxW;
  let availH = safe.maxH - (node.progress !== null && node.progress !== undefined ? 10 : 0);
  let textCenterX = node.x;
  let textCenterY = node.y + safe.offsetY - (node.progress !== null && node.progress !== undefined ? 4 : 0);

  if (icon && pos === 'top') {
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, node.x, node.y - node.h * 0.22 + safe.offsetY);
    availH = Math.max(18, availH * 0.62);
    textCenterY += node.h * 0.14;
  } else if (icon && pos === 'left') {
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, node.x - safe.maxW * 0.36, textCenterY);
    availW = Math.max(32, availW * 0.72);
    textCenterX += safe.maxW * 0.12;
  }

  const layout = computeFittedTextLayout(ctx, label, availW, Math.max(14, availH), node.fs ?? 13);
  ctx.font = `600 ${layout.fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = textCenterY - ((layout.lines.length - 1) * layout.lineHeight) / 2;
  layout.lines.forEach((line, i) => {
    ctx.fillText(line, textCenterX, startY + i * layout.lineHeight);
  });
}

function drawTableContent(ctx: CanvasRenderingContext2D, node: GraphNode, theme: ThemeMode) {
  const table = node.tableData;
  if (!table) return;
  const x0 = node.x - node.w / 2;
  const y0 = node.y - node.h / 2;
  const cols = Math.max(1, table.headers.length);
  const totalRows = 2 + table.rows.length; // title + header + data rows
  const rowH = node.h / totalRows;
  const colW = node.w / cols;

  // Title bar
  ctx.fillStyle = theme === 'high_contrast' ? '#18181b' : '#1e293b';
  ctx.fillRect(x0 + 1, y0 + 1, node.w - 2, rowH);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.text || 'Data Table', node.x, y0 + rowH / 2, node.w - 12);

  // Header row
  ctx.fillStyle = theme === 'high_contrast' ? '#27272a' : '#e2e8f0';
  ctx.fillRect(x0 + 1, y0 + rowH, node.w - 2, rowH);
  ctx.fillStyle = theme === 'high_contrast' ? '#ffffff' : '#0f172a';
  ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  table.headers.forEach((h, ci) => {
    ctx.fillText(h, x0 + ci * colW + colW / 2, y0 + rowH * 1.5, colW - 8);
  });

  // Data rows
  ctx.font = '400 10px "JetBrains Mono", monospace';
  table.rows.forEach((row, ri) => {
    const ry = y0 + (ri + 2) * rowH;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, ry);
    ctx.lineTo(x0 + node.w, ry);
    ctx.stroke();

    ctx.fillStyle = theme === 'high_contrast' ? '#ffffff' : '#1e293b';
    for (let ci = 0; ci < cols; ci++) {
      ctx.fillText(row[ci] ?? '', x0 + ci * colW + colW / 2, ry + rowH / 2, colW - 8);
    }
  });

  // Vertical column dividers
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 0.8;
  for (let ci = 1; ci < cols; ci++) {
    ctx.beginPath();
    ctx.moveTo(x0 + ci * colW, y0 + rowH);
    ctx.lineTo(x0 + ci * colW, y0 + node.h);
    ctx.stroke();
  }
}

function drawMinimap(
  canvas: HTMLCanvasElement,
  graph: GraphDocument,
  cam: Camera,
  viewW: number,
  viewH: number,
  theme: ThemeMode,
  onBounds: (b: { minX: number; minY: number; scale: number; w: number; h: number }) => void
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const mw = canvas.width;
  const mh = canvas.height;

  ctx.clearRect(0, 0, mw, mh);
  ctx.fillStyle = theme === 'light' ? 'rgba(248, 250, 252, 0.95)' : 'rgba(15, 23, 42, 0.95)';
  ctx.fillRect(0, 0, mw, mh);

  let minX = -cam.ox / cam.scale;
  let minY = -cam.oy / cam.scale;
  let maxX = (viewW - cam.ox) / cam.scale;
  let maxY = (viewH - cam.oy) / cam.scale;

  for (const n of graph.nodes) {
    minX = Math.min(minX, n.x - n.w / 2 - 60);
    minY = Math.min(minY, n.y - n.h / 2 - 60);
    maxX = Math.max(maxX, n.x + n.w / 2 + 60);
    maxY = Math.max(maxY, n.y + n.h / 2 + 60);
  }
  const gw = Math.max(400, maxX - minX);
  const gh = Math.max(300, maxY - minY);
  const s = Math.min((mw - 12) / gw, (mh - 12) / gh);
  const offX = minX - 6 / s;
  const offY = minY - 6 / s;

  onBounds({ minX: offX, minY: offY, scale: s, w: mw, h: mh });

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  ctx.strokeStyle = theme === 'light' ? 'rgba(100,116,139,0.5)' : 'rgba(148,163,184,0.45)';
  ctx.lineWidth = 1;
  for (const e of graph.edges) {
    const a = nodeMap.get(e.a);
    const b = nodeMap.get(e.b);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo((a.x - offX) * s, (a.y - offY) * s);
    ctx.lineTo((b.x - offX) * s, (b.y - offY) * s);
    ctx.stroke();
  }

  for (const n of graph.nodes) {
    ctx.fillStyle = n.color || '#93c5fd';
    ctx.fillRect(
      (n.x - n.w / 2 - offX) * s,
      (n.y - n.h / 2 - offY) * s,
      Math.max(4, n.w * s),
      Math.max(3, n.h * s)
    );
  }

  // Viewport red rectangle
  const vx = (-cam.ox / cam.scale - offX) * s;
  const vy = (-cam.oy / cam.scale - offY) * s;
  const vw = (viewW / cam.scale) * s;
  const vh = (viewH / cam.scale) * s;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vx, vy, vw, vh);
}

// --- Eraser Geometry Helpers ---

function pointToSegmentDistSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

function segmentsIntersectOrClose(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
  tol: number
): boolean {
  const tolSq = tol * tol;
  if (
    pointToSegmentDistSq(ax1, ay1, bx1, by1, bx2, by2) <= tolSq ||
    pointToSegmentDistSq(ax2, ay2, bx1, by1, bx2, by2) <= tolSq ||
    pointToSegmentDistSq(bx1, by1, ax1, ay1, ax2, ay2) <= tolSq ||
    pointToSegmentDistSq(bx2, by2, ax1, ay1, ax2, ay2) <= tolSq
  ) {
    return true;
  }
  const ccw = (p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number) =>
    (p3y - p1y) * (p2x - p1x) > (p2y - p1y) * (p3x - p1x);
  return (
    ccw(ax1, ay1, bx1, by1, bx2, by2) !== ccw(ax2, ay2, bx1, by1, bx2, by2) &&
    ccw(ax1, ay1, ax2, ay2, bx1, by1) !== ccw(ax1, ay1, ax2, ay2, bx2, by2)
  );
}
