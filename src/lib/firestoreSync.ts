import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  BoardComment,
  CollabPresence,
  FreehandStroke,
  GraphDocument,
  GraphEdge,
  GraphNode,
  NoteRecord,
  StickyNote,
  WorkspaceBoard,
} from '../types/linkdraw';
import { db, handleFirestoreError, OperationType } from './firebase';
import { DEFAULT_LAYERS, DEFAULT_SETTINGS } from './templates';

export function makeSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object' && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  return Date.now();
}

export function encodeNodePayload(node: GraphNode): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    id: node.id,
    x: Math.round(node.x * 100) / 100,
    y: Math.round(node.y * 100) / 100,
    w: Math.round(node.w),
    h: Math.round(node.h),
    text: (node.text ?? '').slice(0, 1000),
    shape: node.shape ?? 'rounded',
    color: node.color ?? '#dbeafe',
    fs: node.fs ?? 13,
    icon: node.icon ?? '',
    iconPosition: node.iconPosition ?? 'inline',
    tags: (node.tags ?? []).slice(0, 20),
    metadata: node.metadata ?? {},
    progress: node.progress ?? null,
    badge: node.badge ?? null,
    collapsed: Boolean(node.collapsed),
    locked: Boolean(node.locked),
    layer: node.layer ?? 'Data',
    createdAtMs: node.createdAt ?? Date.now(),
    updatedAtMs: node.updatedAt ?? Date.now(),
  };

  if (node.textColor) payload.textColor = node.textColor;
  if (node.tableData) {
    payload.tableHeaders = (node.tableData.headers ?? []).slice(0, 15);
    payload.tableRows = (node.tableData.rows ?? []).slice(0, 50).map((row) => ({
      cells: row.map((c) => String(c ?? '')),
    }));
  }
  return payload;
}

export function decodeNodePayload(id: string, p: Record<string, unknown>): GraphNode {
  let tableData: GraphNode['tableData'] = null;
  const rawTableObj = (p.tableData ?? p.table_data) as Record<string, unknown> | null | undefined;
  if (rawTableObj && typeof rawTableObj === 'object') {
    const headers = Array.isArray(rawTableObj.headers) ? rawTableObj.headers.map(String) : ['Col 1', 'Col 2'];
    const rawRows = Array.isArray(rawTableObj.rows) ? rawTableObj.rows : [];
    const rows = rawRows.map((r) => {
      if (r && typeof r === 'object' && 'cells' in r && Array.isArray((r as { cells: unknown[] }).cells)) {
        return (r as { cells: unknown[] }).cells.map(String);
      }
      if (Array.isArray(r)) return r.map(String);
      return [];
    });
    tableData = { headers, rows };
  } else if (Array.isArray(p.tableHeaders) || Array.isArray(p.tableRows)) {
    const headers = Array.isArray(p.tableHeaders) ? p.tableHeaders.map(String) : ['Col 1', 'Col 2'];
    const rows = Array.isArray(p.tableRows)
      ? p.tableRows.map((r) => {
          if (r && typeof r === 'object' && 'cells' in r && Array.isArray((r as { cells: unknown[] }).cells)) {
            return (r as { cells: unknown[] }).cells.map(String);
          }
          if (Array.isArray(r)) return r.map(String);
          return [];
        })
      : [];
    tableData = { headers, rows };
  }

  const rawTextColor = p.textColor ?? p.text_color;
  const rawIconPosition = p.iconPosition ?? p.icon_position ?? 'inline';

  return {
    id: String(p.id ?? id),
    x: Number(p.x ?? 0),
    y: Number(p.y ?? 0),
    w: Number(p.w ?? 140),
    h: Number(p.h ?? 58),
    text: String(p.text ?? 'Node'),
    shape: (p.shape as GraphNode['shape']) ?? 'rounded',
    color: String(p.color ?? '#dbeafe'),
    textColor: rawTextColor ? String(rawTextColor) : undefined,
    fs: Number(p.fs ?? 13),
    icon: p.icon ? String(p.icon) : '',
    iconPosition: (rawIconPosition as GraphNode['iconPosition']) ?? 'inline',
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    metadata:
      p.metadata && typeof p.metadata === 'object'
        ? Object.fromEntries(
            Object.entries(p.metadata as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        : {},
    progress: p.progress !== null && p.progress !== undefined ? Number(p.progress) : null,
    badge: p.badge ? String(p.badge) : null,
    collapsed: Boolean(p.collapsed),
    locked: Boolean(p.locked),
    layer: (p.layer as GraphNode['layer']) ?? 'Data',
    tableData,
    createdAt: toMillis(p.createdAtMs ?? p.createdAt ?? p.created_at),
    updatedAt: toMillis(p.updatedAtMs ?? p.updatedAt ?? p.updated_at),
  };
}

export function encodeEdgePayload(edge: GraphEdge): Record<string, unknown> {
  return {
    id: edge.id,
    a: edge.a,
    b: edge.b,
    label: (edge.label ?? '').slice(0, 200),
    color: edge.color ?? '#475569',
    width: Number(edge.width ?? 2),
    arrow: edge.arrow ?? 'forward',
    type: edge.type ?? 'curved',
    lineStyle: edge.lineStyle ?? 'solid',
    weight: Number(edge.weight ?? 1),
    layer: edge.layer ?? 'Data',
    createdAtMs: edge.createdAt ?? Date.now(),
    updatedAtMs: edge.updatedAt ?? Date.now(),
  };
}

export function decodeEdgePayload(id: string, p: Record<string, unknown>): GraphEdge {
  return {
    id: String(p.id ?? id),
    a: String(p.a ?? ''),
    b: String(p.b ?? ''),
    label: String(p.label ?? ''),
    color: String(p.color ?? '#475569'),
    width: Number(p.width ?? 2),
    arrow: (p.arrow as GraphEdge['arrow']) ?? 'forward',
    type: (p.type as GraphEdge['type']) ?? 'curved',
    lineStyle: ((p.lineStyle ?? p.line_style) as GraphEdge['lineStyle']) ?? 'solid',
    weight: Number(p.weight ?? 1),
    layer: (p.layer as GraphEdge['layer']) ?? 'Data',
    createdAt: toMillis(p.createdAtMs ?? p.createdAt ?? p.created_at),
    updatedAt: toMillis(p.updatedAtMs ?? p.updatedAt ?? p.updated_at),
  };
}

export function encodeStickyPayload(sticky: StickyNote): Record<string, unknown> {
  return {
    id: sticky.id,
    x: Math.round(sticky.x * 100) / 100,
    y: Math.round(sticky.y * 100) / 100,
    w: Math.round(sticky.w),
    h: Math.round(sticky.h),
    text: (sticky.text ?? '').slice(0, 2000),
    color: sticky.color ?? '#fef08a',
    layer: sticky.layer ?? 'Annotations',
    createdAtMs: sticky.createdAt ?? Date.now(),
    updatedAtMs: sticky.updatedAt ?? Date.now(),
  };
}

export function decodeStickyPayload(id: string, p: Record<string, unknown>): StickyNote {
  return {
    id: String(p.id ?? id),
    x: Number(p.x ?? 0),
    y: Number(p.y ?? 0),
    w: Number(p.w ?? 170),
    h: Number(p.h ?? 110),
    text: String(p.text ?? ''),
    color: String(p.color ?? '#fef08a'),
    layer: (p.layer as StickyNote['layer']) ?? 'Annotations',
    createdAt: toMillis(p.createdAtMs ?? p.createdAt ?? p.created_at),
    updatedAt: toMillis(p.updatedAtMs ?? p.updatedAt ?? p.updated_at),
  };
}

export function encodeStrokePayload(stroke: FreehandStroke): Record<string, unknown> {
  // Downsample long strokes so Firestore payload stays compact
  const pts = stroke.points.length > 250
    ? stroke.points.filter((_, idx) => idx % 2 === 0 || idx === stroke.points.length - 1)
    : stroke.points;
  return {
    id: stroke.id,
    points: pts.map((pt) => ({ x: Math.round(pt.x * 10) / 10, y: Math.round(pt.y * 10) / 10 })),
    color: stroke.color,
    width: stroke.width,
    tool: stroke.tool,
    layer: stroke.layer ?? 'Annotations',
    createdAtMs: stroke.createdAt ?? Date.now(),
  };
}

export function decodeStrokePayload(id: string, p: Record<string, unknown>): FreehandStroke {
  return {
    id: String(p.id ?? id),
    points: Array.isArray(p.points)
      ? p.points.map((pt) =>
          Array.isArray(pt)
            ? { x: Number(pt[0] ?? 0), y: Number(pt[1] ?? 0) }
            : {
                x: Number((pt as { x: number }).x ?? 0),
                y: Number((pt as { y: number }).y ?? 0),
              }
        )
      : [],
    color: String(p.color ?? '#ef4444'),
    width: Number(p.width ?? 3),
    tool: p.tool === 'highlight' ? 'highlight' : 'pen',
    layer: (p.layer as FreehandStroke['layer']) ?? 'Annotations',
    createdAt: toMillis(p.createdAtMs ?? p.createdAt ?? p.created_at),
  };
}

// --- Subscriptions for Workspaces Home ---
export function subscribeCollabBoards(
  uid: string,
  onChange: (boards: WorkspaceBoard[]) => void
): Unsubscribe {
  const q = query(collection(db, 'collab_boards'), where('memberUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const boards: WorkspaceBoard[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          kind: 'shared',
          title: String(data.title ?? 'Untitled Shared Board'),
          description: String(data.description ?? ''),
          ownerId: String(data.ownerId ?? data.owner_id ?? ''),
          ownerName: String(data.ownerName ?? data.owner_name ?? 'Owner'),
          inviteCode: String(data.inviteCode ?? data.invite_code ?? ''),
          memberUids: Array.isArray(data.memberUids)
            ? data.memberUids.map(String)
            : Array.isArray(data.member_uids)
            ? data.member_uids.map(String)
            : [],
          memberNames: ((data.memberNames ?? data.member_names) as Record<string, string>) ?? {},
          gridSnap: Boolean(data.gridSnap ?? data.grid_snap ?? true),
          gridSize: Number(data.gridSize ?? data.grid_size ?? 20),
          flowAnimation: Boolean(data.flowAnimation ?? data.flow_animation ?? true),
          createdAt: toMillis(data.createdAt ?? data.created_at),
          updatedAt: toMillis(data.updatedAt ?? data.updated_at),
        };
      });
      onChange(boards);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'collab_boards')
  );
}

export function subscribePersonalBoards(
  uid: string,
  onChange: (boards: WorkspaceBoard[]) => void
): Unsubscribe {
  const path = `users/${uid}/personal_boards`;
  // Avoid Firestore orderBy('updatedAt') so mobile docs lacking updatedAt are still returned
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const boards: WorkspaceBoard[] = snap.docs
        .map((d) => {
          const data = d.data();
          const rawGraph = ((data.graphData ?? data.graph_data ?? data) as Record<string, unknown>) ?? {};
          const rawNodes = Array.isArray(rawGraph.nodes) ? rawGraph.nodes : [];
          const rawEdges = Array.isArray(rawGraph.edges)
            ? rawGraph.edges
            : Array.isArray(rawGraph.conns)
            ? rawGraph.conns
            : [];
          const rawStickies = Array.isArray(rawGraph.stickies)
            ? rawGraph.stickies
            : Array.isArray(rawGraph.sticky_notes)
            ? rawGraph.sticky_notes
            : [];
          const rawStrokes = Array.isArray(rawGraph.strokes)
            ? rawGraph.strokes
            : Array.isArray(rawGraph.freehand_strokes)
            ? rawGraph.freehand_strokes
            : [];

          const nodes = rawNodes.map((n, i) => decodeNodePayload(`n_${i}`, n as Record<string, unknown>));
          const edges = rawEdges.map((e, i) => decodeEdgePayload(`e_${i}`, e as Record<string, unknown>));
          const stickies = rawStickies.map((s, i) => decodeStickyPayload(`s_${i}`, s as Record<string, unknown>));
          const strokes = rawStrokes.map((st, i) => decodeStrokePayload(`st_${i}`, st as Record<string, unknown>));
          const rawSettings = ((rawGraph.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
          const settings: GraphDocument['settings'] = {
            gridSnap: Boolean(rawSettings.gridSnap ?? rawSettings.grid_snap ?? DEFAULT_SETTINGS.gridSnap),
            gridSize: Number(rawSettings.gridSize ?? rawSettings.grid_size ?? DEFAULT_SETTINGS.gridSize),
            flowAnimation: Boolean(
              rawSettings.flowAnimation ?? rawSettings.flow_animation ?? DEFAULT_SETTINGS.flowAnimation
            ),
          };
          const layers = Array.isArray(rawGraph.layers)
            ? (rawGraph.layers as GraphDocument['layers'])
            : DEFAULT_LAYERS.map((l) => ({ ...l }));

          return {
            id: d.id,
            kind: 'personal' as const,
            title: String(data.title ?? 'Untitled Board'),
            description: String(data.description ?? ''),
            ownerId: String(data.ownerId ?? data.owner_id ?? uid),
            ownerName: 'You',
            gridSnap: settings.gridSnap,
            gridSize: settings.gridSize,
            flowAnimation: settings.flowAnimation,
            createdAt: toMillis(data.createdAt ?? data.created_at),
            updatedAt: toMillis(data.updatedAt ?? data.updated_at),
            graphData: { nodes, edges, stickies, strokes, layers, settings },
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
      onChange(boards);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function fetchCollabBoardGraph(board: WorkspaceBoard): Promise<GraphDocument> {
  const path = `collab_boards/${board.id}/elements`;
  try {
    const snap = await getDocs(collection(db, path));
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const stickies: StickyNote[] = [];
    const strokes: FreehandStroke[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      const kind = String(data.kind ?? '');
      const payload = (data.payload as Record<string, unknown>) ?? {};
      if (kind === 'node') nodes.push(decodeNodePayload(d.id, payload));
      else if (kind === 'edge') edges.push(decodeEdgePayload(d.id, payload));
      else if (kind === 'sticky') stickies.push(decodeStickyPayload(d.id, payload));
      else if (kind === 'stroke') strokes.push(decodeStrokePayload(d.id, payload));
    }
    return {
      nodes,
      edges,
      stickies,
      strokes,
      layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
      settings: {
        gridSnap: board.gridSnap,
        gridSize: board.gridSize,
        flowAnimation: board.flowAnimation,
      },
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// --- Create / Duplicate / Join / Delete Workspaces ---
export async function createCollabBoard(
  uid: string,
  displayName: string,
  title: string,
  description: string,
  initialGraph: GraphDocument
): Promise<WorkspaceBoard> {
  const boardId = makeSafeId('cb');
  const inviteCode = generateInviteCode();
  const safeTitle = (title.trim() || 'Untitled Shared Board').slice(0, 160);
  const safeDesc = description.trim().slice(0, 1000);
  const safeName = (displayName || 'User').slice(0, 120);

  const batch1 = writeBatch(db);
  batch1.set(doc(db, 'collab_boards', boardId), {
    ownerId: uid,
    ownerName: safeName,
    title: safeTitle,
    description: safeDesc,
    inviteCode,
    memberUids: [uid],
    memberNames: { [uid]: safeName },
    gridSnap: initialGraph.settings.gridSnap,
    gridSize: initialGraph.settings.gridSize,
    flowAnimation: initialGraph.settings.flowAnimation,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch1.set(doc(db, 'board_invites', inviteCode), {
    boardId,
    ownerId: uid,
    title: safeTitle,
    createdAt: serverTimestamp(),
  });

  try {
    await batch1.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `collab_boards/${boardId}`);
  }

  // Write initial template elements in a second batch so Master Gate exists() passes
  const batch2 = writeBatch(db);
  const elemCol = collection(db, `collab_boards/${boardId}/elements`);
  for (const n of initialGraph.nodes) {
    batch2.set(doc(elemCol, n.id), {
      kind: 'node',
      payload: encodeNodePayload(n),
      updatedByUid: uid,
      updatedByName: safeName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  for (const e of initialGraph.edges) {
    batch2.set(doc(elemCol, e.id), {
      kind: 'edge',
      payload: encodeEdgePayload(e),
      updatedByUid: uid,
      updatedByName: safeName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  for (const s of initialGraph.stickies) {
    batch2.set(doc(elemCol, s.id), {
      kind: 'sticky',
      payload: encodeStickyPayload(s),
      updatedByUid: uid,
      updatedByName: safeName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  for (const st of initialGraph.strokes) {
    batch2.set(doc(elemCol, st.id), {
      kind: 'stroke',
      payload: encodeStrokePayload(st),
      updatedByUid: uid,
      updatedByName: safeName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch2.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `collab_boards/${boardId}/elements`);
  }

  return {
    id: boardId,
    kind: 'shared',
    title: safeTitle,
    description: safeDesc,
    ownerId: uid,
    ownerName: safeName,
    inviteCode,
    memberUids: [uid],
    memberNames: { [uid]: safeName },
    gridSnap: initialGraph.settings.gridSnap,
    gridSize: initialGraph.settings.gridSize,
    flowAnimation: initialGraph.settings.flowAnimation,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export async function createPersonalBoard(
  uid: string,
  title: string,
  description: string,
  graph: GraphDocument
): Promise<WorkspaceBoard> {
  const boardId = makeSafeId('pb');
  const safeTitle = (title.trim() || 'Untitled Personal Board').slice(0, 160);
  const safeDesc = description.trim().slice(0, 1000);
  const path = `users/${uid}/personal_boards/${boardId}`;
  const encodedGraph = {
    nodes: graph.nodes.map(encodeNodePayload),
    edges: graph.edges.map(encodeEdgePayload),
    stickies: graph.stickies.map(encodeStickyPayload),
    strokes: graph.strokes.map(encodeStrokePayload),
    layers: graph.layers,
    settings: graph.settings,
  };

  try {
    await setDoc(doc(db, path), {
      ownerId: uid,
      title: safeTitle,
      description: safeDesc,
      graphData: encodedGraph,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return {
    id: boardId,
    kind: 'personal',
    title: safeTitle,
    description: safeDesc,
    ownerId: uid,
    ownerName: 'You',
    gridSnap: graph.settings.gridSnap,
    gridSize: graph.settings.gridSize,
    flowAnimation: graph.settings.flowAnimation,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    graphData: graph,
  };
}

export async function savePersonalBoardGraph(
  uid: string,
  boardId: string,
  title: string,
  description: string,
  graph: GraphDocument
): Promise<void> {
  const path = `users/${uid}/personal_boards/${boardId}`;
  try {
    await updateDoc(doc(db, path), {
      title: title.slice(0, 160),
      description: description.slice(0, 1000),
      graphData: {
        nodes: graph.nodes.map(encodeNodePayload),
        edges: graph.edges.map(encodeEdgePayload),
        stickies: graph.stickies.map(encodeStickyPayload),
        strokes: graph.strokes.map(encodeStrokePayload),
        layers: graph.layers,
        settings: graph.settings,
      },
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function joinCollabBoardByCode(
  inviteCodeRaw: string,
  uid: string,
  displayName: string
): Promise<string> {
  const code = inviteCodeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    throw new Error('Invite code must be 6 alphanumeric characters.');
  }

  let inviteSnap;
  try {
    inviteSnap = await getDoc(doc(db, 'board_invites', code));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `board_invites/${code}`);
  }

  if (!inviteSnap.exists()) {
    throw new Error(`No shared board found for invite code "${code}".`);
  }

  const boardId = String(inviteSnap.data().boardId);
  const safeName = (displayName || 'Collaborator').slice(0, 120);

  try {
    await updateDoc(doc(db, 'collab_boards', boardId), {
      memberUids: arrayUnion(uid),
      [`memberNames.${uid}`]: safeName,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    // Check if already a member (rule rejects join if already in memberUids)
    try {
      const existing = await getDoc(doc(db, 'collab_boards', boardId));
      if (existing.exists() && Array.isArray(existing.data().memberUids) && existing.data().memberUids.includes(uid)) {
        return boardId;
      }
    } catch {
      // ignore fallback check
    }
    handleFirestoreError(err, OperationType.UPDATE, `collab_boards/${boardId}`);
  }
  return boardId;
}

export async function renameCollabBoard(boardId: string, title: string, description: string) {
  try {
    await updateDoc(doc(db, 'collab_boards', boardId), {
      title: title.slice(0, 160),
      description: description.slice(0, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `collab_boards/${boardId}`);
  }
}

export async function updateCollabBoardSettings(
  boardId: string,
  settings: { gridSnap: boolean; gridSize: number; flowAnimation: boolean }
) {
  try {
    await updateDoc(doc(db, 'collab_boards', boardId), {
      gridSnap: settings.gridSnap,
      gridSize: settings.gridSize,
      flowAnimation: settings.flowAnimation,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `collab_boards/${boardId}`);
  }
}

export async function removeCollabMember(
  boardId: string,
  targetUid: string,
  currentMemberNames: Record<string, string>
) {
  const nextNames = { ...currentMemberNames };
  delete nextNames[targetUid];
  try {
    await updateDoc(doc(db, 'collab_boards', boardId), {
      memberUids: arrayRemove(targetUid),
      memberNames: nextNames,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `collab_boards/${boardId}`);
  }
}

export async function leaveCollabBoard(
  boardId: string,
  uid: string,
  currentMemberNames: Record<string, string>
) {
  return removeCollabMember(boardId, uid, currentMemberNames);
}

export async function deleteWorkspaceBoard(uid: string, board: WorkspaceBoard) {
  if (board.kind === 'personal') {
    const path = `users/${uid}/personal_boards/${board.id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    return;
  }

  // Collab board deletion by owner
  try {
    const elems = await getDocs(collection(db, `collab_boards/${board.id}/elements`));
    const comments = await getDocs(collection(db, `collab_boards/${board.id}/comments`));
    const pres = await getDocs(collection(db, `collab_boards/${board.id}/presence`));
    const batch = writeBatch(db);
    elems.docs.forEach((d) => batch.delete(d.ref));
    comments.docs.forEach((d) => batch.delete(d.ref));
    pres.docs.forEach((d) => batch.delete(d.ref));
    if (board.inviteCode) {
      batch.delete(doc(db, 'board_invites', board.inviteCode));
    }
    batch.delete(doc(db, 'collab_boards', board.id));
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `collab_boards/${board.id}`);
  }
}

// --- Real-Time Board Elements Sync ---
export function subscribeCollabElements(
  boardId: string,
  onChange: (elements: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stickies: StickyNote[];
    strokes: FreehandStroke[];
    rawHashes: Map<string, string>;
  }) => void
): Unsubscribe {
  const path = `collab_boards/${boardId}/elements`;
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const stickies: StickyNote[] = [];
      const strokes: FreehandStroke[] = [];
      const rawHashes = new Map<string, string>();

      for (const d of snap.docs) {
        const data = d.data();
        const kind = String(data.kind ?? '');
        const payload = (data.payload as Record<string, unknown>) ?? {};
        rawHashes.set(d.id, JSON.stringify({ kind, payload }));
        if (kind === 'node') nodes.push(decodeNodePayload(d.id, payload));
        else if (kind === 'edge') edges.push(decodeEdgePayload(d.id, payload));
        else if (kind === 'sticky') stickies.push(decodeStickyPayload(d.id, payload));
        else if (kind === 'stroke') strokes.push(decodeStrokePayload(d.id, payload));
      }

      onChange({ nodes, edges, stickies, strokes, rawHashes });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function syncCollabElementDiff(
  boardId: string,
  uid: string,
  displayName: string,
  graph: GraphDocument,
  lastSyncedHashes: Map<string, string>
): Promise<Map<string, string>> {
  const path = `collab_boards/${boardId}/elements`;
  const elemCol = collection(db, path);
  const safeName = (displayName || 'User').slice(0, 120);

  const nextMap = new Map<string, { kind: 'node' | 'edge' | 'sticky' | 'stroke'; payload: Record<string, unknown>; hash: string }>();

  for (const n of graph.nodes) {
    const payload = encodeNodePayload(n);
    nextMap.set(n.id, { kind: 'node', payload, hash: JSON.stringify({ kind: 'node', payload }) });
  }
  for (const e of graph.edges) {
    const payload = encodeEdgePayload(e);
    nextMap.set(e.id, { kind: 'edge', payload, hash: JSON.stringify({ kind: 'edge', payload }) });
  }
  for (const s of graph.stickies) {
    const payload = encodeStickyPayload(s);
    nextMap.set(s.id, { kind: 'sticky', payload, hash: JSON.stringify({ kind: 'sticky', payload }) });
  }
  for (const st of graph.strokes) {
    const payload = encodeStrokePayload(st);
    nextMap.set(st.id, { kind: 'stroke', payload, hash: JSON.stringify({ kind: 'stroke', payload }) });
  }

  const batch = writeBatch(db);
  let opCount = 0;

  // Creates & updates
  for (const [id, entry] of nextMap.entries()) {
    const prevHash = lastSyncedHashes.get(id);
    if (prevHash === entry.hash) continue;
    const ref = doc(elemCol, id);
    if (prevHash === undefined) {
      batch.set(ref, {
        kind: entry.kind,
        payload: entry.payload,
        updatedByUid: uid,
        updatedByName: safeName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(ref, {
        kind: entry.kind,
        payload: entry.payload,
        updatedByUid: uid,
        updatedByName: safeName,
        updatedAt: serverTimestamp(),
      });
    }
    opCount++;
  }

  // Deletes
  for (const prevId of lastSyncedHashes.keys()) {
    if (!nextMap.has(prevId)) {
      batch.delete(doc(elemCol, prevId));
      opCount++;
    }
  }

  if (opCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  const updatedHashes = new Map<string, string>();
  for (const [id, entry] of nextMap.entries()) {
    updatedHashes.set(id, entry.hash);
  }
  return updatedHashes;
}

// --- Real-Time Presence ---
const PRESENCE_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function pickPresenceColor(uid: string): string {
  let sum = 0;
  for (let i = 0; i < uid.length; i++) sum += uid.charCodeAt(i);
  return PRESENCE_COLORS[sum % PRESENCE_COLORS.length];
}

export function subscribePresence(
  boardId: string,
  onChange: (items: CollabPresence[]) => void
): Unsubscribe {
  const path = `collab_boards/${boardId}/presence`;
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const now = Date.now();
      const items: CollabPresence[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid ?? d.id),
            displayName: String(data.displayName ?? 'Collaborator'),
            colorHex: String(data.colorHex ?? '#2563eb'),
            selectedNodeId: data.selectedNodeId ? String(data.selectedNodeId) : null,
            activeTab: String(data.activeTab ?? 'canvas'),
            updatedAt: toMillis(data.updatedAt),
          };
        })
        .filter((p) => now - p.updatedAt < 120000);
      onChange(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function upsertPresence(
  boardId: string,
  uid: string,
  displayName: string,
  selectedNodeId: string | null,
  activeTab: string
) {
  const path = `collab_boards/${boardId}/presence/${uid}`;
  const ref = doc(db, path);
  const colorHex = pickPresenceColor(uid);
  const safeName = (displayName || 'User').slice(0, 120);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        displayName: safeName,
        colorHex,
        selectedNodeId: selectedNodeId ?? null,
        activeTab: activeTab.slice(0, 40),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: safeName,
        colorHex,
        selectedNodeId: selectedNodeId ?? null,
        activeTab: activeTab.slice(0, 40),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// --- Real-Time Comments ---
export function subscribeBoardComments(
  boardId: string,
  onChange: (comments: BoardComment[]) => void
): Unsubscribe {
  const path = `collab_boards/${boardId}/comments`;
  const q = query(collection(db, path), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const comments: BoardComment[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          authorId: String(data.authorId ?? ''),
          authorName: String(data.authorName ?? 'User'),
          text: String(data.text ?? ''),
          linkedNodeId: data.linkedNodeId ? String(data.linkedNodeId) : null,
          linkedNodeLabel: data.linkedNodeLabel ? String(data.linkedNodeLabel) : null,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });
      onChange(comments);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function addBoardComment(
  boardId: string,
  authorId: string,
  authorName: string,
  text: string,
  linkedNodeId: string | null,
  linkedNodeLabel: string | null
) {
  const commentId = makeSafeId('cmt');
  const path = `collab_boards/${boardId}/comments/${commentId}`;
  try {
    await setDoc(doc(db, path), {
      authorId,
      authorName: (authorName || 'User').slice(0, 120),
      text: text.trim().slice(0, 2000),
      linkedNodeId: linkedNodeId ?? null,
      linkedNodeLabel: linkedNodeLabel ? linkedNodeLabel.slice(0, 200) : null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteBoardComment(boardId: string, commentId: string) {
  const path = `collab_boards/${boardId}/comments/${commentId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- Notes Studio CRUD ---
export function subscribeUserNotes(
  uid: string,
  onChange: (notes: NoteRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/notes`;
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const notes: NoteRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId ?? data.owner_id ?? uid),
            boardId: data.boardId ? String(data.boardId) : data.board_id ? String(data.board_id) : null,
            title: String(data.title ?? 'Untitled Note'),
            body: String(data.body ?? ''),
            noteType: ((data.noteType ?? data.note_type) as NoteRecord['noteType']) ?? 'Observation',
            sourceUrl: String(data.sourceUrl ?? data.source_url ?? ''),
            folder: String(data.folder ?? ''),
            tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
            priority: (data.priority as NoteRecord['priority']) ?? 'normal',
            color: String(data.color ?? '#ffffff'),
            pinned: Boolean(data.pinned),
            archived: Boolean(data.archived),
            linkedNodeId: data.linkedNodeId
              ? String(data.linkedNodeId)
              : data.linked_node_id
              ? String(data.linked_node_id)
              : null,
            linkedNodeName: data.linkedNodeName
              ? String(data.linkedNodeName)
              : data.linked_node_name
              ? String(data.linked_node_name)
              : null,
            checklist: Array.isArray(data.checklist)
              ? data.checklist.map((item) => ({
                  text: String((item as { text?: string }).text ?? ''),
                  checked: Boolean((item as { checked?: boolean }).checked),
                }))
              : [],
            wordCount: Number(data.wordCount ?? data.word_count ?? 0),
            createdAt: toMillis(data.createdAt ?? data.created_at),
            updatedAt: toMillis(data.updatedAt ?? data.updated_at),
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
      onChange(notes);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function saveUserNote(uid: string, note: NoteRecord, isNew: boolean): Promise<void> {
  const path = `users/${uid}/notes/${note.id}`;
  const cleanPayload = {
    ownerId: uid,
    boardId: note.boardId ?? null,
    title: (note.title.trim() || 'Untitled Note').slice(0, 200),
    body: note.body.slice(0, 50000),
    noteType: note.noteType,
    sourceUrl: note.sourceUrl.slice(0, 1000),
    folder: note.folder.slice(0, 100),
    tags: note.tags.slice(0, 20),
    priority: note.priority,
    color: note.color.slice(0, 16),
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    linkedNodeId: note.linkedNodeId ?? null,
    linkedNodeName: note.linkedNodeName ? note.linkedNodeName.slice(0, 200) : null,
    checklist: note.checklist.slice(0, 100).map((c) => ({ text: c.text.slice(0, 300), checked: Boolean(c.checked) })),
    wordCount: Math.max(0, Math.min(100000, note.wordCount)),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, path), { ...cleanPayload, createdAt: serverTimestamp() });
    } else {
      await updateDoc(doc(db, path), cleanPayload);
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteUserNote(uid: string, noteId: string): Promise<void> {
  const path = `users/${uid}/notes/${noteId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
