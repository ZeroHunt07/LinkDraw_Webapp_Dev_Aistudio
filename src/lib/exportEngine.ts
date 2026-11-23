import type { GraphDocument, GraphEdge, GraphNode } from '../types/linkdraw';
import { computeEdgeGeometry, computeParallelEdgeIndexMap } from './geometry';

export function exportLinkDrawJSON(doc: GraphDocument, title: string): string {
  return JSON.stringify(
    {
      format: 'linkdraw-v2',
      title,
      exportedAt: new Date().toISOString(),
      pages: doc.pages ?? [{ id: 'page_1', title: 'Page 1', order: 0 }],
      nodes: doc.nodes,
      conns: doc.edges,
      sticky_notes: doc.stickies,
      freehand_strokes: doc.strokes,
      layers: doc.layers,
      settings: doc.settings,
    },
    null,
    2
  );
}

export function parseLinkDrawJSON(raw: string): { title?: string; graph: GraphDocument } {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rawPages = Array.isArray(parsed.pages) ? parsed.pages : [];
  const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const rawEdges = Array.isArray(parsed.conns)
    ? parsed.conns
    : Array.isArray(parsed.edges)
    ? parsed.edges
    : [];
  const rawStickies = Array.isArray(parsed.sticky_notes)
    ? parsed.sticky_notes
    : Array.isArray(parsed.stickies)
    ? parsed.stickies
    : [];
  const rawStrokes = Array.isArray(parsed.freehand_strokes)
    ? parsed.freehand_strokes
    : Array.isArray(parsed.strokes)
    ? parsed.strokes
    : [];

  const sanitizeId = (rawId: unknown, fallback: string) => {
    const cleaned = String(rawId ?? '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    return cleaned || fallback;
  };

  const normalizeTableData = (rawNode: Record<string, unknown>): GraphNode['tableData'] => {
    const td = (rawNode.tableData ?? rawNode.table_data) as Record<string, unknown> | null | undefined;
    if (td && typeof td === 'object') {
      const headers = Array.isArray(td.headers) ? td.headers.map(String) : ['Col 1', 'Col 2'];
      const rawRows = Array.isArray(td.rows) ? td.rows : [];
      const rows = rawRows.map((r) => {
        if (Array.isArray(r)) return r.map(String);
        if (r && typeof r === 'object' && 'cells' in r && Array.isArray((r as { cells: unknown[] }).cells)) {
          return (r as { cells: unknown[] }).cells.map(String);
        }
        return [];
      });
      return { headers, rows };
    }
    if (Array.isArray(rawNode.tableHeaders) || Array.isArray(rawNode.tableRows)) {
      const headers = Array.isArray(rawNode.tableHeaders) ? rawNode.tableHeaders.map(String) : ['Col 1', 'Col 2'];
      const rows = Array.isArray(rawNode.tableRows)
        ? rawNode.tableRows.map((r) =>
            r && typeof r === 'object' && 'cells' in r && Array.isArray((r as { cells: unknown[] }).cells)
              ? (r as { cells: unknown[] }).cells.map(String)
              : Array.isArray(r)
              ? r.map(String)
              : []
          )
        : [];
      return { headers, rows };
    }
    return null;
  };

  const toTimestampMs = (val: unknown): number => {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string') {
      const parsedMs = Date.parse(val);
      if (Number.isFinite(parsedMs)) return parsedMs;
    }
    return Date.now();
  };

  const pages = rawPages.length > 0
    ? rawPages.map((pg: Record<string, unknown>, idx) => ({
        id: sanitizeId(pg.id, `page_${idx + 1}`),
        title: String(pg.title ?? `Page ${idx + 1}`).slice(0, 120),
        order: typeof pg.order === 'number' && Number.isFinite(pg.order) ? pg.order : idx,
        createdAt: toTimestampMs(pg.createdAt ?? pg.createdAtMs ?? pg.created_at),
      }))
    : [{ id: 'page_1', title: 'Page 1', order: 0, createdAt: Date.now() }];

  const nodes: GraphNode[] = rawNodes.map((n: Record<string, unknown>, idx) => ({
    id: sanitizeId(n.id, `n_${idx}`),
    pageId: n.pageId || n.page_id ? sanitizeId(n.pageId ?? n.page_id, 'page_1') : undefined,
    x: Number(n.x ?? 0),
    y: Number(n.y ?? 0),
    w: Number(n.w ?? 140),
    h: Number(n.h ?? 58),
    text: String(n.text ?? 'Node'),
    shape: (n.shape as GraphNode['shape']) ?? 'rounded',
    color: String(n.color ?? '#dbeafe'),
    textColor: n.textColor ? String(n.textColor) : n.text_color ? String(n.text_color) : undefined,
    fs: n.fs ? Number(n.fs) : 13,
    icon: n.icon ? String(n.icon) : '',
    iconPosition: (n.iconPosition ?? n.icon_position ?? 'inline') as GraphNode['iconPosition'],
    tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
    metadata:
      n.metadata && typeof n.metadata === 'object'
        ? Object.fromEntries(Object.entries(n.metadata as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
        : {},
    progress: n.progress !== undefined && n.progress !== null ? Number(n.progress) : null,
    badge: n.badge ? String(n.badge) : null,
    collapsed: Boolean(n.collapsed),
    locked: Boolean(n.locked),
    layer: (n.layer as GraphNode['layer']) ?? 'Data',
    tableData: normalizeTableData(n),
    createdAt: toTimestampMs(n.createdAt ?? n.createdAtMs ?? n.created_at),
    updatedAt: toTimestampMs(n.updatedAt ?? n.updatedAtMs ?? n.updated_at),
  }));

  const edges: GraphEdge[] = rawEdges.map((e: Record<string, unknown>, idx) => ({
    id: sanitizeId(e.id, `e_${idx}`),
    pageId: e.pageId || e.page_id ? sanitizeId(e.pageId ?? e.page_id, 'page_1') : undefined,
    a: sanitizeId(e.a, ''),
    b: sanitizeId(e.b, ''),
    label: String(e.label ?? ''),
    color: String(e.color ?? '#475569'),
    width: Number(e.width ?? 2),
    arrow: (e.arrow as GraphEdge['arrow']) ?? 'forward',
    type: (e.type as GraphEdge['type']) ?? 'curved',
    lineStyle: (e.lineStyle ?? e.line_style ?? 'solid') as GraphEdge['lineStyle'],
    weight: Number(e.weight ?? 1),
    curvature:
      e.curvature !== undefined && e.curvature !== null && Number.isFinite(Number(e.curvature))
        ? Number(e.curvature)
        : null,
    layer: (e.layer as GraphEdge['layer']) ?? 'Data',
    createdAt: toTimestampMs(e.createdAt ?? e.createdAtMs ?? e.created_at),
    updatedAt: toTimestampMs(e.updatedAt ?? e.updatedAtMs ?? e.updated_at),
  }));

  const stickies = rawStickies.map((s: Record<string, unknown>, idx) => ({
    id: sanitizeId(s.id, `s_${idx}`),
    pageId: s.pageId || s.page_id ? sanitizeId(s.pageId ?? s.page_id, 'page_1') : undefined,
    x: Number(s.x ?? 0),
    y: Number(s.y ?? 0),
    w: Number(s.w ?? 170),
    h: Number(s.h ?? 110),
    text: String(s.text ?? ''),
    color: String(s.color ?? '#fef08a'),
    layer: (s.layer as GraphNode['layer']) ?? 'Annotations',
    createdAt: toTimestampMs(s.createdAt ?? s.createdAtMs ?? s.created_at),
    updatedAt: toTimestampMs(s.updatedAt ?? s.updatedAtMs ?? s.updated_at),
  }));

  const strokes = rawStrokes.map((st: Record<string, unknown>, idx) => ({
    id: sanitizeId(st.id, `st_${idx}`),
    pageId: st.pageId || st.page_id ? sanitizeId(st.pageId ?? st.page_id, 'page_1') : undefined,
    points: Array.isArray(st.points)
      ? st.points.map((pt) =>
          Array.isArray(pt)
            ? { x: Number(pt[0]), y: Number(pt[1]) }
            : { x: Number((pt as { x: number }).x ?? 0), y: Number((pt as { y: number }).y ?? 0) }
        )
      : [],
    color: String(st.color ?? '#ef4444'),
    width: Number(st.width ?? 3),
    tool: (st.tool === 'highlight' ? 'highlight' : 'pen') as 'pen' | 'highlight',
    layer: (st.layer as GraphNode['layer']) ?? 'Annotations',
    createdAt: toTimestampMs(st.createdAt ?? st.createdAtMs ?? st.created_at),
  }));

  const rawSettings =
    parsed.settings && typeof parsed.settings === 'object'
      ? (parsed.settings as Record<string, unknown>)
      : {};

  return {
    title: parsed.title ? String(parsed.title) : undefined,
    graph: {
      pages,
      nodes,
      edges,
      stickies,
      strokes,
      layers: Array.isArray(parsed.layers)
        ? (parsed.layers as GraphDocument['layers'])
        : [
            { name: 'Background', visible: true, locked: false },
            { name: 'Data', visible: true, locked: false },
            { name: 'Annotations', visible: true, locked: false },
          ],
      settings: {
        gridSnap: Boolean(rawSettings.gridSnap ?? rawSettings.grid_snap ?? true),
        gridSize: Number(rawSettings.gridSize ?? rawSettings.grid_size ?? 20),
        flowAnimation: Boolean(rawSettings.flowAnimation ?? rawSettings.flow_animation ?? true),
      },
    },
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportSVG(doc: GraphDocument): string {
  if (doc.nodes.length === 0 && doc.stickies.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"></svg>';
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of doc.nodes) {
    minX = Math.min(minX, n.x - n.w / 2 - 40);
    minY = Math.min(minY, n.y - n.h / 2 - 40);
    maxX = Math.max(maxX, n.x + n.w / 2 + 40);
    maxY = Math.max(maxY, n.y + n.h / 2 + 40);
  }
  for (const s of doc.stickies) {
    minX = Math.min(minX, s.x - s.w / 2 - 20);
    minY = Math.min(minY, s.y - s.h / 2 - 20);
    maxX = Math.max(maxX, s.x + s.w / 2 + 20);
    maxY = Math.max(maxY, s.y + s.h / 2 + 20);
  }
  const width = Math.max(300, Math.ceil(maxX - minX));
  const height = Math.max(200, Math.ceil(maxY - minY));

  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  const parallelMap = computeParallelEdgeIndexMap(doc.edges);

  const edgeSvgs = doc.edges
    .map((e) => {
      const geom = computeEdgeGeometry(e, nodeMap, parallelMap.get(e.id));
      if (!geom) return '';
      const d = geom.points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
      const dash =
        e.lineStyle === 'dashed' ? 'stroke-dasharray="7 5"' : e.lineStyle === 'dotted' ? 'stroke-dasharray="2 4"' : '';
      const labelSvg = e.label
        ? `<text x="${geom.labelPos.x.toFixed(1)}" y="${(geom.labelPos.y - 6).toFixed(
            1
          )}" font-family="sans-serif" font-size="11" fill="#334155" text-anchor="middle">${escapeXml(
            e.label
          )}</text>`
        : '';
      return `<path d="${d}" fill="none" stroke="${escapeXml(e.color)}" stroke-width="${
        e.width
      }" ${dash} />${labelSvg}`;
    })
    .join('\n  ');

  const nodeSvgs = doc.nodes
    .map((n) => {
      const x = n.x - n.w / 2;
      const y = n.y - n.h / 2;
      const shapeSvg =
        n.shape === 'circle'
          ? `<ellipse cx="${n.x}" cy="${n.y}" rx="${n.w / 2}" ry="${n.h / 2}" fill="${escapeXml(
              n.color
            )}" stroke="#334155" stroke-width="1.5" />`
          : `<rect x="${x}" y="${y}" width="${n.w}" height="${n.h}" rx="${
              n.shape === 'rectangle' || n.shape === 'table' ? 4 : 12
            }" fill="${escapeXml(n.color)}" stroke="#334155" stroke-width="1.5" />`;
      const label = n.icon ? `${n.icon} ${n.text}` : n.text;
      return `${shapeSvg}<text x="${n.x}" y="${n.y + 4}" font-family="sans-serif" font-size="12" font-weight="600" fill="#0f172a" text-anchor="middle">${escapeXml(
        label
      )}</text>`;
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#ffffff" />
  ${edgeSvgs}
  ${nodeSvgs}
</svg>`;
}

export function exportGraphvizDOT(doc: GraphDocument, title: string): string {
  const safeName = title.replace(/[^a-zA-Z0-9_]/g, '_') || 'LinkDrawGraph';
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  const lines = [`digraph ${safeName} {`, '  rankdir=TB;', '  node [shape=box, style=rounded];'];
  for (const n of doc.nodes) {
    lines.push(`  "${n.id}" [label="${n.text.replace(/"/g, '\\"')}"];`);
  }
  for (const e of doc.edges) {
    if (!nodeMap.has(e.a) || !nodeMap.has(e.b)) continue;
    lines.push(
      `  "${e.a}" -> "${e.b}" [label="${e.label.replace(/"/g, '\\"')}", weight=${e.weight}];`
    );
  }
  lines.push('}');
  return lines.join('\n');
}

export function exportGraphML(doc: GraphDocument): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
    '  <key id="d_label" for="node" attr.name="label" attr.type="string"/>',
    '  <key id="d_shape" for="node" attr.name="shape" attr.type="string"/>',
    '  <key id="d_x" for="node" attr.name="x" attr.type="double"/>',
    '  <key id="d_y" for="node" attr.name="y" attr.type="double"/>',
    '  <key id="e_label" for="edge" attr.name="label" attr.type="string"/>',
    '  <key id="e_weight" for="edge" attr.name="weight" attr.type="double"/>',
    '  <graph id="G" edgedefault="directed">',
  ];
  for (const n of doc.nodes) {
    lines.push(`    <node id="${escapeXml(n.id)}">`);
    lines.push(`      <data key="d_label">${escapeXml(n.text)}</data>`);
    lines.push(`      <data key="d_shape">${escapeXml(n.shape)}</data>`);
    lines.push(`      <data key="d_x">${n.x}</data>`);
    lines.push(`      <data key="d_y">${n.y}</data>`);
    lines.push('    </node>');
  }
  for (const e of doc.edges) {
    lines.push(
      `    <edge id="${escapeXml(e.id)}" source="${escapeXml(e.a)}" target="${escapeXml(e.b)}">`
    );
    lines.push(`      <data key="e_label">${escapeXml(e.label)}</data>`);
    lines.push(`      <data key="e_weight">${e.weight}</data>`);
    lines.push('    </edge>');
  }
  lines.push('  </graph>', '</graphml>');
  return lines.join('\n');
}

export function exportCSVBundle(doc: GraphDocument): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const nodeLines = [
    'SECTION,id,label,shape,color,x,y,tags',
    ...doc.nodes.map((n) =>
      ['NODE', n.id, n.text, n.shape, n.color, Math.round(n.x), Math.round(n.y), n.tags.join('|')]
        .map(esc)
        .join(',')
    ),
  ];
  const edgeLines = [
    'SECTION,id,source,target,label,weight,routing,arrow',
    ...doc.edges.map((e) =>
      ['EDGE', e.id, e.a, e.b, e.label, e.weight, e.type, e.arrow].map(esc).join(',')
    ),
  ];
  return [...nodeLines, '', ...edgeLines].join('\n');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
