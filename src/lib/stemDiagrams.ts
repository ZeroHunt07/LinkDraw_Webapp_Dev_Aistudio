import type { GraphEdge, GraphNode, NodeShape, StickyNote } from '../types/linkdraw';

export type StemCategory =
  | 'physics'
  | 'schematics'
  | 'maths'
  | 'biology'
  | 'chemistry'
  | 'systems';

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
  {
    id: 'phy_concave_lens',
    category: 'physics',
    label: 'Concave Lens',
    defaultText: '-f',
    shape: 'concave_lens',
    w: 70,
    h: 140,
    color: '#e0f2fe',
    filled: true,
    borderColor: '#0284c7',
    borderWidth: 2,
    tags: ['physics', 'optics'],
    summary: 'Diverging optical lens',
  },
  {
    id: 'phy_prism',
    category: 'physics',
    label: 'Optical Prism',
    defaultText: 'n',
    shape: 'prism',
    w: 120,
    h: 108,
    color: '#e0f2fe',
    filled: true,
    borderColor: '#0369a1',
    borderWidth: 2,
    tags: ['physics', 'optics'],
    summary: 'Refractive glass prism',
  },
  {
    id: 'phy_mirror',
    category: 'physics',
    label: 'Curved Mirror',
    defaultText: 'Mirror',
    shape: 'concave_mirror',
    w: 84,
    h: 132,
    color: '#ffffff',
    filled: false,
    borderColor: '#334155',
    borderWidth: 2.2,
    tags: ['physics', 'optics'],
    summary: 'Concave / parabolic mirror',
  },
  {
    id: 'phy_pendulum',
    category: 'physics',
    label: 'Simple Pendulum',
    defaultText: 'T = 2π√(L/g)',
    shape: 'pendulum',
    w: 112,
    h: 134,
    color: '#fde68a',
    filled: true,
    borderColor: '#b45309',
    borderWidth: 2,
    tags: ['physics', 'oscillation'],
    summary: 'Swinging pendulum mass & pivot',
  },
  {
    id: 'phy_magnet',
    category: 'physics',
    label: 'Bar Magnet',
    defaultText: 'B Field',
    shape: 'magnet_bar',
    w: 136,
    h: 58,
    color: '#ffffff',
    filled: true,
    borderColor: '#1e293b',
    borderWidth: 2,
    tags: ['physics', 'magnetism'],
    summary: 'Dipole N/S bar magnet',
  },
  {
    id: 'phy_meter',
    category: 'physics',
    label: 'Ammeter / Voltmeter',
    defaultText: 'A / V',
    shape: 'meter_circle',
    w: 96,
    h: 58,
    color: '#f8fafc',
    filled: true,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['physics', 'measurement'],
    summary: 'In-line electrical meter',
  },
  {
    id: 'phy_convex_mirror',
    category: 'physics',
    label: 'Convex Mirror',
    defaultText: 'Diverging (-f)',
    shape: 'convex_mirror',
    w: 84,
    h: 132,
    color: '#ffffff',
    filled: false,
    borderColor: '#334155',
    borderWidth: 2.2,
    tags: ['physics', 'optics', 'mirror'],
    summary: 'Convex diverging spherical mirror',
  },
  {
    id: 'phy_ray_source',
    category: 'physics',
    label: 'Laser / Ray Source',
    defaultText: 'Laser (λ)',
    shape: 'ray_source',
    w: 130,
    h: 62,
    color: '#fee2e2',
    filled: true,
    borderColor: '#dc2626',
    borderWidth: 2,
    tags: ['physics', 'optics', 'laser'],
    summary: 'Collimated coherent beam emitter',
  },
  {
    id: 'phy_solenoid',
    category: 'physics',
    label: 'Solenoid Coil',
    defaultText: 'B = μ₀nI',
    shape: 'solenoid',
    w: 152,
    h: 72,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#3730a3',
    borderWidth: 2,
    tags: ['physics', 'electromagnetism', 'coil'],
    summary: 'Electromagnetic helical solenoid',
  },
  {
    id: 'phy_field_lines',
    category: 'physics',
    label: 'Magnetic / E-Field',
    defaultText: 'B⃗ / E⃗ Flux',
    shape: 'field_lines',
    w: 156,
    h: 92,
    color: '#ffffff',
    filled: false,
    borderColor: '#2563eb',
    borderWidth: 1.8,
    tags: ['physics', 'field', 'flux', 'magnetism'],
    summary: 'Closed magnetic/electric flux loops',
  },
  {
    id: 'phy_lever',
    category: 'physics',
    label: 'Lever & Fulcrum',
    defaultText: 'τ = F · d',
    shape: 'lever_fulcrum',
    w: 168,
    h: 84,
    color: '#fde68a',
    filled: true,
    borderColor: '#b45309',
    borderWidth: 2,
    tags: ['physics', 'torque', 'mechanics', 'moment'],
    summary: 'Pivot fulcrum & torque lever beam',
  },
  {
    id: 'phy_cart',
    category: 'physics',
    label: 'Dynamics Cart',
    defaultText: 'm₁ v₁',
    shape: 'cart_wheels',
    w: 126,
    h: 72,
    color: '#dbeafe',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['physics', 'momentum', 'collision', 'kinematics'],
    summary: 'Low-friction dynamics cart on wheels',
  },
  {
    id: 'phy_thermometer',
    category: 'physics',
    label: 'Thermometer',
    defaultText: 'T (K / °C)',
    shape: 'thermometer',
    w: 78,
    h: 134,
    color: '#fee2e2',
    filled: true,
    borderColor: '#334155',
    borderWidth: 2,
    tags: ['physics', 'thermal', 'temperature', 'heat'],
    summary: 'Calibrated thermal bulb thermometer',
  },
  {
    id: 'phy_piston',
    category: 'physics',
    label: 'Gas Piston',
    defaultText: 'PV = nRT',
    shape: 'piston_cylinder',
    w: 156,
    h: 88,
    color: '#bae6fd',
    filled: true,
    borderColor: '#0369a1',
    borderWidth: 2,
    tags: ['physics', 'thermodynamics', 'gas', 'work'],
    summary: 'Ideal gas piston-cylinder chamber',
  },
  {
    id: 'phy_projectile',
    category: 'physics',
    label: 'Projectile Arc',
    defaultText: 'R = v₀²sin2θ/g',
    shape: 'projectile_arc',
    w: 176,
    h: 98,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['physics', 'kinematics', 'trajectory'],
    summary: 'Parabolic projectile trajectory',
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
  {
    id: 'sch_opamp',
    category: 'schematics',
    label: 'Op-Amp (U1)',
    defaultText: 'Op-Amp',
    shape: 'opamp',
    w: 126,
    h: 88,
    color: '#e0f2fe',
    filled: true,
    borderColor: '#0369a1',
    borderWidth: 2,
    tags: ['schematic', 'opamp', 'analog', 'amplifier'],
    summary: 'Differential operational amplifier',
  },
  {
    id: 'sch_xor',
    category: 'schematics',
    label: 'XOR Gate',
    defaultText: 'XOR',
    shape: 'xor_gate',
    w: 124,
    h: 68,
    color: '#f3e8ff',
    filled: true,
    borderColor: '#6b21a8',
    borderWidth: 2,
    tags: ['logic', 'gate', 'xor', 'digital'],
    summary: '2-input exclusive-OR gate',
  },
  {
    id: 'sch_transformer',
    category: 'schematics',
    label: 'Transformer',
    defaultText: 'N₁ : N₂',
    shape: 'transformer',
    w: 132,
    h: 82,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'ac', 'transformer', 'coil'],
    summary: 'Iron-core AC step transformer',
  },
  {
    id: 'sch_fuse',
    category: 'schematics',
    label: 'Fuse (F1)',
    defaultText: 'Fuse 2A',
    shape: 'fuse_sym',
    w: 112,
    h: 54,
    color: '#ffffff',
    filled: false,
    borderColor: '#b91c1c',
    borderWidth: 2,
    tags: ['schematic', 'fuse', 'protection'],
    summary: 'Overcurrent protection fuse',
  },
  {
    id: 'sch_pot',
    category: 'schematics',
    label: 'Potentiometer',
    defaultText: 'RV1 10kΩ',
    shape: 'potentiometer',
    w: 122,
    h: 64,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['schematic', 'resistor', 'variable'],
    summary: 'Variable 3-terminal resistor',
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
  {
    id: 'math_number_line',
    category: 'maths',
    label: '1D Number Line',
    defaultText: 'ℝ',
    shape: 'number_line',
    w: 220,
    h: 64,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['math', 'number-line'],
    summary: 'Real number axis with ticks',
  },
  {
    id: 'math_parabola',
    category: 'maths',
    label: 'Parabola Curve',
    defaultText: 'y = ax² + bx + c',
    shape: 'parabola',
    w: 170,
    h: 138,
    color: '#f8fafc',
    filled: true,
    borderColor: '#2563eb',
    borderWidth: 2.2,
    tags: ['math', 'algebra'],
    summary: 'Quadratic parabola graph',
  },
  {
    id: 'math_right_triangle',
    category: 'maths',
    label: 'Right Triangle',
    defaultText: 'a² + b² = c²',
    shape: 'right_triangle',
    w: 140,
    h: 108,
    color: '#fef3c7',
    filled: true,
    borderColor: '#b45309',
    borderWidth: 2,
    tags: ['math', 'trigonometry'],
    summary: 'Pythagorean right triangle',
  },
  {
    id: 'math_venn_3',
    category: 'maths',
    label: '3-Set Venn',
    defaultText: 'A ∩ B ∩ C',
    shape: 'venn_3',
    w: 176,
    h: 156,
    color: '#bfdbfe',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['math', 'sets'],
    summary: 'Three-circle Venn diagram',
  },
  {
    id: 'math_pie_chart',
    category: 'maths',
    label: 'Pie / Sector Chart',
    defaultText: 'Proportions',
    shape: 'pie_chart',
    w: 120,
    h: 120,
    color: '#93c5fd',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['math', 'statistics'],
    summary: 'Circular sector chart',
  },
  {
    id: 'math_sphere',
    category: 'maths',
    label: '3D Sphere',
    defaultText: 'V = ⁴⁄₃πr³',
    shape: 'sphere_3d',
    w: 112,
    h: 112,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#4338ca',
    borderWidth: 2,
    tags: ['math', '3d'],
    summary: '3D sphere with equator',
  },
  {
    id: 'math_pyramid',
    category: 'maths',
    label: '3D Pyramid',
    defaultText: 'V = ⅓Bh',
    shape: 'pyramid_3d',
    w: 116,
    h: 112,
    color: '#dcfce7',
    filled: true,
    borderColor: '#15803d',
    borderWidth: 2,
    tags: ['math', '3d'],
    summary: '3D square pyramid',
  },
  {
    id: 'math_axes_3d',
    category: 'maths',
    label: '3D Axes (x,y,z)',
    defaultText: 'ℝ³ Space',
    shape: 'axes_3d',
    w: 186,
    h: 156,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 1.8,
    tags: ['math', '3d', 'axes', 'calculus'],
    summary: '3D isometric coordinate axes',
  },
  {
    id: 'math_sine_graph',
    category: 'maths',
    label: 'Sine Function',
    defaultText: 'y = A·sin(ωx)',
    shape: 'sine_graph',
    w: 190,
    h: 130,
    color: '#f8fafc',
    filled: true,
    borderColor: '#7c3aed',
    borderWidth: 2.2,
    tags: ['math', 'trig', 'sine', 'wave'],
    summary: 'Sinusoidal curve on axes',
  },
  {
    id: 'math_unit_circle',
    category: 'maths',
    label: 'Unit Circle',
    defaultText: 'cos²θ + sin²θ = 1',
    shape: 'unit_circle',
    w: 154,
    h: 154,
    color: '#dbeafe',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['math', 'trigonometry', 'circle'],
    summary: 'Trigonometric unit circle & radius',
  },
  {
    id: 'math_ellipse',
    category: 'maths',
    label: 'Conic Ellipse',
    defaultText: 'x²/a² + y²/b² = 1',
    shape: 'ellipse_conic',
    w: 176,
    h: 112,
    color: '#fef3c7',
    filled: true,
    borderColor: '#b45309',
    borderWidth: 2,
    tags: ['math', 'conic', 'ellipse', 'foci'],
    summary: 'Ellipse with major/minor axes & foci',
  },
  {
    id: 'math_bar_chart',
    category: 'maths',
    label: 'Bar / Histogram',
    defaultText: 'Frequency',
    shape: 'bar_chart',
    w: 174,
    h: 132,
    color: '#f8fafc',
    filled: true,
    borderColor: '#2563eb',
    borderWidth: 2,
    tags: ['math', 'statistics', 'histogram', 'chart'],
    summary: 'Categorical bar chart / histogram',
  },
  {
    id: 'math_scatter',
    category: 'maths',
    label: 'Scatter & Fit',
    defaultText: 'ŷ = mx + b (R²)',
    shape: 'scatter_plot',
    w: 176,
    h: 134,
    color: '#f8fafc',
    filled: true,
    borderColor: '#059669',
    borderWidth: 2,
    tags: ['math', 'statistics', 'regression', 'scatter'],
    summary: 'Linear regression scatter plot',
  },
  {
    id: 'math_box_plot',
    category: 'maths',
    label: 'Box-Whisker',
    defaultText: 'IQR (Q₁ - Q₃)',
    shape: 'box_plot',
    w: 168,
    h: 76,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#4338ca',
    borderWidth: 2,
    tags: ['math', 'statistics', 'quartile'],
    summary: '5-number summary box plot',
  },
  {
    id: 'math_fraction',
    category: 'maths',
    label: 'Fraction Bar',
    defaultText: '¾ = 75%',
    shape: 'fraction_bar',
    w: 164,
    h: 66,
    color: '#93c5fd',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['math', 'fraction', 'ratio'],
    summary: 'Segmented proportion / fraction bar',
  },

  // Biology
  {
    id: 'bio_animal_cell',
    category: 'biology',
    label: 'Animal Cell',
    defaultText: 'Eukaryotic Cell',
    shape: 'cell_animal',
    w: 168,
    h: 132,
    color: '#fce7f3',
    filled: true,
    borderColor: '#db2777',
    borderWidth: 2.2,
    tags: ['biology', 'cell'],
    summary: 'Animal cell with nucleus & organelles',
  },
  {
    id: 'bio_plant_cell',
    category: 'biology',
    label: 'Plant Cell',
    defaultText: 'Plant Cell',
    shape: 'cell_plant',
    w: 170,
    h: 132,
    color: '#dcfce7',
    filled: true,
    borderColor: '#15803d',
    borderWidth: 2.2,
    tags: ['biology', 'cell'],
    summary: 'Cell wall, vacuole & nucleus',
  },
  {
    id: 'bio_dna',
    category: 'biology',
    label: 'DNA Double Helix',
    defaultText: 'DNA (A-T / G-C)',
    shape: 'dna_helix',
    w: 158,
    h: 82,
    color: '#ffffff',
    filled: false,
    borderColor: '#2563eb',
    borderWidth: 2.2,
    tags: ['biology', 'genetics'],
    summary: 'Double-stranded DNA helix',
  },
  {
    id: 'bio_mitochondria',
    category: 'biology',
    label: 'Mitochondrion',
    defaultText: 'ATP Synthase',
    shape: 'mitochondria',
    w: 148,
    h: 88,
    color: '#fed7aa',
    filled: true,
    borderColor: '#c2410c',
    borderWidth: 2,
    tags: ['biology', 'organelle'],
    summary: 'Powerhouse organelle with cristae',
  },
  {
    id: 'bio_chloroplast',
    category: 'biology',
    label: 'Chloroplast',
    defaultText: 'Chloroplast',
    shape: 'chloroplast',
    w: 148,
    h: 88,
    color: '#bbf7d0',
    filled: true,
    borderColor: '#166534',
    borderWidth: 2,
    tags: ['biology', 'photosynthesis'],
    summary: 'Thylakoid grana organelle',
  },
  {
    id: 'bio_neuron',
    category: 'biology',
    label: 'Neuron / Axon',
    defaultText: 'Motor Neuron',
    shape: 'neuron',
    w: 184,
    h: 96,
    color: '#fef08a',
    filled: true,
    borderColor: '#a16207',
    borderWidth: 2,
    tags: ['biology', 'neuroscience'],
    summary: 'Dendrites, soma, myelinated axon',
  },
  {
    id: 'bio_antibody',
    category: 'biology',
    label: 'Antibody (IgG)',
    defaultText: 'Antibody',
    shape: 'antibody',
    w: 108,
    h: 108,
    color: '#ffffff',
    filled: false,
    borderColor: '#7c3aed',
    borderWidth: 2.8,
    tags: ['biology', 'immunology'],
    summary: 'Y-shaped immunoglobulin',
  },
  {
    id: 'bio_virus',
    category: 'biology',
    label: 'Bacteriophage',
    defaultText: 'Viral Capsid',
    shape: 'virus_capsid',
    w: 112,
    h: 132,
    color: '#fee2e2',
    filled: true,
    borderColor: '#b91c1c',
    borderWidth: 2,
    tags: ['biology', 'microbiology'],
    summary: 'Capsid head & tail fibers',
  },
  {
    id: 'bio_leaf',
    category: 'biology',
    label: 'Leaf Organ',
    defaultText: 'Mesophyll',
    shape: 'leaf_organ',
    w: 144,
    h: 92,
    color: '#bbf7d0',
    filled: true,
    borderColor: '#15803d',
    borderWidth: 2,
    tags: ['biology', 'botany'],
    summary: 'Photosynthetic leaf with veins',
  },
  {
    id: 'bio_punnett',
    category: 'biology',
    label: 'Punnett 2×2',
    defaultText: 'Aa × Aa',
    shape: 'punnett_grid',
    w: 136,
    h: 132,
    color: '#f8fafc',
    filled: true,
    borderColor: '#0f172a',
    borderWidth: 2,
    tags: ['biology', 'genetics'],
    summary: 'Mendelian 2×2 inheritance grid',
  },
  {
    id: 'bio_enzyme',
    category: 'biology',
    label: 'Enzyme / Protein',
    defaultText: 'Enzyme',
    shape: 'hexagon',
    w: 126,
    h: 64,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#4338ca',
    borderWidth: 2,
    tags: ['biology', 'biochem'],
    summary: 'Catalytic protein / enzyme node',
  },
  {
    id: 'bio_ribosome',
    category: 'biology',
    label: 'Ribosome (60S/40S)',
    defaultText: 'Translation',
    shape: 'ribosome',
    w: 132,
    h: 92,
    color: '#fde68a',
    filled: true,
    borderColor: '#b45309',
    borderWidth: 2,
    tags: ['biology', 'genetics', 'ribosome', 'protein'],
    summary: 'Ribosomal subunits bound to mRNA',
  },
  {
    id: 'bio_golgi',
    category: 'biology',
    label: 'Golgi Apparatus',
    defaultText: 'Golgi Body',
    shape: 'golgi_body',
    w: 152,
    h: 92,
    color: '#fed7aa',
    filled: true,
    borderColor: '#c2410c',
    borderWidth: 2,
    tags: ['biology', 'organelle', 'golgi'],
    summary: 'Cisternae stack & secretory vesicles',
  },
  {
    id: 'bio_membrane',
    category: 'biology',
    label: 'Lipid Bilayer',
    defaultText: 'Plasma Membrane',
    shape: 'lipid_bilayer',
    w: 164,
    h: 88,
    color: '#fef08a',
    filled: true,
    borderColor: '#a16207',
    borderWidth: 1.8,
    tags: ['biology', 'membrane', 'phospholipid'],
    summary: 'Phospholipid bilayer structure',
  },
  {
    id: 'bio_chromosome',
    category: 'biology',
    label: 'Chromosome (X)',
    defaultText: 'Sister Chromatids',
    shape: 'chromosome',
    w: 108,
    h: 116,
    color: '#e9d5ff',
    filled: true,
    borderColor: '#7e22ce',
    borderWidth: 2,
    tags: ['biology', 'genetics', 'mitosis', 'dna'],
    summary: 'Replicated X chromosome & centromere',
  },
  {
    id: 'bio_synapse',
    category: 'biology',
    label: 'Synaptic Cleft',
    defaultText: 'Neurotransmitter',
    shape: 'synapse_cleft',
    w: 152,
    h: 92,
    color: '#fef9c3',
    filled: true,
    borderColor: '#ca8a04',
    borderWidth: 2,
    tags: ['biology', 'neuroscience', 'synapse'],
    summary: 'Presynaptic terminal & cleft receptors',
  },
  {
    id: 'bio_petri',
    category: 'biology',
    label: 'Petri Agar Dish',
    defaultText: 'Culture Plate',
    shape: 'petri_dish',
    w: 122,
    h: 122,
    color: '#fecdd3',
    filled: true,
    borderColor: '#be123c',
    borderWidth: 2,
    tags: ['biology', 'microbiology', 'bacteria'],
    summary: 'Agar culture dish with colonies',
  },
  {
    id: 'bio_microscope',
    category: 'biology',
    label: 'Microscope',
    defaultText: '400× Optical',
    shape: 'microscope',
    w: 116,
    h: 132,
    color: '#e2e8f0',
    filled: true,
    borderColor: '#334155',
    borderWidth: 2,
    tags: ['biology', 'lab', 'microscope'],
    summary: 'Compound optical microscope',
  },
  {
    id: 'bio_heart',
    category: 'biology',
    label: '4-Chamber Heart',
    defaultText: 'RA | LA / RV | LV',
    shape: 'heart_chamber',
    w: 136,
    h: 122,
    color: '#fee2e2',
    filled: true,
    borderColor: '#dc2626',
    borderWidth: 2.2,
    tags: ['biology', 'anatomy', 'cardiac', 'heart'],
    summary: 'Schematic 4-chamber heart model',
  },

  // Chemistry
  {
    id: 'chem_atom',
    category: 'chemistry',
    label: 'Bohr Atom',
    defaultText: 'Carbon (C)',
    shape: 'atom_bohr',
    w: 126,
    h: 126,
    color: '#dbeafe',
    filled: true,
    borderColor: '#1d4ed8',
    borderWidth: 2,
    tags: ['chemistry', 'atom'],
    summary: 'Nucleus & electron shells',
  },
  {
    id: 'chem_benzene',
    category: 'chemistry',
    label: 'Benzene Ring',
    defaultText: 'C₆H₆',
    shape: 'benzene_ring',
    w: 112,
    h: 112,
    color: '#f8fafc',
    filled: true,
    borderColor: '#0f172a',
    borderWidth: 2.2,
    tags: ['chemistry', 'organic'],
    summary: 'Aromatic 6-carbon ring',
  },
  {
    id: 'chem_molecule',
    category: 'chemistry',
    label: 'Molecule (H₂O)',
    defaultText: 'H₂O (104.5°)',
    shape: 'molecule_h2o',
    w: 132,
    h: 108,
    color: '#bae6fd',
    filled: true,
    borderColor: '#0369a1',
    borderWidth: 2,
    tags: ['chemistry', 'molecule'],
    summary: 'Bent triatomic molecule',
  },
  {
    id: 'chem_beaker',
    category: 'chemistry',
    label: 'Lab Beaker',
    defaultText: '100 mL Soln',
    shape: 'beaker',
    w: 108,
    h: 124,
    color: '#bae6fd',
    filled: true,
    borderColor: '#0284c7',
    borderWidth: 2,
    tags: ['chemistry', 'lab'],
    summary: 'Graduated glass beaker',
  },
  {
    id: 'chem_erlenmeyer',
    category: 'chemistry',
    label: 'Erlenmeyer Flask',
    defaultText: 'Titrand',
    shape: 'erlenmeyer_flask',
    w: 116,
    h: 130,
    color: '#fbcfe8',
    filled: true,
    borderColor: '#be185d',
    borderWidth: 2,
    tags: ['chemistry', 'lab'],
    summary: 'Conical titration flask',
  },
  {
    id: 'chem_round_flask',
    category: 'chemistry',
    label: 'Boiling Flask',
    defaultText: 'Reflux Mix',
    shape: 'round_flask',
    w: 114,
    h: 132,
    color: '#fef08a',
    filled: true,
    borderColor: '#b45309',
    borderWidth: 2,
    tags: ['chemistry', 'lab'],
    summary: 'Round-bottom distillation flask',
  },
  {
    id: 'chem_test_tube',
    category: 'chemistry',
    label: 'Test Tube',
    defaultText: 'Sample',
    shape: 'test_tube',
    w: 76,
    h: 128,
    color: '#a7f3d0',
    filled: true,
    borderColor: '#047857',
    borderWidth: 2,
    tags: ['chemistry', 'lab'],
    summary: 'Culture / reagent test tube',
  },
  {
    id: 'chem_burner',
    category: 'chemistry',
    label: 'Bunsen Burner',
    defaultText: 'Heat (Δ)',
    shape: 'bunsen_burner',
    w: 94,
    h: 122,
    color: '#fed7aa',
    filled: true,
    borderColor: '#c2410c',
    borderWidth: 2,
    tags: ['chemistry', 'lab'],
    summary: 'Lab gas burner & flame',
  },
  {
    id: 'chem_reaction_arrow',
    category: 'chemistry',
    label: 'Equilibrium ⇌',
    defaultText: 'Keq / Catalyst',
    shape: 'reaction_arrow',
    w: 136,
    h: 56,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2.2,
    tags: ['chemistry', 'equilibrium'],
    summary: 'Reversible reaction arrows',
  },
  {
    id: 'chem_double_bond',
    category: 'chemistry',
    label: 'Double Bond (=)',
    defaultText: 'C=C',
    shape: 'bond_double',
    w: 96,
    h: 52,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2.2,
    tags: ['chemistry', 'organic'],
    summary: 'Double covalent bond',
  },
  {
    id: 'chem_ion',
    category: 'chemistry',
    label: 'Ion / Reactant',
    defaultText: 'Na⁺ / Cl⁻',
    shape: 'circle',
    w: 84,
    h: 56,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#4338ca',
    borderWidth: 2,
    tags: ['chemistry', 'ion'],
    summary: 'Ionic species or reagent badge',
  },
  {
    id: 'chem_burette',
    category: 'chemistry',
    label: 'Titration Burette',
    defaultText: '50 mL Burette',
    shape: 'burette',
    w: 78,
    h: 146,
    color: '#bae6fd',
    filled: true,
    borderColor: '#0284c7',
    borderWidth: 2,
    tags: ['chemistry', 'lab', 'titration', 'burette'],
    summary: 'Stopcock titration burette',
  },
  {
    id: 'chem_funnel',
    category: 'chemistry',
    label: 'Filter Funnel',
    defaultText: 'Filtration',
    shape: 'funnel_filter',
    w: 108,
    h: 120,
    color: '#e0f2fe',
    filled: true,
    borderColor: '#0369a1',
    borderWidth: 2,
    tags: ['chemistry', 'lab', 'filtration'],
    summary: 'Conical funnel for separation',
  },
  {
    id: 'chem_grad_cyl',
    category: 'chemistry',
    label: 'Graduated Cylinder',
    defaultText: '250 mL Vol.',
    shape: 'graduated_cylinder',
    w: 84,
    h: 136,
    color: '#a7f3d0',
    filled: true,
    borderColor: '#047857',
    borderWidth: 2,
    tags: ['chemistry', 'lab', 'volume'],
    summary: 'Volumetric measuring cylinder',
  },
  {
    id: 'chem_condenser',
    category: 'chemistry',
    label: 'Liebig Condenser',
    defaultText: 'Cooling Jacket',
    shape: 'condenser_tube',
    w: 158,
    h: 78,
    color: '#cffafe',
    filled: true,
    borderColor: '#0891b2',
    borderWidth: 2,
    tags: ['chemistry', 'lab', 'distillation'],
    summary: 'Water-jacketed distillation condenser',
  },
  {
    id: 'chem_chair',
    category: 'chemistry',
    label: 'Cyclohexane Chair',
    defaultText: 'C₆H₁₂ (Chair)',
    shape: 'cyclohexane_chair',
    w: 138,
    h: 92,
    color: '#f8fafc',
    filled: true,
    borderColor: '#0f172a',
    borderWidth: 2.2,
    tags: ['chemistry', 'organic', 'stereochemistry'],
    summary: '3D chair conformation ring',
  },
  {
    id: 'chem_triple_bond',
    category: 'chemistry',
    label: 'Triple Bond (≡)',
    defaultText: 'N≡N / C≡C',
    shape: 'bond_triple',
    w: 98,
    h: 52,
    color: '#ffffff',
    filled: false,
    borderColor: '#0f172a',
    borderWidth: 2.2,
    tags: ['chemistry', 'organic', 'alkyne', 'bond'],
    summary: 'Triple covalent bond',
  },
  {
    id: 'chem_tetrahedral',
    category: 'chemistry',
    label: 'Tetrahedral (CH₄)',
    defaultText: 'CH₄ (109.5°)',
    shape: 'tetrahedral_mol',
    w: 134,
    h: 120,
    color: '#e0e7ff',
    filled: true,
    borderColor: '#4338ca',
    borderWidth: 2,
    tags: ['chemistry', 'vsepr', 'molecule', 'sp3'],
    summary: 'Tetrahedral sp³ molecular geometry',
  },
  {
    id: 'chem_energy_profile',
    category: 'chemistry',
    label: 'Activation Energy',
    defaultText: 'Ea & ΔH Curve',
    shape: 'energy_profile',
    w: 184,
    h: 136,
    color: '#f8fafc',
    filled: true,
    borderColor: '#ea580c',
    borderWidth: 2.2,
    tags: ['chemistry', 'kinetics', 'enthalpy', 'thermodynamics'],
    summary: 'Reaction coordinate & activation barrier',
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

  // --- ADDITIONAL PHYSICS KITS ---
  {
    id: 'kit_pendulum_energy',
    category: 'physics',
    title: 'Pendulum & Energy Conservation',
    summary: 'Simple pendulum oscillation showing PE_max at turning points and KE_max at equilibrium.',
    build: (cx, cy, makeId) => {
      const nPend = makeNode(makeId('n'), cx, cy - 10, 148, 170, 'T = 2π√(L/g)', 'pendulum', {
        color: '#fde68a',
        borderColor: '#b45309',
        borderWidth: 2.2,
      });
      const nPe = makeNode(makeId('n'), cx - 185, cy - 30, 130, 56, 'PE = mgh (Max)', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nKe = makeNode(makeId('n'), cx + 185, cy + 45, 134, 56, 'KE = ½mv² (Max)', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nPend, nPe, nKe],
        edges: [
          makeEdge(makeId('e'), nPe.id, nPend.id, 'v = 0', { lineStyle: 'dashed', color: '#2563eb' }),
          makeEdge(makeId('e'), nPend.id, nKe.id, 'θ = 0°', { type: 'curved', color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_prism_dispersion',
    category: 'physics',
    title: 'Optical Prism Dispersion',
    summary: 'Incident white light refracted through glass prism into dispersed visible spectrum.',
    build: (cx, cy, makeId) => {
      const nLight = makeNode(makeId('n'), cx - 205, cy - 10, 118, 48, 'White Light', 'rounded', {
        color: '#f8fafc',
        borderColor: '#475569',
      });
      const nPrism = makeNode(makeId('n'), cx, cy, 136, 126, 'Glass (n)', 'prism', {
        color: '#e0f2fe',
        borderColor: '#0284c7',
        borderWidth: 2.2,
      });
      const nRed = makeNode(makeId('n'), cx + 210, cy - 55, 116, 44, 'Red (700nm)', 'rounded', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      const nViolet = makeNode(makeId('n'), cx + 210, cy + 55, 116, 44, 'Violet (400nm)', 'rounded', {
        color: '#ede9fe',
        borderColor: '#7c3aed',
      });
      return {
        nodes: [nLight, nPrism, nRed, nViolet],
        edges: [
          makeEdge(makeId('e'), nLight.id, nPrism.id, 'θ₁', { color: '#334155' }),
          makeEdge(makeId('e'), nPrism.id, nRed.id, 'Least bent', { color: '#dc2626' }),
          makeEdge(makeId('e'), nPrism.id, nViolet.id, 'Most bent', { color: '#7c3aed' }),
        ],
        stickies: [],
      };
    },
  },

  // --- ADDITIONAL MATHS KITS ---
  {
    id: 'kit_right_triangle_trig',
    category: 'maths',
    title: 'Right Triangle Trigonometry',
    summary: 'Pythagorean identity with SOH-CAH-TOA side relationships.',
    build: (cx, cy, makeId) => {
      const nTri = makeNode(makeId('n'), cx, cy - 10, 180, 135, 'c² = a² + b²', 'right_triangle', {
        color: '#fef3c7',
        borderColor: '#b45309',
        borderWidth: 2.2,
      });
      const nTrig = makeNode(
        makeId('n'),
        cx,
        cy + 102,
        245,
        42,
        'sin θ = a/c  ·  cos θ = b/c  ·  tan θ = a/b',
        'rounded',
        { color: '#f8fafc', borderColor: '#475569', fs: 11 }
      );
      return {
        nodes: [nTri, nTrig],
        edges: [],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_quadratic_parabola',
    category: 'maths',
    title: 'Quadratic Function Analysis',
    summary: 'Parabola curve y = ax² + bx + c linked to vertex and discriminant formula.',
    build: (cx, cy, makeId) => {
      const nPara = makeNode(makeId('n'), cx - 80, cy, 200, 160, 'y = ax² + bx + c', 'parabola', {
        color: '#f8fafc',
        borderColor: '#2563eb',
        borderWidth: 2.2,
      });
      const nRoots = makeNode(
        makeId('n'),
        cx + 165,
        cy - 40,
        168,
        54,
        'x = (-b ± √Δ) / 2a',
        'rounded',
        { color: '#dbeafe', borderColor: '#1d4ed8' }
      );
      const nVertex = makeNode(
        makeId('n'),
        cx + 165,
        cy + 45,
        168,
        52,
        'Vertex: h = -b / 2a',
        'rounded',
        { color: '#dcfce7', borderColor: '#16a34a' }
      );
      return {
        nodes: [nPara, nRoots, nVertex],
        edges: [
          makeEdge(makeId('e'), nPara.id, nRoots.id, 'Δ = b²-4ac', { color: '#1d4ed8' }),
          makeEdge(makeId('e'), nPara.id, nVertex.id, 'Min/Max', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },

  // --- BIOLOGY DIAGRAMS ---
  {
    id: 'kit_animal_cell_organelles',
    category: 'biology',
    title: 'Eukaryotic Animal Cell & Organelles',
    summary: 'Central animal cell linked to Mitochondrion (ATP), Nucleus/DNA, and Immune defense.',
    build: (cx, cy, makeId) => {
      const nCell = makeNode(makeId('n'), cx, cy, 200, 150, 'Animal Cell', 'cell_animal', {
        color: '#fce7f3',
        borderColor: '#db2777',
        borderWidth: 2.2,
      });
      const nMito = makeNode(makeId('n'), cx - 215, cy - 65, 148, 86, 'Mitochondria (ATP)', 'mitochondria', {
        color: '#fed7aa',
        borderColor: '#c2410c',
      });
      const nDna = makeNode(makeId('n'), cx + 215, cy - 65, 152, 84, 'Nuclear DNA', 'dna_helix', {
        color: '#ffffff',
        filled: false,
        borderColor: '#2563eb',
      });
      const nAtp = makeNode(makeId('n'), cx + 215, cy + 75, 140, 52, 'Cellular Respiration', 'rounded', {
        color: '#fef3c7',
        borderColor: '#d97706',
      });
      return {
        nodes: [nCell, nMito, nDna, nAtp],
        edges: [
          makeEdge(makeId('e'), nMito.id, nCell.id, 'ATP Energy', { color: '#c2410c' }),
          makeEdge(makeId('e'), nCell.id, nDna.id, 'Nucleus', { color: '#2563eb' }),
          makeEdge(makeId('e'), nCell.id, nAtp.id, 'O₂ + Glucose', { type: 'curved', color: '#d97706' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_plant_photosynthesis',
    category: 'biology',
    title: 'Plant Cell & Photosynthesis',
    summary: 'Plant leaf organ, chloroplast thylakoids, and Calvin cycle glucose synthesis.',
    build: (cx, cy, makeId) => {
      const nLeaf = makeNode(makeId('n'), cx - 205, cy, 146, 94, 'Leaf Mesophyll', 'leaf_organ', {
        color: '#bbf7d0',
        borderColor: '#15803d',
      });
      const nPlant = makeNode(makeId('n'), cx, cy - 55, 174, 134, 'Plant Cell', 'cell_plant', {
        color: '#dcfce7',
        borderColor: '#166534',
      });
      const nChloro = makeNode(makeId('n'), cx, cy + 100, 154, 88, 'Chloroplast', 'chloroplast', {
        color: '#86efac',
        borderColor: '#15803d',
      });
      const nSugar = makeNode(makeId('n'), cx + 215, cy + 20, 146, 58, 'C₆H₁₂O₆ + O₂', 'rounded', {
        color: '#fef3c7',
        borderColor: '#ca8a04',
      });
      return {
        nodes: [nLeaf, nPlant, nChloro, nSugar],
        edges: [
          makeEdge(makeId('e'), nLeaf.id, nPlant.id, 'Sunlight + CO₂', { color: '#15803d' }),
          makeEdge(makeId('e'), nPlant.id, nChloro.id, 'Thylakoid', { color: '#166534' }),
          makeEdge(makeId('e'), nChloro.id, nSugar.id, 'Calvin Cycle', { type: 'curved', color: '#ca8a04' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_central_dogma_dna',
    category: 'biology',
    title: 'Central Dogma (DNA → RNA → Protein)',
    summary: 'Genetic information flow from DNA transcription to mRNA translation and Enzyme folding.',
    build: (cx, cy, makeId) => {
      const nDna = makeNode(makeId('n'), cx - 210, cy, 152, 86, 'DNA', 'dna_helix', {
        color: '#ffffff',
        filled: false,
        borderColor: '#2563eb',
      });
      const nRna = makeNode(makeId('n'), cx, cy, 134, 56, 'mRNA Transcript', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nProt = makeNode(makeId('n'), cx + 205, cy, 134, 66, 'Folded Protein', 'hexagon', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nDna, nRna, nProt],
        edges: [
          makeEdge(makeId('e'), nDna.id, nDna.id, 'Replication', {
            type: 'curved',
            curvature: -65,
            color: '#6366f1',
          }),
          makeEdge(makeId('e'), nDna.id, nRna.id, 'Transcription', { color: '#2563eb' }),
          makeEdge(makeId('e'), nRna.id, nProt.id, 'Translation', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_neuron_synapse',
    category: 'biology',
    title: 'Neural Signal & Synapse',
    summary: 'Action potential propagation across a myelinated neuron to neurotransmitter release.',
    build: (cx, cy, makeId) => {
      const nStim = makeNode(makeId('n'), cx - 220, cy, 118, 52, 'Stimulus (-55mV)', 'rounded', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      const nNeuron = makeNode(makeId('n'), cx - 10, cy, 200, 102, 'Action Potential', 'neuron', {
        color: '#fef08a',
        borderColor: '#a16207',
      });
      const nSynapse = makeNode(makeId('n'), cx + 220, cy, 136, 56, 'Target Effector', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nStim, nNeuron, nSynapse],
        edges: [
          makeEdge(makeId('e'), nStim.id, nNeuron.id, 'Dendrites', { color: '#dc2626' }),
          makeEdge(makeId('e'), nNeuron.id, nSynapse.id, 'Synapse', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_punnett_inheritance',
    category: 'biology',
    title: 'Mendelian Genetics (Punnett Cross)',
    summary: 'Monohybrid heterozygous cross Aa × Aa showing 3:1 dominant-to-recessive ratio.',
    build: (cx, cy, makeId) => {
      const nGrid = makeNode(makeId('n'), cx, cy - 10, 164, 152, 'Cross: Aa × Aa', 'punnett_grid', {
        color: '#f8fafc',
        borderColor: '#0f172a',
      });
      const nP1 = makeNode(makeId('n'), cx - 175, cy - 40, 118, 46, 'Parent 1 (Aa)', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nP2 = makeNode(makeId('n'), cx + 175, cy - 40, 118, 46, 'Parent 2 (Aa)', 'rounded', {
        color: '#fce7f3',
        borderColor: '#db2777',
      });
      const nRatio = makeNode(
        makeId('n'),
        cx,
        cy + 104,
        210,
        40,
        'Genotypes: 1 AA : 2 Aa : 1 aa',
        'rounded',
        { color: '#dcfce7', borderColor: '#16a34a', fs: 11 }
      );
      return {
        nodes: [nGrid, nP1, nP2, nRatio],
        edges: [
          makeEdge(makeId('e'), nP1.id, nGrid.id, 'A / a', { color: '#2563eb' }),
          makeEdge(makeId('e'), nP2.id, nGrid.id, 'A / a', { color: '#db2777' }),
        ],
        stickies: [],
      };
    },
  },

  // --- CHEMISTRY DIAGRAMS ---
  {
    id: 'kit_titration_setup',
    category: 'chemistry',
    title: 'Acid-Base Titration Workflow',
    summary: 'Titrant beaker added to Erlenmeyer flask with indicator endpoint & neutralization.',
    build: (cx, cy, makeId) => {
      const nBeaker = makeNode(makeId('n'), cx - 190, cy - 20, 114, 126, '0.1M NaOH', 'beaker', {
        color: '#bae6fd',
        borderColor: '#0284c7',
      });
      const nFlask = makeNode(makeId('n'), cx, cy, 128, 136, 'HCl + Phenol.', 'erlenmeyer_flask', {
        color: '#fbcfe8',
        borderColor: '#be185d',
      });
      const nEq = makeNode(makeId('n'), cx + 205, cy, 160, 56, 'NaCl + H₂O (pH 7)', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nBeaker, nFlask, nEq],
        edges: [
          makeEdge(makeId('e'), nBeaker.id, nFlask.id, 'Titrate', { color: '#0284c7' }),
          makeEdge(makeId('e'), nFlask.id, nEq.id, 'Endpoint', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_reversible_equilibrium',
    category: 'chemistry',
    title: 'Chemical Equilibrium (Le Chatelier)',
    summary: 'Reversible reaction A + B ⇌ C + D with equilibrium constant Keq and ΔH.',
    build: (cx, cy, makeId) => {
      const nReact = makeNode(makeId('n'), cx - 190, cy, 130, 56, 'N₂ + 3H₂', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nArrow = makeNode(makeId('n'), cx, cy, 140, 62, 'Fe Catalyst · ΔH<0', 'reaction_arrow', {
        color: '#ffffff',
        filled: false,
        borderColor: '#0f172a',
      });
      const nProd = makeNode(makeId('n'), cx + 190, cy, 130, 56, '2NH₃', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nReact, nArrow, nProd],
        edges: [
          makeEdge(makeId('e'), nReact.id, nArrow.id, '', { arrow: 'none', color: '#334155' }),
          makeEdge(makeId('e'), nArrow.id, nProd.id, '', { arrow: 'none', color: '#334155' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_distillation_heating',
    category: 'chemistry',
    title: 'Thermal Reflux & Distillation',
    summary: 'Bunsen burner heating round-bottom boiling flask into condensed distillate beaker.',
    build: (cx, cy, makeId) => {
      const nBurner = makeNode(makeId('n'), cx - 135, cy + 95, 96, 118, 'Heat (Δ)', 'bunsen_burner', {
        color: '#fed7aa',
        borderColor: '#c2410c',
      });
      const nFlask = makeNode(makeId('n'), cx - 135, cy - 55, 118, 132, 'Mixture (bp 78°C)', 'round_flask', {
        color: '#fef08a',
        borderColor: '#b45309',
      });
      const nCond = makeNode(makeId('n'), cx + 55, cy - 55, 132, 48, 'Condenser (H₂O)', 'cylinder', {
        color: '#e0f2fe',
        borderColor: '#0284c7',
      });
      const nRec = makeNode(makeId('n'), cx + 220, cy + 45, 112, 124, 'Distillate', 'beaker', {
        color: '#bae6fd',
        borderColor: '#0369a1',
      });
      return {
        nodes: [nBurner, nFlask, nCond, nRec],
        edges: [
          makeEdge(makeId('e'), nBurner.id, nFlask.id, 'Thermal', { lineStyle: 'dashed', color: '#ea580c' }),
          makeEdge(makeId('e'), nFlask.id, nCond.id, 'Vapor', { color: '#0284c7' }),
          makeEdge(makeId('e'), nCond.id, nRec.id, 'Condense', { type: 'curved', color: '#0369a1' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_benzene_substitution',
    category: 'chemistry',
    title: 'Aromatic Benzene & Atom Bonding',
    summary: 'Carbon Bohr atom and molecular geometry alongside aromatic benzene substitution.',
    build: (cx, cy, makeId) => {
      const nAtom = makeNode(makeId('n'), cx - 195, cy, 124, 124, 'Carbon (6e⁻)', 'atom_bohr', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nBenz = makeNode(makeId('n'), cx, cy, 122, 122, 'Benzene C₆H₆', 'benzene_ring', {
        color: '#f8fafc',
        borderColor: '#0f172a',
      });
      const nMol = makeNode(makeId('n'), cx + 195, cy, 134, 110, 'H₂O / Polar', 'molecule_h2o', {
        color: '#bae6fd',
        borderColor: '#0369a1',
      });
      return {
        nodes: [nAtom, nBenz, nMol],
        edges: [
          makeEdge(makeId('e'), nAtom.id, nBenz.id, 'sp² Hybrid', { color: '#1d4ed8' }),
          makeEdge(makeId('e'), nBenz.id, nMol.id, 'Hydrophobic', { lineStyle: 'dashed', color: '#64748b' }),
        ],
        stickies: [],
      };
    },
  },

  // --- EXTENDED PHYSICS KITS ---
  {
    id: 'kit_torque_lever',
    category: 'physics',
    title: 'Torque & Lever Equilibrium',
    summary: 'Balanced lever & fulcrum demonstrating rotational equilibrium F₁·d₁ = F₂·d₂.',
    build: (cx, cy, makeId) => {
      const nLever = makeNode(makeId('n'), cx, cy, 220, 96, 'τ_net = 0', 'lever_fulcrum', {
        color: '#fde68a',
        borderColor: '#b45309',
      });
      const nF1 = makeNode(makeId('n'), cx - 150, cy - 68, 108, 44, 'F₁ = 20 N', 'rounded', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nF2 = makeNode(makeId('n'), cx + 150, cy + 68, 108, 44, 'F₂ = 40 N', 'rounded', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      return {
        nodes: [nLever, nF1, nF2],
        edges: [
          makeEdge(makeId('e'), nF1.id, nLever.id, 'd₁ = 2.0 m', { color: '#1d4ed8' }),
          makeEdge(makeId('e'), nLever.id, nF2.id, 'd₂ = 1.0 m', { color: '#dc2626' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_electromagnetism_solenoid',
    category: 'physics',
    title: 'Solenoid Electromagnet & B-Field',
    summary: 'Current-carrying solenoid coil driven by DC battery generating magnetic flux B.',
    build: (cx, cy, makeId) => {
      const nBat = makeNode(makeId('n'), cx - 205, cy, 102, 62, '12V DC', 'battery', {
        filled: false,
        borderColor: '#dc2626',
      });
      const nSol = makeNode(makeId('n'), cx, cy, 162, 78, 'B = μ₀nI', 'solenoid', {
        color: '#e0e7ff',
        borderColor: '#3730a3',
      });
      const nField = makeNode(makeId('n'), cx + 205, cy, 152, 92, 'Magnetic Flux Φ', 'field_lines', {
        filled: false,
        borderColor: '#2563eb',
      });
      return {
        nodes: [nBat, nSol, nField],
        edges: [
          makeEdge(makeId('e'), nBat.id, nSol.id, 'Current I', { color: '#dc2626' }),
          makeEdge(makeId('e'), nSol.id, nField.id, 'Induces B⃗', { lineStyle: 'dashed', color: '#2563eb' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_carnot_thermo',
    category: 'physics',
    title: 'Thermodynamics Piston & Heat Engine',
    summary: 'Thermal reservoir heating an ideal gas piston cylinder with First Law ΔU = Q - W.',
    build: (cx, cy, makeId) => {
      const nTherm = makeNode(makeId('n'), cx - 190, cy, 86, 134, 'T_H = 600 K', 'thermometer', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      const nPiston = makeNode(makeId('n'), cx, cy, 174, 96, 'PV = nRT (Gas)', 'piston_cylinder', {
        color: '#bae6fd',
        borderColor: '#0369a1',
      });
      const nWork = makeNode(makeId('n'), cx + 200, cy, 128, 52, 'W = ∫ P dV', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nTherm, nPiston, nWork],
        edges: [
          makeEdge(makeId('e'), nTherm.id, nPiston.id, 'Heat Q_in', { color: '#dc2626' }),
          makeEdge(makeId('e'), nPiston.id, nWork.id, 'Expansion', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_projectile_motion',
    category: 'physics',
    title: 'Projectile Motion & Range',
    summary: 'Parabolic launch trajectory separating horizontal vₓ and vertical acceleration g.',
    build: (cx, cy, makeId) => {
      const nProj = makeNode(makeId('n'), cx, cy - 10, 230, 120, 'y(t) = v₀ᵧt - ½gt²', 'projectile_arc', {
        filled: false,
        borderColor: '#0f172a',
      });
      const nVx = makeNode(makeId('n'), cx - 155, cy + 90, 130, 44, 'vₓ = v₀ cos θ', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nVy = makeNode(makeId('n'), cx + 155, cy + 90, 130, 44, 'vᵧ(peak) = 0', 'rounded', {
        color: '#fef3c7',
        borderColor: '#d97706',
      });
      return {
        nodes: [nProj, nVx, nVy],
        edges: [
          makeEdge(makeId('e'), nVx.id, nProj.id, 'Constant', { lineStyle: 'dashed', color: '#2563eb' }),
          makeEdge(makeId('e'), nProj.id, nVy.id, 'aᵧ = -g', { lineStyle: 'dashed', color: '#d97706' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_elastic_collision',
    category: 'physics',
    title: 'Momentum & Cart Collision',
    summary: 'Two dynamics carts colliding elastically with conserved total momentum Σp.',
    build: (cx, cy, makeId) => {
      const nC1 = makeNode(makeId('n'), cx - 165, cy, 130, 76, 'Cart m₁ (v₁)', 'cart_wheels', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nC2 = makeNode(makeId('n'), cx + 165, cy, 130, 76, 'Cart m₂ (v₂)', 'cart_wheels', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      const nLaw = makeNode(makeId('n'), cx, cy + 100, 236, 42, 'm₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′', 'rounded', {
        color: '#f8fafc',
        borderColor: '#475569',
        fs: 11,
      });
      return {
        nodes: [nC1, nC2, nLaw],
        edges: [
          makeEdge(makeId('e'), nC1.id, nC2.id, 'Impulse J = Δp', { arrow: 'both', color: '#0f172a' }),
        ],
        stickies: [],
      };
    },
  },

  // --- EXTENDED SCHEMATICS KITS ---
  {
    id: 'kit_opamp_inverting',
    category: 'schematics',
    title: 'Inverting Op-Amp Amplifier',
    summary: 'Operational amplifier stage with input resistor R_in and negative feedback R_f.',
    build: (cx, cy, makeId) => {
      const nVin = makeNode(makeId('n'), cx - 225, cy - 20, 76, 44, 'V_in', 'circle', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nRin = makeNode(makeId('n'), cx - 95, cy - 20, 108, 52, 'R_in', 'resistor', {
        filled: false,
        borderColor: '#0f172a',
      });
      const nOp = makeNode(makeId('n'), cx + 60, cy, 130, 92, 'U1', 'opamp', {
        color: '#e0f2fe',
        borderColor: '#0369a1',
      });
      const nRf = makeNode(makeId('n'), cx + 60, cy - 105, 108, 52, 'R_f', 'resistor', {
        filled: false,
        borderColor: '#7c3aed',
      });
      const nVout = makeNode(makeId('n'), cx + 225, cy, 96, 46, 'V_out', 'circle', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nVin, nRin, nOp, nRf, nVout],
        edges: [
          makeEdge(makeId('e'), nVin.id, nRin.id, '', { arrow: 'forward' }),
          makeEdge(makeId('e'), nRin.id, nOp.id, '(-)', { arrow: 'forward' }),
          makeEdge(makeId('e'), nOp.id, nVout.id, '-(Rf/Rin)Vin', { color: '#16a34a' }),
          makeEdge(makeId('e'), nVout.id, nRf.id, 'Feedback', { type: 'orthogonal', color: '#7c3aed' }),
          makeEdge(makeId('e'), nRf.id, nRin.id, '', { type: 'orthogonal', color: '#7c3aed' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_ac_transformer',
    category: 'schematics',
    title: 'AC Transformer & Diode Rectifier',
    summary: 'Step-down AC transformer feeding rectifier diode, smoothing capacitor, and load.',
    build: (cx, cy, makeId) => {
      const nFuse = makeNode(makeId('n'), cx - 210, cy, 100, 50, 'Fuse 2A', 'fuse_sym', {
        filled: false,
        borderColor: '#b91c1c',
      });
      const nTrans = makeNode(makeId('n'), cx - 60, cy, 132, 84, '10:1 Step-Down', 'transformer', {
        filled: false,
        borderColor: '#0f172a',
      });
      const nDiode = makeNode(makeId('n'), cx + 100, cy - 45, 96, 52, 'Rectifier', 'diode', {
        color: '#fef08a',
        borderColor: '#0f172a',
      });
      const nCap = makeNode(makeId('n'), cx + 220, cy + 30, 96, 58, 'Filter C', 'capacitor', {
        filled: false,
        borderColor: '#0f172a',
      });
      return {
        nodes: [nFuse, nTrans, nDiode, nCap],
        edges: [
          makeEdge(makeId('e'), nFuse.id, nTrans.id, 'AC In', { color: '#dc2626' }),
          makeEdge(makeId('e'), nTrans.id, nDiode.id, '12V AC', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nDiode.id, nCap.id, 'DC Out', { type: 'orthogonal', color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_half_adder',
    category: 'schematics',
    title: 'Digital Half-Adder (XOR + AND)',
    summary: 'Binary addition circuit computing Sum = A ⊕ B and Carry = A · B.',
    build: (cx, cy, makeId) => {
      const nA = makeNode(makeId('n'), cx - 195, cy - 55, 64, 40, 'Bit A', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nB = makeNode(makeId('n'), cx - 195, cy + 55, 64, 40, 'Bit B', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nXor = makeNode(makeId('n'), cx, cy - 55, 122, 66, 'XOR', 'xor_gate', {
        color: '#f3e8ff',
        borderColor: '#6b21a8',
      });
      const nAnd = makeNode(makeId('n'), cx, cy + 55, 120, 66, 'AND', 'and_gate', {
        color: '#e0e7ff',
        borderColor: '#3730a3',
      });
      const nSum = makeNode(makeId('n'), cx + 195, cy - 55, 92, 42, 'Sum (S)', 'circle', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      const nCarry = makeNode(makeId('n'), cx + 195, cy + 55, 92, 42, 'Carry (C)', 'circle', {
        color: '#fef3c7',
        borderColor: '#d97706',
      });
      return {
        nodes: [nA, nB, nXor, nAnd, nSum, nCarry],
        edges: [
          makeEdge(makeId('e'), nA.id, nXor.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nB.id, nXor.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nA.id, nAnd.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nB.id, nAnd.id, '', { type: 'orthogonal' }),
          makeEdge(makeId('e'), nXor.id, nSum.id, 'A ⊕ B', { color: '#6b21a8' }),
          makeEdge(makeId('e'), nAnd.id, nCarry.id, 'A · B', { color: '#3730a3' }),
        ],
        stickies: [],
      };
    },
  },

  // --- EXTENDED MATHS KITS ---
  {
    id: 'kit_unit_circle_trig',
    category: 'maths',
    title: 'Unit Circle & Sinusoidal Wave',
    summary: 'Angle θ rotation on the unit circle mapped directly onto y = sin(θ) waveform.',
    build: (cx, cy, makeId) => {
      const nUnit = makeNode(makeId('n'), cx - 150, cy, 160, 160, '(cos θ, sin θ)', 'unit_circle', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nSine = makeNode(makeId('n'), cx + 135, cy, 210, 140, 'y = sin(θ)', 'sine_graph', {
        color: '#f8fafc',
        borderColor: '#7c3aed',
      });
      return {
        nodes: [nUnit, nSine],
        edges: [
          makeEdge(makeId('e'), nUnit.id, nSine.id, 'y = sin θ', {
            lineStyle: 'dashed',
            color: '#7c3aed',
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_conic_ellipse',
    category: 'maths',
    title: 'Conic Ellipse & Focal Geometry',
    summary: 'Standard ellipse equation with semi-axes a, b and focal distance c² = a² - b².',
    build: (cx, cy, makeId) => {
      const nEll = makeNode(makeId('n'), cx, cy - 12, 210, 130, 'x²/a² + y²/b² = 1', 'ellipse_conic', {
        color: '#fef3c7',
        borderColor: '#b45309',
      });
      const nProps = makeNode(
        makeId('n'),
        cx,
        cy + 100,
        250,
        40,
        'Foci (±c, 0) · c² = a² - b² · e = c/a',
        'rounded',
        { color: '#f8fafc', borderColor: '#64748b', fs: 11 }
      );
      return {
        nodes: [nEll, nProps],
        edges: [],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_linear_regression',
    category: 'maths',
    title: 'Scatter Regression & Distribution',
    summary: 'Paired scatter linear regression fit with histogram and box-plot summary.',
    build: (cx, cy, makeId) => {
      const nScat = makeNode(makeId('n'), cx - 135, cy - 10, 190, 142, 'ŷ = mx + b', 'scatter_plot', {
        color: '#f8fafc',
        borderColor: '#059669',
      });
      const nBar = makeNode(makeId('n'), cx + 135, cy - 45, 178, 128, 'Residuals', 'bar_chart', {
        color: '#f8fafc',
        borderColor: '#2563eb',
      });
      const nBox = makeNode(makeId('n'), cx + 135, cy + 88, 178, 72, 'Spread (IQR)', 'box_plot', {
        color: '#e0e7ff',
        borderColor: '#4338ca',
      });
      return {
        nodes: [nScat, nBar, nBox],
        edges: [
          makeEdge(makeId('e'), nScat.id, nBar.id, 'R² Check', { color: '#2563eb' }),
          makeEdge(makeId('e'), nBar.id, nBox.id, 'Quartiles', { color: '#4338ca' }),
        ],
        stickies: [],
      };
    },
  },

  // --- EXTENDED BIOLOGY KITS ---
  {
    id: 'kit_cell_membrane_transport',
    category: 'biology',
    title: 'Membrane Transport & Golgi Secretion',
    summary: 'Golgi vesicle packaging proteins for exocytosis across the phospholipid bilayer.',
    build: (cx, cy, makeId) => {
      const nGolgi = makeNode(makeId('n'), cx - 190, cy, 154, 96, 'Golgi Apparatus', 'golgi_body', {
        color: '#fed7aa',
        borderColor: '#c2410c',
      });
      const nMem = makeNode(makeId('n'), cx + 15, cy, 172, 92, 'Lipid Bilayer', 'lipid_bilayer', {
        color: '#fef08a',
        borderColor: '#a16207',
      });
      const nExo = makeNode(makeId('n'), cx + 220, cy, 126, 54, 'Exocytosis', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nGolgi, nMem, nExo],
        edges: [
          makeEdge(makeId('e'), nGolgi.id, nMem.id, 'Vesicle', { color: '#c2410c' }),
          makeEdge(makeId('e'), nMem.id, nExo.id, 'Secretion', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_mitosis_chromosome',
    category: 'biology',
    title: 'Chromosome & Mitotic Division',
    summary: 'DNA replication into X sister chromatids, separation, and two diploid daughter cells.',
    build: (cx, cy, makeId) => {
      const nDna = makeNode(makeId('n'), cx - 205, cy, 146, 82, 'S-Phase DNA', 'dna_helix', {
        filled: false,
        borderColor: '#2563eb',
      });
      const nChr = makeNode(makeId('n'), cx - 10, cy, 114, 120, '2n Chromosomes', 'chromosome', {
        color: '#e9d5ff',
        borderColor: '#7e22ce',
      });
      const nD1 = makeNode(makeId('n'), cx + 195, cy - 60, 128, 86, 'Daughter Cell (2n)', 'cell_animal', {
        color: '#fce7f3',
        borderColor: '#db2777',
      });
      const nD2 = makeNode(makeId('n'), cx + 195, cy + 60, 128, 86, 'Daughter Cell (2n)', 'cell_animal', {
        color: '#fce7f3',
        borderColor: '#db2777',
      });
      return {
        nodes: [nDna, nChr, nD1, nD2],
        edges: [
          makeEdge(makeId('e'), nDna.id, nChr.id, 'Condense', { color: '#7e22ce' }),
          makeEdge(makeId('e'), nChr.id, nD1.id, 'Cytokinesis', { color: '#db2777' }),
          makeEdge(makeId('e'), nChr.id, nD2.id, 'Cytokinesis', { color: '#db2777' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_cardiac_circulation',
    category: 'biology',
    title: '4-Chamber Heart Circulation Loop',
    summary: 'Double circulatory loop connecting lungs (pulmonary) and body tissues (systemic).',
    build: (cx, cy, makeId) => {
      const nHeart = makeNode(makeId('n'), cx, cy, 148, 128, 'RA | LA / RV | LV', 'heart_chamber', {
        color: '#fee2e2',
        borderColor: '#dc2626',
      });
      const nLungs = makeNode(makeId('n'), cx, cy - 135, 146, 52, 'Lungs (O₂ Exchange)', 'cloud', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nBody = makeNode(makeId('n'), cx, cy + 135, 152, 50, 'Systemic Tissues', 'rounded', {
        color: '#fce7f3',
        borderColor: '#be185d',
      });
      return {
        nodes: [nHeart, nLungs, nBody],
        edges: [
          makeEdge(makeId('e'), nHeart.id, nLungs.id, 'Pulmonary (Deox)', {
            type: 'curved',
            curvature: -48,
            color: '#2563eb',
          }),
          makeEdge(makeId('e'), nLungs.id, nHeart.id, 'Oxygenated', {
            type: 'curved',
            curvature: -48,
            color: '#dc2626',
          }),
          makeEdge(makeId('e'), nHeart.id, nBody.id, 'Aorta (O₂)', {
            type: 'curved',
            curvature: -48,
            color: '#dc2626',
          }),
          makeEdge(makeId('e'), nBody.id, nHeart.id, 'Vena Cava', {
            type: 'curved',
            curvature: -48,
            color: '#2563eb',
          }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_enzyme_catalysis',
    category: 'biology',
    title: 'Enzyme Catalysis & Ribosome Synthesis',
    summary: 'mRNA translation at the ribosome folding into an enzyme that lowers activation energy.',
    build: (cx, cy, makeId) => {
      const nRibo = makeNode(makeId('n'), cx - 205, cy, 140, 96, 'Ribosome', 'ribosome', {
        color: '#fde68a',
        borderColor: '#b45309',
      });
      const nEnz = makeNode(makeId('n'), cx - 10, cy, 128, 66, 'Active Enzyme', 'hexagon', {
        color: '#e0e7ff',
        borderColor: '#4338ca',
      });
      const nEa = makeNode(makeId('n'), cx + 205, cy, 184, 134, 'Lowers Ea', 'energy_profile', {
        color: '#f8fafc',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nRibo, nEnz, nEa],
        edges: [
          makeEdge(makeId('e'), nRibo.id, nEnz.id, 'Polypeptide', { color: '#4338ca' }),
          makeEdge(makeId('e'), nEnz.id, nEa.id, 'Catalyzes', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },

  // --- EXTENDED CHEMISTRY KITS ---
  {
    id: 'kit_activation_energy',
    category: 'chemistry',
    title: 'Exothermic Reaction Energy Profile',
    summary: 'Reactants crossing transition state peak Ea to products with negative enthalpy ΔH.',
    build: (cx, cy, makeId) => {
      const nReact = makeNode(makeId('n'), cx - 205, cy - 30, 120, 48, 'Reactants', 'rounded', {
        color: '#dbeafe',
        borderColor: '#2563eb',
      });
      const nCurve = makeNode(makeId('n'), cx, cy, 200, 146, 'Ea Peak · ΔH < 0', 'energy_profile', {
        color: '#f8fafc',
        borderColor: '#ea580c',
      });
      const nProd = makeNode(makeId('n'), cx + 205, cy + 35, 120, 48, 'Products', 'rounded', {
        color: '#dcfce7',
        borderColor: '#16a34a',
      });
      return {
        nodes: [nReact, nCurve, nProd],
        edges: [
          makeEdge(makeId('e'), nReact.id, nCurve.id, '+ Ea', { color: '#ea580c' }),
          makeEdge(makeId('e'), nCurve.id, nProd.id, 'Exothermic', { color: '#16a34a' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_electrolysis_cell',
    category: 'chemistry',
    title: 'Galvanic / Electrolytic Cell',
    summary: 'Anode oxidation and cathode reduction half-cells joined by a salt bridge and voltmeter.',
    build: (cx, cy, makeId) => {
      const nAnode = makeNode(makeId('n'), cx - 165, cy + 40, 126, 130, 'Zn Anode (-)', 'beaker', {
        color: '#dbeafe',
        borderColor: '#1d4ed8',
      });
      const nCathode = makeNode(makeId('n'), cx + 165, cy + 40, 126, 130, 'Cu Cathode (+)', 'beaker', {
        color: '#bae6fd',
        borderColor: '#0284c7',
      });
      const nVolt = makeNode(makeId('n'), cx, cy - 95, 102, 62, 'E° = +1.10V', 'meter_circle', {
        color: '#fef3c7',
        borderColor: '#b45309',
      });
      const nBridge = makeNode(makeId('n'), cx, cy + 20, 132, 40, 'KNO₃ Salt Bridge', 'rounded', {
        color: '#f1f5f9',
        borderColor: '#475569',
        fs: 11,
      });
      return {
        nodes: [nAnode, nCathode, nVolt, nBridge],
        edges: [
          makeEdge(makeId('e'), nAnode.id, nVolt.id, 'e⁻ flow', { color: '#dc2626' }),
          makeEdge(makeId('e'), nVolt.id, nCathode.id, 'e⁻ flow', { color: '#dc2626' }),
          makeEdge(makeId('e'), nAnode.id, nBridge.id, 'NO₃⁻', { arrow: 'both', lineStyle: 'dashed' }),
          makeEdge(makeId('e'), nBridge.id, nCathode.id, 'K⁺', { arrow: 'both', lineStyle: 'dashed' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_burette_titration',
    category: 'chemistry',
    title: 'Burette & Volumetric Filtration Lab',
    summary: 'Graduated cylinder measurement -> burette drop titration -> filter funnel separation.',
    build: (cx, cy, makeId) => {
      const nCyl = makeNode(makeId('n'), cx - 205, cy + 15, 88, 138, '25 mL Aliquot', 'graduated_cylinder', {
        color: '#a7f3d0',
        borderColor: '#047857',
      });
      const nBur = makeNode(makeId('n'), cx - 15, cy - 75, 82, 146, 'NaOH Burette', 'burette', {
        color: '#bae6fd',
        borderColor: '#0284c7',
      });
      const nFlask = makeNode(makeId('n'), cx - 15, cy + 85, 120, 126, 'Endpoint', 'erlenmeyer_flask', {
        color: '#fbcfe8',
        borderColor: '#be185d',
      });
      const nFunnel = makeNode(makeId('n'), cx + 195, cy + 15, 114, 122, 'Precipitate', 'funnel_filter', {
        color: '#e0f2fe',
        borderColor: '#0369a1',
      });
      return {
        nodes: [nCyl, nBur, nFlask, nFunnel],
        edges: [
          makeEdge(makeId('e'), nCyl.id, nFlask.id, 'Transfer', { color: '#047857' }),
          makeEdge(makeId('e'), nBur.id, nFlask.id, 'Drops', { color: '#0284c7' }),
          makeEdge(makeId('e'), nFlask.id, nFunnel.id, 'Filter', { type: 'curved', color: '#be185d' }),
        ],
        stickies: [],
      };
    },
  },
  {
    id: 'kit_organic_functional',
    category: 'chemistry',
    title: 'Organic Bonding & Conformations',
    summary: 'Tetrahedral sp³ methane, double/triple π-bonds, benzene aromaticity & cyclohexane chair.',
    build: (cx, cy, makeId) => {
      const nTet = makeNode(makeId('n'), cx - 195, cy - 55, 134, 120, 'sp³ (109.5°)', 'tetrahedral_mol', {
        color: '#e0e7ff',
        borderColor: '#4338ca',
      });
      const nTriple = makeNode(makeId('n'), cx, cy - 55, 108, 56, 'C≡C Alkyne', 'bond_triple', {
        filled: false,
        borderColor: '#0f172a',
      });
      const nChair = makeNode(makeId('n'), cx + 195, cy - 55, 142, 94, 'Cyclohexane', 'cyclohexane_chair', {
        color: '#f8fafc',
        borderColor: '#0f172a',
      });
      const nBenz = makeNode(makeId('n'), cx, cy + 85, 118, 118, 'Aromatic C₆H₆', 'benzene_ring', {
        color: '#fef3c7',
        borderColor: '#b45309',
      });
      return {
        nodes: [nTet, nTriple, nChair, nBenz],
        edges: [
          makeEdge(makeId('e'), nTet.id, nTriple.id, 'sp Hybrid', { color: '#4338ca' }),
          makeEdge(makeId('e'), nTriple.id, nChair.id, 'Hydrogenate', { color: '#0f172a' }),
          makeEdge(makeId('e'), nChair.id, nBenz.id, 'Aromatize', { lineStyle: 'dashed', color: '#b45309' }),
        ],
        stickies: [],
      };
    },
  },
];
