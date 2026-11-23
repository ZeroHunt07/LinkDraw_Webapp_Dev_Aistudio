import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FolderOpen,
  KeyRound,
  LogOut,
  Plus,
  Radio,
  Search,
  Share2,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type { GraphDocument, StarterTemplateId, WorkspaceBoard } from '../types/linkdraw';
import { exportLinkDrawJSON, parseLinkDrawJSON, triggerFileDownload } from '../lib/exportEngine';
import { fetchCollabBoardGraph } from '../lib/firestoreSync';
import { PWAInstallButton } from './PWAInstallButton';

interface WorkspacesHomeProps {
  uid: string;
  displayName: string;
  boards: WorkspaceBoard[];
  activeBoardId: string | null;
  onSelectBoard: (board: WorkspaceBoard) => void;
  onCreateBoard: (opts: {
    title: string;
    description: string;
    shared: boolean;
    template: StarterTemplateId;
    customGraph?: GraphDocument;
  }) => Promise<void>;
  onJoinBoard: (code: string) => Promise<void>;
  onDuplicateBoard: (board: WorkspaceBoard) => Promise<void>;
  onPromoteToShared: (board: WorkspaceBoard) => Promise<void>;
  onDeleteOrLeaveBoard: (board: WorkspaceBoard) => Promise<void>;
  onNotify: (msg: string) => void;
}

const TEMPLATES: { id: StarterTemplateId; title: string; summary: string; stats: string }[] = [
  {
    id: 'microservices',
    title: 'Microservices Architecture',
    summary: 'API Gateway, Auth, Orders, Billing, Postgres cylinder, and live SLA table.',
    stats: '6 nodes · 5 edges',
  },
  {
    id: 'osint',
    title: 'OSINT Investigation',
    summary: 'Domain, IPv4 exit node, WHOIS email, and Bitcoin cluster ready for transforms.',
    stats: '4 nodes · 3 edges',
  },
  {
    id: 'mindmap',
    title: 'Mindmap Tree',
    summary: 'Collapsible NotebookLM-style hierarchical tree with fold/unfold branch badges.',
    stats: '6 nodes · 5 edges',
  },
  {
    id: 'blank',
    title: 'Blank Graph',
    summary: 'Clean infinite 2D canvas with default layers and grid snapping enabled.',
    stats: 'Empty canvas',
  },
];

export const WorkspacesHome: React.FC<WorkspacesHomeProps> = ({
  uid,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onJoinBoard,
  onDuplicateBoard,
  onPromoteToShared,
  onDeleteOrLeaveBoard,
  onNotify,
}) => {
  const [filter, setFilter] = useState<'all' | 'shared' | 'personal'>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [template, setTemplate] = useState<StarterTemplateId>('microservices');
  const [creating, setCreating] = useState(false);

  // Join form
  const [inviteInput, setInviteInput] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const fileRef = useRef<HTMLInputElement | null>(null);

  const filteredBoards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boards
      .filter((b) => {
        if (filter === 'shared' && b.kind !== 'shared') return false;
        if (filter === 'personal' && b.kind !== 'personal') return false;
        if (!q) return true;
        return (
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          (b.inviteCode ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [boards, filter, search]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      await onCreateBoard({
        title: newTitle.trim() || 'Untitled Workspace',
        description: newDesc.trim(),
        shared: isShared,
        template,
      });
      setShowCreate(false);
      setNewTitle('');
      setNewDesc('');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joining) return;
    setJoinError('');
    setJoining(true);
    try {
      await onJoinBoard(inviteInput.trim().toUpperCase());
      setShowJoin(false);
      setInviteInput('');
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Unable to join board.');
    } finally {
      setJoining(false);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseLinkDrawJSON(text);
      await onCreateBoard({
        title: parsed.title || file.name.replace(/\.json$/i, ''),
        description: 'Imported LinkDraw JSON graph',
        shared: false,
        template: 'blank',
        customGraph: parsed.graph,
      });
      onNotify(`Imported "${file.name}" as a personal workspace.`);
    } catch {
      onNotify('Invalid LinkDraw JSON file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleShareCode = async (board: WorkspaceBoard) => {
    if (!board.inviteCode) return;
    const shareUrl = `${window.location.origin}?join=${board.inviteCode}`;
    try {
      await navigator.clipboard.writeText(`Join "${board.title}" on LinkDraw — Invite Code: ${board.inviteCode}\n${shareUrl}`);
      onNotify(`Copied invite code ${board.inviteCode} & link.`);
    } catch {
      onNotify(`Invite Code: ${board.inviteCode}`);
    }
  };

  const handleExportBoardJson = async (board: WorkspaceBoard) => {
    try {
      const graphData = board.graphData ?? (await fetchCollabBoardGraph(board));
      const json = exportLinkDrawJSON(graphData, board.title);
      triggerFileDownload(`${board.title.replace(/\s+/g, '_')}.linkdraw.json`, json, 'application/json');
      onNotify(`Exported "${board.title}" as LinkDraw JSON.`);
    } catch {
      onNotify('Failed to export board.');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time collaborative boards synced with Android and private personal studios.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PWAInstallButton compact />
            <button
              onClick={() => {
                setJoinError('');
                setShowJoin(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <KeyRound className="w-4 h-4" />
              Join by Code
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Workspace
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 self-start">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'shared', label: 'Shared Live' },
                { id: 'personal', label: 'Personal' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, or invite code..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {/* Boards Grid */}
        {filteredBoards.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
            <p className="text-base font-medium">No matching workspaces yet</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create a new graph from a starter template, import a LinkDraw JSON file, or join a live session with a 6-character invite code.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Workspace
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBoards.map((board) => {
              const isOwner = board.ownerId === uid;
              const isActive = board.id === activeBoardId;
              const memberCount = board.memberUids?.length ?? 1;
              const nodeCount = board.graphData?.nodes.length;

              return (
                <div
                  key={board.id}
                  className={`flex flex-col justify-between bg-white dark:bg-slate-900 border rounded-xl p-5 transition-colors ${
                    isActive
                      ? 'border-blue-500 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => onSelectBoard(board)}
                        className="text-left font-semibold text-base text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1"
                      >
                        {board.title}
                      </button>
                      <span
                        className={`text-xs font-medium whitespace-nowrap shrink-0 ${
                          board.kind === 'shared'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {board.kind === 'shared' ? 'Shared Live' : 'Personal'}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
                      {board.description || 'No description provided.'}
                    </p>

                    {/* Unboxed clean metadata */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums pt-1">
                      {board.kind === 'shared' ? (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                            {board.inviteCode}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>{nodeCount ?? 0} nodes</span>
                          <span aria-hidden="true">·</span>
                          <span>{board.graphData?.edges.length ?? 0} edges</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{new Date(board.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => onSelectBoard(board)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {isActive ? 'Open Canvas' : 'Open'}
                    </button>

                    <div className="flex items-center gap-1">
                      {board.kind === 'shared' && board.inviteCode && (
                        <button
                          onClick={() => handleShareCode(board)}
                          title="Copy invite code & link"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                      )}
                      {board.kind === 'personal' && (
                        <button
                          onClick={() => onPromoteToShared(board)}
                          title="Publish as Shared Live Board (get 6-char invite code for Mobile sync)"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                        >
                          <Radio className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => onDuplicateBoard(board)}
                        title="Duplicate as personal board"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExportBoardJson(board)}
                        title="Export LinkDraw JSON"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteOrLeaveBoard(board)}
                        title={board.kind === 'shared' && !isOwner ? 'Leave board' : 'Delete board'}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        {board.kind === 'shared' && !isOwner ? (
                          <LogOut className="w-4 h-4" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Workspace Modal (scrollable) */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold">Create Workspace</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={160}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Core Infrastructure Topology"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional summary of scope, investigation, or team goals..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
                <div>
                  <span className="text-sm font-medium block">Shared Live Board</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Generates a 6-character invite code for Web + Android real-time sync
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Starter Template
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      type="button"
                      key={tpl.id}
                      onClick={() => setTemplate(tpl.id)}
                      className={`text-left p-3 rounded-lg border transition-colors ${
                        template === tpl.id
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-sm font-medium">{tpl.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {tpl.summary}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1.5">{tpl.stats}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join by 6-Character Invite Code Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold">Join Shared Board</h2>
              <button
                onClick={() => setShowJoin(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleJoinSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  6-Character Invite Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. A7K9M2"
                  className="w-full px-3 py-2.5 text-center font-mono text-lg tracking-widest uppercase rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              {joinError && <p className="text-xs text-red-600 dark:text-red-400">{joinError}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJoin(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining || inviteInput.length !== 6}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {joining ? 'Joining...' : 'Join Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
