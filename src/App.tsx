import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  Calculator,
  FileText,
  FolderKanban,
  Network,
  Radar,
  Settings,
  Sliders,
  Workflow,
} from 'lucide-react';
import type {
  AppSection,
  BoardComment,
  CollabPresence,
  FreehandStroke,
  GraphDocument,
  GraphEdge,
  GraphNode,
  NoteRecord,
  StarterTemplateId,
  StickyNote,
  ThemeMode,
  UtilitySubTab,
  WorkspaceBoard,
} from './types/linkdraw';
import { auth, signInWithGoogle, signOutUser, testConnection } from './lib/firebase';
import {
  addBoardComment,
  buildCollabMetaFromGraph,
  type CollabElementMeta,
  createCollabBoard,
  createPersonalBoard,
  deleteBoardComment,
  deleteUserNote,
  deleteWorkspaceBoard,
  fetchCollabBoardGraph,
  joinCollabBoardByCode,
  leaveCollabBoard,
  makeSafeId,
  removeCollabMember,
  renameCollabBoard,
  savePersonalBoardGraph,
  saveUserNote,
  subscribeBoardComments,
  subscribeCollabBoards,
  subscribeCollabElements,
  subscribePersonalBoards,
  subscribePresence,
  subscribeUserNotes,
  syncCollabElementDiff,
  updateCollabBoardSettings,
  upsertPresence,
} from './lib/firestoreSync';
import { createStarterTemplate, DEFAULT_LAYERS, DEFAULT_SETTINGS } from './lib/templates';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkspacesHome } from './components/WorkspacesHome';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import {
  EdgeInspectorModal,
  NodeInspectorModal,
  StickyInspectorModal,
} from './components/Inspectors';
import { CollaboratorsModal, CommentsDrawer } from './components/CollabModals';
import { NotesStudio } from './components/NotesStudio';
import { UtilitiesSuite } from './components/UtilitiesSuite';

const EMPTY_GRAPH: GraphDocument = {
  nodes: [],
  edges: [],
  stickies: [],
  strokes: [],
  layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
  settings: { ...DEFAULT_SETTINGS },
};

function cloneGraph(g: GraphDocument): GraphDocument {
  return JSON.parse(JSON.stringify(g)) as GraphDocument;
}

export default function App() {
  return (
    <ErrorBoundary>
      <LinkDrawApp />
    </ErrorBoundary>
  );
}

function LinkDrawApp() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [section, setSection] = useState<AppSection>('workspaces');
  const [utilitySubTab, setUtilitySubTab] = useState<UtilitySubTab>('algos');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('linkdraw_theme');
    return saved === 'dark' || saved === 'high_contrast' ? saved : 'light';
  });

  // Workspaces & Notes from Firestore
  const [collabBoards, setCollabBoards] = useState<WorkspaceBoard[]>([]);
  const [personalBoards, setPersonalBoards] = useState<WorkspaceBoard[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  // Active Canvas Graph + Undo/Redo
  const [graph, setGraph] = useState<GraphDocument>(EMPTY_GRAPH);
  const [undoStack, setUndoStack] = useState<GraphDocument[]>([]);
  const [redoStack, setRedoStack] = useState<GraphDocument[]>([]);

  // Collaboration state
  const [presence, setPresence] = useState<CollabPresence[]>([]);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);

  // Selection, Highlights & Inspectors
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedStickyId, setSelectedStickyId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(new Set());
  const [focusRequest, setFocusRequest] = useState<{ x: number; y: number; ts: number } | null>(null);

  const [inspectedNode, setInspectedNode] = useState<GraphNode | null>(null);
  const [inspectedEdge, setInspectedEdge] = useState<GraphEdge | null>(null);
  const [inspectedSticky, setInspectedSticky] = useState<StickyNote | null>(null);
  const [notesTargetNodeId, setNotesTargetNodeId] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Sync tracking refs
  const lastCollabMetaRef = useRef<Map<string, CollabElementMeta>>(new Map());
  const collabPendingCountRef = useRef(0);
  const collabSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const activeBoardIdRef = useRef<string | null>(activeBoardId);
  activeBoardIdRef.current = activeBoardId;
  const activeBoardSettingsRef = useRef<GraphDocument['settings']>({ ...DEFAULT_SETTINGS });
  const latestCollabSnapshotRef = useRef<{
    boardId: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
    stickies: StickyNote[];
    strokes: FreehandStroke[];
    elementMeta: Map<string, CollabElementMeta>;
  } | null>(null);
  const personalSaveTimerRef = useRef<number | null>(null);
  const graphRef = useRef<GraphDocument>(graph);
  graphRef.current = graph;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  // Theme class sync
  useEffect(() => {
    localStorage.setItem('linkdraw_theme', theme);
    const root = document.documentElement;
    root.classList.remove('dark', 'high-contrast');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'high_contrast') {
      root.classList.add('dark', 'high-contrast');
    }
  }, [theme]);

  // Boot connection check & Auth listener
  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to boards & notes when authenticated
  useEffect(() => {
    if (!user) {
      setCollabBoards([]);
      setPersonalBoards([]);
      setNotes([]);
      return;
    }
    const unsubCollab = subscribeCollabBoards(user.uid, setCollabBoards);
    const unsubPersonal = subscribePersonalBoards(user.uid, setPersonalBoards);
    const unsubNotes = subscribeUserNotes(user.uid, setNotes);
    return () => {
      unsubCollab();
      unsubPersonal();
      unsubNotes();
    };
  }, [user]);

  const allBoards = useMemo(
    () => [...collabBoards, ...personalBoards],
    [collabBoards, personalBoards]
  );

  const activeBoard = useMemo(
    () => allBoards.find((b) => b.id === activeBoardId) ?? null,
    [allBoards, activeBoardId]
  );

  if (activeBoard?.kind === 'shared') {
    activeBoardSettingsRef.current = {
      gridSnap: activeBoard.gridSnap,
      gridSize: activeBoard.gridSize,
      flowAnimation: activeBoard.flowAnimation,
    };
  }

  // Handle ?join=INVITE_CODE query parameter on boot
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code && /^[A-Z0-9]{6}$/i.test(code.trim())) {
      window.history.replaceState({}, '', window.location.pathname);
      joinCollabBoardByCode(code, user.uid, user.displayName || user.email || 'Collaborator')
        .then((boardId) => {
          lastCollabMetaRef.current = new Map();
          latestCollabSnapshotRef.current = null;
          collabPendingCountRef.current = 0;
          setActiveBoardId(boardId);
          setSection('canvas');
          notify(`Joined shared board (${code.toUpperCase()}).`);
        })
        .catch((err) => notify(err instanceof Error ? err.message : 'Unable to join board.'));
    }
  }, [user, notify]);

  // Subscribe to active shared board's elements, presence & comments
  useEffect(() => {
    if (!user || !activeBoard) {
      setPresence([]);
      setComments([]);
      return;
    }

    if (activeBoard.kind === 'personal') {
      if (activeBoard.graphData) {
        setGraph(activeBoard.graphData);
      }
      setPresence([]);
      setComments([]);
      return;
    }

    // Shared Live Board
    const targetBoardId = activeBoard.id;
    latestCollabSnapshotRef.current = null;
    const unsubElems = subscribeCollabElements(
      targetBoardId,
      ({ nodes, edges, stickies, strokes, elementMeta }) => {
        if (activeBoardIdRef.current !== targetBoardId) return;
        if (collabPendingCountRef.current > 0) {
          latestCollabSnapshotRef.current = {
            boardId: targetBoardId,
            nodes,
            edges,
            stickies,
            strokes,
            elementMeta,
          };
          return;
        }
        lastCollabMetaRef.current = elementMeta;
        setGraph((prev) => ({
          ...prev,
          nodes,
          edges,
          stickies,
          strokes,
          settings: activeBoardSettingsRef.current,
        }));
      }
    );

    const unsubPresence = subscribePresence(targetBoardId, setPresence);
    const unsubComments = subscribeBoardComments(targetBoardId, setComments);

    return () => {
      unsubElems();
      unsubPresence();
      unsubComments();
    };
  }, [user, activeBoard?.id, activeBoard?.kind]);

  // Keep shared board settings synced when board metadata updates
  useEffect(() => {
    if (activeBoard?.kind === 'shared') {
      const nextSettings = {
        gridSnap: activeBoard.gridSnap,
        gridSize: activeBoard.gridSize,
        flowAnimation: activeBoard.flowAnimation,
      };
      activeBoardSettingsRef.current = nextSettings;
      setGraph((prev) => ({
        ...prev,
        settings: nextSettings,
      }));
    }
  }, [activeBoard?.gridSnap, activeBoard?.gridSize, activeBoard?.flowAnimation, activeBoard?.kind]);

  // Presence heartbeat & selection sync
  useEffect(() => {
    if (!user || !activeBoard || activeBoard.kind !== 'shared') return;
    const displayName = user.displayName || user.email || 'Collaborator';
    const selId = selectedNodeIds[0] ?? null;
    upsertPresence(activeBoard.id, user.uid, displayName, selId, section).catch(() => {});

    const timer = window.setInterval(() => {
      upsertPresence(activeBoard.id, user.uid, displayName, selId, section).catch(() => {});
    }, 25000);
    return () => window.clearInterval(timer);
  }, [user, activeBoard?.id, activeBoard?.kind, selectedNodeIds, section]);

  // Persist graph changes (Undo/Redo + Firestore sync)
  const commitGraph = useCallback(
    (nextGraph: GraphDocument, recordUndo = true) => {
      const prev = graphRef.current;
      if (recordUndo) {
        setUndoStack((stk) => [...stk.slice(-59), cloneGraph(prev)]);
        setRedoStack([]);
      }
      setGraph(nextGraph);

      if (!user || !activeBoard) return;
      if (activeBoard.kind === 'shared') {
        const targetBoardId = activeBoard.id;
        const displayName = user.displayName || user.email || 'Collaborator';
        const graphSnapshot = nextGraph;
        collabPendingCountRef.current += 1;

        collabSyncQueueRef.current = collabSyncQueueRef.current
          .catch(() => {})
          .then(async () => {
            if (activeBoardIdRef.current !== targetBoardId) return;
            const updatedMeta = await syncCollabElementDiff(
              targetBoardId,
              user.uid,
              displayName,
              graphSnapshot,
              lastCollabMetaRef.current
            );
            if (activeBoardIdRef.current === targetBoardId) {
              lastCollabMetaRef.current = updatedMeta;
            }
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : 'Unable to save board changes.';
            notify(`Shared sync failed: ${msg}`);
          })
          .finally(() => {
            collabPendingCountRef.current = Math.max(0, collabPendingCountRef.current - 1);
            const deferred = latestCollabSnapshotRef.current;
            if (
              collabPendingCountRef.current === 0 &&
              deferred &&
              deferred.boardId === activeBoardIdRef.current
            ) {
              latestCollabSnapshotRef.current = null;
              lastCollabMetaRef.current = deferred.elementMeta;
              setGraph((curr) => ({
                ...curr,
                nodes: deferred.nodes,
                edges: deferred.edges,
                stickies: deferred.stickies,
                strokes: deferred.strokes,
                settings: activeBoardSettingsRef.current,
              }));
            }
          });

        if (
          nextGraph.settings.gridSnap !== prev.settings.gridSnap ||
          nextGraph.settings.gridSize !== prev.settings.gridSize ||
          nextGraph.settings.flowAnimation !== prev.settings.flowAnimation
        ) {
          activeBoardSettingsRef.current = { ...nextGraph.settings };
          updateCollabBoardSettings(targetBoardId, nextGraph.settings).catch((err) => {
            const msg = err instanceof Error ? err.message : 'Unable to save board settings.';
            notify(`Settings sync failed: ${msg}`);
          });
        }
      } else {
        if (personalSaveTimerRef.current) window.clearTimeout(personalSaveTimerRef.current);
        const targetBoardId = activeBoard.id;
        const targetTitle = activeBoard.title;
        const targetDesc = activeBoard.description;
        personalSaveTimerRef.current = window.setTimeout(() => {
          savePersonalBoardGraph(user.uid, targetBoardId, targetTitle, targetDesc, nextGraph).catch(
            (err) => {
              const msg = err instanceof Error ? err.message : 'Unable to save board.';
              notify(`Save failed: ${msg}`);
            }
          );
        }, 350);
      }
    },
    [user, activeBoard, notify]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prevSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((stk) => stk.slice(0, -1));
    setRedoStack((stk) => [...stk, cloneGraph(graphRef.current)]);
    commitGraph(prevSnapshot, false);
  }, [undoStack, commitGraph]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    setRedoStack((stk) => stk.slice(0, -1));
    setUndoStack((stk) => [...stk, cloneGraph(graphRef.current)]);
    commitGraph(nextSnapshot, false);
  }, [redoStack, commitGraph]);

  // Workspace Handlers
  const handleSelectBoard = (board: WorkspaceBoard) => {
    setUndoStack([]);
    setRedoStack([]);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
    setSelectedStickyId(null);
    setHighlightedNodeIds(new Set());
    setHighlightedEdgeIds(new Set());
    lastCollabMetaRef.current = new Map();
    latestCollabSnapshotRef.current = null;
    collabPendingCountRef.current = 0;
    setActiveBoardId(board.id);
    if (board.kind === 'personal' && board.graphData) {
      setGraph(board.graphData);
    } else {
      activeBoardSettingsRef.current = {
        gridSnap: board.gridSnap,
        gridSize: board.gridSize,
        flowAnimation: board.flowAnimation,
      };
      setGraph(EMPTY_GRAPH);
    }
    setSection('canvas');
  };

  const handleCreateBoard = async (opts: {
    title: string;
    description: string;
    shared: boolean;
    template: StarterTemplateId;
    customGraph?: GraphDocument;
  }) => {
    if (!user) return;
    const initialGraph = opts.customGraph ?? createStarterTemplate(opts.template);
    const displayName = user.displayName || user.email || 'User';
    const created = opts.shared
      ? await createCollabBoard(user.uid, displayName, opts.title, opts.description, initialGraph)
      : await createPersonalBoard(user.uid, opts.title, opts.description, initialGraph);
    setUndoStack([]);
    setRedoStack([]);
    latestCollabSnapshotRef.current = null;
    collabPendingCountRef.current = 0;
    lastCollabMetaRef.current = opts.shared
      ? buildCollabMetaFromGraph(initialGraph)
      : new Map();
    if (opts.shared) {
      activeBoardSettingsRef.current = { ...initialGraph.settings };
    }
    setActiveBoardId(created.id);
    setGraph(initialGraph);
    setSection('canvas');
    notify(
      opts.shared && created.inviteCode
        ? `Created shared board "${created.title}" · Code ${created.inviteCode}`
        : `Created personal board "${created.title}".`
    );
  };

  const handleJoinBoard = async (code: string) => {
    if (!user) return;
    const boardId = await joinCollabBoardByCode(
      code,
      user.uid,
      user.displayName || user.email || 'Collaborator'
    );
    lastCollabMetaRef.current = new Map();
    latestCollabSnapshotRef.current = null;
    collabPendingCountRef.current = 0;
    setActiveBoardId(boardId);
    setSection('canvas');
    notify(`Joined shared board (${code}).`);
  };

  const handleDuplicateBoard = async (board: WorkspaceBoard) => {
    if (!user) return;
    const sourceGraph = board.graphData ?? (await fetchCollabBoardGraph(board));
    await createPersonalBoard(
      user.uid,
      `${board.title} (Copy)`,
      board.description,
      cloneGraph(sourceGraph)
    );
    notify(`Duplicated "${board.title}" as a personal board.`);
  };

  const handlePromoteToShared = async (board: WorkspaceBoard) => {
    if (!user) return;
    const sourceGraph = cloneGraph(board.graphData ?? EMPTY_GRAPH);
    const displayName = user.displayName || user.email || 'User';
    const created = await createCollabBoard(
      user.uid,
      displayName,
      board.title,
      board.description,
      sourceGraph
    );
    setUndoStack([]);
    setRedoStack([]);
    latestCollabSnapshotRef.current = null;
    collabPendingCountRef.current = 0;
    lastCollabMetaRef.current = buildCollabMetaFromGraph(sourceGraph);
    activeBoardSettingsRef.current = { ...sourceGraph.settings };
    setActiveBoardId(created.id);
    setGraph(sourceGraph);
    setSection('canvas');
    notify(
      created.inviteCode
        ? `Published "${created.title}" as Shared Live · Code ${created.inviteCode}`
        : `Published "${created.title}" as Shared Live.`
    );
  };

  const handleDeleteOrLeaveBoard = async (board: WorkspaceBoard) => {
    if (!user) return;
    const isOwner = board.ownerId === user.uid;
    if (board.kind === 'shared' && !isOwner) {
      await leaveCollabBoard(board.id, user.uid, board.memberNames ?? {});
      notify(`Left shared board "${board.title}".`);
    } else {
      await deleteWorkspaceBoard(user.uid, board);
      notify(`Deleted "${board.title}".`);
    }
    if (activeBoardId === board.id) {
      setActiveBoardId(null);
      setGraph(EMPTY_GRAPH);
    }
  };

  const focusNodeOrEdgeOnCanvas = (targetId: string, kind: 'node' | 'edge') => {
    setSection('canvas');
    if (kind === 'node') {
      const node = graph.nodes.find((n) => n.id === targetId);
      if (node) {
        setSelectedNodeIds([node.id]);
        setSelectedEdgeId(null);
        setSelectedStickyId(null);
        setFocusRequest({ x: node.x, y: node.y, ts: Date.now() });
      }
    } else {
      const edge = graph.edges.find((e) => e.id === targetId);
      if (edge) {
        const a = graph.nodes.find((n) => n.id === edge.a);
        const b = graph.nodes.find((n) => n.id === edge.b);
        setSelectedNodeIds([]);
        setSelectedEdgeId(edge.id);
        setSelectedStickyId(null);
        if (a && b) {
          setFocusRequest({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ts: Date.now() });
        }
      }
    }
  };

  // Sign-In Screen
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 text-sm">
        Initializing LinkDraw Studio...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                <Workflow className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">LinkDraw</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight pt-2">
              Collaborative Graph Studio &amp; OSINT Workbench
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in with Google to access real-time collaborative workspaces, graph algorithms, Notes Studio, and Formula Engine synced with LinkDraw Android.
            </p>
          </div>

          {authError && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-900">
              {authError}
            </p>
          )}

          <button
            onClick={async () => {
              setAuthError('');
              setSigningIn(true);
              try {
                await signInWithGoogle();
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
                if (msg.includes('auth/unauthorized-domain')) {
                  setAuthError(
                    `Domain "${window.location.hostname}" is not in Firebase Auth Authorized Domains yet. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
                  );
                } else {
                  setAuthError(msg);
                }
              } finally {
                setSigningIn(false);
              }
            }}
            disabled={signingIn}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {signingIn ? 'Signing in...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    );
  }

  const navItems: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
  }[] = [
    {
      id: 'workspaces',
      label: 'Workspaces',
      icon: FolderKanban,
      active: section === 'workspaces',
      onClick: () => setSection('workspaces'),
    },
    {
      id: 'canvas',
      label: 'Canvas',
      icon: Workflow,
      active: section === 'canvas',
      onClick: () => setSection('canvas'),
      disabled: !activeBoard,
    },
    {
      id: 'notes',
      label: 'Notes',
      icon: FileText,
      active: section === 'notes',
      onClick: () => {
        setNotesTargetNodeId(null);
        setSection('notes');
      },
    },
    {
      id: 'algos',
      label: 'Algos',
      icon: Network,
      active: section === 'utilities' && utilitySubTab === 'algos',
      onClick: () => {
        setUtilitySubTab('algos');
        setSection('utilities');
      },
      disabled: !activeBoard,
    },
    {
      id: 'osint',
      label: 'OSINT',
      icon: Radar,
      active: section === 'utilities' && utilitySubTab === 'osint',
      onClick: () => {
        setUtilitySubTab('osint');
        setSection('utilities');
      },
      disabled: !activeBoard,
    },
    {
      id: 'formulas',
      label: 'Formulas',
      icon: Calculator,
      active: section === 'utilities' && utilitySubTab === 'formulas',
      onClick: () => {
        setUtilitySubTab('formulas');
        setSection('utilities');
      },
      disabled: !activeBoard,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      active: section === 'utilities' && utilitySubTab === 'settings',
      onClick: () => {
        setUtilitySubTab('settings');
        setSection('utilities');
      },
    },
  ];

  const selectedSingleNode =
    selectedNodeIds.length > 0
      ? graph.nodes.find((n) => n.id === selectedNodeIds[0]) ?? null
      : null;

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Desktop Navigation Rail */}
      <aside className="hidden md:flex flex-col w-20 lg:w-48 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Workflow className="w-4 h-4" />
          </div>
          <span className="hidden lg:inline font-bold text-sm tracking-tight truncate">
            LinkDraw
          </span>
        </div>

        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={item.onClick}
                className={`w-full flex items-center justify-center lg:justify-start gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  item.active
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                } disabled:opacity-35 disabled:pointer-events-none`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium truncate hidden lg:block">
            {user.displayName || 'Analyst'}
          </div>
          <div className="text-[11px] text-slate-400 truncate hidden lg:block">
            {user.email}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 min-h-0 relative overflow-hidden">
        {section === 'workspaces' && (
          <WorkspacesHome
            uid={user.uid}
            displayName={user.displayName || user.email || 'User'}
            boards={allBoards}
            activeBoardId={activeBoardId}
            onSelectBoard={handleSelectBoard}
            onCreateBoard={handleCreateBoard}
            onJoinBoard={handleJoinBoard}
            onDuplicateBoard={handleDuplicateBoard}
            onPromoteToShared={handlePromoteToShared}
            onDeleteOrLeaveBoard={handleDeleteOrLeaveBoard}
            onNotify={notify}
          />
        )}

        {section === 'canvas' && activeBoard && (
          <CanvasWorkspace
            board={activeBoard}
            uid={user.uid}
            graph={graph}
            theme={theme}
            presence={presence}
            commentCount={comments.length}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeId={selectedEdgeId}
            selectedStickyId={selectedStickyId}
            highlightedNodeIds={highlightedNodeIds}
            highlightedEdgeIds={highlightedEdgeIds}
            focusRequest={focusRequest}
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onCommitGraph={commitGraph}
            onSelectionChange={(nIds, eId, sId) => {
              setSelectedNodeIds(nIds);
              setSelectedEdgeId(eId);
              setSelectedStickyId(sId);
            }}
            onInspectNode={(n) => setInspectedNode(n)}
            onInspectEdge={(e) => setInspectedEdge(e)}
            onInspectSticky={(s) => setInspectedSticky(s)}
            onOpenComments={() => setShowCommentsDrawer(true)}
            onOpenCollaborators={() => setShowCollaboratorsModal(true)}
          />
        )}

        {section === 'canvas' && !activeBoard && (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
            <p className="text-base font-medium">No workspace open</p>
            <button
              onClick={() => setSection('workspaces')}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white"
            >
              Open Workspaces
            </button>
          </div>
        )}

        {section === 'notes' && (
          <NotesStudio
            uid={user.uid}
            boardId={activeBoardId}
            nodes={graph.nodes}
            notes={notes}
            initialSelectedNodeId={notesTargetNodeId}
            onSaveNote={async (note, isNew, silent) => {
              await saveUserNote(user.uid, note, isNew);
              if (!silent) {
                notify('Note saved & synced.');
              }
            }}
            onDeleteNote={async (noteId) => {
              await deleteUserNote(user.uid, noteId);
              notify('Note deleted.');
            }}
            onJumpToNode={(nodeId) => {
              setNotesTargetNodeId(null);
              focusNodeOrEdgeOnCanvas(nodeId, 'node');
            }}
            onCreateNodeFromNote={async (note) => {
              if (!activeBoard) {
                notify('Open a workspace first to spawn a node on its canvas.');
                return;
              }
              const now = Date.now();
              const newNode: GraphNode = {
                id: makeSafeId('n'),
                x: Math.round((Math.random() - 0.5) * 160),
                y: Math.round((Math.random() - 0.5) * 120),
                w: 170,
                h: 64,
                text: note.title.slice(0, 60),
                shape: 'rounded',
                color: '#dbeafe',
                icon: '📝',
                iconPosition: 'left',
                tags: [...note.tags],
                metadata: { note_type: note.noteType, priority: note.priority },
                layer: 'Data',
                createdAt: now,
                updatedAt: now,
              };
              const nextGraph = { ...graph, nodes: [...graph.nodes, newNode] };
              commitGraph(nextGraph, true);
              try {
                const noteExists = notes.some((existing) => existing.id === note.id);
                await saveUserNote(
                  user.uid,
                  { ...note, linkedNodeId: newNode.id, linkedNodeName: newNode.text },
                  !noteExists
                );
                setNotesTargetNodeId(null);
                focusNodeOrEdgeOnCanvas(newNode.id, 'node');
                notify(`Created node "${newNode.text}" from note.`);
              } catch {
                notify('Node created, but linking note failed to sync.');
              }
            }}
          />
        )}

        {section === 'utilities' && (
          <UtilitiesSuite
            activeSubTab={utilitySubTab}
            onSubTabChange={setUtilitySubTab}
            boardTitle={activeBoard?.title ?? 'No Active Board'}
            graph={graph}
            theme={theme}
            userId={user.uid}
            userEmail={user.email || ''}
            userName={user.displayName || 'LinkDraw Analyst'}
            onChangeTheme={setTheme}
            onUpdateGraph={commitGraph}
            onHighlightElements={(nIds, eIds) => {
              setHighlightedNodeIds(new Set(nIds));
              setHighlightedEdgeIds(new Set(eIds));
              if (nIds.length > 0) {
                const first = graph.nodes.find((n) => n.id === nIds[0]);
                if (first) setFocusRequest({ x: first.x, y: first.y, ts: Date.now() });
              }
            }}
            onFocusNodeOrEdge={focusNodeOrEdgeOnCanvas}
            onSignOut={() => signOutUser()}
            onNotify={notify}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden h-14 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-4 shrink-0">
        {[
          {
            id: 'workspaces',
            label: 'Boards',
            icon: FolderKanban,
            active: section === 'workspaces',
            onClick: () => setSection('workspaces'),
          },
          {
            id: 'canvas',
            label: 'Canvas',
            icon: Workflow,
            active: section === 'canvas',
            onClick: () => activeBoard && setSection('canvas'),
          },
          {
            id: 'notes',
            label: 'Notes',
            icon: FileText,
            active: section === 'notes',
            onClick: () => setSection('notes'),
          },
          {
            id: 'utilities',
            label: 'Suite',
            icon: Sliders,
            active: section === 'utilities',
            onClick: () => setSection('utilities'),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                item.active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals & Drawers */}
      {inspectedNode && (
        <NodeInspectorModal
          node={inspectedNode}
          onUpdate={(updated) => {
            commitGraph(
              {
                ...graph,
                nodes: graph.nodes.map((n) => (n.id === updated.id ? updated : n)),
              },
              true
            );
          }}
          onDelete={(id) => {
            commitGraph(
              {
                ...graph,
                nodes: graph.nodes.filter((n) => n.id !== id),
                edges: graph.edges.filter((e) => e.a !== id && e.b !== id),
              },
              true
            );
            setSelectedNodeIds([]);
          }}
          onOpenLinkedNote={(node) => {
            setInspectedNode(null);
            setNotesTargetNodeId(node.id);
            setSection('notes');
          }}
          onClose={() => setInspectedNode(null)}
        />
      )}

      {inspectedEdge && (
        <EdgeInspectorModal
          edge={inspectedEdge}
          onUpdate={(updated) => {
            commitGraph(
              {
                ...graph,
                edges: graph.edges.map((e) => (e.id === updated.id ? updated : e)),
              },
              true
            );
          }}
          onDelete={(id) => {
            commitGraph(
              { ...graph, edges: graph.edges.filter((e) => e.id !== id) },
              true
            );
            setSelectedEdgeId(null);
          }}
          onClose={() => setInspectedEdge(null)}
        />
      )}

      {inspectedSticky && (
        <StickyInspectorModal
          sticky={inspectedSticky}
          onUpdate={(updated) => {
            commitGraph(
              {
                ...graph,
                stickies: graph.stickies.map((s) => (s.id === updated.id ? updated : s)),
              },
              true
            );
          }}
          onDelete={(id) => {
            commitGraph(
              { ...graph, stickies: graph.stickies.filter((s) => s.id !== id) },
              true
            );
            setSelectedStickyId(null);
          }}
          onClose={() => setInspectedSticky(null)}
        />
      )}

      {showCommentsDrawer && activeBoard && activeBoard.kind === 'shared' && (
        <CommentsDrawer
          board={activeBoard}
          uid={user.uid}
          comments={comments}
          selectedNode={selectedSingleNode}
          onAddComment={async (text, linkedNode) => {
            await addBoardComment(
              activeBoard.id,
              user.uid,
              user.displayName || user.email || 'Collaborator',
              text,
              linkedNode?.id ?? null,
              linkedNode?.text ?? null
            );
          }}
          onDeleteComment={async (commentId) => {
            await deleteBoardComment(activeBoard.id, commentId);
          }}
          onFocusNode={(nodeId) => focusNodeOrEdgeOnCanvas(nodeId, 'node')}
          onClose={() => setShowCommentsDrawer(false)}
        />
      )}

      {showCollaboratorsModal && activeBoard && activeBoard.kind === 'shared' && (
        <CollaboratorsModal
          board={activeBoard}
          uid={user.uid}
          presence={presence}
          onRenameBoard={(title, desc) => renameCollabBoard(activeBoard.id, title, desc)}
          onRemoveMember={(memberUid) =>
            removeCollabMember(activeBoard.id, memberUid, activeBoard.memberNames ?? {})
          }
          onLeaveBoard={async () => {
            await leaveCollabBoard(activeBoard.id, user.uid, activeBoard.memberNames ?? {});
            setActiveBoardId(null);
            setGraph(EMPTY_GRAPH);
            setSection('workspaces');
          }}
          onDeleteBoard={async () => {
            await deleteWorkspaceBoard(user.uid, activeBoard);
            setActiveBoardId(null);
            setGraph(EMPTY_GRAPH);
            setSection('workspaces');
          }}
          onNotify={notify}
          onClose={() => setShowCollaboratorsModal(false)}
        />
      )}

      {/* Offline Mode Indicator */}
      {!isOnline && (
        <div className="fixed bottom-16 md:bottom-4 left-4 z-[65] flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          Offline Mode — Cached app loaded. Cloud sync will resume online.
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-16 md:bottom-5 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}
