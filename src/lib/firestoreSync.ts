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

export function sanitizeElementId(id: string, prefix = 'el'): string {
  const raw = String(id ?? '').trim();
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(raw)) return raw;
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : makeSafeId(prefix);
}

function finiteNum(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function stableStringify(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map((item) => (item === undefined ? 'null' : stableStringify(item))).join(',')}]`;
  }
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
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
  const safeProgress =
    node.progress !== null && node.progress !== undefined && Number.isFinite(Number(node.progress))
      ? Number(node.progress)
      : null;

  const payload: Record<string, unknown> = {
    id: String(node.id),
    x: Math.round(finiteNum(node.x, 0) * 100) / 100 || 0,
    y: Math.round(finiteNum(node.y, 0) * 100) / 100 || 0,
    w: Math.max(20, Math.round(finiteNum(node.w, 140))),
    h: Math.max(20, Math.round(finiteNum(node.h, 58))),
    text: String(node.text ?? '').slice(0, 1000),
    shape: node.shape ?? 'rounded',
    color: String(node.color ?? '#dbeafe'),
    fs: Math.max(8, finiteNum(node.fs, 13)),
    icon: String(node.icon ?? ''),
    iconPosition: node.iconPosition ?? 'inline',
    tags: (node.tags ?? []).slice(0, 20).map(String),
    metadata: node.metadata
      ? Object.fromEntries(Object.entries(node.metadata).map(([k, v]) => [String(k), String(v ?? '')]))
      : {},
    progress: safeProgress,
    badge: node.badge ? String(node.badge) : null,
    collapsed: Boolean(node.collapsed),
    locked: Boolean(node.locked),
    layer: node.layer ?? 'Data',
    createdAtMs: finiteNum(node.createdAt, Date.now()),
    updatedAtMs: finiteNum(node.updatedAt, Date.now()),
  };

  if (node.textColor) payload.textColor = String(node.textColor);
  if (node.tableData) {
    payload.tableHeaders = (node.tableData.headers ?? []).slice(0, 15).map(String);
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
    id: String(edge.id),
    a: String(edge.a),
    b: String(edge.b),
    label: String(edge.label ?? '').slice(0, 200),
    color: String(edge.color ?? '#475569'),
    width: Math.max(0.5, finiteNum(edge.width, 2)),
    arrow: edge.arrow ?? 'forward',
    type: edge.type ?? 'curved',
    lineStyle: edge.lineStyle ?? 'solid',
    weight: finiteNum(edge.weight, 1),
    layer: edge.layer ?? 'Data',
    createdAtMs: finiteNum(edge.createdAt, Date.now()),
    updatedAtMs: finiteNum(edge.updatedAt, Date.now()),
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
    id: String(sticky.id),
    x: Math.round(finiteNum(sticky.x, 0) * 100) / 100 || 0,
    y: Math.round(finiteNum(sticky.y, 0) * 100) / 100 || 0,
    w: Math.max(40, Math.round(finiteNum(sticky.w, 170))),
    h: Math.max(40, Math.round(finiteNum(sticky.h, 110))),
    text: String(sticky.text ?? '').slice(0, 2000),
    color: String(sticky.color ?? '#fef08a'),
    layer: sticky.layer ?? 'Annotations',
    createdAtMs: finiteNum(sticky.createdAt, Date.now()),
    updatedAtMs: finiteNum(sticky.updatedAt, Date.now()),
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
    id: String(stroke.id),
    points: pts.map((pt) => ({
      x: Math.round(finiteNum(pt.x, 0) * 10) / 10 || 0,
      y: Math.round(finiteNum(pt.y, 0) * 10) / 10 || 0,
    })),
    color: String(stroke.color ?? '#ef4444'),
    width: Math.max(1, finiteNum(stroke.width, 3)),
    tool: stroke.tool === 'highlight' ? 'highlight' : 'pen',
    layer: stroke.layer ?? 'Annotations',
    createdAtMs: finiteNum(stroke.createdAt, Date.now()),
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

  // Write initial template elements in chunked batches so Master Gate exists() passes
  const elemCol = collection(db, `collab_boards/${boardId}/elements`);
  const initialWrites: { docId: string; data: Record<string, unknown> }[] = [];

  for (const n of initialGraph.nodes) {
    initialWrites.push({
      docId: sanitizeElementId(n.id, 'n'),
      data: {
        kind: 'node',
        payload: encodeNodePayload(n),
        updatedByUid: uid,
        updatedByName: safeName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }
  for (const e of initialGraph.edges) {
    initialWrites.push({
      docId: sanitizeElementId(e.id, 'e'),
      data: {
        kind: 'edge',
        payload: encodeEdgePayload(e),
        updatedByUid: uid,
        updatedByName: safeName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }
  for (const s of initialGraph.stickies) {
    initialWrites.push({
      docId: sanitizeElementId(s.id, 's'),
      data: {
        kind: 'sticky',
        payload: encodeStickyPayload(s),
        updatedByUid: uid,
        updatedByName: safeName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }
  for (const st of initialGraph.strokes) {
    initialWrites.push({
      docId: sanitizeElementId(st.id, 'st'),
      data: {
        kind: 'stroke',
        payload: encodeStrokePayload(st),
        updatedByUid: uid,
        updatedByName: safeName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  try {
    for (let i = 0; i < initialWrites.length; i += 400) {
      const chunk = initialWrites.slice(i, i + 400);
      const batch2 = writeBatch(db);
      for (const item of chunk) {
        batch2.set(doc(elemCol, item.docId), item.data);
      }
      await batch2.commit();
    }
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
export interface CollabElementMeta {
  docId: string;
  hash: string;
  existsOnServer: boolean;
  canonical: boolean;
  createdAtTs: Timestamp | null;
}

const CANONICAL_ELEMENT_KEYS = new Set([
  'kind',
  'payload',
  'updatedByUid',
  'updatedByName',
  'createdAt',
  'updatedAt',
]);

function isCanonicalElementDoc(data: Record<string, unknown>): boolean {
  return (
    data.createdAt instanceof Timestamp &&
    typeof data.updatedByUid === 'string' &&
    typeof data.updatedByName === 'string' &&
    Object.keys(data).every((k) => CANONICAL_ELEMENT_KEYS.has(k))
  );
}

export function buildCollabMetaFromGraph(graph: GraphDocument): Map<string, CollabElementMeta> {
  const meta = new Map<string, CollabElementMeta>();
  for (const n of graph.nodes) {
    const payload = encodeNodePayload(n);
    meta.set(n.id, {
      docId: sanitizeElementId(n.id, 'n'),
      hash: stableStringify({ kind: 'node', payload }),
      existsOnServer: true,
      canonical: true,
      createdAtTs: null,
    });
  }
  for (const e of graph.edges) {
    const payload = encodeEdgePayload(e);
    meta.set(e.id, {
      docId: sanitizeElementId(e.id, 'e'),
      hash: stableStringify({ kind: 'edge', payload }),
      existsOnServer: true,
      canonical: true,
      createdAtTs: null,
    });
  }
  for (const s of graph.stickies) {
    const payload = encodeStickyPayload(s);
    meta.set(s.id, {
      docId: sanitizeElementId(s.id, 's'),
      hash: stableStringify({ kind: 'sticky', payload }),
      existsOnServer: true,
      canonical: true,
      createdAtTs: null,
    });
  }
  for (const st of graph.strokes) {
    const payload = encodeStrokePayload(st);
    meta.set(st.id, {
      docId: sanitizeElementId(st.id, 'st'),
      hash: stableStringify({ kind: 'stroke', payload }),
      existsOnServer: true,
      canonical: true,
      createdAtTs: null,
    });
  }
  return meta;
}

export function subscribeCollabElements(
  boardId: string,
  onChange: (elements: {
    nodes: GraphNode[];
    edges: GraphEdge[];
    stickies: StickyNote[];
    strokes: FreehandStroke[];
    elementMeta: Map<string, CollabElementMeta>;
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
      const elementMeta = new Map<string, CollabElementMeta>();

      for (const d of snap.docs) {
        const data = d.data();
        const kind = String(data.kind ?? '');
        const payload = (data.payload as Record<string, unknown>) ?? {};
        const canonical = isCanonicalElementDoc(data);
        const createdAtTs = data.createdAt instanceof Timestamp ? data.createdAt : null;

        if (kind === 'node') {
          const decoded = decodeNodePayload(d.id, payload);
          nodes.push(decoded);
          elementMeta.set(decoded.id, {
            docId: d.id,
            hash: stableStringify({ kind: 'node', payload: encodeNodePayload(decoded) }),
            existsOnServer: true,
            canonical,
            createdAtTs,
          });
        } else if (kind === 'edge') {
          const decoded = decodeEdgePayload(d.id, payload);
          edges.push(decoded);
          elementMeta.set(decoded.id, {
            docId: d.id,
            hash: stableStringify({ kind: 'edge', payload: encodeEdgePayload(decoded) }),
            existsOnServer: true,
            canonical,
            createdAtTs,
          });
        } else if (kind === 'sticky') {
          const decoded = decodeStickyPayload(d.id, payload);
          stickies.push(decoded);
          elementMeta.set(decoded.id, {
            docId: d.id,
            hash: stableStringify({ kind: 'sticky', payload: encodeStickyPayload(decoded) }),
            existsOnServer: true,
            canonical,
            createdAtTs,
          });
        } else if (kind === 'stroke') {
          const decoded = decodeStrokePayload(d.id, payload);
          strokes.push(decoded);
          elementMeta.set(decoded.id, {
            docId: d.id,
            hash: stableStringify({ kind: 'stroke', payload: encodeStrokePayload(decoded) }),
            existsOnServer: true,
            canonical,
            createdAtTs,
          });
        }
      }

      onChange({ nodes, edges, stickies, strokes, elementMeta });
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

type QueuedElementWrite =
  | { kind: 'set'; docId: string; data: Record<string, unknown> }
  | { kind: 'update'; docId: string; data: Record<string, unknown> }
  | { kind: 'delete'; docId: string };

export async function syncCollabElementDiff(
  boardId: string,
  uid: string,
  displayName: string,
  graph: GraphDocument,
  lastSyncedMeta: Map<string, CollabElementMeta>
): Promise<Map<string, CollabElementMeta>> {
  const path = `collab_boards/${boardId}/elements`;
  const elemCol = collection(db, path);
  const safeName = (displayName.trim() || 'User').slice(0, 120);

  const nextEntries = new Map<
    string,
    { kind: 'node' | 'edge' | 'sticky' | 'stroke'; payload: Record<string, unknown>; hash: string }
  >();

  for (const n of graph.nodes) {
    const payload = encodeNodePayload(n);
    nextEntries.set(n.id, { kind: 'node', payload, hash: stableStringify({ kind: 'node', payload }) });
  }
  for (const e of graph.edges) {
    const payload = encodeEdgePayload(e);
    nextEntries.set(e.id, { kind: 'edge', payload, hash: stableStringify({ kind: 'edge', payload }) });
  }
  for (const s of graph.stickies) {
    const payload = encodeStickyPayload(s);
    nextEntries.set(s.id, { kind: 'sticky', payload, hash: stableStringify({ kind: 'sticky', payload }) });
  }
  for (const st of graph.strokes) {
    const payload = encodeStrokePayload(st);
    nextEntries.set(st.id, { kind: 'stroke', payload, hash: stableStringify({ kind: 'stroke', payload }) });
  }

  const nextMeta = new Map<string, CollabElementMeta>();
  const ops: QueuedElementWrite[] = [];
  const unknownEntries: { id: string; docId: string; entry: { kind: 'node' | 'edge' | 'sticky' | 'stroke'; payload: Record<string, unknown>; hash: string } }[] = [];

  for (const [id, entry] of nextEntries.entries()) {
    const prev = lastSyncedMeta.get(id);
    if (prev && prev.hash === entry.hash) {
      nextMeta.set(id, prev);
      continue;
    }

    const docId = prev?.docId ?? sanitizeElementId(id, entry.kind);
    if (!prev || !prev.existsOnServer) {
      unknownEntries.push({ id, docId, entry });
    } else if (prev.canonical) {
      ops.push({
        kind: 'update',
        docId,
        data: {
          kind: entry.kind,
          payload: entry.payload,
          updatedByUid: uid,
          updatedByName: safeName,
          updatedAt: serverTimestamp(),
        },
      });
      nextMeta.set(id, {
        docId,
        hash: entry.hash,
        existsOnServer: true,
        canonical: true,
        createdAtTs: prev.createdAtTs,
      });
    } else {
      ops.push({
        kind: 'set',
        docId,
        data: {
          kind: entry.kind,
          payload: entry.payload,
          updatedByUid: uid,
          updatedByName: safeName,
          createdAt: prev.createdAtTs ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });
      nextMeta.set(id, {
        docId,
        hash: entry.hash,
        existsOnServer: true,
        canonical: true,
        createdAtTs: prev.createdAtTs,
      });
    }
  }

  if (unknownEntries.length > 0) {
    try {
      const snaps = await Promise.all(unknownEntries.map((u) => getDoc(doc(elemCol, u.docId))));
      for (let i = 0; i < unknownEntries.length; i++) {
        const { id, docId, entry } = unknownEntries[i];
        const existingSnap = snaps[i];
        if (!existingSnap.exists()) {
          ops.push({
            kind: 'set',
            docId,
            data: {
              kind: entry.kind,
              payload: entry.payload,
              updatedByUid: uid,
              updatedByName: safeName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
          });
          nextMeta.set(id, {
            docId,
            hash: entry.hash,
            existsOnServer: true,
            canonical: true,
            createdAtTs: null,
          });
        } else {
          const existingData = existingSnap.data();
          const createdAtTs = existingData.createdAt instanceof Timestamp ? existingData.createdAt : null;
          if (isCanonicalElementDoc(existingData)) {
            ops.push({
              kind: 'update',
              docId,
              data: {
                kind: entry.kind,
                payload: entry.payload,
                updatedByUid: uid,
                updatedByName: safeName,
                updatedAt: serverTimestamp(),
              },
            });
          } else {
            ops.push({
              kind: 'set',
              docId,
              data: {
                kind: entry.kind,
                payload: entry.payload,
                updatedByUid: uid,
                updatedByName: safeName,
                createdAt: createdAtTs ?? serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
            });
          }
          nextMeta.set(id, {
            docId,
            hash: entry.hash,
            existsOnServer: true,
            canonical: true,
            createdAtTs,
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }

  // Deletes
  for (const [prevId, prevMeta] of lastSyncedMeta.entries()) {
    if (!nextEntries.has(prevId) && prevMeta.existsOnServer) {
      ops.push({ kind: 'delete', docId: prevMeta.docId });
    }
  }

  if (ops.length > 0) {
    try {
      for (let i = 0; i < ops.length; i += 400) {
        const chunk = ops.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const op of chunk) {
          const ref = doc(elemCol, op.docId);
          if (op.kind === 'set') batch.set(ref, op.data);
          else if (op.kind === 'update') batch.update(ref, op.data);
          else batch.delete(ref);
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  return nextMeta;
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

const VALID_NOTE_TYPES = new Set<NoteRecord['noteType']>([
  'Observation',
  'Source',
  'Lead',
  'Analysis',
  'Question',
  'Action',
]);

const VALID_NOTE_PRIORITIES = new Set<NoteRecord['priority']>([
  'urgent',
  'high',
  'normal',
  'low',
]);

function normalizeNoteType(raw: unknown): NoteRecord['noteType'] {
  const s = String(raw ?? '').trim();
  for (const valid of VALID_NOTE_TYPES) {
    if (valid.toLowerCase() === s.toLowerCase()) return valid;
  }
  return 'Observation';
}

function normalizeNotePriority(raw: unknown): NoteRecord['priority'] {
  const s = String(raw ?? '').trim().toLowerCase() as NoteRecord['priority'];
  return VALID_NOTE_PRIORITIES.has(s) ? s : 'normal';
}

function normalizeNoteColor(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (s.length >= 4 && s.length <= 16) return s;
  return '#ffffff';
}

function sanitizeChecklist(raw: unknown): { text: string; checked: boolean }[] {
  if (!Array.isArray(raw)) return [];
  const out: { text: string; checked: boolean }[] = [];
  for (const item of raw.slice(0, 100)) {
    if (!item || typeof item !== 'object') continue;
    const text = String((item as { text?: unknown }).text ?? '').trim().slice(0, 300);
    if (!text) continue;
    out.push({
      text,
      checked: Boolean((item as { checked?: unknown }).checked),
    });
  }
  return out;
}

// --- Notes Studio CRUD ---
export function subscribeUserNotes(
  uid: string,
  onChange: (notes: NoteRecord[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/notes`;
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const notes: NoteRecord[] = snap.docs
        .map((d) => {
          const data = d.data();
          const rawTags = Array.isArray(data.tags) ? data.tags : [];
          const cleanTags = rawTags
            .map((t) => String(t ?? '').trim())
            .filter(Boolean)
            .slice(0, 20);
          const rawWordCount = Number(data.wordCount ?? data.word_count ?? 0);
          return {
            id: d.id,
            ownerId: String(data.ownerId ?? data.owner_id ?? uid),
            boardId: data.boardId ? String(data.boardId) : data.board_id ? String(data.board_id) : null,
            title: String(data.title ?? 'Untitled Note'),
            body: String(data.body ?? ''),
            noteType: normalizeNoteType(data.noteType ?? data.note_type),
            sourceUrl: String(data.sourceUrl ?? data.source_url ?? ''),
            folder: String(data.folder ?? ''),
            tags: cleanTags,
            priority: normalizeNotePriority(data.priority),
            color: normalizeNoteColor(data.color),
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
            checklist: sanitizeChecklist(data.checklist),
            wordCount: Number.isFinite(rawWordCount) ? Math.max(0, Math.min(100000, Math.round(rawWordCount))) : 0,
            createdAt: toMillis(data.createdAt ?? data.created_at),
            updatedAt: toMillis(data.updatedAt ?? data.updated_at),
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
      onChange(notes);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

const CANONICAL_NOTE_KEYS = new Set([
  'ownerId',
  'boardId',
  'title',
  'body',
  'noteType',
  'sourceUrl',
  'folder',
  'tags',
  'priority',
  'color',
  'pinned',
  'archived',
  'linkedNodeId',
  'linkedNodeName',
  'checklist',
  'wordCount',
  'createdAt',
  'updatedAt',
]);

export async function saveUserNote(uid: string, note: NoteRecord, _isNew?: boolean): Promise<void> {
  const safeNoteId = note.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || makeSafeId('note');
  const path = `users/${uid}/notes/${safeNoteId}`;
  const docRef = doc(db, path);
  const cleanBody = String(note.body ?? '').slice(0, 50000);
  const computedWords = cleanBody.trim() ? cleanBody.trim().split(/\s+/).length : 0;
  const wordCount = Math.max(
    0,
    Math.min(100000, Number.isFinite(note.wordCount) ? Math.round(note.wordCount) : computedWords)
  );
  const cleanTags = (note.tags ?? [])
    .map((t) => String(t ?? '').trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);

  const mutableFields = {
    boardId: note.boardId ? String(note.boardId).slice(0, 128) : null,
    title: (String(note.title ?? '').trim() || 'Untitled Note').slice(0, 200),
    body: cleanBody,
    noteType: normalizeNoteType(note.noteType),
    sourceUrl: String(note.sourceUrl ?? '').slice(0, 1000),
    folder: String(note.folder ?? '').slice(0, 100),
    tags: cleanTags,
    priority: normalizeNotePriority(note.priority),
    color: normalizeNoteColor(note.color),
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    linkedNodeId: note.linkedNodeId ? String(note.linkedNodeId).slice(0, 128) : null,
    linkedNodeName: note.linkedNodeName ? String(note.linkedNodeName).slice(0, 200) : null,
    checklist: sanitizeChecklist(note.checklist),
    wordCount,
    updatedAt: serverTimestamp(),
  };

  let opType: OperationType = OperationType.WRITE;
  try {
    opType = OperationType.GET;
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      opType = OperationType.CREATE;
      await setDoc(docRef, {
        ownerId: uid,
        ...mutableFields,
        createdAt: serverTimestamp(),
      });
    } else {
      opType = OperationType.UPDATE;
      const existingData = existingSnap.data();
      const existingKeys = Object.keys(existingData);
      const isCanonical =
        existingData.ownerId === uid &&
        existingData.createdAt instanceof Timestamp &&
        existingKeys.every((k) => CANONICAL_NOTE_KEYS.has(k));

      if (isCanonical) {
        await updateDoc(docRef, mutableFields);
      } else {
        await setDoc(docRef, {
          ownerId: uid,
          ...mutableFields,
          createdAt:
            existingData.createdAt instanceof Timestamp
              ? existingData.createdAt
              : serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, opType, path);
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
