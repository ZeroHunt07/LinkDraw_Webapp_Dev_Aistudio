import emojiGroupsRaw from 'unicode-emoji-json/data-by-group.json';

export type IconCategory =
  | 'all'
  | 'icons'
  | 'smileys_emotion'
  | 'people_body'
  | 'animals_nature'
  | 'food_drink'
  | 'travel_places'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';

export interface NodeIconOption {
  value: string;
  label: string;
  category: Exclude<IconCategory, 'all'>;
  keywords: string[];
  kind: 'vector' | 'emoji';
}

interface UnicodeEmojiGroupRaw {
  name: string;
  slug: string;
  emojis: {
    emoji: string;
    name: string;
    slug: string;
  }[];
}

export const VECTOR_NODE_ICONS: NodeIconOption[] = [
  { value: 'icon:server', label: 'Server', category: 'icons', keywords: ['server', 'rack', 'host', 'backend'], kind: 'vector' },
  { value: 'icon:database', label: 'Database', category: 'icons', keywords: ['database', 'db', 'sql', 'storage'], kind: 'vector' },
  { value: 'icon:cloud', label: 'Cloud', category: 'icons', keywords: ['cloud', 'aws', 'gcp', 'saas'], kind: 'vector' },
  { value: 'icon:globe', label: 'Globe', category: 'icons', keywords: ['globe', 'web', 'internet', 'domain'], kind: 'vector' },
  { value: 'icon:shield', label: 'Shield', category: 'icons', keywords: ['shield', 'security', 'firewall', 'defense'], kind: 'vector' },
  { value: 'icon:lock', label: 'Lock', category: 'icons', keywords: ['lock', 'auth', 'private', 'encrypt'], kind: 'vector' },
  { value: 'icon:key', label: 'Key', category: 'icons', keywords: ['key', 'token', 'secret', 'ssh'], kind: 'vector' },
  { value: 'icon:cpu', label: 'CPU / Chip', category: 'icons', keywords: ['cpu', 'chip', 'compute', 'processor'], kind: 'vector' },
  { value: 'icon:code', label: 'Code', category: 'icons', keywords: ['code', 'api', 'dev', 'script'], kind: 'vector' },
  { value: 'icon:terminal', label: 'Terminal', category: 'icons', keywords: ['terminal', 'cli', 'shell', 'console'], kind: 'vector' },
  { value: 'icon:user', label: 'User', category: 'icons', keywords: ['user', 'person', 'actor', 'profile'], kind: 'vector' },
  { value: 'icon:users', label: 'Team / Users', category: 'icons', keywords: ['users', 'team', 'group', 'org'], kind: 'vector' },
  { value: 'icon:file', label: 'Document', category: 'icons', keywords: ['file', 'doc', 'page', 'note'], kind: 'vector' },
  { value: 'icon:folder', label: 'Folder', category: 'icons', keywords: ['folder', 'dir', 'bucket', 'archive'], kind: 'vector' },
  { value: 'icon:mail', label: 'Mail', category: 'icons', keywords: ['mail', 'email', 'message', 'smtp'], kind: 'vector' },
  { value: 'icon:bell', label: 'Alert Bell', category: 'icons', keywords: ['bell', 'notify', 'alarm', 'event'], kind: 'vector' },
  { value: 'icon:zap', label: 'Zap / Power', category: 'icons', keywords: ['zap', 'bolt', 'power', 'trigger', 'fast'], kind: 'vector' },
  { value: 'icon:wifi', label: 'Network / WiFi', category: 'icons', keywords: ['wifi', 'signal', 'wireless', 'radio'], kind: 'vector' },
  { value: 'icon:link', label: 'Link', category: 'icons', keywords: ['link', 'url', 'webhook', 'connect'], kind: 'vector' },
  { value: 'icon:search', label: 'Search', category: 'icons', keywords: ['search', 'inspect', 'find', 'osint'], kind: 'vector' },
  { value: 'icon:settings', label: 'Settings', category: 'icons', keywords: ['settings', 'gear', 'config', 'worker'], kind: 'vector' },
  { value: 'icon:chart', label: 'Analytics', category: 'icons', keywords: ['chart', 'metrics', 'analytics', 'stats'], kind: 'vector' },
  { value: 'icon:check', label: 'Check', category: 'icons', keywords: ['check', 'done', 'pass', 'verify'], kind: 'vector' },
  { value: 'icon:alert', label: 'Warning', category: 'icons', keywords: ['alert', 'warning', 'error', 'risk'], kind: 'vector' },
  { value: 'icon:clock', label: 'Timer / Clock', category: 'icons', keywords: ['clock', 'time', 'cron', 'schedule'], kind: 'vector' },
  { value: 'icon:layers', label: 'Layers', category: 'icons', keywords: ['layers', 'stack', 'tier', 'module'], kind: 'vector' },
  { value: 'icon:target', label: 'Target', category: 'icons', keywords: ['target', 'goal', 'scope', 'ip'], kind: 'vector' },
  { value: 'icon:star', label: 'Star', category: 'icons', keywords: ['star', 'favorite', 'highlight', 'core'], kind: 'vector' },
  { value: 'icon:rocket', label: 'Deploy / Rocket', category: 'icons', keywords: ['rocket', 'launch', 'deploy', 'release'], kind: 'vector' },
  { value: 'icon:atom', label: 'Atom / Science', category: 'icons', keywords: ['atom', 'physics', 'science', 'quantum'], kind: 'vector' },
];

const MATH_AND_STEM_SYMBOLS: NodeIconOption[] = [
  { value: '∑', label: 'Sigma / Sum', category: 'symbols', keywords: ['sum', 'sigma', 'math', 'formula'], kind: 'emoji' },
  { value: 'π', label: 'Pi', category: 'symbols', keywords: ['pi', 'circle', 'math', 'constant'], kind: 'emoji' },
  { value: '∞', label: 'Infinity', category: 'symbols', keywords: ['infinity', 'loop', 'math', 'limit'], kind: 'emoji' },
  { value: 'Δ', label: 'Delta', category: 'symbols', keywords: ['delta', 'change', 'math', 'physics'], kind: 'emoji' },
  { value: 'θ', label: 'Theta', category: 'symbols', keywords: ['theta', 'angle', 'trigonometry', 'math'], kind: 'emoji' },
  { value: 'λ', label: 'Lambda', category: 'symbols', keywords: ['lambda', 'wavelength', 'function', 'physics'], kind: 'emoji' },
  { value: 'Ω', label: 'Ohm / Omega', category: 'symbols', keywords: ['ohm', 'resistance', 'omega', 'circuit'], kind: 'emoji' },
  { value: '√', label: 'Square Root', category: 'symbols', keywords: ['root', 'sqrt', 'radical', 'math'], kind: 'emoji' },
  { value: '∫', label: 'Integral', category: 'symbols', keywords: ['integral', 'calculus', 'math'], kind: 'emoji' },
  { value: '≈', label: 'Approximately Equal', category: 'symbols', keywords: ['approx', 'equal', 'math'], kind: 'emoji' },
  { value: '≠', label: 'Not Equal', category: 'symbols', keywords: ['not equal', 'diff', 'math'], kind: 'emoji' },
];

const VALID_EMOJI_GROUPS = new Set<Exclude<IconCategory, 'all' | 'icons'>>([
  'smileys_emotion',
  'people_body',
  'animals_nature',
  'food_drink',
  'travel_places',
  'activities',
  'objects',
  'symbols',
  'flags',
]);

const UNICODE_EMOJI_OPTIONS: NodeIconOption[] = (emojiGroupsRaw as UnicodeEmojiGroupRaw[]).flatMap(
  (group) => {
    const cat: Exclude<IconCategory, 'all' | 'icons'> = VALID_EMOJI_GROUPS.has(
      group.slug as Exclude<IconCategory, 'all' | 'icons'>
    )
      ? (group.slug as Exclude<IconCategory, 'all' | 'icons'>)
      : 'symbols';
    const groupKeyword = group.name.toLowerCase();
    return group.emojis.map((item) => ({
      value: item.emoji,
      label: item.name,
      category: cat,
      keywords: [item.slug.replace(/_/g, ' '), groupKeyword],
      kind: 'emoji' as const,
    }));
  }
);

export const EMOJI_NODE_ICONS: NodeIconOption[] = [
  ...UNICODE_EMOJI_OPTIONS,
  ...MATH_AND_STEM_SYMBOLS,
];

export const ALL_NODE_ICON_OPTIONS: NodeIconOption[] = [
  ...VECTOR_NODE_ICONS,
  ...EMOJI_NODE_ICONS,
];

export function isVectorNodeIcon(icon?: string | null): boolean {
  return Boolean(icon && icon.startsWith('icon:'));
}

export function getVectorIconName(icon?: string | null): string {
  if (!icon || !icon.startsWith('icon:')) return '';
  return icon.slice('icon:'.length).trim();
}

export function getIconDisplayText(icon?: string | null): string {
  const trimmed = icon?.trim() ?? '';
  if (!trimmed) return '';
  if (!isVectorNodeIcon(trimmed)) return trimmed;
  const found = VECTOR_NODE_ICONS.find((opt) => opt.value === trimmed);
  return found ? `[${found.label}]` : '◈';
}

/**
 * Draws a crisp vector icon on a Canvas 2D context centered at (cx, cy).
 */
export function drawVectorNodeIcon(
  ctx: CanvasRenderingContext2D,
  iconToken: string,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  const name = getVectorIconName(iconToken);
  const r = size * 0.44;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.3, size * 0.105);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (name) {
    case 'server': {
      ctx.strokeRect(-r, -r * 0.85, r * 2, r * 0.72);
      ctx.strokeRect(-r, r * 0.13, r * 2, r * 0.72);
      ctx.beginPath();
      ctx.arc(-r * 0.55, -r * 0.49, r * 0.1, 0, Math.PI * 2);
      ctx.arc(-r * 0.55, r * 0.49, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'database': {
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.55);
      ctx.lineTo(-r * 0.85, r * 0.55);
      ctx.ellipse(0, r * 0.55, r * 0.85, r * 0.3, 0, Math.PI, 0, true);
      ctx.lineTo(r * 0.85, -r * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.85, r * 0.25, 0, 0, Math.PI);
      ctx.stroke();
      break;
    }
    case 'cloud': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.55);
      ctx.lineTo(r * 0.58, r * 0.55);
      ctx.arc(r * 0.55, r * 0.15, r * 0.4, Math.PI * 0.5, -Math.PI * 0.55, true);
      ctx.arc(0, -r * 0.2, r * 0.52, -Math.PI * 0.15, Math.PI * 1.08, true);
      ctx.arc(-r * 0.55, r * 0.18, r * 0.37, -Math.PI * 0.7, Math.PI * 0.5, true);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'globe': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.44, r * 0.92, 0, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.92, 0);
      ctx.lineTo(r * 0.92, 0);
      ctx.stroke();
      break;
    }
    case 'shield': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.lineTo(r * 0.82, -r * 0.58);
      ctx.quadraticCurveTo(r * 0.82, r * 0.35, 0, r * 0.95);
      ctx.quadraticCurveTo(-r * 0.82, r * 0.35, -r * 0.82, -r * 0.58);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'lock': {
      ctx.strokeRect(-r * 0.72, -r * 0.1, r * 1.44, r * 1.0);
      ctx.beginPath();
      ctx.arc(0, -r * 0.15, r * 0.46, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case 'key': {
      ctx.beginPath();
      ctx.arc(-r * 0.42, 0, r * 0.4, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.02, 0);
      ctx.lineTo(r * 0.92, 0);
      ctx.moveTo(r * 0.55, 0);
      ctx.lineTo(r * 0.55, r * 0.38);
      ctx.moveTo(r * 0.88, 0);
      ctx.lineTo(r * 0.88, r * 0.38);
      ctx.stroke();
      break;
    }
    case 'cpu': {
      ctx.strokeRect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1);
      ctx.strokeRect(-r * 0.22, -r * 0.22, r * 0.44, r * 0.44);
      ctx.beginPath();
      [-0.3, 0.3].forEach((offset) => {
        ctx.moveTo(r * offset, -r * 0.55);
        ctx.lineTo(r * offset, -r * 0.95);
        ctx.moveTo(r * offset, r * 0.55);
        ctx.lineTo(r * offset, r * 0.95);
        ctx.moveTo(-r * 0.55, r * offset);
        ctx.lineTo(-r * 0.95, r * offset);
        ctx.moveTo(r * 0.55, r * offset);
        ctx.lineTo(r * 0.95, r * offset);
      });
      ctx.stroke();
      break;
    }
    case 'code': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.38, -r * 0.45);
      ctx.lineTo(-r * 0.88, 0);
      ctx.lineTo(-r * 0.38, r * 0.45);
      ctx.moveTo(r * 0.38, -r * 0.45);
      ctx.lineTo(r * 0.88, 0);
      ctx.lineTo(r * 0.38, r * 0.45);
      ctx.moveTo(r * 0.16, -r * 0.6);
      ctx.lineTo(-r * 0.16, r * 0.6);
      ctx.stroke();
      break;
    }
    case 'terminal': {
      ctx.strokeRect(-r * 0.9, -r * 0.72, r * 1.8, r * 1.44);
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, -r * 0.25);
      ctx.lineTo(-r * 0.16, 0.05);
      ctx.lineTo(-r * 0.52, r * 0.32);
      ctx.moveTo(0, r * 0.32);
      ctx.lineTo(r * 0.5, r * 0.32);
      ctx.stroke();
      break;
    }
    case 'user': {
      ctx.beginPath();
      ctx.arc(0, -r * 0.38, r * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.88, r * 0.75, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    }
    case 'users': {
      ctx.beginPath();
      ctx.arc(-r * 0.24, -r * 0.38, r * 0.3, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.82, r * 0.78);
      ctx.arc(-r * 0.24, r * 0.82, r * 0.58, Math.PI * 1.12, Math.PI * 1.88);
      ctx.moveTo(r * 0.62, -r * 0.36);
      ctx.arc(r * 0.42, -r * 0.36, r * 0.22, 0, Math.PI * 2);
      ctx.moveTo(r * 0.48, r * 0.26);
      ctx.quadraticCurveTo(r * 0.92, r * 0.35, r * 0.92, r * 0.78);
      ctx.stroke();
      break;
    }
    case 'file': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.65, -r * 0.9);
      ctx.lineTo(r * 0.25, -r * 0.9);
      ctx.lineTo(r * 0.65, -r * 0.5);
      ctx.lineTo(r * 0.65, r * 0.9);
      ctx.lineTo(-r * 0.65, r * 0.9);
      ctx.closePath();
      ctx.moveTo(-r * 0.32, 0);
      ctx.lineTo(r * 0.32, 0);
      ctx.moveTo(-r * 0.32, r * 0.42);
      ctx.lineTo(r * 0.32, r * 0.42);
      ctx.stroke();
      break;
    }
    case 'folder': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.88, -r * 0.65);
      ctx.lineTo(-r * 0.15, -r * 0.65);
      ctx.lineTo(r * 0.05, -r * 0.35);
      ctx.lineTo(r * 0.88, -r * 0.35);
      ctx.lineTo(r * 0.88, r * 0.68);
      ctx.lineTo(-r * 0.88, r * 0.68);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'mail': {
      ctx.strokeRect(-r * 0.9, -r * 0.64, r * 1.8, r * 1.28);
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.55);
      ctx.lineTo(0, r * 0.12);
      ctx.lineTo(r * 0.9, -r * 0.55);
      ctx.stroke();
      break;
    }
    case 'bell': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, r * 0.35);
      ctx.lineTo(-r * 0.52, -r * 0.25);
      ctx.arc(0, -r * 0.25, r * 0.52, Math.PI, 0);
      ctx.lineTo(r * 0.62, r * 0.35);
      ctx.lineTo(-r * 0.78, r * 0.35);
      ctx.lineTo(r * 0.78, r * 0.35);
      ctx.moveTo(-r * 0.2, r * 0.68);
      ctx.lineTo(r * 0.2, r * 0.68);
      ctx.stroke();
      break;
    }
    case 'zap': {
      ctx.beginPath();
      ctx.moveTo(r * 0.12, -r * 0.95);
      ctx.lineTo(-r * 0.65, r * 0.08);
      ctx.lineTo(r * 0.02, r * 0.08);
      ctx.lineTo(-r * 0.14, r * 0.95);
      ctx.lineTo(r * 0.65, -r * 0.08);
      ctx.lineTo(-r * 0.02, -r * 0.08);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'wifi': {
      ctx.beginPath();
      ctx.arc(0, r * 0.58, r * 1.2, -Math.PI * 0.78, -Math.PI * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.58, r * 0.72, -Math.PI * 0.76, -Math.PI * 0.24);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.58, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'link': {
      ctx.beginPath();
      ctx.arc(-r * 0.36, 0, r * 0.42, Math.PI * 0.5, Math.PI * 1.5);
      ctx.moveTo(-r * 0.36, -r * 0.42);
      ctx.lineTo(r * 0.08, -r * 0.42);
      ctx.moveTo(-r * 0.36, r * 0.42);
      ctx.lineTo(r * 0.08, r * 0.42);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.36, 0, r * 0.42, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.moveTo(-r * 0.08, -r * 0.42);
      ctx.lineTo(r * 0.36, -r * 0.42);
      ctx.moveTo(-r * 0.08, r * 0.42);
      ctx.lineTo(r * 0.36, r * 0.42);
      ctx.stroke();
      break;
    }
    case 'search': {
      ctx.beginPath();
      ctx.arc(-r * 0.18, -r * 0.18, r * 0.56, 0, Math.PI * 2);
      ctx.moveTo(r * 0.24, r * 0.24);
      ctx.lineTo(r * 0.85, r * 0.85);
      ctx.stroke();
      break;
    }
    case 'settings': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
        ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      }
      ctx.stroke();
      break;
    }
    case 'chart': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.8);
      ctx.lineTo(-r * 0.85, r * 0.8);
      ctx.lineTo(r * 0.85, r * 0.8);
      ctx.moveTo(-r * 0.42, r * 0.8);
      ctx.lineTo(-r * 0.42, r * 0.15);
      ctx.moveTo(r * 0.05, r * 0.8);
      ctx.lineTo(r * 0.05, -r * 0.42);
      ctx.moveTo(r * 0.52, r * 0.8);
      ctx.lineTo(r * 0.52, -r * 0.1);
      ctx.stroke();
      break;
    }
    case 'check': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.4, 0.04 * r);
      ctx.lineTo(-r * 0.1, r * 0.36);
      ctx.lineTo(r * 0.45, -r * 0.32);
      ctx.stroke();
      break;
    }
    case 'alert': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.88);
      ctx.lineTo(r * 0.88, r * 0.78);
      ctx.lineTo(-r * 0.88, r * 0.78);
      ctx.closePath();
      ctx.moveTo(0, -r * 0.28);
      ctx.lineTo(0, r * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, r * 0.48, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'clock': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
      ctx.moveTo(0, -r * 0.5);
      ctx.lineTo(0, 0);
      ctx.lineTo(r * 0.42, r * 0.22);
      ctx.stroke();
      break;
    }
    case 'layers': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.82);
      ctx.lineTo(r * 0.88, -r * 0.35);
      ctx.lineTo(0, r * 0.12);
      ctx.lineTo(-r * 0.88, -r * 0.35);
      ctx.closePath();
      ctx.moveTo(-r * 0.88, r * 0.08);
      ctx.lineTo(0, r * 0.52);
      ctx.lineTo(r * 0.88, r * 0.08);
      ctx.moveTo(-r * 0.88, r * 0.48);
      ctx.lineTo(0, r * 0.9);
      ctx.lineTo(r * 0.88, r * 0.48);
      ctx.stroke();
      break;
    }
    case 'target': {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? r * 0.95 : r * 0.42;
        const px = Math.cos(angle) * rad;
        const py = Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'rocket': {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.quadraticCurveTo(r * 0.65, -r * 0.3, r * 0.42, r * 0.48);
      ctx.lineTo(-r * 0.42, r * 0.48);
      ctx.quadraticCurveTo(-r * 0.65, -r * 0.3, 0, -r * 0.95);
      ctx.moveTo(-r * 0.42, r * 0.25);
      ctx.lineTo(-r * 0.82, r * 0.65);
      ctx.lineTo(-r * 0.35, r * 0.65);
      ctx.moveTo(r * 0.42, r * 0.25);
      ctx.lineTo(r * 0.82, r * 0.65);
      ctx.lineTo(r * 0.35, r * 0.65);
      ctx.stroke();
      break;
    }
    case 'atom': {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.36, Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.95, r * 0.36, -Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}
