import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FolderOpen,
  Grid,
  Maximize2,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Smile,
  Spline,
  StickyNote as StickyIcon,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type {
  ArrowType,
  EdgeRouting,
  GraphDocument,
  GraphEdge,
  GraphNode,
  IconPosition,
  LineStyle,
  NodeShape,
  StickyNote,
  ThemeMode,
} from '../types/linkdraw';
import {
  ALL_NODE_SHAPES,
  buildEntityMap,
  computeEdgeGeometry,
  computeParallelEdgeIndexMap,
  hitTestEdge,
  hitTestNode,
  hitTestSticky,
} from '../lib/geometry';
import { drawRoundedRect, renderGraphSnapshotToContext } from '../lib/canvasRenderer';
import { DEFAULT_LAYERS, DEFAULT_SETTINGS } from '../lib/templates';
import {
  STEM_COMPONENTS,
  STEM_DIAGRAM_KITS,
  type StemCategory,
  type StemComponentPreset,
  type StemDiagramKit,
} from '../lib/stemDiagrams';
import { IconEmojiTray, NodeIconBadge } from './IconEmojiTray';
import { makeSafeId } from '../lib/firestoreSync';

export interface DiagramImportPayload {
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stickies: StickyNote[];
}

export interface SavedCustomDiagram {
  id: string;
  title: string;
  category: StemCategory | 'custom';
  nodes: GraphNode[];
  edges: GraphEdge[];
  stickies: StickyNote[];
  updatedAt: number;
}

interface DiagramStudioModalProps {
  uid: string;
  theme: ThemeMode;
  currentCanvasGraph: GraphDocument;
  onImportToCanvas: (payload: DiagramImportPayload) => void;
  onNotify?: (msg: string) => void;
  onClose: () => void;
}

type StudioTab = 'templates' | 'builder' | 'saved';
type BuilderTool = 'select' | 'connect' | 'sticky';

interface MiniCamera {
  ox: number;
  oy: number;
  scale: number;
}

const STORAGE_KEY_PREFIX = 'linkdraw_custom_diagrams_v1_';
const FILL_SWATCHES = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#e0e7ff', '#fce7f3', '#f1f5f9', '#ffffff'];
const STROKE_SWATCHES = ['#0f172a', '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed'];
const STICKY_SWATCHES = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'];

function cloneElements(
  nodes: GraphNode[],
  edges: GraphEdge[],
  stickies: StickyNote[]
): { nodes: GraphNode[]; edges: GraphEdge[]; stickies: StickyNote[] } {
  return {
    nodes: nodes.map((n) => ({
      ...n,
      tags: [...(n.tags ?? [])],
      metadata: { ...(n.metadata ?? {}) },
      tableData: n.tableData
        ? {
            headers: [...n.tableData.headers],
            rows: n.tableData.rows.map((r) => [...r]),
          }
        : n.tableData,
    })),
    edges: edges.map((e) => ({ ...e })),
    stickies: stickies.map((s) => ({ ...s, tags: s.tags ? [...s.tags] : undefined })),
  };
}

function normalizeDiagramAroundOrigin(
  nodes: GraphNode[],
  edges: GraphEdge[],
  stickies: StickyNote[]
): { nodes: GraphNode[]; edges: GraphEdge[]; stickies: StickyNote[] } {
  const cloned = cloneElements(nodes, edges, stickies);
  if (cloned.nodes.length === 0 && cloned.stickies.length === 0) return cloned;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of cloned.nodes) {
    minX = Math.min(minX, n.x - n.w / 2);
    minY = Math.min(minY, n.y - n.h / 2);
    maxX = Math.max(maxX, n.x + n.w / 2);
    maxY = Math.max(maxY, n.y + n.h / 2);
  }
  for (const s of cloned.stickies) {
    minX = Math.min(minX, s.x - s.w / 2);
    minY = Math.min(minY, s.y - s.h / 2);
    maxX = Math.max(maxX, s.x + s.w / 2);
    maxY = Math.max(maxY, s.y + s.h / 2);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (const n of cloned.nodes) {
    n.x = Math.round(n.x - cx);
    n.y = Math.round(n.y - cy);
  }
  for (const s of cloned.stickies) {
    s.x = Math.round(s.x - cx);
    s.y = Math.round(s.y - cy);
  }
  return cloned;
}

function scaleDiagramElements(
  nodes: GraphNode[],
  edges: GraphEdge[],
  stickies: StickyNote[],
  factor: number
): { nodes: GraphNode[]; edges: GraphEdge[]; stickies: StickyNote[] } {
  const cloned = cloneElements(nodes, edges, stickies);
  if (Math.abs(factor - 1) < 0.01) return cloned;
  for (const n of cloned.nodes) {
    n.x = Math.round(n.x * factor);
    n.y = Math.round(n.y * factor);
    n.w = Math.max(24, Math.round(n.w * factor));
    n.h = Math.max(20, Math.round(n.h * factor));
  }
  for (const s of cloned.stickies) {
    s.x = Math.round(s.x * factor);
    s.y = Math.round(s.y * factor);
    s.w = Math.max(80, Math.round(s.w * factor));
    s.h = Math.max(54, Math.round(s.h * factor));
  }
  return cloned;
}

function loadSavedDiagrams(uid: string): SavedCustomDiagram[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedCustomDiagram[]) : [];
  } catch {
    return [];
  }
}

function persistSavedDiagrams(uid: string, list: SavedCustomDiagram[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, JSON.stringify(list));
  } catch {
    // ignore quota issues silently
  }
}

function buildMiniGraphDoc(
  nodes: GraphNode[],
  edges: GraphEdge[],
  stickies: StickyNote[],
  gridSnap: boolean
): GraphDocument {
  return {
    nodes,
    edges,
    stickies,
    strokes: [],
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
    settings: {
      ...DEFAULT_SETTINGS,
      gridSnap,
      flowAnimation: false,
    },
  };
}

function computeFitCamera(
  width: number,
  height: number,
  nodes: GraphNode[],
  stickies: StickyNote[]
): MiniCamera {
  if (nodes.length === 0 && stickies.length === 0) {
    return { ox: width / 2, oy: height / 2, scale: 1 };
  }
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
  const gw = Math.max(180, maxX - minX + 80);
  const gh = Math.max(140, maxY - minY + 80);
  const scale = Math.max(0.25, Math.min(1.4, Math.min(width / gw, height / gh)));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    ox: width / 2 - cx * scale,
    oy: height / 2 - cy * scale,
    scale,
  };
}

export const DiagramStudioModal: React.FC<DiagramStudioModalProps> = ({
  uid,
  theme,
  currentCanvasGraph,
  onImportToCanvas,
  onNotify,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('templates');
  const [showBuilderIconTray, setShowBuilderIconTray] = useState(false);

  // Saved Custom Diagrams Library
  const [savedDiagrams, setSavedDiagrams] = useState<SavedCustomDiagram[]>(() =>
    loadSavedDiagrams(uid)
  );
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(() => {
    const initial = loadSavedDiagrams(uid);
    return initial[0]?.id ?? null;
  });

  // --- TAB 1: TEMPLATE DIAGRAMS STATE ---
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<'all' | StemCategory>('all');
  const [selectedKitId, setSelectedKitId] = useState<string>(STEM_DIAGRAM_KITS[0].id);
  const [templateScale, setTemplateScale] = useState<number>(1);
  const [templateDraft, setTemplateDraft] = useState<{
    nodes: GraphNode[];
    edges: GraphEdge[];
    stickies: StickyNote[];
  }>(() => STEM_DIAGRAM_KITS[0].build(0, 0, makeSafeId));

  const filteredKits = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    return STEM_DIAGRAM_KITS.filter((k) => {
      if (templateCategory !== 'all' && k.category !== templateCategory) return false;
      if (!q) return true;
      return (
        k.title.toLowerCase().includes(q) ||
        k.summary.toLowerCase().includes(q) ||
        k.category.toLowerCase().includes(q)
      );
    });
  }, [templateCategory, templateSearch]);

  const selectedKit: StemDiagramKit = useMemo(
    () => STEM_DIAGRAM_KITS.find((k) => k.id === selectedKitId) ?? STEM_DIAGRAM_KITS[0],
    [selectedKitId]
  );

  const selectTemplateKit = (kit: StemDiagramKit) => {
    setSelectedKitId(kit.id);
    setTemplateDraft(kit.build(0, 0, makeSafeId));
  };

  // --- TAB 2: CUSTOM DIAGRAM BUILDER STATE ---
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [diagramTitle, setDiagramTitle] = useState('Custom Diagram');
  const [diagramCategory, setDiagramCategory] = useState<StemCategory | 'custom'>('custom');
  const [builderNodes, setBuilderNodes] = useState<GraphNode[]>([]);
  const [builderEdges, setBuilderEdges] = useState<GraphEdge[]>([]);
  const [builderStickies, setBuilderStickies] = useState<StickyNote[]>([]);
  const [builderUndo, setBuilderUndo] = useState<
    { nodes: GraphNode[]; edges: GraphEdge[]; stickies: StickyNote[] }[]
  >([]);

  const [paletteSearch, setPaletteSearch] = useState('');
  const [paletteCat, setPaletteCat] = useState<'all' | StemCategory>('all');
  const [builderTool, setBuilderTool] = useState<BuilderTool>('select');
  const [gridSnap, setGridSnap] = useState(true);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedStickyId, setSelectedStickyId] = useState<string | null>(null);
  const dropCascadeRef = useRef(0);

  const builderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const builderContainerRef = useRef<HTMLDivElement | null>(null);
  const builderCamRef = useRef<MiniCamera>({ ox: 260, oy: 200, scale: 1 });
  const builderDragRef = useRef<
    | { mode: 'none' }
    | { mode: 'pan'; lastX: number; lastY: number }
    | {
        mode: 'drag_node';
        id: string;
        startWx: number;
        startWy: number;
        origX: number;
        origY: number;
        moved: boolean;
      }
    | {
        mode: 'drag_sticky';
        id: string;
        startWx: number;
        startWy: number;
        origX: number;
        origY: number;
        moved: boolean;
      }
  >({ mode: 'none' });
  const pointerWorldRef = useRef<{ x: number; y: number } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const savedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const savedContainerRef = useRef<HTMLDivElement | null>(null);

  const pushBuilderUndo = useCallback(() => {
    setBuilderUndo((prev) => [
      ...prev.slice(-29),
      cloneElements(builderNodes, builderEdges, builderStickies),
    ]);
  }, [builderEdges, builderNodes, builderStickies]);

  const handleBuilderUndo = () => {
    if (builderUndo.length === 0) return;
    const prev = builderUndo[builderUndo.length - 1];
    setBuilderUndo((stk) => stk.slice(0, -1));
    setBuilderNodes(prev.nodes);
    setBuilderEdges(prev.edges);
    setBuilderStickies(prev.stickies);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedStickyId(null);
  };

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === 'Escape') {
        if (connectSourceId) {
          setConnectSourceId(null);
          setBuilderTool('select');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [connectSourceId, onClose]);

  const filteredPalette = useMemo(() => {
    const q = paletteSearch.trim().toLowerCase();
    return STEM_COMPONENTS.filter((c) => {
      if (paletteCat !== 'all' && c.category !== paletteCat) return false;
      if (!q) return true;
      return (
        c.label.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.shape.toLowerCase().includes(q)
      );
    });
  }, [paletteCat, paletteSearch]);

  const snapValue = useCallback(
    (v: number) => (gridSnap ? Math.round(v / 20) * 20 : Math.round(v)),
    [gridSnap]
  );

  const fitBuilderCamera = useCallback(
    (nodes = builderNodes, stickies = builderStickies) => {
      const el = builderContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      builderCamRef.current = computeFitCamera(rect.width, rect.height, nodes, stickies);
    },
    [builderNodes, builderStickies]
  );

  // Center builder camera when switching to builder tab
  useEffect(() => {
    if (activeTab === 'builder') {
      const id = requestAnimationFrame(() => fitBuilderCamera());
      return () => cancelAnimationFrame(id);
    }
  }, [activeTab, fitBuilderCamera]);

  // Render Template Preview or Saved Preview Canvas
  useEffect(() => {
    if (activeTab !== 'templates') return;
    const canvas = previewCanvasRef.current;
    const container = previewContainerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle =
        theme === 'light' ? '#f8fafc' : theme === 'dark' ? '#090d16' : '#000000';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const scaled = scaleDiagramElements(
        templateDraft.nodes,
        templateDraft.edges,
        templateDraft.stickies,
        templateScale
      );
      const cam = computeFitCamera(rect.width, rect.height, scaled.nodes, scaled.stickies);

      // Dot grid
      const dotGap = 20 * cam.scale;
      if (dotGap >= 8) {
        ctx.fillStyle =
          theme === 'light' ? 'rgba(148, 163, 184, 0.32)' : 'rgba(148, 163, 184, 0.16)';
        const startX = ((cam.ox % dotGap) + dotGap) % dotGap;
        const startY = ((cam.oy % dotGap) + dotGap) % dotGap;
        for (let gx = startX; gx < rect.width; gx += dotGap) {
          for (let gy = startY; gy < rect.height; gy += dotGap) {
            ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
          }
        }
      }

      ctx.translate(cam.ox, cam.oy);
      ctx.scale(cam.scale, cam.scale);
      renderGraphSnapshotToContext(
        ctx,
        buildMiniGraphDoc(scaled.nodes, scaled.edges, scaled.stickies, gridSnap),
        theme
      );
      ctx.restore();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [activeTab, gridSnap, templateDraft, templateScale, theme]);

  const selectedSaved = useMemo(
    () => savedDiagrams.find((d) => d.id === selectedSavedId) ?? savedDiagrams[0] ?? null,
    [savedDiagrams, selectedSavedId]
  );

  // Render Saved Library Preview Canvas
  useEffect(() => {
    if (activeTab !== 'saved' || !selectedSaved) return;
    const canvas = savedCanvasRef.current;
    const container = savedContainerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle =
        theme === 'light' ? '#f8fafc' : theme === 'dark' ? '#090d16' : '#000000';
      ctx.fillRect(0, 0, rect.width, rect.height);

      const cam = computeFitCamera(
        rect.width,
        rect.height,
        selectedSaved.nodes,
        selectedSaved.stickies
      );
      ctx.translate(cam.ox, cam.oy);
      ctx.scale(cam.scale, cam.scale);
      renderGraphSnapshotToContext(
        ctx,
        buildMiniGraphDoc(selectedSaved.nodes, selectedSaved.edges, selectedSaved.stickies, true),
        theme
      );
      ctx.restore();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(container);
    return () => ro.disconnect();
  }, [activeTab, selectedSaved, theme]);

  // Render Interactive Builder Canvas
  useEffect(() => {
    if (activeTab !== 'builder') return;
    let rafId = 0;

    const renderLoop = () => {
      const canvas = builderCanvasRef.current;
      const container = builderContainerRef.current;
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const pw = Math.round(rect.width * dpr);
          const ph = Math.round(rect.height * dpr);
          if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
          }
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const cam = builderCamRef.current;
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.fillStyle =
              theme === 'light' ? '#f8fafc' : theme === 'dark' ? '#090d16' : '#000000';
            ctx.fillRect(0, 0, rect.width, rect.height);

            // Dot Grid
            const dotGap = 20 * cam.scale;
            if (dotGap >= 8) {
              ctx.fillStyle =
                theme === 'light' ? 'rgba(148, 163, 184, 0.34)' : 'rgba(148, 163, 184, 0.16)';
              const startX = ((cam.ox % dotGap) + dotGap) % dotGap;
              const startY = ((cam.oy % dotGap) + dotGap) % dotGap;
              for (let gx = startX; gx < rect.width; gx += dotGap) {
                for (let gy = startY; gy < rect.height; gy += dotGap) {
                  ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
                }
              }
            }

            ctx.translate(cam.ox, cam.oy);
            ctx.scale(cam.scale, cam.scale);

            // Crosshair origin marker
            ctx.strokeStyle =
              theme === 'light' ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.2)';
            ctx.lineWidth = 1 / cam.scale;
            ctx.beginPath();
            ctx.moveTo(-12, 0);
            ctx.lineTo(12, 0);
            ctx.moveTo(0, -12);
            ctx.lineTo(0, 12);
            ctx.stroke();

            const doc = buildMiniGraphDoc(builderNodes, builderEdges, builderStickies, gridSnap);
            renderGraphSnapshotToContext(ctx, doc, theme);

            // Rubber-band connect line
            if (builderTool === 'connect' && connectSourceId && pointerWorldRef.current) {
              const eMap = buildEntityMap(builderNodes, builderStickies);
              const src = eMap.get(connectSourceId);
              if (src) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(src.x, src.y);
                ctx.lineTo(pointerWorldRef.current.x, pointerWorldRef.current.y);
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2 / cam.scale;
                ctx.setLineDash([5 / cam.scale, 4 / cam.scale]);
                ctx.stroke();
                ctx.restore();
              }
            }

            // Selection Rings
            if (selectedNodeId) {
              const n = builderNodes.find((item) => item.id === selectedNodeId);
              if (n) {
                ctx.save();
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2.5 / cam.scale;
                drawRoundedRect(
                  ctx,
                  n.x - n.w / 2 - 5,
                  n.y - n.h / 2 - 5,
                  n.w + 10,
                  n.h + 10,
                  10
                );
                ctx.stroke();
                ctx.restore();
              }
            }
            if (selectedStickyId) {
              const s = builderStickies.find((item) => item.id === selectedStickyId);
              if (s) {
                ctx.save();
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2.5 / cam.scale;
                drawRoundedRect(
                  ctx,
                  s.x - s.w / 2 - 5,
                  s.y - s.h / 2 - 5,
                  s.w + 10,
                  s.h + 10,
                  10
                );
                ctx.stroke();
                ctx.restore();
              }
            }
            if (connectSourceId) {
              const eMap = buildEntityMap(builderNodes, builderStickies);
              const src = eMap.get(connectSourceId);
              if (src) {
                ctx.save();
                ctx.strokeStyle = '#16a34a';
                ctx.lineWidth = 2.5 / cam.scale;
                drawRoundedRect(
                  ctx,
                  src.x - src.w / 2 - 6,
                  src.y - src.h / 2 - 6,
                  src.w + 12,
                  src.h + 12,
                  12
                );
                ctx.stroke();
                ctx.restore();
              }
            }
            if (selectedEdgeId) {
              const e = builderEdges.find((item) => item.id === selectedEdgeId);
              const eMap = buildEntityMap(builderNodes, builderStickies);
              const a = e ? eMap.get(e.a) : undefined;
              const b = e ? eMap.get(e.b) : undefined;
              if (a && b) {
                ctx.save();
                ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
                ctx.lineWidth = (e!.width + 6) / cam.scale;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.restore();
              }
            }

            ctx.restore();
          }
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [
    activeTab,
    builderEdges,
    builderNodes,
    builderStickies,
    builderTool,
    connectSourceId,
    gridSnap,
    selectedEdgeId,
    selectedNodeId,
    selectedStickyId,
    theme,
  ]);

  const toMiniWorld = (clientX: number, clientY: number) => {
    const canvas = builderCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = builderCamRef.current;
    return {
      x: (sx - cam.ox) / cam.scale,
      y: (sy - cam.oy) / cam.scale,
    };
  };

  const handleBuilderPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = builderCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const { x: wx, y: wy } = toMiniWorld(e.clientX, e.clientY);
    pointerWorldRef.current = { x: wx, y: wy };

    let hitNode: GraphNode | null = null;
    for (let i = builderNodes.length - 1; i >= 0; i--) {
      if (hitTestNode(wx, wy, builderNodes[i])) {
        hitNode = builderNodes[i];
        break;
      }
    }
    let hitSticky: StickyNote | null = null;
    if (!hitNode) {
      for (let i = builderStickies.length - 1; i >= 0; i--) {
        if (hitTestSticky(wx, wy, builderStickies[i])) {
          hitSticky = builderStickies[i];
          break;
        }
      }
    }
    const entityMap = buildEntityMap(builderNodes, builderStickies);

    if (builderTool === 'sticky') {
      pushBuilderUndo();
      const now = Date.now();
      const st: StickyNote = {
        id: makeSafeId('s'),
        x: snapValue(wx),
        y: snapValue(wy),
        w: 150,
        h: 88,
        text: 'Diagram Note',
        color: '#fef08a',
        tags: [],
        layer: 'Annotations',
        createdAt: now,
        updatedAt: now,
      };
      setBuilderStickies((prev) => [...prev, st]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedStickyId(st.id);
      setBuilderTool('select');
      return;
    }

    if (builderTool === 'connect') {
      const targetId = hitNode?.id ?? hitSticky?.id ?? null;
      if (!targetId) {
        setConnectSourceId(null);
        return;
      }
      if (!connectSourceId) {
        setConnectSourceId(targetId);
        return;
      }
      pushBuilderUndo();
      const now = Date.now();
      const newEdge: GraphEdge = {
        id: makeSafeId('e'),
        a: connectSourceId,
        b: targetId,
        label: '',
        color: '#334155',
        width: 2,
        arrow: 'forward',
        type: connectSourceId === targetId ? 'curved' : 'straight',
        lineStyle: 'solid',
        weight: 1,
        curvature: null,
        layer: 'Data',
        createdAt: now,
        updatedAt: now,
      };
      setBuilderEdges((prev) => [...prev, newEdge]);
      setSelectedNodeId(null);
      setSelectedStickyId(null);
      setSelectedEdgeId(newEdge.id);
      setConnectSourceId(null);
      return;
    }

    // Select & Drag
    if (hitNode) {
      setSelectedNodeId(hitNode.id);
      setSelectedEdgeId(null);
      setSelectedStickyId(null);
      builderDragRef.current = {
        mode: 'drag_node',
        id: hitNode.id,
        startWx: wx,
        startWy: wy,
        origX: hitNode.x,
        origY: hitNode.y,
        moved: false,
      };
      return;
    }

    if (hitSticky) {
      setSelectedStickyId(hitSticky.id);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      builderDragRef.current = {
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

    const parallelMap = computeParallelEdgeIndexMap(builderEdges);
    const edgeTol = 12 / builderCamRef.current.scale;
    let hitEdge: GraphEdge | null = null;
    for (let i = builderEdges.length - 1; i >= 0; i--) {
      const edge = builderEdges[i];
      const geom = computeEdgeGeometry(edge, entityMap, parallelMap.get(edge.id));
      if (geom && hitTestEdge(wx, wy, geom, edge, edgeTol)) {
        hitEdge = edge;
        break;
      }
    }
    if (hitEdge) {
      setSelectedEdgeId(hitEdge.id);
      setSelectedNodeId(null);
      setSelectedStickyId(null);
      return;
    }

    // Pan empty space
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedStickyId(null);
    builderDragRef.current = {
      mode: 'pan',
      lastX: e.clientX,
      lastY: e.clientY,
    };
  };

  const handleBuilderPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x: wx, y: wy } = toMiniWorld(e.clientX, e.clientY);
    pointerWorldRef.current = { x: wx, y: wy };
    const drag = builderDragRef.current;
    if (drag.mode === 'none') return;

    if (drag.mode === 'pan') {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      builderCamRef.current.ox += dx;
      builderCamRef.current.oy += dy;
      return;
    }

    const dx = wx - drag.startWx;
    const dy = wy - drag.startWy;
    if (!drag.moved && Math.hypot(dx, dy) > 2) {
      pushBuilderUndo();
      drag.moved = true;
    }
    if (!drag.moved) return;

    if (drag.mode === 'drag_node') {
      const nx = snapValue(drag.origX + dx);
      const ny = snapValue(drag.origY + dy);
      setBuilderNodes((prev) =>
        prev.map((n) => (n.id === drag.id ? { ...n, x: nx, y: ny, updatedAt: Date.now() } : n))
      );
    } else if (drag.mode === 'drag_sticky') {
      const sx = snapValue(drag.origX + dx);
      const sy = snapValue(drag.origY + dy);
      setBuilderStickies((prev) =>
        prev.map((s) => (s.id === drag.id ? { ...s, x: sx, y: sy, updatedAt: Date.now() } : s))
      );
    }
  };

  const handleBuilderPointerUp = () => {
    builderDragRef.current = { mode: 'none' };
  };

  const handleBuilderWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = builderCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const cam = builderCamRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.max(0.25, Math.min(3, cam.scale * factor));
    cam.ox = sx - (sx - cam.ox) * (newScale / cam.scale);
    cam.oy = sy - (sy - cam.oy) * (newScale / cam.scale);
    cam.scale = newScale;
  };

  const addPaletteComponent = (comp: StemComponentPreset) => {
    pushBuilderUndo();
    const el = builderContainerRef.current;
    const cam = builderCamRef.current;
    let cx = 0;
    let cy = 0;
    if (el) {
      const rect = el.getBoundingClientRect();
      cx = (rect.width / 2 - cam.ox) / cam.scale;
      cy = (rect.height / 2 - cam.oy) / cam.scale;
    }
    const step = (dropCascadeRef.current % 5) * 24 - 40;
    dropCascadeRef.current += 1;
    const now = Date.now();
    const node: GraphNode = {
      id: makeSafeId('n'),
      x: snapValue(cx + step),
      y: snapValue(cy + step),
      w: comp.w,
      h: comp.h,
      text: comp.defaultText,
      shape: comp.shape,
      color: comp.color,
      filled: comp.filled,
      borderColor: comp.borderColor,
      borderWidth: comp.borderWidth,
      fs: 12,
      icon: '',
      iconPosition: 'inline',
      tags: [...comp.tags],
      metadata: { stem_category: comp.category },
      layer: 'Data',
      createdAt: now,
      updatedAt: now,
    };
    setBuilderNodes((prev) => [...prev, node]);
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setSelectedStickyId(null);
    setBuilderTool('select');
  };

  const autoArrangeGrid = () => {
    if (builderNodes.length === 0) return;
    pushBuilderUndo();
    const cols = Math.max(1, Math.ceil(Math.sqrt(builderNodes.length)));
    const gapX = 185;
    const gapY = 125;
    const totalRows = Math.ceil(builderNodes.length / cols);
    const startX = -((cols - 1) * gapX) / 2;
    const startY = -((totalRows - 1) * gapY) / 2;
    setBuilderNodes((prev) =>
      prev.map((n, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          ...n,
          x: Math.round(startX + col * gapX),
          y: Math.round(startY + row * gapY),
          updatedAt: Date.now(),
        };
      })
    );
    requestAnimationFrame(() => fitBuilderCamera());
  };

  const loadTemplateIntoBuilder = (
    title: string,
    category: StemCategory | 'custom',
    nodes: GraphNode[],
    edges: GraphEdge[],
    stickies: StickyNote[],
    savedId: string | null = null
  ) => {
    const norm = normalizeDiagramAroundOrigin(nodes, edges, stickies);
    setBuilderUndo([]);
    setEditingSavedId(savedId);
    setDiagramTitle(title);
    setDiagramCategory(category);
    setBuilderNodes(norm.nodes);
    setBuilderEdges(norm.edges);
    setBuilderStickies(norm.stickies);
    setSelectedNodeId(norm.nodes[0]?.id ?? null);
    setSelectedEdgeId(null);
    setSelectedStickyId(null);
    setBuilderTool('select');
    setActiveTab('builder');
  };

  const loadCurrentBoardIntoBuilder = () => {
    if (
      currentCanvasGraph.nodes.length === 0 &&
      currentCanvasGraph.stickies.length === 0
    ) {
      onNotify?.('Current canvas page is empty.');
      return;
    }
    loadTemplateIntoBuilder(
      'Board Diagram Snapshot',
      'custom',
      currentCanvasGraph.nodes,
      currentCanvasGraph.edges,
      currentCanvasGraph.stickies,
      null
    );
    onNotify?.('Loaded current canvas into Builder.');
  };

  const saveBuilderAsTemplate = () => {
    if (builderNodes.length === 0 && builderStickies.length === 0) {
      onNotify?.('Add at least one node or sticky before saving a template.');
      return;
    }
    const cleanTitle = diagramTitle.trim() || 'Untitled Custom Diagram';
    const norm = normalizeDiagramAroundOrigin(builderNodes, builderEdges, builderStickies);
    const now = Date.now();
    const id = editingSavedId ?? makeSafeId('tpl');
    const record: SavedCustomDiagram = {
      id,
      title: cleanTitle,
      category: diagramCategory,
      nodes: norm.nodes,
      edges: norm.edges,
      stickies: norm.stickies,
      updatedAt: now,
    };
    const nextList = editingSavedId
      ? savedDiagrams.map((d) => (d.id === editingSavedId ? record : d))
      : [record, ...savedDiagrams];
    setSavedDiagrams(nextList);
    persistSavedDiagrams(uid, nextList);
    setEditingSavedId(id);
    setSelectedSavedId(id);
    onNotify?.(`Saved custom template "${cleanTitle}".`);
  };

  const deleteSavedTemplate = (id: string) => {
    const nextList = savedDiagrams.filter((d) => d.id !== id);
    setSavedDiagrams(nextList);
    persistSavedDiagrams(uid, nextList);
    if (selectedSavedId === id) {
      setSelectedSavedId(nextList[0]?.id ?? null);
    }
    if (editingSavedId === id) {
      setEditingSavedId(null);
    }
    onNotify?.('Deleted saved template.');
  };

  const duplicateSavedTemplate = (item: SavedCustomDiagram) => {
    const cloned = cloneElements(item.nodes, item.edges, item.stickies);
    const copy: SavedCustomDiagram = {
      id: makeSafeId('tpl'),
      title: `${item.title} (Copy)`,
      category: item.category,
      nodes: cloned.nodes,
      edges: cloned.edges,
      stickies: cloned.stickies,
      updatedAt: Date.now(),
    };
    const nextList = [copy, ...savedDiagrams];
    setSavedDiagrams(nextList);
    persistSavedDiagrams(uid, nextList);
    setSelectedSavedId(copy.id);
    onNotify?.(`Duplicated "${item.title}".`);
  };

  const handleImportActive = () => {
    if (activeTab === 'templates') {
      const scaled = scaleDiagramElements(
        templateDraft.nodes,
        templateDraft.edges,
        templateDraft.stickies,
        templateScale
      );
      onImportToCanvas({
        title: selectedKit.title,
        nodes: scaled.nodes,
        edges: scaled.edges,
        stickies: scaled.stickies,
      });
      return;
    }

    if (activeTab === 'saved') {
      if (!selectedSaved) return;
      onImportToCanvas({
        title: selectedSaved.title,
        nodes: selectedSaved.nodes,
        edges: selectedSaved.edges,
        stickies: selectedSaved.stickies,
      });
      return;
    }

    // Builder tab
    if (builderNodes.length === 0 && builderStickies.length === 0) {
      onNotify?.('Add at least one component before importing to canvas.');
      return;
    }
    const norm = normalizeDiagramAroundOrigin(builderNodes, builderEdges, builderStickies);
    onImportToCanvas({
      title: diagramTitle.trim() || 'Custom Diagram',
      nodes: norm.nodes,
      edges: norm.edges,
      stickies: norm.stickies,
    });
  };

  const selectedNode = useMemo(
    () => builderNodes.find((n) => n.id === selectedNodeId) ?? null,
    [builderNodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => builderEdges.find((e) => e.id === selectedEdgeId) ?? null,
    [builderEdges, selectedEdgeId]
  );
  const selectedSticky = useMemo(
    () => builderStickies.find((s) => s.id === selectedStickyId) ?? null,
    [builderStickies, selectedStickyId]
  );

  const canImportCurrent =
    activeTab === 'templates' ||
    (activeTab === 'saved' && Boolean(selectedSaved)) ||
    (activeTab === 'builder' && (builderNodes.length > 0 || builderStickies.length > 0));

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-2 sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Diagram Studio"
        className="w-full max-w-6xl h-[90vh] max-h-[860px] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100"
      >
        {/* Top Studio Window Bar */}
        <header className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-base font-semibold tracking-tight whitespace-nowrap shrink-0">
              Diagram Studio
            </h2>
            <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400 truncate">
              Build custom diagrams or customize templates before importing to canvas
            </span>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            {(
              [
                { id: 'templates', label: 'Templates' },
                { id: 'builder', label: 'Custom Builder' },
                { id: 'saved', label: `Saved (${savedDiagrams.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === t.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!canImportCurrent}
              onClick={handleImportActive}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Import to Canvas
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close Diagram Studio"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* BODY: TAB 1 — TEMPLATES GALLERY & LIVE CUSTOMIZER */}
        {activeTab === 'templates' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_1fr_288px]">
            {/* Left Template Catalog */}
            <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 max-h-56 lg:max-h-none">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'physics', label: 'Physics' },
                      { id: 'schematics', label: 'Schematics' },
                      { id: 'maths', label: 'Maths' },
                      { id: 'systems', label: 'Systems' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setTemplateCategory(cat.id)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        templateCategory === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {filteredKits.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 text-center">
                    No templates match your filter.
                  </div>
                ) : (
                  filteredKits.map((kit) => {
                    const active = kit.id === selectedKit.id;
                    return (
                      <button
                        key={kit.id}
                        type="button"
                        onClick={() => selectTemplateKit(kit)}
                        className={`w-full text-left px-3.5 py-3 transition-colors ${
                          active
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {kit.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {kit.summary}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 capitalize">
                          {kit.category}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Center Live Preview Viewport */}
            <section className="flex flex-col min-h-[260px] min-w-0 bg-slate-50 dark:bg-slate-950">
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold">{selectedKit.title}</span>
                  <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    {templateDraft.nodes.length} nodes · {templateDraft.edges.length} connections
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Scale:</span>
                  {[0.75, 1, 1.25].map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => setTemplateScale(sc)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] border ${
                        templateScale === sc
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {sc}x
                    </button>
                  ))}
                </div>
              </div>

              <div ref={previewContainerRef} className="flex-1 min-h-0 relative">
                <canvas ref={previewCanvasRef} className="w-full h-full block" />
              </div>
            </section>

            {/* Right Quick-Customize Labels & Open in Builder */}
            <aside className="border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
                <div className="text-xs font-semibold">Customize Before Import</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Edit element values inline or open in the interactive Custom Builder to rearrange geometry.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      loadTemplateIntoBuilder(
                        selectedKit.title,
                        selectedKit.category,
                        templateDraft.nodes,
                        templateDraft.edges,
                        templateDraft.stickies,
                        null
                      )
                    }
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    Customize in Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => selectTemplateKit(selectedKit)}
                    title="Reset template labels"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium text-slate-500">Node Labels</div>
                  {templateDraft.nodes.map((node) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <span className="w-20 text-[11px] text-slate-400 truncate capitalize">
                        {node.shape.replace('_', ' ')}
                      </span>
                      <input
                        type="text"
                        value={node.text}
                        onChange={(e) =>
                          setTemplateDraft((prev) => ({
                            ...prev,
                            nodes: prev.nodes.map((n) =>
                              n.id === node.id ? { ...n, text: e.target.value } : n
                            ),
                          }))
                        }
                        className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  ))}
                </div>

                {templateDraft.edges.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] font-medium text-slate-500">Connection Labels</div>
                    {templateDraft.edges.map((edge, idx) => (
                      <div key={edge.id} className="flex items-center gap-2">
                        <span className="w-20 text-[11px] text-slate-400 font-mono">
                          Link {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={edge.label}
                          placeholder="(unlabeled)"
                          onChange={(e) =>
                            setTemplateDraft((prev) => ({
                              ...prev,
                              edges: prev.edges.map((ed) =>
                                ed.id === edge.id ? { ...ed, label: e.target.value } : ed
                              ),
                            }))
                          }
                          className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* BODY: TAB 2 — INTERACTIVE CUSTOM DIAGRAM BUILDER */}
        {activeTab === 'builder' && (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[256px_1fr_288px]">
            {/* Left Component Palette */}
            <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-0 max-h-52 lg:max-h-none">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold">Components</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={loadCurrentBoardIntoBuilder}
                      title="Load nodes & links from current board"
                      className="px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      From Board
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (builderNodes.length > 0 || builderStickies.length > 0) {
                          pushBuilderUndo();
                        }
                        setEditingSavedId(null);
                        setDiagramTitle('Custom Diagram');
                        setBuilderNodes([]);
                        setBuilderEdges([]);
                        setBuilderStickies([]);
                        setSelectedNodeId(null);
                        setSelectedEdgeId(null);
                        setSelectedStickyId(null);
                      }}
                      title="Start blank diagram"
                      className="px-2 py-1 text-[11px] rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Blank
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                    placeholder="Find shape or symbol..."
                    className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'systems', label: 'Systems' },
                      { id: 'physics', label: 'Physics' },
                      { id: 'schematics', label: 'Schematics' },
                      { id: 'maths', label: 'Maths' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setPaletteCat(cat.id)}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                        paletteCat === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 content-start">
                {filteredPalette.map((comp) => (
                  <button
                    key={comp.id}
                    type="button"
                    onClick={() => addPaletteComponent(comp)}
                    title={`Add ${comp.label} (${comp.summary})`}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 text-left transition-colors"
                  >
                    <div className="text-xs font-medium truncate">{comp.label}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5 capitalize">
                      {comp.category}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {/* Center Interactive Mini-Canvas */}
            <section className="flex flex-col min-h-[280px] min-w-0 bg-slate-50 dark:bg-slate-950">
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'select', icon: MousePointer2, label: 'Select' },
                      { id: 'connect', icon: Spline, label: 'Connect' },
                      { id: 'sticky', icon: StickyIcon, label: 'Sticky' },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setConnectSourceId(null);
                          setBuilderTool(t.id);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                          builderTool === t.id
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}

                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

                  <button
                    type="button"
                    disabled={builderUndo.length === 0}
                    onClick={handleBuilderUndo}
                    title="Undo"
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={builderNodes.length === 0}
                    onClick={autoArrangeGrid}
                    title="Auto-arrange nodes in grid"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Arrange</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fitBuilderCamera()}
                    title="Fit diagram to view"
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gridSnap}
                      onChange={(e) => setGridSnap(e.target.checked)}
                      className="w-3.5 h-3.5 accent-blue-600"
                    />
                    Snap
                  </label>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {builderNodes.length}N · {builderEdges.length}E
                  </span>
                </div>
              </div>

              {builderTool === 'connect' && (
                <div className="px-3 py-1 bg-blue-600 text-white text-[11px] font-medium text-center">
                  {connectSourceId
                    ? 'Click destination node or sticky note to finish connection'
                    : 'Click source node or sticky note to start connection'}
                </div>
              )}

              <div ref={builderContainerRef} className="flex-1 min-h-0 relative">
                <canvas
                  ref={builderCanvasRef}
                  onWheel={handleBuilderWheel}
                  onPointerDown={handleBuilderPointerDown}
                  onPointerMove={handleBuilderPointerMove}
                  onPointerUp={handleBuilderPointerUp}
                  onPointerCancel={handleBuilderPointerUp}
                  className={`w-full h-full block touch-none ${
                    builderTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
                  }`}
                />

                {builderNodes.length === 0 && builderStickies.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
                    <div className="max-w-xs space-y-1.5">
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Empty Custom Diagram Canvas
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Click components on the left palette to add shapes, switch to Connect to link them, then Save as Template or Import to Canvas.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Right Properties & Save Panel */}
            <aside className="border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 flex flex-col min-h-0">
              {/* Diagram Metadata & Save Template */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Diagram Title
                  </label>
                  <input
                    type="text"
                    value={diagramTitle}
                    onChange={(e) => setDiagramTitle(e.target.value)}
                    placeholder="My Custom Diagram"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={diagramCategory}
                    onChange={(e) =>
                      setDiagramCategory(e.target.value as StemCategory | 'custom')
                    }
                    className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="custom">Custom</option>
                    <option value="systems">Systems</option>
                    <option value="physics">Physics</option>
                    <option value="schematics">Schematics</option>
                    <option value="maths">Maths</option>
                  </select>
                  <button
                    type="button"
                    onClick={saveBuilderAsTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Template
                  </button>
                </div>
              </div>

              {/* Selected Element Inspector */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
                {selectedNode && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Selected Node</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            pushBuilderUndo();
                            const copy: GraphNode = {
                              ...selectedNode,
                              id: makeSafeId('n'),
                              x: selectedNode.x + 28,
                              y: selectedNode.y + 28,
                              tags: [...selectedNode.tags],
                              metadata: { ...selectedNode.metadata },
                            };
                            setBuilderNodes((prev) => [...prev, copy]);
                            setSelectedNodeId(copy.id);
                          }}
                          title="Duplicate Node"
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            pushBuilderUndo();
                            setBuilderNodes((prev) =>
                              prev.filter((n) => n.id !== selectedNode.id)
                            );
                            setBuilderEdges((prev) =>
                              prev.filter(
                                (e) => e.a !== selectedNode.id && e.b !== selectedNode.id
                              )
                            );
                            setSelectedNodeId(null);
                          }}
                          title="Delete Node"
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedNode.text}
                        onChange={(e) =>
                          setBuilderNodes((prev) =>
                            prev.map((n) =>
                              n.id === selectedNode.id ? { ...n, text: e.target.value } : n
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">Icon / Emoji</span>
                        <button
                          type="button"
                          onClick={() => setShowBuilderIconTray((v) => !v)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium"
                        >
                          <NodeIconBadge
                            icon={selectedNode.icon}
                            className="w-3.5 h-3.5"
                            fallback={<Smile className="w-3.5 h-3.5 text-slate-400" />}
                          />
                          <span>{showBuilderIconTray ? 'Hide Tray' : 'Choose Icon'}</span>
                        </button>
                      </div>
                      {showBuilderIconTray && (
                        <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60">
                          <IconEmojiTray
                            value={selectedNode.icon ?? ''}
                            position={selectedNode.iconPosition ?? 'inline'}
                            onChangeIcon={(nextIcon) =>
                              setBuilderNodes((prev) =>
                                prev.map((n) =>
                                  n.id === selectedNode.id ? { ...n, icon: nextIcon } : n
                                )
                              )
                            }
                            onChangePosition={(nextPos: IconPosition) =>
                              setBuilderNodes((prev) =>
                                prev.map((n) =>
                                  n.id === selectedNode.id ? { ...n, iconPosition: nextPos } : n
                                )
                              )
                            }
                            compact
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Shape</label>
                      <select
                        value={selectedNode.shape}
                        onChange={(e) =>
                          setBuilderNodes((prev) =>
                            prev.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, shape: e.target.value as NodeShape }
                                : n
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        {ALL_NODE_SHAPES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setBuilderNodes((prev) =>
                            prev.map((n) =>
                              n.id === selectedNode.id ? { ...n, filled: true } : n
                            )
                          )
                        }
                        className={`py-1.5 rounded-lg border font-medium ${
                          selectedNode.filled !== false
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Filled
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBuilderNodes((prev) =>
                            prev.map((n) =>
                              n.id === selectedNode.id ? { ...n, filled: false } : n
                            )
                          )
                        }
                        className={`py-1.5 rounded-lg border font-medium ${
                          selectedNode.filled === false
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Outline
                      </button>
                    </div>

                    {selectedNode.filled !== false && (
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Fill Color</label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {FILL_SWATCHES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() =>
                                setBuilderNodes((prev) =>
                                  prev.map((n) =>
                                    n.id === selectedNode.id ? { ...n, color: c } : n
                                  )
                                )
                              }
                              style={{ backgroundColor: c }}
                              className={`w-5 h-5 rounded border ${
                                selectedNode.color.toLowerCase() === c
                                  ? 'ring-2 ring-blue-600 border-white'
                                  : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                          ))}
                          <input
                            type="color"
                            value={selectedNode.color || '#dbeafe'}
                            onChange={(e) =>
                              setBuilderNodes((prev) =>
                                prev.map((n) =>
                                  n.id === selectedNode.id ? { ...n, color: e.target.value } : n
                                )
                              )
                            }
                            className="w-5 h-5 rounded border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Border Color</label>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {STROKE_SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setBuilderNodes((prev) =>
                                prev.map((n) =>
                                  n.id === selectedNode.id ? { ...n, borderColor: c } : n
                                )
                              )
                            }
                            style={{ backgroundColor: c }}
                            className={`w-5 h-5 rounded border ${
                              (selectedNode.borderColor ?? '').toLowerCase() === c
                                ? 'ring-2 ring-blue-600 border-white'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        ))}
                        <input
                          type="color"
                          value={selectedNode.borderColor || '#334155'}
                          onChange={(e) =>
                            setBuilderNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, borderColor: e.target.value }
                                  : n
                              )
                            )
                          }
                          className="w-5 h-5 rounded border border-slate-300 dark:border-slate-700 bg-transparent cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Width</label>
                        <input
                          type="number"
                          min={24}
                          max={600}
                          value={Math.round(selectedNode.w)}
                          onChange={(e) =>
                            setBuilderNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, w: Math.max(24, Number(e.target.value) || 80) }
                                  : n
                              )
                            )
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Height</label>
                        <input
                          type="number"
                          min={20}
                          max={500}
                          value={Math.round(selectedNode.h)}
                          onChange={(e) =>
                            setBuilderNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, h: Math.max(20, Number(e.target.value) || 48) }
                                  : n
                              )
                            )
                          }
                          className="w-full px-2 py-1 font-mono tabular-nums rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedEdge && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Selected Connection</span>
                      <button
                        type="button"
                        onClick={() => {
                          pushBuilderUndo();
                          setBuilderEdges((prev) =>
                            prev.filter((e) => e.id !== selectedEdge.id)
                          );
                          setSelectedEdgeId(null);
                        }}
                        title="Delete Connection"
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={selectedEdge.label}
                        onChange={(e) =>
                          setBuilderEdges((prev) =>
                            prev.map((ed) =>
                              ed.id === selectedEdge.id ? { ...ed, label: e.target.value } : ed
                            )
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Routing</label>
                        <select
                          value={selectedEdge.type}
                          onChange={(e) =>
                            setBuilderEdges((prev) =>
                              prev.map((ed) =>
                                ed.id === selectedEdge.id
                                  ? { ...ed, type: e.target.value as EdgeRouting }
                                  : ed
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        >
                          <option value="straight">Straight</option>
                          <option value="curved">Curved</option>
                          <option value="orthogonal">Orthogonal</option>
                          <option value="elbow">Elbow</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Arrowhead</label>
                        <select
                          value={selectedEdge.arrow}
                          onChange={(e) =>
                            setBuilderEdges((prev) =>
                              prev.map((ed) =>
                                ed.id === selectedEdge.id
                                  ? { ...ed, arrow: e.target.value as ArrowType }
                                  : ed
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        >
                          <option value="forward">Forward</option>
                          <option value="backward">Backward</option>
                          <option value="both">Both</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Line Style</label>
                      <select
                        value={selectedEdge.lineStyle}
                        onChange={(e) =>
                          setBuilderEdges((prev) =>
                            prev.map((ed) =>
                              ed.id === selectedEdge.id
                                ? { ...ed, lineStyle: e.target.value as LineStyle }
                                : ed
                            )
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Curvature</span>
                        <span className="font-mono tabular-nums">
                          {selectedEdge.curvature ?? 0}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={5}
                        value={selectedEdge.curvature ?? 0}
                        onChange={(e) =>
                          setBuilderEdges((prev) =>
                            prev.map((ed) =>
                              ed.id === selectedEdge.id
                                ? { ...ed, type: 'curved', curvature: Number(e.target.value) }
                                : ed
                            )
                          )
                        }
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Color</label>
                      <div className="flex flex-wrap gap-1.5">
                        {STROKE_SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              setBuilderEdges((prev) =>
                                prev.map((ed) =>
                                  ed.id === selectedEdge.id ? { ...ed, color: c } : ed
                                )
                              )
                            }
                            style={{ backgroundColor: c }}
                            className={`w-5 h-5 rounded border ${
                              selectedEdge.color.toLowerCase() === c
                                ? 'ring-2 ring-blue-600 border-white'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedSticky && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Selected Sticky Note</span>
                      <button
                        type="button"
                        onClick={() => {
                          pushBuilderUndo();
                          setBuilderStickies((prev) =>
                            prev.filter((s) => s.id !== selectedSticky.id)
                          );
                          setSelectedStickyId(null);
                        }}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <textarea
                      rows={3}
                      value={selectedSticky.text}
                      onChange={(e) =>
                        setBuilderStickies((prev) =>
                          prev.map((s) =>
                            s.id === selectedSticky.id ? { ...s, text: e.target.value } : s
                          )
                        )
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />

                    <div className="flex flex-wrap gap-1.5">
                      {STICKY_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() =>
                            setBuilderStickies((prev) =>
                              prev.map((s) =>
                                s.id === selectedSticky.id ? { ...s, color: c } : s
                              )
                            )
                          }
                          style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded border ${
                            selectedSticky.color.toLowerCase() === c
                              ? 'ring-2 ring-blue-600 border-white'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {!selectedNode && !selectedEdge && !selectedSticky && (
                  <div className="py-6 text-center space-y-2 text-slate-500 dark:text-slate-400">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Element Inspector
                    </p>
                    <p className="text-[11px] leading-relaxed">
                      Select any node, connection, or sticky note on the builder canvas to customize its label, shape, fill, or routing.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* BODY: TAB 3 — SAVED CUSTOM TEMPLATES LIBRARY */}
        {activeTab === 'saved' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {savedDiagrams.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <FolderOpen className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                <div className="text-sm font-semibold">No Saved Custom Diagrams Yet</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Build a custom diagram in the Custom Builder tab and click Save Template to store reusable diagrams here.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('builder')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Custom Diagram
                </button>
              </div>
            ) : (
              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[300px_1fr]">
                <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-56 lg:max-h-none">
                  {savedDiagrams.map((item) => {
                    const active = selectedSaved?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedSavedId(item.id)}
                        className={`px-4 py-3 cursor-pointer transition-colors ${
                          active
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{item.title}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                              <span className="capitalize">{item.category}</span>
                              <span className="mx-1.5">·</span>
                              <span>{item.nodes.length} nodes</span>
                              <span className="mx-1.5">·</span>
                              <span>{item.edges.length} links</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateSavedTemplate(item);
                              }}
                              title="Duplicate template"
                              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSavedTemplate(item.id);
                              }}
                              title="Delete template"
                              className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </aside>

                {selectedSaved && (
                  <section className="flex flex-col min-h-[260px] min-w-0 bg-slate-50 dark:bg-slate-950">
                    <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-semibold">{selectedSaved.title}</span>
                        <span className="mx-2 text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          Updated {new Date(selectedSaved.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          loadTemplateIntoBuilder(
                            selectedSaved.title,
                            selectedSaved.category,
                            selectedSaved.nodes,
                            selectedSaved.edges,
                            selectedSaved.stickies,
                            selectedSaved.id
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                      >
                        Edit in Builder
                      </button>
                    </div>
                    <div ref={savedContainerRef} className="flex-1 min-h-0 relative">
                      <canvas ref={savedCanvasRef} className="w-full h-full block" />
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
