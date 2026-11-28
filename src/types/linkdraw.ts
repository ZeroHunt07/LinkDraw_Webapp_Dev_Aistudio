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
  | 'block_arrow'
  | 'double_arrow'
  | 'parallelogram'
  | 'table'
  | 'progress_bar'
  | 'text'
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'battery'
  | 'ground'
  | 'diode'
  | 'bulb'
  | 'switch_sym'
  | 'and_gate'
  | 'or_gate'
  | 'not_gate'
  | 'transistor'
  | 'spring'
  | 'pulley'
  | 'incline'
  | 'lens'
  | 'concave_lens'
  | 'prism'
  | 'concave_mirror'
  | 'convex_mirror'
  | 'pendulum'
  | 'magnet_bar'
  | 'meter_circle'
  | 'solenoid'
  | 'field_lines'
  | 'lever_fulcrum'
  | 'cart_wheels'
  | 'thermometer'
  | 'piston_cylinder'
  | 'projectile_arc'
  | 'ray_source'
  | 'opamp'
  | 'xor_gate'
  | 'transformer'
  | 'fuse_sym'
  | 'potentiometer'
  | 'wave'
  | 'axes_2d'
  | 'axes_3d'
  | 'number_line'
  | 'parabola'
  | 'sine_graph'
  | 'unit_circle'
  | 'ellipse_conic'
  | 'vector_arrow'
  | 'angle_arc'
  | 'right_triangle'
  | 'venn_2'
  | 'venn_3'
  | 'bell_curve'
  | 'pie_chart'
  | 'bar_chart'
  | 'scatter_plot'
  | 'box_plot'
  | 'fraction_bar'
  | 'cube_3d'
  | 'sphere_3d'
  | 'cone_3d'
  | 'pyramid_3d'
  | 'matrix_box'
  | 'cell_animal'
  | 'cell_plant'
  | 'dna_helix'
  | 'mitochondria'
  | 'chloroplast'
  | 'neuron'
  | 'antibody'
  | 'virus_capsid'
  | 'leaf_organ'
  | 'punnett_grid'
  | 'ribosome'
  | 'golgi_body'
  | 'lipid_bilayer'
  | 'chromosome'
  | 'petri_dish'
  | 'microscope'
  | 'heart_chamber'
  | 'synapse_cleft'
  | 'beaker'
  | 'erlenmeyer_flask'
  | 'round_flask'
  | 'test_tube'
  | 'burette'
  | 'funnel_filter'
  | 'graduated_cylinder'
  | 'condenser_tube'
  | 'bunsen_burner'
  | 'benzene_ring'
  | 'cyclohexane_chair'
  | 'atom_bohr'
  | 'reaction_arrow'
  | 'bond_double'
  | 'bond_triple'
  | 'molecule_h2o'
  | 'tetrahedral_mol'
  | 'energy_profile';

export type IconPosition = 'inline' | 'top' | 'left';
export type EdgeRouting = 'straight' | 'curved' | 'elbow' | 'orthogonal';
export type ArrowType = 'none' | 'forward' | 'backward' | 'both';
export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type CanvasLayerName = 'Background' | 'Data' | 'Annotations';
export type ThemeMode = 'light' | 'dark' | 'high_contrast';
export type ToolMode =
  | 'select'
  | 'add_node'
  | 'add_text'
  | 'draw_shape'
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

export interface GraphPage {
  id: string;
  title: string;
  order?: number;
  createdAt?: number;
}

export interface GraphNode {
  id: string;
  pageId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  shape: NodeShape;
  color: string;
  filled?: boolean;
  borderColor?: string;
  borderWidth?: number;
  textColor?: string;
  fs?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
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
  pageId?: string;
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
  pageId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  tags?: string[];
  layer: CanvasLayerName;
  createdAt?: number;
  updatedAt?: number;
}

export interface FreehandStroke {
  id: string;
  pageId?: string;
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
  pages?: GraphPage[];
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
