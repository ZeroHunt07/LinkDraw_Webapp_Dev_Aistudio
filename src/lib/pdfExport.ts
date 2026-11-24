import { jsPDF } from 'jspdf';
import type { GraphDocument, GraphPage, ThemeMode, WorkspaceBoard } from '../types/linkdraw';
import { computeGraphTelemetry } from './algorithms';
import { renderGraphSnapshotToContext } from './canvasRenderer';
import { buildEntityMap } from './geometry';

export interface PdfReportOptions {
  board: WorkspaceBoard;
  pagesToExport: { page: GraphPage; graph: GraphDocument }[];
  orientation: 'auto' | 'landscape' | 'portrait';
  printWhiteBackground: boolean;
  theme: ThemeMode;
  includeSummaryPage: boolean;
}

function computeGraphBounds(doc: GraphDocument): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of doc.nodes) {
    minX = Math.min(minX, n.x - n.w / 2 - 48);
    minY = Math.min(minY, n.y - n.h / 2 - 48);
    maxX = Math.max(maxX, n.x + n.w / 2 + 48);
    maxY = Math.max(maxY, n.y + n.h / 2 + 48);
  }
  for (const s of doc.stickies) {
    minX = Math.min(minX, s.x - s.w / 2 - 36);
    minY = Math.min(minY, s.y - s.h / 2 - 36);
    maxX = Math.max(maxX, s.x + s.w / 2 + 36);
    maxY = Math.max(maxY, s.y + s.h / 2 + 36);
  }
  for (const st of doc.strokes) {
    for (const pt of st.points) {
      minX = Math.min(minX, pt.x - 24);
      minY = Math.min(minY, pt.y - 24);
      maxX = Math.max(maxX, pt.x + 24);
      maxY = Math.max(maxY, pt.y + 24);
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: -200, minY: -120, maxX: 200, maxY: 120 };
  }
  return { minX, minY, maxX, maxY };
}

function renderGraphToPngDataUrl(
  doc: GraphDocument,
  effectiveTheme: ThemeMode
): { dataUrl: string; worldW: number; worldH: number } {
  const { minX, minY, maxX, maxY } = computeGraphBounds(doc);
  const worldW = Math.max(320, maxX - minX);
  const worldH = Math.max(220, maxY - minY);

  const maxDimPx = 2800;
  const scale = Math.min(2.5, maxDimPx / Math.max(worldW, worldH));
  const pixelW = Math.max(640, Math.round(worldW * scale));
  const pixelH = Math.max(440, Math.round(worldH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = pixelW;
  canvas.height = pixelH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', worldW, worldH };
  }

  const bg =
    effectiveTheme === 'light'
      ? '#ffffff'
      : effectiveTheme === 'dark'
      ? '#090d16'
      : '#000000';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, pixelW, pixelH);

  // Subtle dot grid for technical/report readability
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);

  const step = Math.max(20, doc.settings.gridSize || 20);
  const gridColor =
    effectiveTheme === 'light' ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.14)';
  const startGx = Math.floor(minX / step) * step;
  const startGy = Math.floor(minY / step) * step;
  ctx.fillStyle = gridColor;
  for (let gx = startGx; gx <= maxX; gx += step) {
    for (let gy = startGy; gy <= maxY; gy += step) {
      ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
    }
  }

  renderGraphSnapshotToContext(ctx, doc, effectiveTheme);
  ctx.restore();

  return {
    dataUrl: canvas.toDataURL('image/png'),
    worldW,
    worldH,
  };
}

export function exportBoardToPDF(opts: PdfReportOptions): string {
  const {
    board,
    pagesToExport,
    orientation,
    printWhiteBackground,
    theme,
    includeSummaryPage,
  } = opts;

  const effectiveTheme: ThemeMode = printWhiteBackground ? 'light' : theme;
  const generatedStr = new Date().toLocaleString();
  const safePages = pagesToExport.length > 0 ? pagesToExport : [];

  const firstBounds = safePages[0]
    ? computeGraphBounds(safePages[0].graph)
    : { minX: 0, minY: 0, maxX: 400, maxY: 260 };
  const firstOri: 'landscape' | 'portrait' =
    orientation === 'auto'
      ? firstBounds.maxX - firstBounds.minX >= firstBounds.maxY - firstBounds.minY
        ? 'landscape'
        : 'portrait'
      : orientation;

  const pdf = new jsPDF({
    orientation: firstOri,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const totalGraphPages = safePages.length;

  safePages.forEach(({ page, graph }, idx) => {
    const bounds = computeGraphBounds(graph);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const pageOri: 'landscape' | 'portrait' =
      orientation === 'auto' ? (w >= h ? 'landscape' : 'portrait') : orientation;

    if (idx > 0) {
      pdf.addPage('a4', pageOri);
    }

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 12;

    // Header band
    pdf.setFillColor(248, 250, 252);
    pdf.rect(margin, margin, pageW - margin * 2, 18, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(margin, margin, pageW - margin * 2, 18, 'S');

    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(board.title || 'Untitled Workspace', margin + 4, margin + 7.2);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    const kindLabel = board.kind === 'shared' ? 'Shared Live Board' : 'Personal Board';
    const subMeta = `${page.title} (${idx + 1}/${totalGraphPages})  ·  ${kindLabel}  ·  ${graph.nodes.length} Nodes · ${graph.edges.length} Connections · ${graph.stickies.length} Stickies`;
    pdf.text(subMeta, margin + 4, margin + 13.5);

    pdf.setFontSize(8);
    pdf.text(`Generated: ${generatedStr}`, pageW - margin - 4, margin + 7.2, {
      align: 'right',
    });

    // Graph Viewport Box
    const frameTop = margin + 22;
    const frameH = pageH - frameTop - margin - 8;
    const frameW = pageW - margin * 2;

    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.3);
    if (!printWhiteBackground && effectiveTheme !== 'light') {
      pdf.setFillColor(effectiveTheme === 'dark' ? 9 : 0, effectiveTheme === 'dark' ? 13 : 0, effectiveTheme === 'dark' ? 22 : 0);
      pdf.rect(margin, frameTop, frameW, frameH, 'FD');
    } else {
      pdf.rect(margin, frameTop, frameW, frameH, 'S');
    }

    const { dataUrl, worldW, worldH } = renderGraphToPngDataUrl(graph, effectiveTheme);
    if (dataUrl) {
      const innerPad = 3;
      const availW = frameW - innerPad * 2;
      const availH = frameH - innerPad * 2;
      const fit = Math.min(availW / worldW, availH / worldH);
      const drawW = worldW * fit;
      const drawH = worldH * fit;
      const drawX = margin + (frameW - drawW) / 2;
      const drawY = frameTop + (frameH - drawH) / 2;
      pdf.addImage(dataUrl, 'PNG', drawX, drawY, drawW, drawH, undefined, 'FAST');
    }

    // Footer
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('LinkDraw Graph & Diagram Report', margin, pageH - 6);
    pdf.text(`Page ${idx + 1}`, pageW - margin, pageH - 6, { align: 'right' });
  });

  // Optional Report Summary & Element Inventory Page
  if (includeSummaryPage && safePages.length > 0) {
    pdf.addPage('a4', 'portrait');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 14;
    let cursorY = margin;

    pdf.setTextColor(15, 23, 42);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(`${board.title || 'Workspace'} — Report Summary`, margin, cursorY + 5);
    cursorY += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    if (board.description) {
      const descLines = pdf.splitTextToSize(board.description, pageW - margin * 2);
      pdf.text(descLines, margin, cursorY);
      cursorY += descLines.length * 4.5 + 3;
    }
    pdf.text(`Generated: ${generatedStr}`, margin, cursorY);
    cursorY += 8;

    safePages.forEach(({ page, graph }, pIdx) => {
      if (cursorY > pageH - 42) {
        pdf.addPage('a4', 'portrait');
        cursorY = margin;
      }

      const telem = computeGraphTelemetry(graph.nodes, graph.edges);
      pdf.setFillColor(241, 245, 249);
      pdf.rect(margin, cursorY, pageW - margin * 2, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`${pIdx + 1}. ${page.title}`, margin + 3, cursorY + 5.5);
      cursorY += 11;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      pdf.text(
        `Nodes: ${graph.nodes.length}   |   Connections: ${graph.edges.length}   |   Sticky Notes: ${graph.stickies.length}   |   Density: ${telem.density.toFixed(3)}   |   Clusters: ${telem.clusters}`,
        margin,
        cursorY
      );
      cursorY += 6;

      // List elements concisely
      const entityMap = buildEntityMap(graph.nodes, graph.stickies);
      const itemRows: string[] = [];
      graph.nodes.slice(0, 35).forEach((n) => {
        const label = n.text?.trim() || `(Untitled ${n.shape})`;
        const tagText = n.tags.length > 0 ? ` [${n.tags.join(', ')}]` : '';
        itemRows.push(`• [Node · ${n.shape}] ${label}${tagText}`);
      });
      graph.stickies.slice(0, 20).forEach((s) => {
        const textOneLine = s.text.replace(/\s+/g, ' ').slice(0, 90);
        itemRows.push(`• [Sticky] ${textOneLine}`);
      });
      graph.edges.slice(0, 25).forEach((e) => {
        const aName = entityMap.get(e.a)?.text?.trim() || e.a;
        const bName = entityMap.get(e.b)?.text?.trim() || e.b;
        const lbl = e.label ? ` (${e.label})` : '';
        itemRows.push(`• [Link] ${aName} → ${bName}${lbl}`);
      });

      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      for (const row of itemRows) {
        const wrapped = pdf.splitTextToSize(row, pageW - margin * 2 - 4);
        if (cursorY + wrapped.length * 4 > pageH - margin) {
          pdf.addPage('a4', 'portrait');
          cursorY = margin;
        }
        pdf.text(wrapped, margin + 2, cursorY);
        cursorY += wrapped.length * 4 + 1;
      }
      cursorY += 5;
    });
  }

  const slug = (board.title || 'linkdraw_board').replace(/\s+/g, '_').toLowerCase();
  const filename = `${slug}_report.pdf`;
  pdf.save(filename);
  return filename;
}
