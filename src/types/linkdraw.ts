export type NodeShape =
  | 'rounded'
  | 'rectangle'
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'hexagon'
  | 'star'
  | 'cylinder'
  | 'cloud'
  | 'callout'
  | 'parallelogram'
  | 'table'
  | 'progress_bar'
  | 'text';

export type IconPosition = 'inline' | 'top' | 'left';
export type EdgeRouting = 'straight' | 'curved' | 'elbow' | 'orthogonal';
export type ArrowType = 'none' | 'forward' | 'backward' | 'both';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type CanvasLayerName = 'Background' | 'Data' | 'Annotations';
export type ThemeMode = 'light' | 'dark' | 'high_contrast';
export type ToolMode =
  | 'select'
  | 'add_node'
  | 'connect'
  | 'sticky'
  | 'pen'
  | 'highlight'
  | 'eraser'
  | 'highlight_eraser';

export interface TableData {
  headers: string[];
  rows: string[][];
  colWidths?: number[];
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  shape: NodeShape;
  color: string;
  textColor?: string;
  fs?: number;
  icon?: string;
  iconPosition?: IconPosition;
  tags: string[];
  metadata: Record<string, string>;
  progress?: number | null;
  badge?: string | null;
  collapsed?: boolean;
  locked?: boolean;
  layer: CanvasLayerName;
  tableData?: TableData | null;
  highlightColor?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface GraphEdge {
  id: string;
  a: string;
  b: string;
  label: string;
  color: string;
  width: number;
  arrow: ArrowType;
  type: EdgeRouting;
  lineStyle: LineStyle;
  weight: number;
  curvature?: number | null;
  layer: CanvasLayerName;
  highlightColor?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface StickyNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  layer: CanvasLayerName;
  createdAt?: number;
  updatedAt?: number;
}

export interface FreehandStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'highlight';
  layer: CanvasLayerName;
  createdAt?: number;
}

export interface LayerState {
  name: CanvasLayerName;
  visible: boolean;
  locked: boolean;
}

export interface GraphSettings {
  gridSnap: boolean;
  gridSize: number;
  flowAnimation: boolean;
}

export interface GraphDocument {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stickies: StickyNote[];
  strokes: FreehandStroke[];
  layers: LayerState[];
  settings: GraphSettings;
}

export interface WorkspaceBoard {
  id: string;
  kind: 'shared' | 'personal';
  title: string;
  description: string;
  ownerId: string;
  ownerName: string;
  inviteCode?: string;
  memberUids?: string[];
  memberNames?: Record<string, string>;
  gridSnap: boolean;
  gridSize: number;
  flowAnimation: boolean;
  createdAt: number;
  updatedAt: number;
  graphData?: GraphDocument;
}

export interface CollabPresence {
  uid: string;
  displayName: string;
  colorHex: string;
  selectedNodeId: string | null;
  activeTab: string;
  updatedAt: number;
}

export interface BoardComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  linkedNodeId: string | null;
  linkedNodeLabel: string | null;
  createdAt: number;
  updatedAt: number;
}

export type NoteType = 'Observation' | 'Source' | 'Lead' | 'Analysis' | 'Question' | 'Action';
export type NotePriority = 'urgent' | 'high' | 'normal' | 'low';

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface NoteRecord {
  id: string;
  ownerId: string;
  boardId: string | null;
  title: string;
  body: string;
  noteType: NoteType;
  sourceUrl: string;
  folder: string;
  tags: string[];
  priority: NotePriority;
  color: string;
  pinned: boolean;
  archived: boolean;
  linkedNodeId: string | null;
  linkedNodeName: string | null;
  checklist: ChecklistItem[];
  wordCount: number;
  createdAt: number;
  updatedAt: number;
}

export type AppSection = 'workspaces' | 'canvas' | 'notes' | 'utilities';
export type UtilitySubTab = 'algos' | 'osint' | 'formulas' | 'settings';

export type StarterTemplateId = 'microservices' | 'osint' | 'mindmap' | 'blank';
