import type { GraphEdge, GraphNode, NodeShape, StickyNote } from '../types/linkdraw';

export type StemCategory = 'physics' | 'schematics' | 'maths' | 'systems';

export interface StemComponentPreset {
  id: string;
  category: StemCategory;
  label: string;
  defaultText: string;
  shape: NodeShape;
  w: number;
  h: number;
  color: string;
  filled: boolean;
  borderColor: string;
  borderWidth: number;
  tags: string[];
  summary: string;
}

export interface StemDiagramKit {
  id: string;
  category: StemCategory;
  title: string;
  summary: string;
  build: (
    cx: number,
    cy: number,
    makeId: (prefix: string) => string
  ) => { nodes: GraphNode[]; edges: GraphEdge[]; stickies: StickyNote[] };
}

export const STEM_COMPONENTS: StemComponentPreset[] = [
  // Physics
  {
    id: 'phy_mass',
    category: 'physics',
    label: 'Mass Block',
    defaultText: 'm',
    shape: 'rectangle',
    w: 76,
    h: 54,
    color: '#dbeafe',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['physics', 'mass'],
    summary: 'Rigid body / block mass',
  },
  {
    id: 'phy_incline',
    category: 'physics',
    label: 'Inclined Plane',
    defaultText: 'θ',
    shape: 'incline',
    w: 180,
    h: 110,
    color: '#e2e8f0',
    filled: true,
    borderColor: '#334155',
    borderWidth: 2,
    tags: ['physics', 'mechanics'],
    summary: 'Ramp / wedge at angle θ',
  },
  {
    id: 'phy_spring',
    category: 'physics',
    label: 'Spring (k)',
    defaultText: 'k',
    shape: 'spring',
    w: 140,
    h: 56,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['physics', 'oscillation'],
    summary: 'Hookean helical spring',
  },
  {
    id: 'phy_pulley',
    category: 'physics',
    label: 'Pulley',
    defaultText: 'Pulley',
    shape: 'pulley',
    w: 76,
    h: 82,
    color: '#f1f5f9',
    filled: true,
    borderColor: '#334155',
    borderWidth: 2,
    tags: ['physics', 'tension'],
    summary: 'Frictionless pulley wheel',
  },
  {
    id: 'phy_lens',
    category: 'physics',
    label: 'Convex Lens',
    defaultText: 'f',
    shape: 'lens',
    w: 68,
    h: 140,
    color: '#bae6fd',
    filled: true,
    borderColor: '#0284c7',
    borderWidth: 2,
    tags: ['physics', 'optics'],
    summary: 'Converging optical lens',
  },
  {
    id: 'phy_wave',
    category: 'physics',
    label: 'Sine Wave',
    defaultText: 'λ, f',
    shape: 'wave',
    w: 150,
    h: 64,
    color: '#ffffff',
    filled: false,
    borderColor: '#7c3aed',
    borderWidth: 2,
    tags: ['physics', 'wave'],
    summary: 'Harmonic wave / oscillation',
  },
  {
    id: 'phy_force',
    category: 'physics',
    label: 'Force Vector',
    defaultText: 'F',
    shape: 'vector_arrow',
    w: 120,
    h: 48,
    color: '#ffffff',
    filled: false,
    borderColor: '#dc2626',
    borderWidth: 2.6,
    tags: ['physics', 'vector'],
    summary: 'Directed force / velocity vector',
  },

  // Schematics
  {
    id: 'sch_resistor',
    category: 'schematics',
    label: 'Resistor (R)',
    defaultText: 'R = 1kΩ',
    shape: 'resistor',
    w: 120,
    h: 54,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'resistor'],
    summary: 'Axial zig-zag resistor',
  },
  {
    id: 'sch_capacitor',
    category: 'schematics',
    label: 'Capacitor (C)',
    defaultText: 'C = 10μF',
    shape: 'capacitor',
    w: 110,
    h: 60,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'capacitor'],
    summary: 'Parallel-plate capacitor',
  },
  {
    id: 'sch_inductor',
    category: 'schematics',
    label: 'Inductor (L)',
    defaultText: 'L = 10mH',
    shape: 'inductor',
    w: 124,
    h: 56,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'inductor'],
    summary: 'Coiled magnetic inductor',
  },
  {
    id: 'sch_battery',
    category: 'schematics',
    label: 'DC Source (V)',
    defaultText: 'V = 9V',
    shape: 'battery',
    w: 110,
    h: 64,
    color: '#ffffff',
    filled: false,
    borderColor: '#dc2626',
    borderWidth: 2,
    tags: ['schematic', 'source'],
    summary: 'DC voltage cell / source',
  },
  {
    id: 'sch_ground',
    category: 'schematics',
    label: 'Ground (GND)',
    defaultText: 'GND',
    shape: 'ground',
    w: 72,
    h: 60,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'gnd'],
    summary: 'Reference earth ground',
  },
  {
    id: 'sch_switch',
    category: 'schematics',
    label: 'Switch (SW)',
    defaultText: 'SW1',
    shape: 'switch_sym',
    w: 110,
    h: 54,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'switch'],
    summary: 'Single-pole circuit switch',
  },
  {
    id: 'sch_diode',
    category: 'schematics',
    label: 'Diode / LED',
    defaultText: 'D1',
    shape: 'diode',
    w: 110,
    h: 56,
    color: '#fef08a',
    filled: true,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'diode'],
    summary: 'PN junction / rectifier diode',
  },
  {
    id: 'sch_bulb',
    category: 'schematics',
    label: 'Lamp / Load',
    defaultText: 'Lamp',
    shape: 'bulb',
    w: 100,
    h: 64,
    color: '#fef9c3',
    filled: true,
    borderColor: '#ca8a04',
    borderWidth: 2,
    tags: ['schematic', 'load'],
    summary: 'Incandescent lamp load',
  },
  {
    id: 'sch_and',
    category: 'schematics',
    label: 'AND Gate',
    defaultText: 'AND',
    shape: 'and_gate',
    w: 120,
    h: 68,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#3730a3',
    borderWidth: 2,
    tags: ['logic', 'gate'],
    summary: '2-input digital AND gate',
  },
  {
    id: 'sch_or',
    category: 'schematics',
    label: 'OR Gate',
    defaultText: 'OR',
    shape: 'or_gate',
    w: 120,
    h: 68,
    color: '#dcfce7',
    filled: true,
    borderColor: '#166534',
    borderWidth: 2,
    tags: ['logic', 'gate'],
    summary: '2-input digital OR gate',
  },
  {
    id: 'sch_not',
    category: 'schematics',
    label: 'NOT Gate',
    defaultText: 'NOT',
    shape: 'not_gate',
    w: 110,
    h: 62,
    color: '#fee2e2',
    filled: true,
    borderColor: '#991b1b',
    borderWidth: 2,
    tags: ['logic', 'inverter'],
    summary: 'Logic inverter gate',
  },
  {
    id: 'sch_bjt',
    category: 'schematics',
    label: 'Transistor',
    defaultText: 'Q1 (NPN)',
    shape: 'transistor',
    w: 104,
    h: 82,
    color: '#f8fafc',
    filled: true,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'transistor'],
    summary: 'Bipolar junction transistor',
  },

  // Maths
  {
    id: 'math_axes',
    category: 'maths',
    label: '2D Axes (x,y)',
    defaultText: 'y = f(x)',
    shape: 'axes_2d',
    w: 220,
    h: 180,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 1.8,
    tags: ['math', 'graph'],
    summary: 'Cartesian X-Y coordinate plane',
  },
  {
    id: 'math_vector',
    category: 'maths',
    label: 'Vector Arrow',
    defaultText: 'v⃗',
    shape: 'vector_arrow',
    w: 120,
    h: 48,
    color: '#ffffff',
    filled: false,
    borderColor: '#2563eb',
    borderWidth: 2.6,
    tags: ['math', 'vector'],
    summary: 'Euclidean vector / ray',
  },
  {
    id: 'math_angle',
    category: 'maths',
    label: 'Angle Arc (θ)',
    defaultText: 'θ = 45°',
    shape: 'angle_arc',
    w: 120,
    h: 90,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['math', 'geometry'],
    summary: 'Vertex angle with arc',
  },
  {
    id: 'math_venn',
    category: 'maths',
    label: '2-Set Venn',
    defaultText: 'A ∩ B',
    shape: 'venn_2',
    w: 180,
    h: 115,
    color: '#dbeafe',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['math', 'sets'],
    summary: 'Two overlapping set circles',
  },
  {
    id: 'math_bell',
    category: 'maths',
    label: 'Normal Curve',
    defaultText: 'N(μ, σ²)',
    shape: 'bell_curve',
    w: 200,
    h: 120,
    color: '#bfdbfe',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['math', 'statistics'],
    summary: 'Gaussian normal distribution',
  },
  {
    id: 'math_cube',
    category: 'maths',
    label: '3D Prism / Cube',
    defaultText: 'V = a³',
    shape: 'cube_3d',
    w: 110,
    h: 105,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#4338ca',
    borderWidth: 2,
    tags: ['math', '3d'],
    summary: '3D geometric prism / cube',
  },
  {
    id: 'math_cone',
    category: 'maths',
    label: '3D Cone',
    defaultText: 'V = ⅓πr²h',
    shape: 'cone_3d',
    w: 100,
    h: 115,
    color: '#dcfce7',
    filled: true,
    borderColor: '#15803d',
    borderWidth: 2,
    tags: ['math', '3d'],
    summary: '3D circular cone',
  },
  {
    id: 'math_matrix',
    category: 'maths',
    label: 'Matrix Brackets',
    defaultText: '[ A ]',
    shape: 'matrix_box',
    w: 110,
    h: 96,
    color: '#f8fafc',
    filled: true,
    borderColor: '#0f172a',
    borderWidth: 2.2,
    tags: ['math', 'linear-algebra'],
    summary: 'Bracketed matrix / tensor',
  },

  // Systems & General Diagram Components
  {
    id: 'sys_process',
    category: 'systems',
    label: 'Process Step',
    defaultText: 'Process',
    shape: 'rounded',
    w: 144,
    h: 56,
    color: '#dbeafe',
    filled: true,
    borderColor: '#2563eb',
    borderWidth: 1.8,
    tags: ['system', 'flow'],
    summary: 'Standard rounded process block',
  },
  {
    id: 'sys_decision',
    category: 'systems',
    label: 'Decision',
    defaultText: 'Condition?',
    shape: 'diamond',
    w: 136,
    h: 82,
    color: '#fef3c7',
    filled: true,
    borderColor: '#d97706',
    borderWidth: 1.8,
    tags: ['system', 'decision'],
    summary: 'Conditional branch diamond',
  },
  {
    id: 'sys_terminal',
    category: 'systems',
    label: 'Start / End',
    defaultText: 'Start',
    shape: 'circle',
    w: 110,
    h: 52,
    color: '#dcfce7',
    filled: true,
    borderColor: '#16a34a',
    borderWidth: 1.8,
    tags: ['system', 'terminal'],
    summary: 'Terminal oval state',
  },
  {
    id: 'sys_database',
    category: 'systems',
    label: 'Database',
    defaultText: 'Store',
    shape: 'cylinder',
    w: 120,
    h: 72,
    color: '#f1f5f9',
    filled: true,
    borderColor: '#334155',
    borderWidth: 1.8,
    tags: ['system', 'storage'],
    summary: 'Persistent data cylinder',
  },
  {
    id: 'sys_cloud',
    category: 'systems',
    label: 'Cloud Service',
    defaultText: 'External API',
    shape: 'cloud',
    w: 146,
    h: 74,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#4f46e5',
    borderWidth: 1.8,
    tags: ['system', 'cloud'],
    summary: 'Cloud / network service boundary',
  },
  {
    id: 'sys_module',
    category: 'systems',
    label: 'Hexagon Module',
    defaultText: 'Service',
    shape: 'hexagon',
    w: 148,
    h: 60,
    color: '#fce7f3',
    filled: true,
    borderColor: '#db2777',
    borderWidth: 1.8,
    tags: ['system', 'service'],
    summary: 'Hexagonal gateway / worker',
  },
  {
    id: 'sys_io',
    category: 'systems',
    label: 'Input / Output',
    defaultText: 'I/O Stream',
    shape: 'parallelogram',
    w: 148,
    h: 56,
    color: '#f1f5f9',
    filled: true,
    borderColor: '#475569',
    borderWidth: 1.8,
    tags: ['system', 'io'],
    summary: 'Data input or output parallelogram',
  },
  {
    id: 'sys_callout',
    category: 'systems',
    label: 'Callout Box',
    defaultText: 'Annotation',
    shape: 'callout',
    w: 148,
    h: 64,
    color: '#fef9c3',
    filled: true,
    borderColor: '#ca8a04',
    borderWidth: 1.8,
    tags: ['annotation'],
    summary: 'Speech callout annotation',
  },
];

function makeNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  shape: NodeShape,
  opts: Partial<GraphNode> = {}
): GraphNode {
  const now = Date.now();
  return {
    id,
    x,
    y,
    w,
    h,
    text,
    shape,
    color: opts.color ?? '#dbeafe',
    filled: opts.filled,
    borderColor: opts.borderColor,
    borderWidth: opts.borderWidth,
    textColor: opts.textColor,
    fs: opts.fs ?? 13,
    icon: opts.icon ?? '',
    iconPosition: opts.iconPosition ?? 'inline',
    tags: opts.tags ?? [],
    metadata: opts.metadata ?? {},
    layer: opts.layer ?? 'Data',
    createdAt: now,
    updatedAt: now,
  };
}

function makeEdge(
  id: string,
  a: string,
  b: string,
  label: string,
  opts: Partial<GraphEdge> = {}
): GraphEdge {
  const now = Date.now();
  return {
    id,
    a,
    b,
    label,
    color: opts.color ?? '#1e293b',
    width: opts.width ?? 2,
    arrow: opts.arrow ?? 'forward',
    type: opts.type ?? 'straight',
    lineStyle: opts.lineStyle ?? 'solid',
    weight: opts.weight ?? 1,
    curvature: opts.curvature ?? null,
    layer: opts.layer ?? 'Data',
    createdAt: now,
    updatedAt: now,
  };
}

export const STEM_DIAGRAM_KITS: StemDiagramKit[] = [
  // --- PHYSICS KITS ---
  {
    id: 'kit_fbd_incline',
    category: 'physics',
    title: 'Free-Body Diagram (Incline)',
    summary: 'Mass block on θ incline with Normal (N), Gravity (mg), and Friction (f_k) force vectors.',
    build: (cx, cy, makeId) => {
      const nIncline = makeNode(makeId('n'), cx, cy + 50, 220, 125, 'θ = 30°', 'incline', {
        color: '#e2e8f0',
        borderColor: '#334155',
        borderWidth: 2,
        tags: ['physics', 'incline'],
      });
      const nBlock = makeNode(makeId('n'), cx + 12, cy - 18, 72, 50, 'm', 'rectangle', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
        borderWidth: 2,
        tags: ['physics', 'mass'],
      });
      const nNormal = makeNode(makeId('n'), cx - 44, cy - 110, 62, 34, 'N (Normal)', 'text', {
        color: '#ffffff',
        tags: ['physics', 'force'],
      });
      const nGravity = makeNode(makeId('n'), cx + 12, cy + 145, 72, 34, 'W = mg', 'text', {
        color: '#ffffff',
        tags: ['physics', 'gravity'],
      });
      const nFriction = makeNode(makeId('n'), cx + 112, cy - 72, 86, 34, 'f_k = μN', 'text', {
        color: '#ffffff',
        tags: ['physics', 'friction'],
      });
      return {
        nodes: [nIncline, nBlock, nNormal, nGravity, nFriction],
        edges: [
          makeEdge(makeId('e'), nBlock.id, nNormal.id, '⊥', { color: '#2563eb', width: 2.4 }),
          makeEdge(makeId('e'), nBlock.id, nGravity.id, '↓', { color: '#dc2626', width: 2.4 }),
          makeEdge(makeId('e'), nBlock.id, nFriction.id, 'opposes motion', {
            color: '#d97706',
            width: 2.2,
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_spring_mass',
    category: 'physics',
    title: 'Harmonic Spring-Mass Oscillator',
    summary: 'Fixed anchor wall, spring constant k, mass m, and restoring force F = -kx.',
    build: (cx, cy, makeId) => {
      const nWall = makeNode(makeId('n'), cx - 185, cy, 24, 120, 'Wall', 'rectangle', {
        color: '#475569',
        borderColor: '#0f172a',
        borderWidth: 2,
        textColor: '#ffffff',
        tags: ['physics', 'anchor'],
      });
      const nSpring = makeNode(makeId('n'), cx - 60, cy, 160, 64, 'k (N/m)', 'spring', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2.2,
        tags: ['physics', 'spring'],
      });
      const nMass = makeNode(makeId('n'), cx + 75, cy, 78, 64, 'm', 'rectangle', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
        borderWidth: 2,
        tags: ['physics', 'mass'],
      });
      const nForce = makeNode(makeId('n'), cx + 190, cy, 92, 42, 'F = -kx', 'vector_arrow', {
        filled: false,
        borderColor: '#dc2626',
        borderWidth: 2.4,
        tags: ['physics', 'force'],
      });
      return {
        nodes: [nWall, nSpring, nMass, nForce],
        edges: [
          makeEdge(makeId('e'), nWall.id, nSpring.id, '', { arrow: 'none', width: 2 }),
          makeEdge(makeId('e'), nSpring.id, nMass.id, '', { arrow: 'none', width: 2 }),
          makeEdge(makeId('e'), nMass.id, nForce.id, 'x(t)', {
            color: '#dc2626',
            lineStyle: 'dashed',
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_convex_optics',
    category: 'physics',
    title: 'Convex Lens Ray Diagram',
    summary: 'Object, converging convex lens, focal point F, and inverted real image.',
    build: (cx, cy, makeId) => {
      const nObj = makeNode(makeId('n'), cx - 190, cy - 34, 68, 72, 'Object', 'rectangle', {
        color: '#dcfce7',
        borderColor: '#15803d',
        borderWidth: 2,
        tags: ['optics', 'object'],
      });
      const nLens = makeNode(makeId('n'), cx, cy, 72, 160, 'Lens (f)', 'lens', {
        color: '#bae6fd',
        borderColor: '#0284c7',
        borderWidth: 2.2,
        tags: ['optics', 'lens'],
      });
      const nFocus = makeNode(makeId('n'), cx + 95, cy, 34, 34, 'F', 'circle', {
        color: '#fef08a',
        borderColor: '#ca8a04',
        borderWidth: 1.8,
        tags: ['optics', 'focus'],
      });
      const nImage = makeNode(makeId('n'), cx + 195, cy + 36, 68, 72, 'Real Image', 'rectangle', {
        color: '#fee2e2',
        borderColor: '#dc2626',
        borderWidth: 2,
        tags: ['optics', 'image'],
      });
      return {
        nodes: [nObj, nLens, nFocus, nImage],
        edges: [
          makeEdge(makeId('e'), nObj.id, nLens.id, 'Parallel Ray', { color: '#f59e0b', width: 2 }),
          makeEdge(makeId('e'), nLens.id, nFocus.id, '', { color: '#f59e0b', width: 2 }),
          makeEdge(makeId('e'), nFocus.id, nImage.id, 'Refracted', { color: '#f59e0b', width: 2 }),
          makeEdge(makeId('e'), nObj.id, nImage.id, 'Central Ray', {
            color: '#2563eb',
            lineStyle: 'dashed',
            width: 1.8,
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_atwood',
    category: 'physics',
    title: 'Pulley & Atwood Machine',
    summary: 'Overhead frictionless pulley supporting m₁ and m₂ via tension T.',
    build: (cx, cy, makeId) => {
      const nPulley = makeNode(makeId('n'), cx, cy - 95, 76, 82, 'Pulley', 'pulley', {
        color: '#f1f5f9',
        borderColor: '#334155',
        borderWidth: 2.2,
        tags: ['physics', 'pulley'],
      });
      const nM1 = makeNode(makeId('n'), cx - 95, cy + 65, 72, 56, 'm₁', 'rectangle', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
        borderWidth: 2,
        tags: ['physics', 'mass'],
      });
      const nM2 = makeNode(makeId('n'), cx + 95, cy + 95, 84, 64, 'm₂ > m₁', 'rectangle', {
        color: '#fee2e2',
        borderColor: '#dc2626',
        borderWidth: 2,
        tags: ['physics', 'mass'],
      });
      return {
        nodes: [nPulley, nM1, nM2],
        edges: [
          makeEdge(makeId('e'), nPulley.id, nM1.id, 'T (up)', {
            color: '#334155',
            arrow: 'backward',
            width: 2.2,
          }),
          makeEdge(makeId('e'), nPulley.id, nM2.id, 'T (up)', {
            color: '#334155',
            arrow: 'backward',
            width: 2.2,
          }),
        ],
        stickies: [],
      };
    },
  },

  // --- SCHEMATICS KITS ---
  {
    id: 'kit_rlc_circuit',
    category: 'schematics',
    title: 'Series RLC Circuit',
    summary: 'Voltage source, switch, resistor R, inductor L, capacitor C, and GND loop.',
    build: (cx, cy, makeId) => {
      const nBat = makeNode(makeId('n'), cx - 180, cy, 100, 62, 'V_s = 12V', 'battery', {
        filled: false,
        borderColor: '#dc2626',
        borderWidth: 2,
        tags: ['schematic', 'source'],
      });
      const nSw = makeNode(makeId('n'), cx - 60, cy - 95, 100, 52, 'SW1', 'switch_sym', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2,
        tags: ['schematic', 'switch'],
      });
      const nRes = makeNode(makeId('n'), cx + 90, cy - 95, 110, 52, 'R = 100Ω', 'resistor', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2,
        tags: ['schematic', 'resistor'],
      });
      const nInd = makeNode(makeId('n'), cx + 185, cy, 110, 54, 'L = 10mH', 'inductor', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2,
        tags: ['schematic', 'inductor'],
      });
      const nCap = makeNode(makeId('n'), cx, cy + 95, 104, 58, 'C = 47μF', 'capacitor', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2,
        tags: ['schematic', 'capacitor'],
      });
      const nGnd = makeNode(makeId('n'), cx - 180, cy + 120, 66, 54, 'GND', 'ground', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2,
        tags: ['schematic', 'gnd'],
      });
      return {
        nodes: [nBat, nSw, nRes, nInd, nCap, nGnd],
        edges: [
          makeEdge(makeId('e'), nBat.id, nSw.id, '+', {
            type: 'orthogonal',
            arrow: 'forward',
            color: '#dc2626',
          }),
          makeEdge(makeId('e'), nSw.id, nRes.id, 'I(t)', {
            type: 'orthogonal',
            arrow: 'forward',
            color: '#0f172a',
          }),
          makeEdge(makeId('e'), nRes.id, nInd.id, '', {
            type: 'orthogonal',
            arrow: 'none',
            color: '#0f172a',
          }),
          makeEdge(makeId('e'), nInd.id, nCap.id, '', {
            type: 'orthogonal',
            arrow: 'none',
            color: '#0f172a',
          }),
          makeEdge(makeId('e'), nCap.id, nBat.id, '-', {
            type: 'orthogonal',
            arrow: 'none',
            color: '#0f172a',
          }),
          makeEdge(makeId('e'), nBat.id, nGnd.id, '', {
            type: 'straight',
            arrow: 'none',
            color: '#0f172a',
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_led_driver',
    category: 'schematics',
    title: 'Diode / Lamp Driver Circuit',
    summary: '9V source through current-limiting resistor, diode, lamp load, and ground.',
    build: (cx, cy, makeId) => {
      const nBat = makeNode(makeId('n'), cx - 170, cy, 100, 62, '9V DC', 'battery', {
        filled: false,
        borderColor: '#dc2626',
        borderWidth: 2,
      });
      const nRes = makeNode(makeId('n'), cx - 35, cy - 85, 110, 52, '330 Ω', 'resistor', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2,
      });
      const nDiode = makeNode(makeId('n'), cx + 115, cy - 85, 100, 54, 'D1', 'diode', {
        color: '#fef08a',
        borderColor: '#0f172a',
        borderWidth: 2,
      });
      const nBulb = makeNode(makeId('n'), cx + 160, cy + 45, 96, 62, 'Load', 'bulb', {
        color: '#fef9c3',
        borderColor: '#ca8a04',
        borderWidth: 2,
      });
      const nGnd = makeNode(makeId('n'), cx - 35, cy + 100, 66, 54, 'GND', 'ground', {
        filled: false,
        borderColor: '#0f172a',
        borderWidth: 2,
      });
      return {
        nodes: [nBat, nRes, nDiode, nBulb, nGnd],
        edges: [
          makeEdge(makeId('e'), nBat.id, nRes.id, 'I', { type: 'orthogonal', color: '#dc2626' }),
          makeEdge(makeId('e'), nRes.id, nDiode.id, '', { type: 'orthogonal', arrow: 'none' }),
          makeEdge(makeId('e'), nDiode.id, nBulb.id, '', { type: 'orthogonal', arrow: 'forward' }),
          makeEdge(makeId('e'), nBulb.id, nGnd.id, '', { type: 'orthogonal', arrow: 'none' }),
          makeEdge(makeId('e'), nGnd.id, nBat.id, '', { type: 'orthogonal', arrow: 'none' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_logic_gates',
    category: 'schematics',
    title: 'Digital Logic Combinational Block',
    summary: 'Inputs A, B feeding AND, OR, and NOT inverter stages with labeled outputs.',
    build: (cx, cy, makeId) => {
      const nA = makeNode(makeId('n'), cx - 190, cy - 55, 64, 42, 'In A', 'rounded', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nB = makeNode(makeId('n'), cx - 190, cy + 55, 64, 42, 'In B', 'rounded', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nAnd = makeNode(makeId('n'), cx - 25, cy - 55, 114, 64, 'AND', 'and_gate', {
        color: '#e0e7ff',
        borderColor: '#3730a3',
      });
      const nOr = makeNode(makeId('n'), cx - 25, cy + 55, 114, 64, 'OR', 'or_gate', {
        color: '#dcfce7',
        borderColor: '#166534',
      });
      const nNot = makeNode(makeId('n'), cx + 125, cy - 55, 102, 58, 'NAND', 'not_gate', {
        color: '#fee2e2',
        borderColor: '#991b1b',
      });
      const nOut1 = makeNode(makeId('n'), cx + 235, cy - 55, 76, 42, 'Y₁', 'circle', {
        color: '#fef3c7',
        borderColor: '#b45309',
      });
      const nOut2 = makeNode(makeId('n'), cx + 235, cy + 55, 76, 42, 'Y₂', 'circle', {
        color: '#fef3c7',
        borderColor: '#b45309',
      });
      return {
        nodes: [nA, nB, nAnd, nOr, nNot, nOut1, nOut2],
        edges: [
          makeEdge(makeId('e'), nA.id, nAnd.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nB.id, nAnd.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nA.id, nOr.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nB.id, nOr.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nAnd.id, nNot.id, '', { type: 'straight' }),
          makeEdge(makeId('e'), nNot.id, nOut1.id, '!(A·B)', { type: 'straight' }),
          makeEdge(makeId('e'), nOr.id, nOut2.id, 'A+B', { type: 'straight' }),
        ],
        stickies: [],
      };
    },
  },

  // --- MATHS KITS ---
  {
    id: 'kit_cartesian_vectors',
    category: 'maths',
    title: 'Cartesian Plane & Vector Sum',
    summary: '2D coordinate axes with vector components u, v, and resultant R = u + v.',
    build: (cx, cy, makeId) => {
      const nAxes = makeNode(makeId('n'), cx, cy, 260, 210, 'ℝ² Plane', 'axes_2d', {
        filled: false,
        borderColor: '#334155',
        borderWidth: 1.8,
        layer: 'Background',
        tags: ['math', 'axes'],
      });
      const nOrigin = makeNode(makeId('n'), cx, cy, 24, 24, 'O', 'circle', {
        color: '#0f172a',
        textColor: '#ffffff',
        fs: 10,
      });
      const nU = makeNode(makeId('n'), cx + 95, cy - 15, 72, 34, 'u⃗ (3,0)', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nR = makeNode(makeId('n'), cx + 95, cy - 95, 92, 36, 'R⃗ = u⃗ + v⃗', 'rounded', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      return {
        nodes: [nAxes, nOrigin, nU, nR],
        edges: [
          makeEdge(makeId('e'), nOrigin.id, nU.id, 'u⃗', { color: '#2563eb', width: 2.5 }),
          makeEdge(makeId('e'), nU.id, nR.id, 'v⃗', {
            color: '#059669',
            width: 2.2,
            lineStyle: 'dashed',
          }),
          makeEdge(makeId('e'), nOrigin.id, nR.id, 'R⃗', { color: '#dc2626', width: 2.6 }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_trig_triangle',
    category: 'maths',
    title: 'Trigonometry Right Triangle',
    summary: 'Right triangle with hypotenuse c, opposite a, adjacent b, and angle θ.',
    build: (cx, cy, makeId) => {
      const nTri = makeNode(makeId('n'), cx, cy, 220, 145, 'a² + b² = c²', 'incline', {
        color: '#eff6ff',
        borderColor: '#1d4ed8',
        borderWidth: 2.2,
        tags: ['math', 'trigonometry'],
      });
      const nHyp = makeNode(makeId('n'), cx - 55, cy - 38, 104, 34, 'c (Hypotenuse)', 'text', {});
      const nOpp = makeNode(makeId('n'), cx + 160, cy, 96, 34, 'a = c·sin θ', 'text', {});
      const nAdj = makeNode(makeId('n'), cx, cy + 98, 96, 34, 'b = c·cos θ', 'text', {});
      return {
        nodes: [nTri, nHyp, nOpp, nAdj],
        edges: [],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_venn_2set',
    category: 'maths',
    title: '2-Set Venn Probability',
    summary: 'Intersecting sets A and B with probability identity P(A ∪ B).',
    build: (cx, cy, makeId) => {
      const nVenn = makeNode(makeId('n'), cx, cy, 240, 145, 'A ∩ B', 'venn_2', {
        color: '#bfdbfe',
        borderColor: '#1d4ed8',
        borderWidth: 2.2,
        tags: ['math', 'sets'],
      });
      const nSetA = makeNode(makeId('n'), cx - 150, cy - 60, 74, 38, 'Set A', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nSetB = makeNode(makeId('n'), cx + 150, cy - 60, 74, 38, 'Set B', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      const nFormula = makeNode(
        makeId('n'),
        cx,
        cy + 108,
        240,
        36,
        'P(A ∪ B) = P(A) + P(B) - P(A ∩ B)',
        'rounded',
        { color: '#f8fafc', borderColor: '#64748b', fs: 11 }
      );
      return {
        nodes: [nVenn, nSetA, nSetB, nFormula],
        edges: [
          makeEdge(makeId('e'), nSetA.id, nVenn.id, 'A', { lineStyle: 'dashed', color: '#2563eb' }),
          makeEdge(makeId('e'), nSetB.id, nVenn.id, 'B', { lineStyle: 'dashed', color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_bell_curve',
    category: 'maths',
    title: 'Normal Distribution N(μ, σ²)',
    summary: 'Gaussian bell curve with empirical 68-95-99.7% rule markers.',
    build: (cx, cy, makeId) => {
      const nCurve = makeNode(makeId('n'), cx, cy - 10, 250, 140, 'N(μ, σ²)', 'bell_curve', {
        color: '#bfdbfe',
        borderColor: '#1d4ed8',
        borderWidth: 2.2,
        tags: ['math', 'statistics'],
      });
      const nRule = makeNode(
        makeId('n'),
        cx,
        cy + 96,
        250,
        38,
        '68.2% (±1σ) · 95.4% (±2σ) · 99.7% (±3σ)',
        'rounded',
        { color: '#f8fafc', borderColor: '#64748b', fs: 11 }
      );
      return {
        nodes: [nCurve, nRule],
        edges: [],
        stickies: [],
      };
    },
  },

  // --- SYSTEMS & WORKFLOW KITS ---
  {
    id: 'kit_flowchart_loop',
    category: 'systems',
    title: 'Flowchart Decision Loop',
    summary: 'Start -> Input -> Validation check with retry branch and final output.',
    build: (cx, cy, makeId) => {
      const nStart = makeNode(makeId('n'), cx - 210, cy, 96, 48, 'Start', 'circle', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      const nInput = makeNode(makeId('n'), cx - 65, cy, 132, 54, 'Read Input', 'parallelogram', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nCheck = makeNode(makeId('n'), cx + 95, cy, 132, 80, 'Valid?', 'diamond', {
        color: '#fef3c7',
        borderColor: '#d97706',
      });
      const nDone = makeNode(makeId('n'), cx + 255, cy, 108, 48, 'Complete', 'circle', {
        color: '#e0e7ff',
        borderColor: '#4f46e5',
      });
      return {
        nodes: [nStart, nInput, nCheck, nDone],
        edges: [
          makeEdge(makeId('e'), nStart.id, nInput.id, '', { color: '#334155' }),
          makeEdge(makeId('e'), nInput.id, nCheck.id, 'Validate', { color: '#2563eb' }),
          makeEdge(makeId('e'), nCheck.id, nDone.id, 'Yes', { color: '#16a34a' }),
          makeEdge(makeId('e'), nCheck.id, nInput.id, 'Retry', {
            type: 'curved',
            curvature: -85,
            lineStyle: 'dashed',
            color: '#dc2626',
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_three_tier',
    category: 'systems',
    title: '3-Tier Application Stack',
    summary: 'Client UI -> API Gateway -> Worker Service -> Primary Database & Cache.',
    build: (cx, cy, makeId) => {
      const nClient = makeNode(makeId('n'), cx - 210, cy, 130, 56, 'Web Client', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nApi = makeNode(makeId('n'), cx - 35, cy, 140, 60, 'API Gateway', 'hexagon', {
        color: '#e0e7ff',
        borderColor: '#4f46e5',
      });
      const nSvc = makeNode(makeId('n'), cx + 145, cy - 55, 136, 54, 'Core Service', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      const nDb = makeNode(makeId('n'), cx + 145, cy + 75, 126, 72, 'Database', 'cylinder', {
        color: '#f1f5f9',
        borderColor: '#334155',
      });
      return {
        nodes: [nClient, nApi, nSvc, nDb],
        edges: [
          makeEdge(makeId('e'), nClient.id, nApi.id, 'HTTPS', { color: '#2563eb' }),
          makeEdge(makeId('e'), nApi.id, nSvc.id, 'RPC', { type: 'curved', color: '#4f46e5' }),
          makeEdge(makeId('e'), nSvc.id, nDb.id, 'Query', { arrow: 'both', color: '#334155' }),
          makeEdge(makeId('e'), nApi.id, nDb.id, 'Read', {
            type: 'curved',
            lineStyle: 'dashed',
            color: '#64748b',
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_feedback_control',
    category: 'systems',
    title: 'Closed-Loop Control System',
    summary: 'Reference r(t) -> Controller -> Plant G(s) -> Output y(t) with sensor feedback.',
    build: (cx, cy, makeId) => {
      const nRef = makeNode(makeId('n'), cx - 220, cy - 35, 92, 46, 'r(t) Ref', 'circle', {
        color: '#f8fafc',
        borderColor: '#0f172a',
      });
      const nCtrl = makeNode(makeId('n'), cx - 65, cy - 35, 132, 56, 'PID Controller', 'rectangle', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nPlant = makeNode(makeId('n'), cx + 115, cy - 35, 132, 56, 'Plant G(s)', 'rectangle', {
        color: '#dcfce7',
        borderColor: '#15803d',
      });
      const nOut = makeNode(makeId('n'), cx + 255, cy - 35, 86, 46, 'y(t)', 'circle', {
        color: '#fef3c7',
        borderColor: '#d97706',
      });
      const nSensor = makeNode(makeId('n'), cx + 25, cy + 85, 136, 52, 'Sensor H(s)', 'rounded', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      return {
        nodes: [nRef, nCtrl, nPlant, nOut, nSensor],
        edges: [
          makeEdge(makeId('e'), nRef.id, nCtrl.id, 'e(t)', { color: '#0f172a' }),
          makeEdge(makeId('e'), nCtrl.id, nPlant.id, 'u(t)', { color: '#1d4ed8' }),
          makeEdge(makeId('e'), nPlant.id, nOut.id, '', { color: '#15803d' }),
          makeEdge(makeId('e'), nOut.id, nSensor.id, 'Feedback', {
            type: 'orthogonal',
            color: '#dc2626',
          }),
          makeEdge(makeId('e'), nSensor.id, nRef.id, '-', {
            type: 'orthogonal',
            color: '#dc2626',
          }),
        ],
        stickies: [],
      };
    },
  },
];
