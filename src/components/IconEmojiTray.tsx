import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Atom,
  BarChart2,
  Bell,
  CheckCircle2,
  Clock,
  Cloud,
  Code2,
  Cpu,
  Database,
  FileText,
  Folder,
  Globe,
  KeyRound,
  Layers,
  Link2,
  Lock,
  Mail,
  Rocket,
  Search,
  Server,
  Settings,
  Shield,
  Smile,
  Star,
  Target,
  Terminal,
  User,
  Users,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import type { IconPosition } from '../types/linkdraw';
import {
  ALL_NODE_ICON_OPTIONS,
  getVectorIconName,
  isVectorNodeIcon,
  type IconCategory,
} from '../lib/nodeIcons';

const RECENT_STORAGE_KEY = 'linkdraw_recent_icons_v1';

const VECTOR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  server: Server,
  database: Database,
  cloud: Cloud,
  globe: Globe,
  shield: Shield,
  lock: Lock,
  key: KeyRound,
  cpu: Cpu,
  code: Code2,
  terminal: Terminal,
  user: User,
  users: Users,
  file: FileText,
  folder: Folder,
  mail: Mail,
  bell: Bell,
  zap: Zap,
  wifi: Wifi,
  link: Link2,
  search: Search,
  settings: Settings,
  chart: BarChart2,
  check: CheckCircle2,
  alert: AlertTriangle,
  clock: Clock,
  layers: Layers,
  target: Target,
  star: Star,
  rocket: Rocket,
  atom: Atom,
};

export const NodeIconBadge: React.FC<{
  icon?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}> = ({ icon, className = 'w-4 h-4', fallback = null }) => {
  const trimmed = icon?.trim() ?? '';
  if (!trimmed) return <>{fallback}</>;
  if (isVectorNodeIcon(trimmed)) {
    const name = getVectorIconName(trimmed);
    const IconComp = VECTOR_ICON_MAP[name] ?? Smile;
    return <IconComp className={className} />;
  }
  return <span className="leading-none text-[15px]">{trimmed}</span>;
};

function readRecentIcons(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, 10) : [];
  } catch {
    return [];
  }
}

function saveRecentIcon(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return readRecentIcons();
  const next = [trimmed, ...readRecentIcons().filter((v) => v !== trimmed)].slice(0, 10);
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

const CATEGORY_TABS: { id: IconCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'icons', label: 'Icons' },
  { id: 'smileys_emotion', label: 'Smileys' },
  { id: 'people_body', label: 'People' },
  { id: 'animals_nature', label: 'Nature' },
  { id: 'food_drink', label: 'Food' },
  { id: 'travel_places', label: 'Travel' },
  { id: 'activities', label: 'Activities' },
  { id: 'objects', label: 'Objects' },
  { id: 'symbols', label: 'Symbols' },
  { id: 'flags', label: 'Flags' },
];

const PAGE_SIZE = 160;

interface IconEmojiTrayProps {
  value: string;
  position?: IconPosition;
  onChangeIcon: (nextIcon: string) => void;
  onChangePosition?: (nextPos: IconPosition) => void;
  compact?: boolean;
}

export const IconEmojiTray: React.FC<IconEmojiTrayProps> = ({
  value,
  position = 'inline',
  onChangeIcon,
  onChangePosition,
  compact = false,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<IconCategory>('all');
  const [recentIcons, setRecentIcons] = useState<string[]>(() => readRecentIcons());
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_NODE_ICON_OPTIONS.filter((opt) => {
      if (category !== 'all' && opt.category !== category) return false;
      if (!q) return true;
      return (
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        opt.keywords.some((kw) => kw.includes(q))
      );
    });
  }, [category, query]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit]
  );
  const hasMore = visibleItems.length < filteredItems.length;

  const handlePick = (iconValue: string) => {
    setRecentIcons(saveRecentIcon(iconValue));
    onChangeIcon(iconValue);
  };

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore) return;
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      setVisibleLimit((prev) => Math.min(filteredItems.length, prev + PAGE_SIZE));
    }
  };

  return (
    <div className="space-y-2.5 text-xs text-slate-800 dark:text-slate-100">
      {/* Search + Custom Input + Clear */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleLimit(PAGE_SIZE);
            }}
            placeholder={`Search ${ALL_NODE_ICON_OPTIONS.length.toLocaleString()} icons & emojis...`}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setVisibleLimit(PAGE_SIZE);
              }}
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <input
          type="text"
          maxLength={8}
          value={isVectorNodeIcon(value) ? '' : value}
          onChange={(e) => onChangeIcon(e.target.value)}
          placeholder="Custom"
          title="Type or paste any custom emoji or symbol"
          className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />

        {value && (
          <button
            type="button"
            onClick={() => onChangeIcon('')}
            title="Remove icon"
            className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 font-medium shrink-0"
          >
            None
          </button>
        )}
      </div>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        {CATEGORY_TABS.map((tab) => {
          const active = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategory(tab.id);
                setVisibleLimit(PAGE_SIZE);
              }}
              className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors shrink-0 ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Recent Picks */}
      {!query && category === 'all' && recentIcons.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Recent
          </div>
          <div className="flex flex-wrap gap-1">
            {recentIcons.map((item) => {
              const selected = value === item;
              return (
                <button
                  key={`recent-${item}`}
                  type="button"
                  onClick={() => handlePick(item)}
                  title={item}
                  className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors ${
                    selected
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <NodeIconBadge icon={item} className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Icon & Emoji Grid */}
      <div
        onScroll={handleGridScroll}
        className={`overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-1.5 ${
          compact ? 'max-h-40' : 'max-h-52'
        }`}
      >
        {filteredItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No icons or emojis match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
              {visibleItems.map((opt, idx) => {
                const selected = value === opt.value;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    onClick={() => handlePick(opt.value)}
                    title={`${opt.label} (${opt.kind === 'vector' ? 'Vector Icon' : 'Emoji'})`}
                    className={`h-8 rounded-md border flex items-center justify-center transition-colors ${
                      selected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                        : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <NodeIconBadge icon={opt.value} className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
            {hasMore && (
              <div className="pt-2 pb-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                  className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 tabular-nums"
                >
                  Load more ({filteredItems.length - visibleItems.length} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Count + Placement Control */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <span className="text-[11px] text-slate-400 tabular-nums">
          {filteredItems.length.toLocaleString()} available
        </span>
        {onChangePosition && (
          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Placement
            </span>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg w-full max-w-[190px]">
              {(['inline', 'top', 'left'] as IconPosition[]).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onChangePosition(pos)}
                  className={`py-1 text-[11px] font-medium rounded-md capitalize transition-colors ${
                    position === pos
                      ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
