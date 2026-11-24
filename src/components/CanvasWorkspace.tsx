import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignLeft,
  AlignStartVertical,
  Atom,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  FileDown,
  FolderInput,
  Highlighter,
  Layers,
  Lock,
  Map as MapIcon,
  Maximize2,
  MessageSquare,
  MoreVertical,
  MousePointer2,
  Pen,
  Pencil,
  Plus,
  PlusSquare,
  Redo2,
  Rows3,
  Search,
  Shapes,
  SlidersHorizontal,
  Smile,
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
  GraphPage,
  IconPosition,
  NodeShape,
  StickyNote,
  ThemeMode,
  ToolMode,
  WorkspaceBoard,
} from '../types/linkdraw';
import {
  ALL_NODE_SHAPES,
  buildEntityMap,
  computeEdgeCurvatureFromPoint,
  computeEdgeGeometry,
  computeMindmapVisibility,
  computeParallelEdgeIndexMap,
  hitTestEdge,
  hitTestNode,
  hitTestSticky,
  wrapTextLines,
} from '../lib/geometry';
import {
  drawArrowhead,
  drawNodeLabelAndIcon,
  drawNodeShape,
  drawRoundedRect,
  drawTableContent,
  samplePointAlongPolyline,
} from '../lib/canvasRenderer';
import { filterGraphByPage, normalizePages } from '../lib/templates';
import { exportBoardToPDF } from '../lib/pdfExport';
import { DiagramStudioModal, type DiagramImportPayload } from './DiagramStudioModal';
import { IconEmojiTray, NodeIconBadge } from './IconEmojiTray';
import { makeSafeId } from '../lib/firestoreSync';

interface CanvasWorkspaceProps {
  board: WorkspaceBoard;
  uid: string;
  graph: GraphDocument;
  fullGraph?: GraphDocument;
  pages: GraphPage[];
  activePageId: string;
  pageNodeCounts: Record<string, number>;
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
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onMovePage: (pageId: string, direction: -1 | 1) => void;
  onMoveSelectionToPage: (targetPageId: string) => void;
  onCommitGraph: (nextGraph: GraphDocument, recordUndo?: boolean) => void;
  onSelectionChange: (nodeIds: string[], edgeId: string | null, stickyId: string | null) => void;
  onInspectNode: (node: GraphNode) => void;
  onInspectEdge: (edge: GraphEdge) => void;
  onInspectSticky: (sticky: StickyNote) => void;
  onOpenComments: () => void;
  onOpenCollaborators: () => void;
  onNotify?: (msg: string) => void;
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

type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface ResizeHitTarget {
  entityKind: 'node' | 'sticky';
  id: string;
  handle: ResizeHandleDir;
  x: number;
  y: number;
}

const DRAWABLE_SHAPES: { value: NodeShape; label: string }[] = [
  { value: 'rectangle', label: 'Rect' },
  { value: 'rounded', label: 'Round' },
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'star', label: 'Star' },
  { value: 'parallelogram', label: 'Para' },
  { value: 'callout', label: 'Callout' },
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'resistor', label: 'Resistor' },
  { value: 'capacitor', label: 'Capacitor' },
  { value: 'inductor', label: 'Inductor' },
  { value: 'battery', label: 'DC Source' },
  { value: 'ground', label: 'Ground' },
  { value: 'diode', label: 'Diode' },
  { value: 'bulb', label: 'Lamp' },
  { value: 'switch_sym', label: 'Switch' },
  { value: 'and_gate', label: 'AND Gate' },
  { value: 'or_gate', label: 'OR Gate' },
  { value: 'not_gate', label: 'NOT Gate' },
  { value: 'transistor', label: 'Transistor' },
  { value: 'spring', label: 'Spring' },
  { value: 'pulley', label: 'Pulley' },
  { value: 'incline', label: 'Incline' },
  { value: 'lens', label: 'Convex Lens' },
  { value: 'wave', label: 'Sine Wave' },
  { value: 'axes_2d', label: '2D Axes' },
  { value: 'vector_arrow', label: 'Vector' },
  { value: 'angle_arc', label: 'Angle Arc' },
  { value: 'venn_2', label: 'Venn 2-Set' },
  { value: 'bell_curve', label: 'Bell Curve' },
  { value: 'cube_3d', label: '3D Cube' },
  { value: 'cone_3d', label: '3D Cone' },
  { value: 'matrix_box', label: 'Matrix' },
];

const SHAPE_SWATCHES = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#e0e7ff', '#fce7f3', '#ffffff', '#1e293b'];
const BORDER_SWATCHES = ['#2563eb', '#0f172a', '#dc2626', '#059669', '#d97706', '#7c3aed', '#f8fafc'];
const PEN_SWATCHES = ['#1e293b', '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#f8fafc'];

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  board,
  uid,
  graph,
  fullGraph,
  pages,
  activePageId,
  pageNodeCounts,
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
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  onMovePage,
  onMoveSelectionToPage,
  onCommitGraph,
  onSelectionChange,
  onInspectNode,
  onInspectEdge,
  onInspectSticky,
  onOpenComments,
  onOpenCollaborators,
  onNotify,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<ToolMode>('select');
  const [multiMode, setMultiMode] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLayersPanel, setShowLayersPanel] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [pdfScope, setPdfScope] = useState<'current' | 'all'>('current');
  const [pdfOrientation, setPdfOrientation] = useState<'auto' | 'landscape' | 'portrait'>('auto');
  const [pdfWhiteBg, setPdfWhiteBg] = useState(true);
  const [pdfIncludeSummary, setPdfIncludeSummary] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showDiagramStudio, setShowDiagramStudio] = useState(false);
  const [showIconTray, setShowIconTray] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchTypeFilter, setSearchTypeFilter] = useState<'all' | 'nodes' | 'stickies'>('all');
  const [searchStyleFilter, setSearchStyleFilter] = useState<
    'any' | 'filled' | 'unfilled' | 'connected' | 'isolated'
  >('any');
  const [searchShapeFilter, setSearchShapeFilter] = useState<string>('all');
  const [searchColorFilter, setSearchColorFilter] = useState<string>('all');
  const [searchTagFilter, setSearchTagFilter] = useState<string>('all');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);

  // Draw Shape tool config
  const [drawShapeType, setDrawShapeType] = useState<NodeShape>('rectangle');
  const [drawShapeFilled, setDrawShapeFilled] = useState(true);
  const [drawShapeFillColor, setDrawShapeFillColor] = useState('#dbeafe');
  const [drawShapeBorderColor, setDrawShapeBorderColor] = useState('#2563eb');
  const [drawShapeBorderWidth, setDrawShapeBorderWidth] = useState(2);

  // Pen / Highlight tool config
  const [penColor, setPenColor] = useState<string>('');
  const [penWidth, setPenWidth] = useState<number>(3);
  const [highlightColor, setHighlightColor] = useState<string>('#facc15');

  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [zoomPct, setZoomPct] = useState(100);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState('');
  const [showPageMenu, setShowPageMenu] = useState(false);

  // Ephemeral camera & drag state stored in refs for 60fps loop without React re-render overhead
  const cameraRef = useRef<Camera>({ ox: 420, oy: 280, scale: 1 });
  const pageCamerasRef = useRef<Map<string, Camera>>(new Map());
  const liveGraphRef = useRef<GraphDocument>(graph);
  const drawShapeConfigRef = useRef({
    shape: drawShapeType,
    filled: drawShapeFilled,
    fillColor: drawShapeFillColor,
    borderColor: drawShapeBorderColor,
    borderWidth: drawShapeBorderWidth,
  });
  drawShapeConfigRef.current = {
    shape: drawShapeType,
    filled: drawShapeFilled,
    fillColor: drawShapeFillColor,
    borderColor: drawShapeBorderColor,
    borderWidth: drawShapeBorderWidth,
  };
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<
    | { mode: 'none' }
    | { mode: 'pan'; lastX: number; lastY: number }
    | { mode: 'pinch'; lastDist: number; lastCx: number; lastCy: number }
    | { mode: 'drag_nodes'; startWx: number; startWy: number; origins: Map<string, { x: number; y: number }>; moved: boolean }
    | { mode: 'drag_sticky'; id: string; startWx: number; startWy: number; origX: number; origY: number; moved: boolean }
    | {
        mode: 'resize_entity';
        entityKind: 'node' | 'sticky';
        id: string;
        handle: ResizeHandleDir;
        startWx: number;
        startWy: number;
        origX: number;
        origY: number;
        origW: number;
        origH: number;
        moved: boolean;
      }
    | { mode: 'draw_shape'; startWx: number; startWy: number; currWx: number; currWy: number }
    | { mode: 'drag_edge_curve'; id: string; isSelfLoop: boolean; labelYOffset: number; moved: boolean }
    | { mode: 'marquee'; startWx: number; startWy: number; currWx: number; currWy: number }
    | { mode: 'draw_stroke'; stroke: FreehandStroke }
    | { mode: 'erase_stroke'; onlyHighlight: boolean; lastWx: number; lastWy: number; erasedAny: boolean }
  >({ mode: 'none' });
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);
  const badgeHitsRef = useRef<BadgeHitTarget[]>([]);
  const resizeHandlesRef = useRef<ResizeHitTarget[]>([]);
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
      gestureRef.current.mode !== 'resize_entity' &&
      gestureRef.current.mode !== 'draw_shape' &&
      gestureRef.current.mode !== 'drag_edge_curve' &&
      gestureRef.current.mode !== 'draw_stroke' &&
      gestureRef.current.mode !== 'erase_stroke'
    ) {
      liveGraphRef.current = graph;
    }
  }, [graph]);

  // Center/restore camera per board & page
  const viewKey = `${board.id}::${activePageId}`;
  useEffect(() => {
    setConnectSourceId(null);
    setShowPageMenu(false);
    setEditingPageId(null);
    const el = containerRef.current;
    if (el) {
      const saved = pageCamerasRef.current.get(viewKey);
      if (saved) {
        cameraRef.current = { ...saved };
      } else {
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
      }
      setZoomPct(Math.round(cameraRef.current.scale * 100));
    }
    return () => {
      pageCamerasRef.current.set(viewKey, { ...cameraRef.current });
    };
  }, [viewKey]);

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
        else if (k === 'd') setTool('draw_shape');
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
    const stickies = liveGraphRef.current.stickies;
    if (nodes.length === 0 && stickies.length === 0) {
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
      for (const s of stickies) {
        minX = Math.min(minX, s.x - s.w / 2);
        minY = Math.min(minY, s.y - s.h / 2);
        maxX = Math.max(maxX, s.x + s.w / 2);
        maxY = Math.max(maxY, s.y + s.h / 2);
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
    const deletedEntityIds = new Set(selectedNodeIds);
    if (selectedStickyId) deletedEntityIds.add(selectedStickyId);
    const next: GraphDocument = {
      ...g,
      nodes: g.nodes.filter((n) => !deletedEntityIds.has(n.id)),
      edges: g.edges.filter(
        (e) =>
          e.id !== selectedEdgeId &&
          !deletedEntityIds.has(e.a) &&
          !deletedEntityIds.has(e.b)
      ),
      stickies: g.stickies.filter((s) => !deletedEntityIds.has(s.id)),
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

  const getViewportWorldCenter = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return toWorld(rect.width / 2, rect.height / 2);
  };

  const firstSelectedNode = useMemo(() => {
    if (selectedNodeIds.length === 0) return null;
    const firstId = selectedNodeIds[0];
    return graph.nodes.find((n) => n.id === firstId) ?? null;
  }, [graph.nodes, selectedNodeIds]);

  const applyIconToSelectedNodes = (updates: { icon?: string; iconPosition?: IconPosition }) => {
    if (selectedNodeIds.length === 0) return;
    const selSet = new Set(selectedNodeIds);
    const now = Date.now();
    const next: GraphDocument = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        selSet.has(n.id) && !n.locked
          ? {
              ...n,
              ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
              ...(updates.iconPosition !== undefined ? { iconPosition: updates.iconPosition } : {}),
              updatedAt: now,
            }
          : n
      ),
    };
    liveGraphRef.current = next;
    onCommitGraph(next, true);
  };

  const handleImportDiagram = (payload: DiagramImportPayload) => {
    if (payload.nodes.length === 0 && payload.stickies.length === 0) return;

    const center = getViewportWorldCenter();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    payload.nodes.forEach((n) => {
      minX = Math.min(minX, n.x - n.w / 2);
      minY = Math.min(minY, n.y - n.h / 2);
      maxX = Math.max(maxX, n.x + n.w / 2);
      maxY = Math.max(maxY, n.y + n.h / 2);
    });
    payload.stickies.forEach((s) => {
      minX = Math.min(minX, s.x - s.w / 2);
      minY = Math.min(minY, s.y - s.h / 2);
      maxX = Math.max(maxX, s.x + s.w / 2);
      maxY = Math.max(maxY, s.y + s.h / 2);
    });

    const srcCx = Number.isFinite(minX) ? (minX + maxX) / 2 : 0;
    const srcCy = Number.isFinite(minY) ? (minY + maxY) / 2 : 0;
    const dx = snapCoord(Math.round(center.x - srcCx));
    const dy = snapCoord(Math.round(center.y - srcCy));

    const now = Date.now();
    const idMap = new Map<string, string>();
    payload.nodes.forEach((n) => idMap.set(n.id, makeSafeId('n')));
    payload.stickies.forEach((s) => idMap.set(s.id, makeSafeId('s')));

    const importedNodes: GraphNode[] = payload.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id) ?? makeSafeId('n'),
      x: Math.round(n.x + dx),
      y: Math.round(n.y + dy),
      tags: [...(n.tags ?? [])],
      metadata: { ...(n.metadata ?? {}) },
      tableData: n.tableData
        ? {
            headers: [...n.tableData.headers],
            rows: n.tableData.rows.map((r) => [...r]),
          }
        : n.tableData,
      createdAt: now,
      updatedAt: now,
    }));

    const importedStickies: StickyNote[] = payload.stickies.map((s) => ({
      ...s,
      id: idMap.get(s.id) ?? makeSafeId('s'),
      x: Math.round(s.x + dx),
      y: Math.round(s.y + dy),
      tags: s.tags ? [...s.tags] : undefined,
      createdAt: now,
      updatedAt: now,
    }));

    const importedEdges: GraphEdge[] = payload.edges
      .filter((e) => idMap.has(e.a) && idMap.has(e.b))
      .map((e) => ({
        ...e,
        id: makeSafeId('e'),
        a: idMap.get(e.a)!,
        b: idMap.get(e.b)!,
        createdAt: now,
        updatedAt: now,
      }));

    const next: GraphDocument = {
      ...graph,
      nodes: [...graph.nodes, ...importedNodes],
      edges: [...graph.edges, ...importedEdges],
      stickies: [...graph.stickies, ...importedStickies],
    };

    liveGraphRef.current = next;
    onCommitGraph(next, true);
    onSelectionChange(
      importedNodes.map((n) => n.id),
      null,
      importedNodes.length === 0 ? (importedStickies[0]?.id ?? null) : null
    );
    setShowDiagramStudio(false);
    setTool('select');
    onNotify?.(`Imported "${payload.title}" to canvas.`);
  };

  const handleExportPdfReport = () => {
    setExportingPdf(true);
    try {
      const currentPage = pages.find((p) => p.id === activePageId) ?? pages[0];
      let pagesToExport: { page: GraphPage; graph: GraphDocument }[] = [];
      if (pdfScope === 'all' && pages.length > 1 && fullGraph) {
        const normPages = normalizePages(fullGraph.pages ?? pages);
        pagesToExport = normPages.map((pg) => ({
          page: pg,
          graph: pg.id === activePageId ? liveGraphRef.current : filterGraphByPage(fullGraph, pg.id),
        }));
      } else {
        pagesToExport = [{ page: currentPage, graph: liveGraphRef.current }];
      }

      const filename = exportBoardToPDF({
        board,
        pagesToExport,
        orientation: pdfOrientation,
        printWhiteBackground: pdfWhiteBg,
        theme,
        includeSummaryPage: pdfIncludeSummary,
      });
      setShowPdfMenu(false);
      onNotify?.(`Exported PDF report "${filename}".`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to generate PDF.';
      onNotify?.(`PDF export failed: ${msg}`);
    } finally {
      setExportingPdf(false);
    }
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

  const availableSearchTags = useMemo(() => {
    const tags = new Set<string>();
    for (const n of graph.nodes) {
      for (const t of n.tags) if (t.trim()) tags.add(t.trim());
    }
    for (const s of graph.stickies) {
      for (const t of s.tags ?? []) if (t.trim()) tags.add(t.trim());
    }
    return [...tags].sort();
  }, [graph.nodes, graph.stickies]);

  const availableSearchColors = useMemo(() => {
    const colors = new Set<string>();
    for (const n of graph.nodes) {
      if (n.filled !== false && n.color) colors.add(n.color.toLowerCase());
      if (n.borderColor) colors.add(n.borderColor.toLowerCase());
    }
    for (const s of graph.stickies) {
      if (s.color) colors.add(s.color.toLowerCase());
    }
    return [...colors].slice(0, 10);
  }, [graph.nodes, graph.stickies]);

  const hasSearchFilter =
    Boolean(searchQuery.trim()) ||
    searchTypeFilter !== 'all' ||
    searchStyleFilter !== 'any' ||
    searchShapeFilter !== 'all' ||
    searchColorFilter !== 'all' ||
    searchTagFilter !== 'all';

  // Search & filter matching set (covers BOTH nodes and sticky notes as first-class entities)
  const { matchingEntityIds, matchingEntityList } = useMemo(() => {
    if (!hasSearchFilter) {
      return {
        matchingEntityIds: null as Set<string> | null,
        matchingEntityList: [] as { id: string; kind: 'node' | 'sticky'; x: number; y: number }[],
      };
    }

    const q = searchQuery.trim().toLowerCase();
    const deg = new Map<string, number>();
    for (const e of graph.edges) {
      deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
      deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
    }

    const set = new Set<string>();
    const list: { id: string; kind: 'node' | 'sticky'; x: number; y: number }[] = [];

    if (searchTypeFilter !== 'stickies') {
      for (const n of graph.nodes) {
        if (searchStyleFilter === 'filled' && n.filled === false) continue;
        if (searchStyleFilter === 'unfilled' && n.filled !== false) continue;
        if (searchStyleFilter === 'connected' && (deg.get(n.id) ?? 0) === 0) continue;
        if (searchStyleFilter === 'isolated' && (deg.get(n.id) ?? 0) > 0) continue;
        if (searchShapeFilter === 'sticky') continue;
        if (searchShapeFilter !== 'all' && n.shape !== searchShapeFilter) continue;
        if (
          searchColorFilter !== 'all' &&
          n.color.toLowerCase() !== searchColorFilter &&
          (n.borderColor ?? '').toLowerCase() !== searchColorFilter
        ) {
          continue;
        }
        if (searchTagFilter !== 'all' && !n.tags.some((t) => t.trim() === searchTagFilter)) {
          continue;
        }

        if (q) {
          const metaStr = Object.entries(n.metadata || {})
            .map(([k, v]) => `${k}:${v}`)
            .join(' ')
            .toLowerCase();
          const hitsQuery =
            n.text.toLowerCase().includes(q) ||
            n.shape.toLowerCase().includes(q) ||
            n.tags.some((t) => t.toLowerCase().includes(q)) ||
            metaStr.includes(q);
          if (!hitsQuery) continue;
        }

        set.add(n.id);
        list.push({ id: n.id, kind: 'node', x: n.x, y: n.y });
      }
    }

    if (searchTypeFilter !== 'nodes') {
      for (const s of graph.stickies) {
        if (searchStyleFilter === 'filled' || searchStyleFilter === 'unfilled') continue;
        if (searchStyleFilter === 'connected' && (deg.get(s.id) ?? 0) === 0) continue;
        if (searchStyleFilter === 'isolated' && (deg.get(s.id) ?? 0) > 0) continue;
        if (searchShapeFilter !== 'all' && searchShapeFilter !== 'sticky') continue;
        if (searchColorFilter !== 'all' && s.color.toLowerCase() !== searchColorFilter) continue;
        if (
          searchTagFilter !== 'all' &&
          !(s.tags ?? []).some((t) => t.trim() === searchTagFilter)
        ) {
          continue;
        }

        if (q) {
          const hitsQuery =
            s.text.toLowerCase().includes(q) ||
            'sticky note'.includes(q) ||
            (s.tags ?? []).some((t) => t.toLowerCase().includes(q));
          if (!hitsQuery) continue;
        }

        set.add(s.id);
        list.push({ id: s.id, kind: 'sticky', x: s.x, y: s.y });
      }
    }

    return { matchingEntityIds: set, matchingEntityList: list };
  }, [
    graph.edges,
    graph.nodes,
    graph.stickies,
    hasSearchFilter,
    searchColorFilter,
    searchQuery,
    searchShapeFilter,
    searchStyleFilter,
    searchTagFilter,
    searchTypeFilter,
  ]);

  const jumpToSearchMatch = (idxOffset: number) => {
    if (matchingEntityList.length === 0 || !containerRef.current) return;
    const nextIdx = (searchMatchIdx + idxOffset + matchingEntityList.length) % matchingEntityList.length;
    setSearchMatchIdx(nextIdx);
    const target = matchingEntityList[nextIdx];
    const rect = containerRef.current.getBoundingClientRect();
    const cam = cameraRef.current;
    cam.ox = rect.width / 2 - target.x * cam.scale;
    cam.oy = rect.height / 2 - target.y * cam.scale;
    if (target.kind === 'node') {
      onSelectionChange([target.id], null, null);
    } else {
      onSelectionChange([], null, target.id);
    }
  };

  const resetSearchFilters = () => {
    setSearchQuery('');
    setSearchTypeFilter('all');
    setSearchStyleFilter('any');
    setSearchShapeFilter('all');
    setSearchColorFilter('all');
    setSearchTagFilter('all');
    setSearchMatchIdx(0);
  };

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

    // Active Draw / Erase / Create tools take precedence over node/badge clicks so users can draw freely OVER any element
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

    if (tool === 'draw_shape') {
      const sxWorld = snapCoord(wx);
      const syWorld = snapCoord(wy);
      gestureRef.current = {
        mode: 'draw_shape',
        startWx: sxWorld,
        startWy: syWorld,
        currWx: sxWorld,
        currWy: syWorld,
      };
      return;
    }

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

    if (tool === 'pen' || tool === 'highlight') {
      const resolvedPenColor = penColor || (theme === 'light' ? '#1e293b' : '#f8fafc');
      const stroke: FreehandStroke = {
        id: makeSafeId('st'),
        points: [{ x: wx, y: wy }],
        color: tool === 'pen' ? resolvedPenColor : highlightColor || '#facc15',
        width: tool === 'pen' ? penWidth : 16,
        tool,
        layer: 'Annotations',
        createdAt: Date.now(),
      };
      gestureRef.current = { mode: 'draw_stroke', stroke };
      return;
    }

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

    // Check Selected Entity Resize Handles first in Select mode
    if (tool === 'select') {
      const handleTol = 11 / cameraRef.current.scale;
      for (const rh of resizeHandlesRef.current) {
        if (Math.hypot(wx - rh.x, wy - rh.y) <= handleTol) {
          if (rh.entityKind === 'node') {
            const target = g.nodes.find((n) => n.id === rh.id);
            if (target && !target.locked) {
              gestureRef.current = {
                mode: 'resize_entity',
                entityKind: 'node',
                id: target.id,
                handle: rh.handle,
                startWx: wx,
                startWy: wy,
                origX: target.x,
                origY: target.y,
                origW: target.w,
                origH: target.h,
                moved: false,
              };
              return;
            }
          } else {
            const target = g.stickies.find((s) => s.id === rh.id);
            if (target) {
              gestureRef.current = {
                mode: 'resize_entity',
                entityKind: 'sticky',
                id: target.id,
                handle: rh.handle,
                startWx: wx,
                startWy: wy,
                origX: target.x,
                origY: target.y,
                origW: target.w,
                origH: target.h,
                moved: false,
              };
              return;
            }
          }
        }
      }
    }

    // Check Mindmap Collapse Toggle Badge
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

    // Compute visible nodes (excluding collapsed mindmap subtrees) & stickies
    const { hiddenNodes } = computeMindmapVisibility(g.nodes, g.edges);
    const visibleNodes = g.nodes.filter(
      (n) => !hiddenNodes.has(n.id) && isLayerInteractive(n.layer)
    );
    const visibleStickies = g.stickies.filter((s) => isLayerInteractive(s.layer));

    // Hit-test filled nodes first, then stickies, then unfilled outline shapes (so inner items inside an unfilled frame stay clickable!)
    let hitFilledNode: GraphNode | null = null;
    let hitUnfilledNode: GraphNode | null = null;
    for (let i = visibleNodes.length - 1; i >= 0; i--) {
      const candidate = visibleNodes[i];
      if (!hitTestNode(wx, wy, candidate)) continue;
      if (candidate.filled === false) {
        if (!hitUnfilledNode) hitUnfilledNode = candidate;
      } else {
        hitFilledNode = candidate;
        break;
      }
    }

    let hitSticky: StickyNote | null = null;
    if (!hitFilledNode) {
      for (let i = visibleStickies.length - 1; i >= 0; i--) {
        if (hitTestSticky(wx, wy, visibleStickies[i])) {
          hitSticky = visibleStickies[i];
          break;
        }
      }
    }

    const hitNode = hitFilledNode ?? (!hitSticky ? hitUnfilledNode : null);

    // Tool: Connect (supports both Nodes and Sticky Notes!)
    if (tool === 'connect') {
      const targetEntity = hitNode
        ? { id: hitNode.id, kind: 'node' as const }
        : hitSticky
        ? { id: hitSticky.id, kind: 'sticky' as const }
        : null;

      if (targetEntity) {
        if (!connectSourceId) {
          setConnectSourceId(targetEntity.id);
          if (targetEntity.kind === 'node') {
            onSelectionChange([targetEntity.id], null, null);
          } else {
            onSelectionChange([], null, targetEntity.id);
          }
        } else {
          const now = Date.now();
          const newEdge: GraphEdge = {
            id: makeSafeId('e'),
            a: connectSourceId,
            b: targetEntity.id,
            label: connectSourceId === targetEntity.id ? 'Self-Loop' : '',
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

    // Tool: Select -> Node
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

    // Tool: Select -> Sticky Note
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

    // Hit-test edges (supports both Node and Sticky endpoints)
    const entityMap = buildEntityMap(g.nodes, g.stickies);
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
      const geom = computeEdgeGeometry(edge, entityMap, parallelMap.get(edge.id));
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

    if (gest.mode === 'resize_entity') {
      const minW = gest.entityKind === 'sticky' ? 72 : 32;
      const minH = gest.entityKind === 'sticky' ? 52 : 28;
      let left = gest.origX - gest.origW / 2;
      let right = gest.origX + gest.origW / 2;
      let top = gest.origY - gest.origH / 2;
      let bottom = gest.origY + gest.origH / 2;
      const sxSnap = snapCoord(wx);
      const sySnap = snapCoord(wy);

      if (gest.handle.includes('w')) left = Math.min(right - minW, sxSnap);
      if (gest.handle.includes('e')) right = Math.max(left + minW, sxSnap);
      if (gest.handle.includes('n')) top = Math.min(bottom - minH, sySnap);
      if (gest.handle.includes('s')) bottom = Math.max(top + minH, sySnap);

      const nextX = (left + right) / 2;
      const nextY = (top + bottom) / 2;
      const nextW = Math.round(right - left);
      const nextH = Math.round(bottom - top);
      if (Math.hypot(wx - gest.startWx, wy - gest.startWy) > 1.5) gest.moved = true;

      const g = liveGraphRef.current;
      if (gest.entityKind === 'node') {
        liveGraphRef.current = {
          ...g,
          nodes: g.nodes.map((n) =>
            n.id === gest.id ? { ...n, x: nextX, y: nextY, w: nextW, h: nextH } : n
          ),
        };
      } else {
        liveGraphRef.current = {
          ...g,
          stickies: g.stickies.map((s) =>
            s.id === gest.id ? { ...s, x: nextX, y: nextY, w: nextW, h: nextH } : s
          ),
        };
      }
      return;
    }

    if (gest.mode === 'draw_shape') {
      gest.currWx = snapCoord(wx);
      gest.currWy = snapCoord(wy);
      return;
    }

    if (gest.mode === 'drag_edge_curve') {
      const g = liveGraphRef.current;
      const edge = g.edges.find((item) => item.id === gest.id);
      if (edge) {
        const entityMap = buildEntityMap(g.nodes, g.stickies);
        const src = entityMap.get(edge.a);
        const dst = entityMap.get(edge.b);
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

    if (gest.mode === 'resize_entity') {
      gestureRef.current = { mode: 'none' };
      if (gest.moved) {
        const now = Date.now();
        const committed: GraphDocument = {
          ...liveGraphRef.current,
          nodes:
            gest.entityKind === 'node'
              ? liveGraphRef.current.nodes.map((n) =>
                  n.id === gest.id ? { ...n, updatedAt: now } : n
                )
              : liveGraphRef.current.nodes,
          stickies:
            gest.entityKind === 'sticky'
              ? liveGraphRef.current.stickies.map((s) =>
                  s.id === gest.id ? { ...s, updatedAt: now } : s
                )
              : liveGraphRef.current.stickies,
        };
        liveGraphRef.current = committed;
        onCommitGraph(committed, true);
      }
      return;
    }

    if (gest.mode === 'draw_shape') {
      gestureRef.current = { mode: 'none' };
      const rawW = Math.abs(gest.currWx - gest.startWx);
      const rawH = Math.abs(gest.currWy - gest.startWy);
      const isClick = rawW < 10 && rawH < 10;
      const cfg = drawShapeConfigRef.current;
      const isCompactSquare =
        cfg.shape === 'circle' || cfg.shape === 'square' || cfg.shape === 'diamond' || cfg.shape === 'star';
      const w = isClick ? (isCompactSquare ? 100 : 156) : Math.max(32, Math.round(rawW));
      const h = isClick ? (isCompactSquare ? 100 : 88) : Math.max(28, Math.round(rawH));
      const cx = isClick ? gest.startWx : (gest.startWx + gest.currWx) / 2;
      const cy = isClick ? gest.startWy : (gest.startWy + gest.currWy) / 2;
      const now = Date.now();
      const newShapeNode: GraphNode = {
        id: makeSafeId('n'),
        x: cx,
        y: cy,
        w,
        h,
        text: '',
        shape: cfg.shape,
        color: cfg.fillColor,
        filled: cfg.filled,
        borderColor: cfg.borderColor,
        borderWidth: cfg.borderWidth,
        icon: '',
        iconPosition: 'inline',
        tags: [],
        metadata: {},
        layer: 'Data',
        createdAt: now,
        updatedAt: now,
      };
      const next: GraphDocument = {
        ...liveGraphRef.current,
        nodes: [...liveGraphRef.current.nodes, newShapeNode],
      };
      liveGraphRef.current = next;
      onSelectionChange([newShapeNode.id], null, null);
      onCommitGraph(next, true);
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
          const nodeMap = buildEntityMap(g.nodes, g.stickies);
          const selNodeSet = new Set(selectedNodeIds);

          const allStrokes =
            gestureRef.current.mode === 'draw_stroke'
              ? [...g.strokes, gestureRef.current.stroke]
              : g.strokes;

          // 1. Edges (rendered under nodes, stickies, and strokes)
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
              matchingEntityIds &&
              !matchingEntityIds.has(edge.a) &&
              !matchingEntityIds.has(edge.b);

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

          // 2. Nodes & Shapes (layer-ordered with viewport culling & presence selection rings)
          const badgeHits: BadgeHitTarget[] = [];
          const presenceByNode = new Map<string, CollabPresence[]>();
          for (const p of presence) {
            if (p.uid !== uid && p.selectedNodeId) {
              const arr = presenceByNode.get(p.selectedNodeId) ?? [];
              arr.push(p);
              presenceByNode.set(p.selectedNodeId, arr);
            }
          }

          const layerRank = (layer: CanvasLayerName) =>
            layer === 'Background' ? 0 : layer === 'Data' ? 1 : 2;
          const orderedNodes = [...g.nodes].sort(
            (a, b) => layerRank(a.layer) - layerRank(b.layer)
          );

          for (const node of orderedNodes) {
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
            const dimmed = matchingEntityIds ? !matchingEntityIds.has(node.id) : false;

            ctx.save();
            ctx.globalAlpha = dimmed ? 0.16 : 1;

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

            // Draw Node Shape (filled or outline)
            const fill = theme === 'high_contrast' ? '#000000' : node.color || '#dbeafe';
            const border =
              theme === 'high_contrast'
                ? '#ffffff'
                : isSelected
                ? '#2563eb'
                : node.borderColor || (theme === 'dark' ? '#64748b' : '#334155');

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

          // 3. Sticky Notes (first-class graph entities: search fading, connect rings, tags)
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
            const isSelected = sticky.id === selectedStickyId;
            const isAlgoHighlight = highlightedNodeIds.has(sticky.id);
            const isConnectSrc = connectSourceId === sticky.id;
            const dimmed = matchingEntityIds ? !matchingEntityIds.has(sticky.id) : false;

            ctx.save();
            ctx.globalAlpha = dimmed ? 0.16 : 1;

            if (isSelected || isAlgoHighlight || isConnectSrc) {
              ctx.save();
              ctx.strokeStyle = isAlgoHighlight ? '#f59e0b' : '#2563eb';
              ctx.lineWidth = 3;
              drawRoundedRect(
                ctx,
                sticky.x - sticky.w / 2 - 5,
                sticky.y - sticky.h / 2 - 5,
                sticky.w + 10,
                sticky.h + 10,
                12
              );
              ctx.stroke();
              ctx.restore();
            }

            ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = sticky.color || '#fef08a';
            ctx.strokeStyle = isSelected ? '#2563eb' : 'rgba(15,23,42,0.18)';
            ctx.lineWidth = isSelected ? 2.2 : 1;
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
            const hasTags = (sticky.tags?.length ?? 0) > 0;
            const reservedBottom = hasTags ? 24 : 12;
            const maxLines = Math.max(1, Math.floor((sticky.h - 10 - reservedBottom) / lh));
            lines.slice(0, maxLines).forEach((ln, idx) => {
              ctx.fillText(ln, sticky.x - sticky.w / 2 + 10, sticky.y - sticky.h / 2 + 10 + idx * lh);
            });

            if (hasTags && sticky.h >= 64) {
              const tagLabel = sticky.tags!.slice(0, 3).map((t) => `#${t}`).join(' ');
              ctx.font = '600 10px "JetBrains Mono", monospace';
              ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
              ctx.textBaseline = 'bottom';
              ctx.fillText(
                tagLabel,
                sticky.x - sticky.w / 2 + 10,
                sticky.y + sticky.h / 2 - 7,
                sticky.w - 20
              );
            }
            ctx.restore();
          }

          // 4. Highlighter Strokes (drawn over nodes/stickies with translucent ink)
          for (const st of allStrokes) {
            if (st.tool !== 'highlight' || layerVisible.get(st.layer) === false || st.points.length < 2) {
              continue;
            }
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
            ctx.globalAlpha = matchingEntityIds ? 0.14 : 0.34;
            ctx.stroke();
            ctx.restore();
          }

          // 5. Pen Strokes (drawn ON TOP of edges, nodes, stickies, and highlights)
          for (const st of allStrokes) {
            if (st.tool === 'highlight' || layerVisible.get(st.layer) === false || st.points.length < 2) {
              continue;
            }
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
            ctx.globalAlpha = matchingEntityIds ? 0.35 : 0.94;
            ctx.stroke();
            ctx.restore();
          }

          // 6. Live Draw Shape Rubber-band Preview
          if (gestureRef.current.mode === 'draw_shape') {
            const ds = gestureRef.current;
            const cfg = drawShapeConfigRef.current;
            const previewW = Math.max(24, Math.abs(ds.currWx - ds.startWx));
            const previewH = Math.max(20, Math.abs(ds.currWy - ds.startWy));
            const previewCx = (ds.startWx + ds.currWx) / 2;
            const previewCy = (ds.startWy + ds.currWy) / 2;
            const previewNode: GraphNode = {
              id: '_preview',
              x: previewCx,
              y: previewCy,
              w: previewW,
              h: previewH,
              text: '',
              shape: cfg.shape,
              color: cfg.fillColor,
              filled: cfg.filled,
              borderColor: cfg.borderColor,
              borderWidth: cfg.borderWidth,
              tags: [],
              metadata: {},
              layer: 'Data',
              createdAt: 0,
              updatedAt: 0,
            };
            ctx.save();
            ctx.globalAlpha = 0.85;
            drawNodeShape(ctx, previewNode, cfg.fillColor, cfg.borderColor);
            ctx.setLineDash([4 / cam.scale, 3 / cam.scale]);
            ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
            ctx.lineWidth = 1 / cam.scale;
            ctx.strokeRect(
              previewCx - previewW / 2,
              previewCy - previewH / 2,
              previewW,
              previewH
            );
            ctx.setLineDash([]);
            ctx.font = '600 10px "JetBrains Mono", monospace';
            const sizeBadge = `${Math.round(previewW)} × ${Math.round(previewH)}`;
            const sbw = ctx.measureText(sizeBadge).width + 10;
            ctx.fillStyle = '#0f172a';
            drawRoundedRect(ctx, previewCx - sbw / 2, previewCy + previewH / 2 + 8, sbw, 18, 5);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sizeBadge, previewCx, previewCy + previewH / 2 + 17);
            ctx.restore();
          }

          // 7. 8-Point Resize Handles for single selected Node/Shape or Sticky Note
          const nextResizeHandles: ResizeHitTarget[] = [];
          if (tool === 'select') {
            let targetBox: { kind: 'node' | 'sticky'; id: string; x: number; y: number; w: number; h: number } | null =
              null;
            if (selectedNodeIds.length === 1) {
              const n = g.nodes.find((item) => item.id === selectedNodeIds[0]);
              const l = n ? g.layers.find((ly) => ly.name === n.layer) : undefined;
              if (n && !n.locked && !hiddenNodes.has(n.id) && (!l || (l.visible && !l.locked))) {
                targetBox = { kind: 'node', id: n.id, x: n.x, y: n.y, w: n.w, h: n.h };
              }
            } else if (selectedStickyId) {
              const s = g.stickies.find((item) => item.id === selectedStickyId);
              const l = s ? g.layers.find((ly) => ly.name === s.layer) : undefined;
              if (s && (!l || (l.visible && !l.locked))) {
                targetBox = { kind: 'sticky', id: s.id, x: s.x, y: s.y, w: s.w, h: s.h };
              }
            }

            if (targetBox) {
              const hw = targetBox.w / 2;
              const hh = targetBox.h / 2;
              const pts: { dir: ResizeHandleDir; x: number; y: number }[] = [
                { dir: 'nw', x: targetBox.x - hw, y: targetBox.y - hh },
                { dir: 'n', x: targetBox.x, y: targetBox.y - hh },
                { dir: 'ne', x: targetBox.x + hw, y: targetBox.y - hh },
                { dir: 'e', x: targetBox.x + hw, y: targetBox.y },
                { dir: 'se', x: targetBox.x + hw, y: targetBox.y + hh },
                { dir: 's', x: targetBox.x, y: targetBox.y + hh },
                { dir: 'sw', x: targetBox.x - hw, y: targetBox.y + hh },
                { dir: 'w', x: targetBox.x - hw, y: targetBox.y },
              ];
              const hs = 7 / cam.scale;
              ctx.save();
              ctx.fillStyle = '#ffffff';
              ctx.strokeStyle = '#2563eb';
              ctx.lineWidth = 1.6 / cam.scale;
              for (const pt of pts) {
                nextResizeHandles.push({
                  entityKind: targetBox.kind,
                  id: targetBox.id,
                  handle: pt.dir,
                  x: pt.x,
                  y: pt.y,
                });
                ctx.fillRect(pt.x - hs / 2, pt.y - hs / 2, hs, hs);
                ctx.strokeRect(pt.x - hs / 2, pt.y - hs / 2, hs, hs);
              }
              ctx.restore();
            }
          }
          resizeHandlesRef.current = nextResizeHandles;

          // 8. Marquee Selection Box
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

          // 9. Eraser / Highlighter Eraser Cursor Ring
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
    matchingEntityIds,
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

  const activePageIndex = Math.max(0, pages.findIndex((p) => p.id === activePageId));
  const activePageObj = pages[activePageIndex] ?? pages[0];

  const startRenamePage = (pg: GraphPage) => {
    setEditingPageId(pg.id);
    setEditingPageTitle(pg.title);
    setShowPageMenu(false);
  };

  const commitRenamePage = () => {
    if (!editingPageId) return;
    const trimmed = editingPageTitle.trim();
    if (trimmed) {
      onRenamePage(editingPageId, trimmed);
    }
    setEditingPageId(null);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none">
      {/* Multi-Page Tab Strip */}
      <div className="relative z-30 h-10 px-2.5 flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
          {pages.map((pg, idx) => {
            const isActive = pg.id === activePageId;
            const nodeCount = pageNodeCounts[pg.id] ?? 0;
            const isEditing = editingPageId === pg.id;
            return (
              <div
                key={pg.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {isEditing ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingPageTitle}
                    onChange={(e) => setEditingPageTitle(e.target.value)}
                    onBlur={commitRenamePage}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRenamePage();
                      if (e.key === 'Escape') setEditingPageId(null);
                    }}
                    className="w-28 px-1 py-0 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-blue-400 rounded focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPageMenu(false);
                      if (!isActive) onSelectPage(pg.id);
                    }}
                    onDoubleClick={() => startRenamePage(pg)}
                    title={`${pg.title} (Double-click to rename)`}
                    className="inline-flex items-center gap-1.5 text-left"
                  >
                    <span className="text-[10px] font-mono opacity-60 tabular-nums">{idx + 1}</span>
                    <span className="max-w-[140px] truncate">{pg.title}</span>
                    {nodeCount > 0 && (
                      <span
                        className={`text-[10px] font-mono tabular-nums px-1 rounded ${
                          isActive
                            ? 'bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {nodeCount}
                      </span>
                    )}
                  </button>
                )}

                {isActive && !isEditing && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRenamePage(pg);
                    }}
                    title="Rename page"
                    className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 opacity-70 hover:opacity-100"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              setShowPageMenu(false);
              onAddPage();
            }}
            title="Add new page"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Page</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPageMenu((v) => !v)}
            title="Active page actions"
            className={`p-1.5 rounded-lg transition-colors ${
              showPageMenu
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Active Page Actions Popover */}
        {showPageMenu && activePageObj && (
          <div className="absolute right-2.5 top-full mt-1.5 z-40 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg p-1.5 text-xs text-slate-800 dark:text-slate-200 space-y-0.5">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800 truncate">
              {activePageObj.title} ({activePageIndex + 1}/{pages.length})
            </div>
            <button
              type="button"
              onClick={() => startRenamePage(activePageObj)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
              Rename Page
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPageMenu(false);
                onDuplicatePage(activePageObj.id);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              Duplicate Page
            </button>
            {pages.length > 1 && (
              <div className="grid grid-cols-2 gap-1 pt-0.5">
                <button
                  type="button"
                  disabled={activePageIndex === 0}
                  onClick={() => {
                    onMovePage(activePageObj.id, -1);
                    setShowPageMenu(false);
                  }}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Move Left
                </button>
                <button
                  type="button"
                  disabled={activePageIndex === pages.length - 1}
                  onClick={() => {
                    onMovePage(activePageObj.id, 1);
                    setShowPageMenu(false);
                  }}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                >
                  Move Right
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {hasSelection && pages.length > 1 && (
              <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5">
                <div className="px-2.5 py-1 text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <FolderInput className="w-3 h-3" />
                  Move Selection To
                </div>
                {pages
                  .filter((p) => p.id !== activePageObj.id)
                  .map((targetPg) => (
                    <button
                      key={targetPg.id}
                      type="button"
                      onClick={() => {
                        setShowPageMenu(false);
                        onMoveSelectionToPage(targetPg.id);
                      }}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-left text-blue-600 dark:text-blue-400"
                    >
                      <span className="truncate">{targetPg.title}</span>
                      <ChevronRight className="w-3 h-3 shrink-0" />
                    </button>
                  ))}
              </div>
            )}

            {pages.length > 1 && (
              <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowPageMenu(false);
                    onDeletePage(activePageObj.id);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Page
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
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
            onClick={() => {
              setShowSearch((s) => !s);
              setShowLayersPanel(false);
              setShowPdfMenu(false);
            }}
            title="Search & Filter Nodes & Stickies (Ctrl+F)"
            className={`relative p-1.5 rounded-lg transition-colors ${
              showSearch || hasSearchFilter
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Search className="w-4 h-4" />
            {hasSearchFilter && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-600" />
            )}
          </button>

          <button
            onClick={() => {
              setShowLayersPanel((s) => !s);
              setShowSearch(false);
              setShowPdfMenu(false);
            }}
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
            onClick={() => {
              setShowPdfMenu((s) => !s);
              setShowLayersPanel(false);
              setShowSearch(false);
            }}
            title="Export Board as PDF Report"
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
              showPdfMenu
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>PDF</span>
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

      {/* Export PDF Report Floating Popover */}
      {showPdfMenu && (
        <div className="absolute top-16 right-3 z-20 w-80 max-w-[calc(100vw-24px)] p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-3.5 text-xs text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <FileDown className="w-4 h-4 text-blue-600" />
              <span>Export PDF Report</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPdfMenu(false)}
              className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {pages.length > 1 && fullGraph && (
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-slate-500">Page Scope</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPdfScope('current')}
                  className={`py-1.5 px-2 rounded-lg border font-medium transition-colors ${
                    pdfScope === 'current'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Current Page
                </button>
                <button
                  type="button"
                  onClick={() => setPdfScope('all')}
                  className={`py-1.5 px-2 rounded-lg border font-medium transition-colors ${
                    pdfScope === 'all'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  All Pages ({pages.length})
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-slate-500">Page Orientation</label>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'auto', label: 'Auto Fit' },
                  { id: 'landscape', label: 'Landscape' },
                  { id: 'portrait', label: 'Portrait' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPdfOrientation(opt.id)}
                  className={`py-1.5 rounded-lg border font-medium transition-colors ${
                    pdfOrientation === opt.id
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700 dark:text-slate-300">Clean White Print Background</span>
              <input
                type="checkbox"
                checked={pdfWhiteBg}
                onChange={(e) => setPdfWhiteBg(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-slate-700 dark:text-slate-300">Include Report Summary Page</span>
              <input
                type="checkbox"
                checked={pdfIncludeSummary}
                onChange={(e) => setPdfIncludeSummary(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdfReport}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingPdf ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>
      )}

      {/* Search & Filter Floating Popover */}
      {showSearch && (
        <div className="absolute top-16 right-3 z-20 w-[320px] sm:w-[348px] max-w-[calc(100vw-24px)] p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-2.5 text-xs text-slate-900 dark:text-slate-100">
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchMatchIdx(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matchingEntityList.length > 0) {
                  e.preventDefault();
                  jumpToSearchMatch(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Search nodes, stickies, tags, metadata..."
              className="flex-1 min-w-0 text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
            />
            {hasSearchFilter && (
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                {matchingEntityList.length > 0
                  ? `${(searchMatchIdx % matchingEntityList.length) + 1}/${matchingEntityList.length}`
                  : '0/0'}
              </span>
            )}
            <button
              type="button"
              disabled={matchingEntityList.length === 0}
              onClick={() => jumpToSearchMatch(-1)}
              title="Previous Match"
              className="p-0.5 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-35"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={matchingEntityList.length === 0}
              onClick={() => jumpToSearchMatch(1)}
              title="Next Match"
              className="p-0.5 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-35"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                resetSearchFilters();
                setShowSearch(false);
              }}
              title="Close & Clear Filters"
              className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Element Type Filter */}
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'nodes', label: 'Nodes' },
                { id: 'stickies', label: 'Stickies' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSearchTypeFilter(opt.id);
                  setSearchMatchIdx(0);
                }}
                className={`py-1 rounded-lg font-medium border transition-colors ${
                  searchTypeFilter === opt.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Style/State & Shape Selects */}
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={searchStyleFilter}
              onChange={(e) => {
                setSearchStyleFilter(
                  e.target.value as 'any' | 'filled' | 'unfilled' | 'connected' | 'isolated'
                );
                setSearchMatchIdx(0);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="any">Any Style / Links</option>
              <option value="filled">Filled Shapes</option>
              <option value="unfilled">Unfilled (Outline)</option>
              <option value="connected">Connected Only</option>
              <option value="isolated">Isolated Only</option>
            </select>

            <select
              value={searchShapeFilter}
              onChange={(e) => {
                setSearchShapeFilter(e.target.value);
                setSearchMatchIdx(0);
              }}
              className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-blue-500 capitalize"
            >
              <option value="all">All Shapes</option>
              <option value="sticky">Sticky Note</option>
              {ALL_NODE_SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tag Filter */}
          {availableSearchTags.length > 0 && (
            <select
              value={searchTagFilter}
              onChange={(e) => {
                setSearchTagFilter(e.target.value);
                setSearchMatchIdx(0);
              }}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Tags ({availableSearchTags.length})</option>
              {availableSearchTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}

          {/* Color Filter Swatches + Reset */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setSearchColorFilter('all');
                  setSearchMatchIdx(0);
                }}
                className={`px-1.5 py-0.5 rounded border text-[11px] font-medium ${
                  searchColorFilter === 'all'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500'
                }`}
              >
                All
              </button>
              {availableSearchColors.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    setSearchColorFilter(searchColorFilter === col ? 'all' : col);
                    setSearchMatchIdx(0);
                  }}
                  title={`Filter by ${col}`}
                  className={`w-4 h-4 rounded border transition-transform ${
                    searchColorFilter === col
                      ? 'border-blue-600 ring-2 ring-blue-500/40 scale-110'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>

            {hasSearchFilter && (
              <button
                type="button"
                onClick={resetSearchFilters}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                Reset
              </button>
            )}
          </div>
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
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium shadow-sm whitespace-nowrap">
          {connectSourceId
            ? 'Click target node or sticky note (or same element for self-loop)'
            : 'Click source node or sticky note to start connection'}
        </div>
      )}

      {/* Draw Shape Floating Config Bar */}
      {tool === 'draw_shape' && (
        <div className="absolute bottom-20 sm:bottom-16 left-3 right-3 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md text-xs text-slate-800 dark:text-slate-200 max-w-full overflow-x-auto">
            <select
              value={drawShapeType}
              onChange={(e) => setDrawShapeType(e.target.value as NodeShape)}
              title="Shape Geometry"
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium focus:outline-none focus:border-blue-500"
            >
              {DRAWABLE_SHAPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setDrawShapeFilled(true)}
                className={`px-2 py-1 font-medium transition-colors ${
                  drawShapeFilled
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                Filled
              </button>
              <button
                type="button"
                onClick={() => setDrawShapeFilled(false)}
                className={`px-2 py-1 font-medium transition-colors ${
                  !drawShapeFilled
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                Unfilled
              </button>
            </div>

            {drawShapeFilled && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-400">Fill</span>
                {SHAPE_SWATCHES.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDrawShapeFillColor(c)}
                    className={`w-4 h-4 rounded border ${
                      drawShapeFillColor.toLowerCase() === c.toLowerCase()
                        ? 'border-blue-600 ring-2 ring-blue-500/40'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={drawShapeFillColor}
                  onChange={(e) => setDrawShapeFillColor(e.target.value)}
                  title="Custom Fill Color"
                  className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-transparent cursor-pointer"
                />
              </div>
            )}

            <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-400">Stroke</span>
              {BORDER_SWATCHES.slice(0, 5).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDrawShapeBorderColor(c)}
                  className={`w-4 h-4 rounded border ${
                    drawShapeBorderColor.toLowerCase() === c.toLowerCase()
                      ? 'border-blue-600 ring-2 ring-blue-500/40'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={drawShapeBorderColor}
                onChange={(e) => setDrawShapeBorderColor(e.target.value)}
                title="Custom Border Color"
                className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-transparent cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-700">
              {[1.5, 2, 4, 6].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setDrawShapeBorderWidth(w)}
                  className={`px-1.5 py-0.5 rounded font-mono text-[11px] border ${
                    drawShapeBorderWidth === w
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pen / Highlight Floating Config Bar */}
      {(tool === 'pen' || tool === 'highlight') && (
        <div className="absolute bottom-20 sm:bottom-16 left-3 right-3 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md text-xs text-slate-800 dark:text-slate-200">
            {tool === 'pen' ? (
              <>
                <span className="text-[11px] font-medium text-slate-400">Pen</span>
                <div className="flex items-center gap-1">
                  {PEN_SWATCHES.map((c) => {
                    const activeCol = penColor || (theme === 'light' ? '#1e293b' : '#f8fafc');
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPenColor(c)}
                        className={`w-4 h-4 rounded-full border ${
                          activeCol.toLowerCase() === c.toLowerCase()
                            ? 'border-blue-600 ring-2 ring-blue-500/40'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    );
                  })}
                  <input
                    type="color"
                    value={penColor || (theme === 'light' ? '#1e293b' : '#f8fafc')}
                    onChange={(e) => setPenColor(e.target.value)}
                    title="Custom Pen Color"
                    className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-transparent cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200 dark:border-slate-700">
                  {[2, 3, 5, 8].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setPenWidth(w)}
                      className={`px-1.5 py-0.5 rounded font-mono text-[11px] border ${
                        penWidth === w
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {w}px
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="text-[11px] font-medium text-slate-400">Highlight</span>
                <div className="flex items-center gap-1.5">
                  {['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#fb923c'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setHighlightColor(c)}
                      className={`w-4 h-4 rounded-full border ${
                        highlightColor.toLowerCase() === c.toLowerCase()
                          ? 'border-blue-600 ring-2 ring-blue-500/40'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={highlightColor}
                    onChange={(e) => setHighlightColor(e.target.value)}
                    title="Custom Highlight Color"
                    className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 bg-transparent cursor-pointer"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Diagram Studio Modal (Custom & Template Diagrams) */}
      {showDiagramStudio && (
        <DiagramStudioModal
          uid={uid}
          theme={theme}
          currentCanvasGraph={graph}
          onImportToCanvas={handleImportDiagram}
          onNotify={onNotify}
          onClose={() => setShowDiagramStudio(false)}
        />
      )}

      {/* Quick Floating Node Icon & Emoji Tray */}
      {showIconTray && selectedNodeIds.length > 0 && firstSelectedNode && (
        <div className="absolute bottom-20 sm:bottom-16 left-1/2 -translate-x-1/2 z-30 w-[330px] max-w-[calc(100vw-24px)] rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xl p-3 text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Smile className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Node Icon &amp; Emoji Tray
                {selectedNodeIds.length > 1 ? ` (${selectedNodeIds.length})` : ''}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowIconTray(false)}
              title="Close Icon Tray"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <IconEmojiTray
            value={firstSelectedNode.icon ?? ''}
            position={firstSelectedNode.iconPosition ?? 'inline'}
            onChangeIcon={(nextIcon) => applyIconToSelectedNodes({ icon: nextIcon })}
            onChangePosition={(nextPos) => applyIconToSelectedNodes({ iconPosition: nextPos })}
            compact
          />
        </div>
      )}

      {/* Bottom Mode & Zoom Toolbar */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-nowrap items-center gap-1 p-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto max-w-full">
          {(
            [
              { id: 'select', icon: MousePointer2, label: 'Select', title: 'Select (V)' },
              { id: 'add_node', icon: PlusSquare, label: 'Add Node', title: 'Add Node (N)' },
              { id: 'draw_shape', icon: Shapes, label: 'Shape', title: 'Draw Shape Filled/Unfilled (D)' },
              { id: 'connect', icon: Spline, label: 'Connect', title: 'Connect Nodes & Stickies (C)' },
              { id: 'sticky', icon: StickyIcon, label: 'Sticky', title: 'Sticky Note (S)' },
              { id: 'pen', icon: Pen, label: 'Pen', title: 'Pen Over Elements (P)' },
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
            type="button"
            onClick={() => setShowDiagramStudio((v) => !v)}
            title="Diagram Studio — Create Custom & Template Diagrams"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              showDiagramStudio
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Atom className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Diagram Studio</span>
          </button>

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
              {selectedNodeIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowIconTray((v) => !v)}
                  title="Choose Icon or Emoji for Selected Node"
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showIconTray
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                  }`}
                >
                  <NodeIconBadge
                    icon={firstSelectedNode?.icon}
                    className="w-3.5 h-3.5"
                    fallback={<Smile className="w-3.5 h-3.5" />}
                  />
                  <span>Icon</span>
                </button>
              )}
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
    </div>
  );
};

// --- Minimap & Eraser Helpers ---

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
  for (const st of graph.stickies) {
    minX = Math.min(minX, st.x - st.w / 2 - 60);
    minY = Math.min(minY, st.y - st.h / 2 - 60);
    maxX = Math.max(maxX, st.x + st.w / 2 + 60);
    maxY = Math.max(maxY, st.y + st.h / 2 + 60);
  }
  const gw = Math.max(400, maxX - minX);
  const gh = Math.max(300, maxY - minY);
  const s = Math.min((mw - 12) / gw, (mh - 12) / gh);
  const offX = minX - 6 / s;
  const offY = minY - 6 / s;

  onBounds({ minX: offX, minY: offY, scale: s, w: mw, h: mh });

  const nodeMap = buildEntityMap(graph.nodes, graph.stickies);
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
    const rx = (n.x - n.w / 2 - offX) * s;
    const ry = (n.y - n.h / 2 - offY) * s;
    const rw = Math.max(4, n.w * s);
    const rh = Math.max(3, n.h * s);
    if (n.filled === false) {
      ctx.strokeStyle = n.borderColor || '#2563eb';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
    } else {
      ctx.fillStyle = n.color || '#93c5fd';
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  for (const st of graph.stickies) {
    ctx.fillStyle = st.color || '#fef08a';
    ctx.fillRect(
      (st.x - st.w / 2 - offX) * s,
      (st.y - st.h / 2 - offY) * s,
      Math.max(4, st.w * s),
      Math.max(3, st.h * s)
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
