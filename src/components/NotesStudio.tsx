import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Check,
  CheckSquare,
  Cloud,
  Crosshair,
  Folder,
  Link2,
  Loader2,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  ChecklistItem,
  GraphNode,
  NotePriority,
  NoteRecord,
  NoteType,
} from '../types/linkdraw';
import { makeSafeId } from '../lib/firestoreSync';

interface NotesStudioProps {
  uid: string;
  boardId: string | null;
  nodes: GraphNode[];
  notes: NoteRecord[];
  initialSelectedNodeId: string | null;
  onSaveNote: (note: NoteRecord, isNew: boolean, silent?: boolean) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onJumpToNode: (nodeId: string) => void;
  onCreateNodeFromNote: (note: NoteRecord) => Promise<void> | void;
}

type SyncState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const NOTE_TYPES: NoteType[] = ['Observation', 'Source', 'Lead', 'Analysis', 'Question', 'Action'];
const PRIORITIES: { value: NotePriority; label: string; ribbon: string }[] = [
  { value: 'urgent', label: 'Urgent', ribbon: 'bg-red-500' },
  { value: 'high', label: 'High', ribbon: 'bg-amber-500' },
  { value: 'normal', label: 'Normal', ribbon: 'bg-slate-400' },
  { value: 'low', label: 'Low', ribbon: 'bg-sky-500' },
];

function computeWords(txt: string): number {
  return txt.trim() ? txt.trim().split(/\s+/).length : 0;
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function formatSyncError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {
    // Plain error string
  }
  return raw || 'Unable to sync note to cloud.';
}

function notesDiffer(a: NoteRecord, b: NoteRecord): boolean {
  if (
    a.title !== b.title ||
    a.body !== b.body ||
    a.noteType !== b.noteType ||
    a.priority !== b.priority ||
    a.folder !== b.folder ||
    a.sourceUrl !== b.sourceUrl ||
    a.pinned !== b.pinned ||
    a.archived !== b.archived ||
    a.linkedNodeId !== b.linkedNodeId ||
    a.linkedNodeName !== b.linkedNodeName ||
    a.color !== b.color
  ) {
    return true;
  }
  if (a.tags.length !== b.tags.length || a.tags.some((t, i) => t !== b.tags[i])) {
    return true;
  }
  if (
    a.checklist.length !== b.checklist.length ||
    a.checklist.some((c, i) => c.text !== b.checklist[i].text || c.checked !== b.checklist[i].checked)
  ) {
    return true;
  }
  return false;
}

export const NotesStudio: React.FC<NotesStudioProps> = ({
  uid,
  boardId,
  nodes,
  notes,
  initialSelectedNodeId,
  onSaveNote,
  onDeleteNote,
  onJumpToNode,
  onCreateNodeFromNote,
}) => {
  const [folderFilter, setFolderFilter] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteRecord | null>(null);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [newCheckText, setNewCheckText] = useState('');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs for race-free auto-save & unmount flush
  const draftRef = useRef<NoteRecord | null>(null);
  const tagsTextRef = useRef('');
  const isNewDraftRef = useRef(false);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const onSaveNoteRef = useRef(onSaveNote);
  const mountedRef = useRef(true);
  const lastHandledNodeIdRef = useRef<string | null>(null);

  draftRef.current = draft;
  tagsTextRef.current = tagsText;
  isNewDraftRef.current = isNewDraft;
  onSaveNoteRef.current = onSaveNote;

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  const persistNote = useCallback(
    async (
      targetDraft: NoteRecord,
      targetTagsText: string,
      wasNew: boolean,
      silent = true
    ): Promise<boolean> => {
      if (inFlightRef.current) {
        queuedSaveRef.current = true;
        return false;
      }

      inFlightRef.current = true;
      queuedSaveRef.current = false;
      if (mountedRef.current) {
        setSyncState('saving');
        setSaveError(null);
      }

      const payload: NoteRecord = {
        ...targetDraft,
        tags: parseTags(targetTagsText),
        wordCount: computeWords(targetDraft.body),
        updatedAt: Date.now(),
      };

      try {
        await onSaveNoteRef.current(payload, wasNew, silent);
        dirtyRef.current = false;
        if (mountedRef.current) {
          setIsNewDraft(false);
          // Only update draft metadata if still on same note without newer queued edits
          if (draftRef.current?.id === payload.id && !queuedSaveRef.current) {
            setSyncState('saved');
          }
        }
        return true;
      } catch (err) {
        if (mountedRef.current) {
          setSyncState('error');
          setSaveError(formatSyncError(err));
        }
        return false;
      } finally {
        inFlightRef.current = false;
        if (queuedSaveRef.current && draftRef.current) {
          queuedSaveRef.current = false;
          void persistNote(
            draftRef.current,
            tagsTextRef.current,
            isNewDraftRef.current,
            true
          );
        }
      }
    },
    []
  );

  const flushPendingSave = useCallback(
    async (silent = true) => {
      clearAutoSaveTimer();
      if (dirtyRef.current && draftRef.current) {
        await persistNote(draftRef.current, tagsTextRef.current, isNewDraftRef.current, silent);
      }
    },
    [clearAutoSaveTimer, persistNote]
  );

  const scheduleAutoSave = useCallback(() => {
    clearAutoSaveTimer();
    dirtyRef.current = true;
    setSyncState('dirty');
    setSaveError(null);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (draftRef.current && dirtyRef.current) {
        void persistNote(draftRef.current, tagsTextRef.current, isNewDraftRef.current, true);
      }
    }, 650);
  }, [clearAutoSaveTimer, persistNote]);

  // Flush unsaved draft when component unmounts (e.g., switching to Canvas / Workspaces)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAutoSaveTimer();
      if (dirtyRef.current && draftRef.current) {
        const snapshot: NoteRecord = {
          ...draftRef.current,
          tags: parseTags(tagsTextRef.current),
          wordCount: computeWords(draftRef.current.body),
          updatedAt: Date.now(),
        };
        void onSaveNoteRef.current(snapshot, isNewDraftRef.current, true).catch(() => {});
      }
    };
  }, [clearAutoSaveTimer]);

  const selectExistingNote = useCallback(
    (note: NoteRecord) => {
      if (draftRef.current && draftRef.current.id !== note.id && dirtyRef.current) {
        void flushPendingSave(true);
      } else {
        clearAutoSaveTimer();
      }
      dirtyRef.current = false;
      setSelectedNoteId(note.id);
      setDraft({
        ...note,
        tags: [...note.tags],
        checklist: note.checklist.map((c) => ({ ...c })),
      });
      setTagsText(note.tags.join(', '));
      setIsNewDraft(false);
      setSyncState('saved');
      setSaveError(null);
    },
    [clearAutoSaveTimer, flushPendingSave]
  );

  const startNewNote = useCallback(
    (linkedNode?: GraphNode) => {
      if (draftRef.current && dirtyRef.current) {
        void flushPendingSave(true);
      } else {
        clearAutoSaveTimer();
      }
      const now = Date.now();
      const blank: NoteRecord = {
        id: makeSafeId('note'),
        ownerId: uid,
        boardId,
        title: linkedNode ? `${linkedNode.text} — Field Notes` : 'Untitled Note',
        body: linkedNode ? `## ${linkedNode.text}\n\nSummary and observations:\n- ` : '',
        noteType: 'Observation',
        sourceUrl: '',
        folder: folderFilter.startsWith('__') ? '' : folderFilter,
        tags: linkedNode ? [...linkedNode.tags] : [],
        priority: 'normal',
        color: '#ffffff',
        pinned: false,
        archived: false,
        linkedNodeId: linkedNode?.id ?? null,
        linkedNodeName: linkedNode?.text ?? null,
        checklist: [],
        wordCount: linkedNode ? computeWords(`## ${linkedNode.text}\n\nSummary and observations:\n- `) : 0,
        createdAt: now,
        updatedAt: now,
      };
      const initialTags = blank.tags.join(', ');
      setSelectedNoteId(blank.id);
      setDraft(blank);
      setTagsText(initialTags);
      setIsNewDraft(true);
      setSaveError(null);
      if (linkedNode) {
        // Persist node-linked note immediately so cross-navigation always preserves it
        dirtyRef.current = true;
        void persistNote(blank, initialTags, true, true);
      } else {
        dirtyRef.current = false;
        setSyncState('idle');
      }
    },
    [boardId, clearAutoSaveTimer, flushPendingSave, folderFilter, persistNote, uid]
  );

  // Sync if launched from Node Inspector for a specific node
  useEffect(() => {
    if (!initialSelectedNodeId) {
      lastHandledNodeIdRef.current = null;
      return;
    }
    if (lastHandledNodeIdRef.current === initialSelectedNodeId) return;
    const existing = notes.find((n) => n.linkedNodeId === initialSelectedNodeId);
    if (existing) {
      lastHandledNodeIdRef.current = initialSelectedNodeId;
      selectExistingNote(existing);
    } else {
      const targetNode = nodes.find((n) => n.id === initialSelectedNodeId);
      if (targetNode) {
        lastHandledNodeIdRef.current = initialSelectedNodeId;
        startNewNote(targetNode);
      }
    }
  }, [initialSelectedNodeId, nodes, notes, selectExistingNote, startNewNote]);

  // Two-way live sync: update open draft from Firestore when not locally dirty or saving
  useEffect(() => {
    if (!selectedNoteId) return;
    const remote = notes.find((n) => n.id === selectedNoteId);
    if (!remote) {
      if (!isNewDraft && !dirtyRef.current && !inFlightRef.current) {
        setDraft(null);
        setSelectedNoteId(null);
        setSyncState('idle');
      }
      return;
    }
    if (isNewDraft) {
      setIsNewDraft(false);
    }
    if (!dirtyRef.current && !inFlightRef.current && draftRef.current && notesDiffer(draftRef.current, remote)) {
      setDraft({
        ...remote,
        tags: [...remote.tags],
        checklist: remote.checklist.map((c) => ({ ...c })),
      });
      setTagsText(remote.tags.join(', '));
      setSyncState('saved');
    }
  }, [notes, selectedNoteId, isNewDraft]);

  const customFolders = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      if (n.folder && n.folder.trim()) set.add(n.folder.trim());
    }
    return [...set].sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (folderFilter === '__archived__') {
          if (!n.archived) return false;
        } else {
          if (n.archived) return false;
          if (folderFilter === '__pinned__' && !n.pinned) return false;
          if (
            folderFilter !== '__all__' &&
            folderFilter !== '__pinned__' &&
            n.folder !== folderFilter
          ) {
            return false;
          }
        }
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, folderFilter, search]);

  const updateDraftAndAutoSave = (updater: (prev: NoteRecord) => NoteRecord, immediate = false) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      draftRef.current = next;
      if (immediate) {
        clearAutoSaveTimer();
        dirtyRef.current = true;
        void persistNote(next, tagsTextRef.current, isNewDraftRef.current, true);
      } else {
        scheduleAutoSave();
      }
      return next;
    });
  };

  const handleManualSave = async () => {
    if (!draftRef.current) return;
    clearAutoSaveTimer();
    await persistNote(draftRef.current, tagsTextRef.current, isNewDraftRef.current, false);
  };

  const insertFormat = (snippet: string) => {
    updateDraftAndAutoSave((prev) => ({
      ...prev,
      body: prev.body ? `${prev.body}\n${snippet}` : snippet,
    }));
  };

  const addChecklistItem = () => {
    if (!draft || !newCheckText.trim()) return;
    const item: ChecklistItem = { text: newCheckText.trim().slice(0, 300), checked: false };
    setNewCheckText('');
    updateDraftAndAutoSave(
      (prev) => ({ ...prev, checklist: [...prev.checklist, item] }),
      true
    );
  };

  const toggleQuickPin = async (note: NoteRecord) => {
    const updated = { ...note, pinned: !note.pinned, updatedAt: Date.now() };
    if (draft?.id === note.id) {
      updateDraftAndAutoSave((prev) => ({ ...prev, pinned: !prev.pinned }), true);
    } else {
      try {
        await onSaveNote(updated, false, true);
      } catch (err) {
        setSaveError(formatSyncError(err));
      }
    }
  };

  const handleBackToListMobile = async () => {
    await flushPendingSave(true);
    setDraft(null);
    setSelectedNoteId(null);
    setSyncState('idle');
    setSaveError(null);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Left Column: Folders & Note Cards (full height on mobile when no note open) */}
      <div
        className={`w-full lg:w-[360px] xl:w-[400px] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col ${
          draft ? 'hidden lg:flex' : 'flex flex-1 lg:flex-none'
        } lg:h-full`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold">Notes Studio</h1>
            <button
              onClick={() => startNewNote()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-3.5 h-3.5" />
              New Note
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes by title, body, or tag..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Folder Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {[
              { id: '__all__', label: 'All' },
              { id: '__pinned__', label: 'Pinned' },
              { id: '__archived__', label: 'Archived' },
              ...customFolders.map((f) => ({ id: f, label: f })),
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFolderFilter(f.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  folderFilter === f.id
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {!f.id.startsWith('__') && <Folder className="w-3 h-3" />}
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes Card List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-8 px-4 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No notes in this folder yet.
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const prio = PRIORITIES.find((p) => p.value === note.priority) ?? PRIORITIES[2];
              const doneCount = note.checklist.filter((c) => c.checked).length;
              const isSelected = note.id === selectedNoteId;

              return (
                <div
                  key={note.id}
                  onClick={() => selectExistingNote(note)}
                  className={`rounded-xl border overflow-hidden cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Top Priority Color Ribbon */}
                  <div className={`h-1 w-full ${prio.ribbon}`} />
                  <div className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold line-clamp-1">{note.title}</div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleQuickPin(note);
                        }}
                        title={note.pinned ? 'Unpin' : 'Pin'}
                        className={`p-1 rounded ${
                          note.pinned ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{note.noteType}</span>
                      <span aria-hidden="true">·</span>
                      <span>{prio.label}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{note.wordCount} words</span>
                      {note.checklist.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-0.5 tabular-nums">
                            <CheckSquare className="w-3 h-3" />
                            {doneCount}/{note.checklist.length}
                          </span>
                        </>
                      )}
                    </div>

                    {note.linkedNodeId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void flushPendingSave(true);
                          onJumpToNode(note.linkedNodeId!);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <Crosshair className="w-3 h-3" />
                        Node: {note.linkedNodeName || note.linkedNodeId}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Full Note Editor */}
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${draft ? 'block' : 'hidden lg:block'}`}>
        {!draft ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto">
            <h2 className="text-lg font-semibold">Select or Create a Note</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Document intelligence leads, architecture decisions, and investigation checklists linked bi-directionally to your graph nodes. Changes auto-sync across devices.
            </p>
            <button
              onClick={() => startNewNote()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create First Note
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Mobile Back Bar + Sync Indicator */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={handleBackToListMobile}
                className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Notes ({filteredNotes.length})
              </button>
              <div className="ml-auto inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                {syncState === 'saving' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Syncing...</span>
                  </>
                )}
                {syncState === 'saved' && (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-400">Synced to cloud</span>
                  </>
                )}
                {syncState === 'dirty' && (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-amber-500" />
                    <span>Unsaved changes...</span>
                  </>
                )}
                {syncState === 'idle' && (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Auto-sync enabled</span>
                  </>
                )}
                {syncState === 'error' && (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">Sync error</span>
                  </>
                )}
              </div>
            </div>

            {saveError && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                <span className="truncate">Failed to save note: {saveError}</span>
                <button
                  type="button"
                  onClick={handleManualSave}
                  className="px-2.5 py-1 rounded bg-red-600 text-white font-medium shrink-0 hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Title & Top Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <input
                type="text"
                maxLength={200}
                value={draft.title}
                onChange={(e) =>
                  updateDraftAndAutoSave((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Note title..."
                className="flex-1 text-xl font-semibold bg-transparent border-b border-transparent focus:border-slate-300 dark:focus:border-slate-700 focus:outline-none py-1"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateDraftAndAutoSave((prev) => ({ ...prev, pinned: !prev.pinned }), true)
                  }
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border ${
                    draft.pinned
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                  {draft.pinned ? 'Pinned' : 'Pin'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateDraftAndAutoSave(
                      (prev) => ({ ...prev, archived: !prev.archived }),
                      true
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {draft.archived ? 'Unarchive' : 'Archive'}
                </button>
                {!isNewDraft && (
                  <button
                    type="button"
                    onClick={async () => {
                      clearAutoSaveTimer();
                      dirtyRef.current = false;
                      try {
                        await onDeleteNote(draft.id);
                        setDraft(null);
                        setSelectedNoteId(null);
                        setSyncState('idle');
                        setSaveError(null);
                      } catch (err) {
                        setSaveError(formatSyncError(err));
                      }
                    }}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Delete Note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleManualSave}
                  disabled={syncState === 'saving'}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {syncState === 'saving' ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>

            {/* Metadata Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Note Type</label>
                <select
                  value={draft.noteType}
                  onChange={(e) =>
                    updateDraftAndAutoSave(
                      (prev) => ({ ...prev, noteType: e.target.value as NoteType }),
                      true
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  {NOTE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Priority</label>
                <select
                  value={draft.priority}
                  onChange={(e) =>
                    updateDraftAndAutoSave(
                      (prev) => ({ ...prev, priority: e.target.value as NotePriority }),
                      true
                    )
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Folder</label>
                <input
                  type="text"
                  value={draft.folder}
                  onChange={(e) =>
                    updateDraftAndAutoSave((prev) => ({ ...prev, folder: e.target.value }))
                  }
                  placeholder="e.g. Security Ops"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1">Tags</label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(e) => {
                    const nextTags = e.target.value;
                    setTagsText(nextTags);
                    tagsTextRef.current = nextTags;
                    scheduleAutoSave();
                  }}
                  placeholder="triage, lead"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
            </div>

            {/* Source URL & Canvas Node Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Source URL</label>
                <input
                  type="url"
                  value={draft.sourceUrl}
                  onChange={(e) =>
                    updateDraftAndAutoSave((prev) => ({ ...prev, sourceUrl: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Linked Canvas Node</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={draft.linkedNodeId ?? ''}
                    onChange={(e) => {
                      const nid = e.target.value || null;
                      const found = nodes.find((n) => n.id === nid);
                      updateDraftAndAutoSave(
                        (prev) => ({
                          ...prev,
                          linkedNodeId: nid,
                          linkedNodeName: found?.text ?? null,
                        }),
                        true
                      );
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <option value="">None</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.text}
                      </option>
                    ))}
                  </select>
                  {draft.linkedNodeId ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await flushPendingSave(true);
                        onJumpToNode(draft.linkedNodeId!);
                      }}
                      title="Jump to Canvas Node"
                      className="px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Go
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        clearAutoSaveTimer();
                        dirtyRef.current = false;
                        const prepared: NoteRecord = {
                          ...draft,
                          tags: parseTags(tagsText),
                          wordCount: computeWords(draft.body),
                          updatedAt: Date.now(),
                        };
                        await onCreateNodeFromNote(prepared);
                      }}
                      title="Create Canvas Node from Note"
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      To Node
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Markdown Quick-Format Bar & Body */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => insertFormat('## Heading')}
                    className="px-2 py-1 text-xs font-medium rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    ## Heading
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormat('**Bold text**')}
                    className="px-2 py-1 text-xs font-semibold rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    Bold
                  </button>
                  <button
                    type="button"
                    onClick={() => insertFormat('- List item')}
                    className="px-2 py-1 text-xs font-medium rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                  >
                    • List
                  </button>
                </div>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {computeWords(draft.body)} words
                </span>
              </div>
              <textarea
                rows={10}
                value={draft.body}
                onChange={(e) =>
                  updateDraftAndAutoSave((prev) => ({ ...prev, body: e.target.value }))
                }
                placeholder="Write markdown observations, timelines, or architectural notes..."
                className="w-full p-3.5 text-sm bg-transparent focus:outline-none leading-relaxed"
              />
            </div>

            {/* Interactive Checklist */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Action Checklist</span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {draft.checklist.filter((c) => c.checked).length}/{draft.checklist.length} completed
                </span>
              </div>
              <div className="space-y-1.5">
                {draft.checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => {
                          updateDraftAndAutoSave(
                            (prev) => ({
                              ...prev,
                              checklist: prev.checklist.map((c, i) =>
                                i === idx ? { ...c, checked: !c.checked } : c
                              ),
                            }),
                            true
                          );
                        }}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <span className={item.checked ? 'line-through text-slate-400' : ''}>
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraftAndAutoSave(
                          (prev) => ({
                            ...prev,
                            checklist: prev.checklist.filter((_, i) => i !== idx),
                          }),
                          true
                        )
                      }
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCheckText}
                  onChange={(e) => setNewCheckText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                  placeholder="Add checklist task..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
