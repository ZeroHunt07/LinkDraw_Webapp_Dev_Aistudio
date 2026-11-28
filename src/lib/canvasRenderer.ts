import type {
  CanvasLayerName,
  FreehandStroke,
  GraphDocument,
  GraphNode,
  ThemeMode,
} from '../types/linkdraw';
import {
  buildEntityMap,
  computeEdgeGeometry,
  computeFittedTextLayout,
  computeMindmapVisibility,
  computeParallelEdgeIndexMap,
  getContrastTextColor,
  getShapeSafeTextBox,
  getStarPolygon,
  wrapTextLines,
} from './geometry';
import { drawVectorNodeIcon, isVectorNodeIcon } from './nodeIcons';

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.48);
  ctx.lineTo(-size * 0.78, 0);
  ctx.lineTo(-size, size * 0.48);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function samplePointAlongPolyline(pts: { x: number; y: number }[], t: number) {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  const segLens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(l);
    total += l;
  }
  if (total === 0) return pts[0];
  let target = t * total;
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i] || i === segLens.length - 1) {
      const frac = segLens[i] > 0 ? target / segLens[i] : 0;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * frac,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * frac,
      };
    }
    target -= segLens[i];
  }
  return pts[pts.length - 1];
}

export function drawNodeShape(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  fill: string,
  border: string
) {
  const { x, y, w, h, shape } = node;
  const hw = w / 2;
  const hh = h / 2;
  const isFilled = node.filled !== false;
  ctx.fillStyle = fill;
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.max(1, node.borderWidth ?? 1.8);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shape) {
    case 'text':
      return;
    case 'rectangle':
    case 'table':
      ctx.beginPath();
      ctx.rect(x - hw, y - hh, w, h);
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    case 'square': {
      const side = Math.min(w, h);
      drawRoundedRect(ctx, x - side / 2, y - side / 2, side, side, 6);
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'circle':
      ctx.beginPath();
      ctx.ellipse(x, y, hw, hh, 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(x, y + hh);
      ctx.lineTo(x - hw, y);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(x, y - hh);
      ctx.lineTo(x + hw, y + hh);
      ctx.lineTo(x - hw, y + hh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    case 'hexagon': {
      const inset = Math.min(hw * 0.28, 22);
      ctx.beginPath();
      ctx.moveTo(x - hw + inset, y - hh);
      ctx.lineTo(x + hw - inset, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(x + hw - inset, y + hh);
      ctx.lineTo(x - hw + inset, y + hh);
      ctx.lineTo(x - hw, y);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'parallelogram': {
      const skew = Math.min(hw * 0.25, 20);
      ctx.beginPath();
      ctx.moveTo(x - hw + skew, y - hh);
      ctx.lineTo(x + hw, y - hh);
      ctx.lineTo(x + hw - skew, y + hh);
      ctx.lineTo(x - hw, y + hh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'star': {
      const pts = getStarPolygon(x, y, hw, hh);
      ctx.beginPath();
      pts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'cylinder': {
      const cap = Math.min(14, hh * 0.28);
      ctx.beginPath();
      ctx.moveTo(x - hw, y - hh + cap);
      ctx.lineTo(x - hw, y + hh - cap);
      ctx.ellipse(x, y + hh - cap, hw, cap, 0, Math.PI, 0, true);
      ctx.lineTo(x + hw, y - hh + cap);
      ctx.ellipse(x, y - hh + cap, hw, cap, 0, 0, Math.PI, true);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - hh + cap, hw, cap, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'cloud': {
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.55, y + hh * 0.65);
      ctx.bezierCurveTo(x - hw * 1.05, y + hh * 0.65, x - hw * 1.0, y - hh * 0.3, x - hw * 0.55, y - hh * 0.35);
      ctx.bezierCurveTo(x - hw * 0.45, y - hh * 1.0, x + hw * 0.35, y - hh * 1.0, x + hw * 0.48, y - hh * 0.38);
      ctx.bezierCurveTo(x + hw * 1.0, y - hh * 0.35, x + hw * 1.05, y + hh * 0.65, x + hw * 0.52, y + hh * 0.65);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'callout': {
      const bodyBottom = y + hh * 0.58;
      ctx.beginPath();
      ctx.moveTo(x - hw + 10, y - hh);
      ctx.lineTo(x + hw - 10, y - hh);
      ctx.quadraticCurveTo(x + hw, y - hh, x + hw, y - hh + 10);
      ctx.lineTo(x + hw, bodyBottom - 10);
      ctx.quadraticCurveTo(x + hw, bodyBottom, x + hw - 10, bodyBottom);
      ctx.lineTo(x - hw * 0.2, bodyBottom);
      ctx.lineTo(x - hw * 0.48, y + hh);
      ctx.lineTo(x - hw * 0.45, bodyBottom);
      ctx.lineTo(x - hw + 10, bodyBottom);
      ctx.quadraticCurveTo(x - hw, bodyBottom, x - hw, bodyBottom - 10);
      ctx.lineTo(x - hw, y - hh + 10);
      ctx.quadraticCurveTo(x - hw, y - hh, x - hw + 10, y - hh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'block_arrow': {
      const headLen = Math.min(hw * 0.72, h * 0.65);
      const shaftHh = hh * 0.44;
      const neckX = x + hw - headLen;
      ctx.beginPath();
      ctx.moveTo(x - hw, y - shaftHh);
      ctx.lineTo(neckX, y - shaftHh);
      ctx.lineTo(neckX, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(neckX, y + hh);
      ctx.lineTo(neckX, y + shaftHh);
      ctx.lineTo(x - hw, y + shaftHh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'double_arrow': {
      const headLen = Math.min(hw * 0.46, h * 0.58);
      const shaftHh = hh * 0.42;
      const leftNeckX = x - hw + headLen;
      const rightNeckX = x + hw - headLen;
      ctx.beginPath();
      ctx.moveTo(x - hw, y);
      ctx.lineTo(leftNeckX, y - hh);
      ctx.lineTo(leftNeckX, y - shaftHh);
      ctx.lineTo(rightNeckX, y - shaftHh);
      ctx.lineTo(rightNeckX, y - hh);
      ctx.lineTo(x + hw, y);
      ctx.lineTo(rightNeckX, y + hh);
      ctx.lineTo(rightNeckX, y + shaftHh);
      ctx.lineTo(leftNeckX, y + shaftHh);
      ctx.lineTo(leftNeckX, y + hh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }

    // --- Electronic & Schematic Shapes ---
    case 'resistor': {
      const cy = y - hh * 0.14;
      const bodyW = w * 0.56;
      const amp = Math.min(12, hh * 0.32);
      const startX = x - bodyW / 2;
      const peaks = 6;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(startX, cy);
      for (let i = 0; i < peaks; i++) {
        const px = startX + ((i + 0.5) / peaks) * bodyW;
        const py = cy + (i % 2 === 0 ? -amp : amp);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x + bodyW / 2, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      return;
    }
    case 'capacitor': {
      const cy = y - hh * 0.14;
      const gap = Math.max(6, w * 0.08);
      const plateH = hh * 0.55;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(x - gap / 2, cy);
      ctx.moveTo(x - gap / 2, cy - plateH);
      ctx.lineTo(x - gap / 2, cy + plateH);
      ctx.moveTo(x + gap / 2, cy - plateH);
      ctx.lineTo(x + gap / 2, cy + plateH);
      ctx.moveTo(x + gap / 2, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      return;
    }
    case 'inductor': {
      const cy = y - hh * 0.08;
      const loops = 4;
      const coilW = w * 0.64;
      const r = coilW / (loops * 2);
      const startX = x - coilW / 2;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(startX, cy);
      for (let i = 0; i < loops; i++) {
        ctx.arc(startX + r * (2 * i + 1), cy, r, Math.PI, 0, false);
      }
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      return;
    }
    case 'battery': {
      const cy = y - hh * 0.14;
      const gap = Math.max(8, w * 0.1);
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(x - gap / 2, cy);
      ctx.moveTo(x - gap / 2, cy - hh * 0.55);
      ctx.lineTo(x - gap / 2, cy + hh * 0.55);
      ctx.moveTo(x + gap / 2, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();

      ctx.save();
      ctx.lineWidth = Math.max(2.6, (node.borderWidth ?? 1.8) * 1.7);
      ctx.beginPath();
      ctx.moveTo(x + gap / 2, cy - hh * 0.28);
      ctx.lineTo(x + gap / 2, cy + hh * 0.28);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'ground': {
      const topY = y - hh * 0.65;
      const stemY = y - hh * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, stemY);
      ctx.moveTo(x - hw * 0.55, stemY);
      ctx.lineTo(x + hw * 0.55, stemY);
      ctx.moveTo(x - hw * 0.36, stemY + hh * 0.24);
      ctx.lineTo(x + hw * 0.36, stemY + hh * 0.24);
      ctx.moveTo(x - hw * 0.16, stemY + hh * 0.48);
      ctx.lineTo(x + hw * 0.16, stemY + hh * 0.48);
      ctx.stroke();
      return;
    }
    case 'switch_sym': {
      const cy = y - hh * 0.05;
      const pLeft = x - hw * 0.38;
      const pRight = x + hw * 0.38;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(pLeft, cy);
      ctx.moveTo(pLeft, cy);
      ctx.lineTo(pRight - 2, cy - hh * 0.52);
      ctx.moveTo(pRight, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pLeft, cy, 3.2, 0, Math.PI * 2);
      ctx.arc(pRight, cy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = border;
      ctx.fill();
      return;
    }
    case 'diode': {
      const cy = y - hh * 0.14;
      const triW = w * 0.32;
      const triH = hh * 0.48;
      const lx = x - triW / 2;
      const rx = x + triW / 2;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(lx, cy);
      ctx.moveTo(rx, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(lx, cy - triH);
      ctx.lineTo(rx, cy);
      ctx.lineTo(lx, cy + triH);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(rx, cy - triH);
      ctx.lineTo(rx, cy + triH);
      ctx.stroke();
      return;
    }
    case 'bulb': {
      const cy = y - hh * 0.14;
      const r = Math.min(hw * 0.46, hh * 0.52);
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(x - r, cy);
      ctx.moveTo(x + r, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();

      const d = r * 0.66;
      ctx.beginPath();
      ctx.moveTo(x - d, cy - d);
      ctx.lineTo(x + d, cy + d);
      ctx.moveTo(x - d, cy + d);
      ctx.lineTo(x + d, cy - d);
      ctx.stroke();
      return;
    }
    case 'and_gate': {
      const bx = x - hw * 0.62;
      const bodyW = w * 0.62;
      const r = hh * 0.72;
      const midX = bx + bodyW - r;
      // Leads
      ctx.beginPath();
      ctx.moveTo(x - hw, y - r * 0.45);
      ctx.lineTo(bx, y - r * 0.45);
      ctx.moveTo(x - hw, y + r * 0.45);
      ctx.lineTo(bx, y + r * 0.45);
      ctx.moveTo(midX + r, y);
      ctx.lineTo(x + hw, y);
      ctx.stroke();
      // D-body
      ctx.beginPath();
      ctx.moveTo(bx, y - r);
      ctx.lineTo(midX, y - r);
      ctx.arc(midX, y, r, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(bx, y + r);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'or_gate': {
      const bx = x - hw * 0.64;
      const tipX = x + hw * 0.66;
      const gh = hh * 0.72;
      ctx.beginPath();
      ctx.moveTo(x - hw, y - gh * 0.45);
      ctx.lineTo(bx + 6, y - gh * 0.45);
      ctx.moveTo(x - hw, y + gh * 0.45);
      ctx.lineTo(bx + 6, y + gh * 0.45);
      ctx.moveTo(tipX, y);
      ctx.lineTo(x + hw, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx, y - gh);
      ctx.quadraticCurveTo(x + hw * 0.15, y - gh, tipX, y);
      ctx.quadraticCurveTo(x + hw * 0.15, y + gh, bx, y + gh);
      ctx.quadraticCurveTo(bx + hw * 0.28, y, bx, y - gh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'not_gate': {
      const bx = x - hw * 0.58;
      const tipX = x + hw * 0.44;
      const gh = hh * 0.65;
      const bubR = Math.max(4, Math.min(7, w * 0.06));
      ctx.beginPath();
      ctx.moveTo(x - hw, y);
      ctx.lineTo(bx, y);
      ctx.moveTo(tipX + bubR * 2, y);
      ctx.lineTo(x + hw, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx, y - gh);
      ctx.lineTo(tipX, y);
      ctx.lineTo(bx, y + gh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(tipX + bubR, y, bubR, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'transistor': {
      const cy = y - hh * 0.12;
      const r = Math.min(hw * 0.5, hh * 0.56);
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();

      // Base bar + leads
      const barX = x - r * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(barX, cy);
      ctx.moveTo(barX, cy - r * 0.52);
      ctx.lineTo(barX, cy + r * 0.52);
      // Collector
      ctx.moveTo(barX, cy - r * 0.25);
      ctx.lineTo(x + r * 0.45, cy - r * 0.65);
      ctx.lineTo(x + r * 0.45, cy - r - 6);
      // Emitter
      ctx.moveTo(barX, cy + r * 0.25);
      ctx.lineTo(x + r * 0.45, cy + r * 0.65);
      ctx.lineTo(x + r * 0.45, cy + r + 6);
      ctx.stroke();
      return;
    }

    // --- Physics Shapes ---
    case 'spring': {
      const cy = y - hh * 0.12;
      const coilW = w * 0.68;
      const amp = hh * 0.44;
      const startX = x - coilW / 2;
      const turns = 8;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(startX, cy);
      for (let i = 0; i < turns; i++) {
        const px = startX + ((i + 0.5) / turns) * coilW;
        const py = cy + (i % 2 === 0 ? -amp : amp);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x + coilW / 2, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      return;
    }
    case 'pulley': {
      const cy = y - hh * 0.12;
      const r = Math.min(hw * 0.54, hh * 0.54);
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Hub
      ctx.beginPath();
      ctx.arc(x, cy, Math.max(3, r * 0.24), 0, Math.PI * 2);
      ctx.stroke();
      // Bracket to top
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x, cy - r * 1.3);
      ctx.moveTo(x - r * 0.6, cy - r * 1.3);
      ctx.lineTo(x + r * 0.6, cy - r * 1.3);
      ctx.stroke();
      return;
    }
    case 'incline': {
      ctx.beginPath();
      ctx.moveTo(x - hw, y + hh);
      ctx.lineTo(x + hw, y + hh);
      ctx.lineTo(x + hw, y - hh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Right angle corner indicator
      const sq = Math.min(14, w * 0.14, h * 0.18);
      ctx.beginPath();
      ctx.moveTo(x + hw - sq, y + hh);
      ctx.lineTo(x + hw - sq, y + hh - sq);
      ctx.lineTo(x + hw, y + hh - sq);
      ctx.stroke();
      return;
    }
    case 'lens': {
      const cy = y - hh * 0.1;
      const lensH = hh * 0.68;
      const bulge = hw * 0.42;
      ctx.beginPath();
      ctx.moveTo(x, cy - lensH);
      ctx.quadraticCurveTo(x + bulge, cy, x, cy + lensH);
      ctx.quadraticCurveTo(x - bulge, cy, x, cy - lensH);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, cy - lensH - 6);
      ctx.lineTo(x, cy + lensH + 6);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'wave': {
      const cy = y - hh * 0.12;
      const amp = hh * 0.48;
      const steps = 40;
      // Baseline
      ctx.save();
      ctx.globalAlpha *= 0.4;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = x - hw + t * w;
        const py = cy - Math.sin(t * Math.PI * 4) * amp;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      return;
    }

    // --- Math & Geometry Shapes ---
    case 'axes_2d': {
      if (isFilled) {
        drawRoundedRect(ctx, x - hw, y - hh, w, h, 8);
        ctx.fill();
      }
      // Grid ticks & axes
      ctx.beginPath();
      ctx.moveTo(x - hw + 8, y);
      ctx.lineTo(x + hw - 8, y);
      ctx.moveTo(x, y + hh - 8);
      ctx.lineTo(x, y - hh + 8);
      ctx.stroke();

      // Tick marks
      const tickStep = 20;
      ctx.beginPath();
      for (let tx = tickStep; tx < hw - 14; tx += tickStep) {
        ctx.moveTo(x + tx, y - 3);
        ctx.lineTo(x + tx, y + 3);
        ctx.moveTo(x - tx, y - 3);
        ctx.lineTo(x - tx, y + 3);
      }
      for (let ty = tickStep; ty < hh - 14; ty += tickStep) {
        ctx.moveTo(x - 3, y + ty);
        ctx.lineTo(x + 3, y + ty);
        ctx.moveTo(x - 3, y - ty);
        ctx.lineTo(x + 3, y - ty);
      }
      ctx.stroke();

      drawArrowhead(ctx, x + hw - 6, y, 0, 8, border);
      drawArrowhead(ctx, x - hw + 6, y, Math.PI, 8, border);
      drawArrowhead(ctx, x, y - hh + 6, -Math.PI / 2, 8, border);
      drawArrowhead(ctx, x, y + hh - 6, Math.PI / 2, 8, border);
      return;
    }
    case 'vector_arrow': {
      const cy = y - hh * 0.12;
      ctx.save();
      ctx.lineWidth = Math.max(2.4, node.borderWidth ?? 2.6);
      ctx.beginPath();
      ctx.moveTo(x - hw + 6, cy);
      ctx.lineTo(x + hw - 10, cy);
      ctx.stroke();
      ctx.restore();
      drawArrowhead(ctx, x + hw - 4, cy, 0, 12, border);
      return;
    }
    case 'angle_arc': {
      const vx = x - hw * 0.62;
      const vy = y + hh * 0.36;
      const rayLen = Math.min(w * 0.72, h * 0.85);
      const ang = -Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(vx + rayLen, vy);
      ctx.lineTo(vx, vy);
      ctx.lineTo(vx + Math.cos(ang) * rayLen, vy + Math.sin(ang) * rayLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(vx, vy, rayLen * 0.42, ang, 0, false);
      ctx.stroke();
      return;
    }
    case 'venn_2': {
      const r = Math.min(hw * 0.56, hh * 0.82);
      const offset = r * 0.52;
      ctx.save();
      if (isFilled) {
        ctx.globalAlpha *= 0.45;
        ctx.beginPath();
        ctx.arc(x - offset, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + offset, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x - offset, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + offset, y, r, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'bell_curve': {
      const baseY = y + hh * 0.62;
      const amp = hh * 1.1;
      const steps = 40;
      ctx.beginPath();
      ctx.moveTo(x - hw + 6, baseY);
      ctx.lineTo(x + hw - 6, baseY);
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * 6 - 3; // -3..+3 sigma
        const px = x + (u / 3) * (hw - 8);
        const py = baseY - Math.exp(-0.5 * u * u) * amp;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      if (isFilled) {
        ctx.lineTo(x + hw - 8, baseY);
        ctx.lineTo(x - hw + 8, baseY);
        ctx.closePath();
        ctx.save();
        ctx.globalAlpha *= 0.45;
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, baseY - amp);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'cube_3d': {
      const d = Math.min(w, h) * 0.22;
      const fx = x - hw;
      const fy = y - hh + d;
      const fw = w - d;
      const fh = h - d;
      // Back face
      ctx.beginPath();
      ctx.rect(fx + d, y - hh, fw, fh);
      if (isFilled) {
        ctx.save();
        ctx.globalAlpha *= 0.65;
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
      // Front face
      ctx.beginPath();
      ctx.rect(fx, fy, fw, fh);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Connecting edges
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + d, y - hh);
      ctx.moveTo(fx + fw, fy);
      ctx.lineTo(fx + fw + d, y - hh);
      ctx.moveTo(fx + fw, fy + fh);
      ctx.lineTo(fx + fw + d, y - hh + fh);
      ctx.moveTo(fx, fy + fh);
      ctx.lineTo(fx + d, y - hh + fh);
      ctx.stroke();
      return;
    }
    case 'cone_3d': {
      const cap = Math.min(14, hh * 0.25);
      const baseY = y + hh - cap;
      ctx.beginPath();
      ctx.moveTo(x, y - hh);
      ctx.lineTo(x + hw, baseY);
      ctx.ellipse(x, baseY, hw, cap, 0, 0, Math.PI, false);
      ctx.lineTo(x - hw, baseY);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, baseY, hw, cap, 0, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'matrix_box': {
      if (isFilled) {
        ctx.save();
        ctx.globalAlpha *= 0.35;
        ctx.fillRect(x - hw + 4, y - hh + 4, w - 8, h - 8);
        ctx.restore();
      }
      const lip = Math.min(12, w * 0.16);
      ctx.beginPath();
      // Left bracket
      ctx.moveTo(x - hw + lip, y - hh + 4);
      ctx.lineTo(x - hw + 4, y - hh + 4);
      ctx.lineTo(x - hw + 4, y + hh - 4);
      ctx.lineTo(x - hw + lip, y + hh - 4);
      // Right bracket
      ctx.moveTo(x + hw - lip, y - hh + 4);
      ctx.lineTo(x + hw - 4, y - hh + 4);
      ctx.lineTo(x + hw - 4, y + hh - 4);
      ctx.lineTo(x + hw - lip, y + hh - 4);
      ctx.stroke();
      return;
    }

    // --- Additional Physics Shapes ---
    case 'concave_lens': {
      const cy = y - hh * 0.1;
      const lensH = hh * 0.68;
      const edgeW = Math.max(10, hw * 0.5);
      const pinch = edgeW * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - edgeW, cy - lensH);
      ctx.lineTo(x + edgeW, cy - lensH);
      ctx.quadraticCurveTo(x + pinch, cy, x + edgeW, cy + lensH);
      ctx.lineTo(x - edgeW, cy + lensH);
      ctx.quadraticCurveTo(x - pinch, cy, x - edgeW, cy - lensH);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, cy - lensH - 6);
      ctx.lineTo(x, cy + lensH + 6);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'prism': {
      ctx.beginPath();
      ctx.moveTo(x, y - hh + 4);
      ctx.lineTo(x + hw - 4, y + hh - 4);
      ctx.lineTo(x - hw + 4, y + hh - 4);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Subtle refracted dispersion ray hint inside
      ctx.save();
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.85, y - hh * 0.05);
      ctx.lineTo(x - hw * 0.25, y - hh * 0.05);
      ctx.lineTo(x + hw * 0.35, y + hh * 0.18);
      ctx.lineTo(x + hw * 0.9, y + hh * 0.32);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'concave_mirror': {
      const cy = y - hh * 0.1;
      const mh = hh * 0.68;
      const arcX = x + hw * 0.25;
      ctx.beginPath();
      ctx.moveTo(arcX - hw * 0.4, cy - mh);
      ctx.quadraticCurveTo(arcX + hw * 0.35, cy, arcX - hw * 0.4, cy + mh);
      ctx.stroke();
      // Hatch lines on reflective backing
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const t = (i + 3) / 6;
        const my = cy - mh * 0.8 + t * mh * 1.6;
        const curveX = arcX + Math.sin(t * Math.PI) * hw * 0.28 - hw * 0.12;
        ctx.moveTo(curveX, my);
        ctx.lineTo(curveX + 7, my - 5);
      }
      ctx.stroke();
      return;
    }
    case 'pendulum': {
      const pivotY = y - hh + 6;
      const bobR = Math.min(14, hw * 0.26, hh * 0.22);
      const bobX = x + hw * 0.32;
      const bobY = y + hh * 0.34;
      // Ceiling support
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.5, pivotY);
      ctx.lineTo(x + hw * 0.5, pivotY);
      ctx.stroke();
      // Vertical equilibrium dashed line
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha *= 0.5;
      ctx.beginPath();
      ctx.moveTo(x, pivotY);
      ctx.lineTo(x, bobY + bobR);
      ctx.stroke();
      ctx.restore();
      // String + bob
      ctx.beginPath();
      ctx.moveTo(x, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bobX, bobY, bobR, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'magnet_bar': {
      const bh = hh * 0.66;
      // Left North half (red tint if filled)
      if (isFilled) {
        ctx.save();
        ctx.fillStyle = '#fecaca';
        ctx.fillRect(x - hw, y - bh, hw, bh * 2);
        ctx.fillStyle = '#bfdbfe';
        ctx.fillRect(x, y - bh, hw, bh * 2);
        ctx.restore();
      }
      ctx.strokeRect(x - hw, y - bh, w, bh * 2);
      ctx.beginPath();
      ctx.moveTo(x, y - bh);
      ctx.lineTo(x, y + bh);
      ctx.stroke();
      ctx.save();
      ctx.fillStyle = border;
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', x - hw * 0.55, y);
      ctx.fillText('S', x + hw * 0.55, y);
      ctx.restore();
      return;
    }
    case 'meter_circle': {
      const r = Math.min(hw, hh) * 0.84;
      ctx.beginPath();
      ctx.moveTo(x - hw, y);
      ctx.lineTo(x - r, y);
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + hw, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }

    // --- Additional Maths Shapes ---
    case 'number_line': {
      const cy = y - hh * 0.14;
      ctx.beginPath();
      ctx.moveTo(x - hw + 8, cy);
      ctx.lineTo(x + hw - 8, cy);
      const ticks = 6;
      for (let i = 0; i <= ticks; i++) {
        const tx = x - hw + 18 + (i / ticks) * (w - 36);
        const tickH = i === ticks / 2 ? 7 : 4;
        ctx.moveTo(tx, cy - tickH);
        ctx.lineTo(tx, cy + tickH);
      }
      ctx.stroke();
      drawArrowhead(ctx, x + hw - 6, cy, 0, 8, border);
      drawArrowhead(ctx, x - hw + 6, cy, Math.PI, 8, border);
      return;
    }
    case 'parabola': {
      if (isFilled) {
        drawRoundedRect(ctx, x - hw, y - hh, w, h, 8);
        ctx.fill();
      }
      const ox = x;
      const oy = y + hh * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - hw + 8, oy);
      ctx.lineTo(x + hw - 8, oy);
      ctx.moveTo(ox, y + hh - 6);
      ctx.lineTo(ox, y - hh + 12);
      ctx.stroke();
      ctx.save();
      ctx.lineWidth = Math.max(2, node.borderWidth ?? 2.2);
      ctx.beginPath();
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * 2 - 1;
        const px = ox + u * (hw - 14);
        const py = oy - u * u * (h * 0.56);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'right_triangle': {
      ctx.beginPath();
      ctx.moveTo(x - hw + 4, y - hh + 4);
      ctx.lineTo(x - hw + 4, y + hh - 4);
      ctx.lineTo(x + hw - 4, y + hh - 4);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      const sq = Math.min(14, w * 0.14, h * 0.18);
      ctx.beginPath();
      ctx.moveTo(x - hw + 4 + sq, y + hh - 4);
      ctx.lineTo(x - hw + 4 + sq, y + hh - 4 - sq);
      ctx.lineTo(x - hw + 4, y + hh - 4 - sq);
      ctx.stroke();
      return;
    }
    case 'venn_3': {
      const r = Math.min(hw, hh) * 0.5;
      const d = r * 0.55;
      const cy = y + hh * 0.08;
      const centers = [
        { cx: x, cy: cy - d * 0.72 },
        { cx: x - d * 0.85, cy: cy + d * 0.58 },
        { cx: x + d * 0.85, cy: cy + d * 0.58 },
      ];
      if (isFilled) {
        ctx.save();
        ctx.globalAlpha *= 0.35;
        centers.forEach((c) => {
          ctx.beginPath();
          ctx.arc(c.cx, c.cy, r, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.restore();
      }
      centers.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.cx, c.cy, r, 0, Math.PI * 2);
        ctx.stroke();
      });
      return;
    }
    case 'pie_chart': {
      const cy = y - hh * 0.12;
      const r = Math.min(hw, hh) * 0.66;
      const slices = [
        { a0: -Math.PI / 2, a1: Math.PI * 0.15, alpha: 0.9 },
        { a0: Math.PI * 0.15, a1: Math.PI * 0.9, alpha: 0.55 },
        { a0: Math.PI * 0.9, a1: Math.PI * 1.5, alpha: 0.3 },
      ];
      slices.forEach((sl) => {
        ctx.beginPath();
        ctx.moveTo(x, cy);
        ctx.arc(x, cy, r, sl.a0, sl.a1);
        ctx.closePath();
        if (isFilled) {
          ctx.save();
          ctx.globalAlpha *= sl.alpha;
          ctx.fill();
          ctx.restore();
        }
        ctx.stroke();
      });
      return;
    }
    case 'sphere_3d': {
      const r = Math.min(hw, hh) * 0.92;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.32, 0, 0, Math.PI);
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.32, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'pyramid_3d': {
      const apexX = x;
      const apexY = y - hh + 4;
      const leftX = x - hw + 6;
      const rightX = x + hw - 6;
      const frontY = y + hh - 6;
      const midX = x + hw * 0.18;
      const backY = y + hh * 0.56;
      ctx.beginPath();
      ctx.moveTo(apexX, apexY);
      ctx.lineTo(leftX, frontY - hh * 0.14);
      ctx.lineTo(midX, frontY);
      ctx.lineTo(rightX, backY);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(apexX, apexY);
      ctx.lineTo(midX, frontY);
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(leftX, frontY - hh * 0.14);
      ctx.lineTo(rightX, backY);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // --- Biology Shapes ---
    case 'cell_animal': {
      const cy = y - hh * 0.1;
      const rx = hw * 0.88;
      const ry = hh * 0.66;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Nucleus + nucleolus
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.12, cy - ry * 0.05, rx * 0.3, ry * 0.36, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - rx * 0.12, cy - ry * 0.05, Math.max(3, rx * 0.1), 0, Math.PI * 2);
      ctx.fillStyle = border;
      ctx.fill();
      // Organelle hints
      ctx.beginPath();
      ctx.ellipse(x + rx * 0.44, cy - ry * 0.25, rx * 0.16, ry * 0.1, 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + rx * 0.35, cy + ry * 0.36, rx * 0.1, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'cell_plant': {
      const cy = y - hh * 0.1;
      const ch = hh * 0.66;
      const inset = hw * 0.22;
      const drawHex = (pad: number) => {
        ctx.beginPath();
        ctx.moveTo(x - hw + inset + pad, cy - ch + pad);
        ctx.lineTo(x + hw - inset - pad, cy - ch + pad);
        ctx.lineTo(x + hw - pad, cy);
        ctx.lineTo(x + hw - inset - pad, cy + ch - pad);
        ctx.lineTo(x - hw + inset + pad, cy + ch - pad);
        ctx.lineTo(x - hw + pad, cy);
        ctx.closePath();
      };
      drawHex(0);
      if (isFilled) ctx.fill();
      ctx.stroke();
      drawHex(5);
      ctx.stroke();
      // Large central vacuole
      ctx.beginPath();
      ctx.ellipse(x + hw * 0.12, cy, hw * 0.34, ch * 0.46, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Nucleus
      ctx.beginPath();
      ctx.arc(x - hw * 0.42, cy - ch * 0.22, Math.min(hw, ch) * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'dna_helix': {
      const cy = y - hh * 0.12;
      const amp = hh * 0.44;
      const span = w * 0.84;
      const sx = x - span / 2;
      const steps = 32;
      // Base-pair rungs
      ctx.beginPath();
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const px = sx + t * span;
        const y1 = cy + Math.sin(t * Math.PI * 2.5) * amp;
        const y2 = cy - Math.sin(t * Math.PI * 2.5) * amp;
        ctx.moveTo(px, y1);
        ctx.lineTo(px, y2);
      }
      ctx.stroke();
      // Twin helical backbones
      [1, -1].forEach((dir) => {
        ctx.save();
        ctx.lineWidth = Math.max(2, node.borderWidth ?? 2.2);
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = sx + t * span;
          const py = cy + dir * Math.sin(t * Math.PI * 2.5) * amp;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      });
      return;
    }
    case 'mitochondria': {
      const cy = y - hh * 0.12;
      const rx = hw * 0.84;
      const ry = hh * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Inner folded cristae
      ctx.beginPath();
      const loops = 5;
      for (let i = 0; i <= loops * 2; i++) {
        const t = i / (loops * 2);
        const px = x - rx * 0.68 + t * rx * 1.36;
        const py = cy + (i % 2 === 0 ? -ry * 0.48 : ry * 0.48);
        if (i === 0) ctx.moveTo(px, cy);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      return;
    }
    case 'chloroplast': {
      const cy = y - hh * 0.12;
      const rx = hw * 0.84;
      const ry = hh * 0.52;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, cy, rx * 0.84, ry * 0.78, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Thylakoid stacks (grana)
      [-0.36, 0, 0.36].forEach((offset) => {
        const gx = x + rx * offset;
        for (let d = -1; d <= 1; d++) {
          ctx.strokeRect(gx - 8, cy + d * 6 - 2, 16, 4);
        }
      });
      return;
    }
    case 'neuron': {
      const cy = y - hh * 0.12;
      const sx = x - hw * 0.46;
      const somaR = Math.min(hw * 0.22, hh * 0.34);
      // Soma star-like cell body
      ctx.beginPath();
      ctx.arc(sx, cy, somaR, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Nucleus
      ctx.beginPath();
      ctx.arc(sx, cy, somaR * 0.36, 0, Math.PI * 2);
      ctx.stroke();
      // Dendrites
      ctx.beginPath();
      [-0.85, -0.35, 0.35, 0.85].forEach((ang) => {
        const dx = sx - Math.cos(ang) * somaR * 1.85;
        const dy = cy + Math.sin(ang) * somaR * 1.75;
        ctx.moveTo(sx - Math.cos(ang) * somaR, cy + Math.sin(ang) * somaR);
        ctx.lineTo(dx, dy);
      });
      // Axon + myelin sheaths
      const axonEnd = x + hw * 0.62;
      ctx.moveTo(sx + somaR, cy);
      ctx.lineTo(axonEnd, cy);
      // Axon terminals
      ctx.moveTo(axonEnd, cy);
      ctx.lineTo(x + hw * 0.88, cy - hh * 0.28);
      ctx.moveTo(axonEnd, cy);
      ctx.lineTo(x + hw * 0.9, cy);
      ctx.moveTo(axonEnd, cy);
      ctx.lineTo(x + hw * 0.88, cy + hh * 0.28);
      ctx.stroke();
      // Myelin blocks
      for (let m = 0; m < 3; m++) {
        const mx = sx + somaR + 8 + m * ((axonEnd - sx - somaR - 14) / 3);
        ctx.fillStyle = isFilled ? node.color : '#ffffff';
        drawRoundedRect(ctx, mx, cy - 6, 14, 12, 4);
        ctx.fill();
        ctx.stroke();
      }
      return;
    }
    case 'antibody': {
      const cy = y - hh * 0.12;
      ctx.save();
      ctx.lineWidth = Math.max(2.6, node.borderWidth ?? 2.8);
      ctx.beginPath();
      // Heavy chain Y
      ctx.moveTo(x, cy + hh * 0.56);
      ctx.lineTo(x, cy);
      ctx.lineTo(x - hw * 0.48, cy - hh * 0.52);
      ctx.moveTo(x, cy);
      ctx.lineTo(x + hw * 0.48, cy - hh * 0.52);
      // Light chain arms
      ctx.moveTo(x - hw * 0.26, cy - hh * 0.12);
      ctx.lineTo(x - hw * 0.64, cy - hh * 0.4);
      ctx.moveTo(x + hw * 0.26, cy - hh * 0.12);
      ctx.lineTo(x + hw * 0.64, cy - hh * 0.4);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'virus_capsid': {
      const cy = y - hh * 0.26;
      const r = Math.min(hw * 0.42, hh * 0.38);
      // Hexagonal capsid head
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = x + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Tail sheath + fibers
      const neckY = cy + r;
      const basePlateY = y + hh * 0.34;
      ctx.strokeRect(x - 5, neckY, 10, basePlateY - neckY);
      ctx.beginPath();
      ctx.moveTo(x - 10, basePlateY);
      ctx.lineTo(x + 10, basePlateY);
      ctx.moveTo(x - 8, basePlateY);
      ctx.lineTo(x - hw * 0.55, basePlateY + hh * 0.22);
      ctx.moveTo(x + 8, basePlateY);
      ctx.lineTo(x + hw * 0.55, basePlateY + hh * 0.22);
      ctx.moveTo(x - 4, basePlateY);
      ctx.lineTo(x - hw * 0.32, basePlateY + hh * 0.26);
      ctx.moveTo(x + 4, basePlateY);
      ctx.lineTo(x + hw * 0.32, basePlateY + hh * 0.26);
      ctx.stroke();
      return;
    }
    case 'leaf_organ': {
      const cy = y - hh * 0.12;
      const rx = hw * 0.78;
      const ry = hh * 0.56;
      ctx.beginPath();
      ctx.moveTo(x - rx, cy);
      ctx.quadraticCurveTo(x, cy - ry * 1.4, x + rx, cy);
      ctx.quadraticCurveTo(x, cy + ry * 1.4, x - rx, cy);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Midrib + veins
      ctx.beginPath();
      ctx.moveTo(x - rx - 8, cy);
      ctx.lineTo(x + rx * 0.85, cy);
      [-0.35, 0, 0.35].forEach((vx) => {
        ctx.moveTo(x + rx * vx, cy);
        ctx.lineTo(x + rx * (vx + 0.22), cy - ry * 0.48);
        ctx.moveTo(x + rx * vx, cy);
        ctx.lineTo(x + rx * (vx + 0.22), cy + ry * 0.48);
      });
      ctx.stroke();
      return;
    }
    case 'punnett_grid': {
      const gx = x - hw + 8;
      const gy = y - hh * 0.35;
      const gw = w - 16;
      const gh = h * 0.72;
      if (isFilled) {
        ctx.fillRect(gx, gy, gw, gh);
      }
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.beginPath();
      ctx.moveTo(gx + gw / 2, gy);
      ctx.lineTo(gx + gw / 2, gy + gh);
      ctx.moveTo(gx, gy + gh / 2);
      ctx.lineTo(gx + gw, gy + gh / 2);
      ctx.stroke();
      return;
    }

    // --- Chemistry Shapes ---
    case 'beaker': {
      const gx = x - hw * 0.54;
      const gw = w * 0.54;
      const topY = y - hh * 0.64;
      const botY = y + hh * 0.48;
      const gh = botY - topY;
      // Liquid fill inside lower 60%
      if (isFilled) {
        ctx.fillRect(gx + 2, topY + gh * 0.42, gw - 4, gh * 0.58 - 2);
      }
      ctx.beginPath();
      ctx.moveTo(gx - 6, topY);
      ctx.lineTo(gx, topY + 6);
      ctx.lineTo(gx, botY);
      ctx.lineTo(gx + gw, botY);
      ctx.lineTo(gx + gw, topY);
      ctx.lineTo(gx + gw + 4, topY);
      // Liquid meniscus line + ticks
      ctx.moveTo(gx, topY + gh * 0.42);
      ctx.lineTo(gx + gw, topY + gh * 0.42);
      for (let t = 1; t <= 3; t++) {
        const ty = topY + (t / 4) * gh;
        ctx.moveTo(gx + gw - 10, ty);
        ctx.lineTo(gx + gw, ty);
      }
      ctx.stroke();
      return;
    }
    case 'erlenmeyer_flask': {
      const topY = y - hh * 0.68;
      const neckY = y - hh * 0.24;
      const botY = y + hh * 0.48;
      const neckHalf = hw * 0.22;
      const baseHalf = hw * 0.72;
      const liqY = y + hh * 0.14;
      const liqHalf = neckHalf + ((liqY - neckY) / (botY - neckY)) * (baseHalf - neckHalf);

      if (isFilled) {
        ctx.beginPath();
        ctx.moveTo(x - liqHalf + 2, liqY);
        ctx.lineTo(x + liqHalf - 2, liqY);
        ctx.lineTo(x + baseHalf - 2, botY - 2);
        ctx.lineTo(x - baseHalf + 2, botY - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(x - neckHalf - 5, topY);
      ctx.lineTo(x + neckHalf + 5, topY);
      ctx.moveTo(x - neckHalf, topY);
      ctx.lineTo(x - neckHalf, neckY);
      ctx.lineTo(x - baseHalf, botY);
      ctx.lineTo(x + baseHalf, botY);
      ctx.lineTo(x + neckHalf, neckY);
      ctx.lineTo(x + neckHalf, topY);
      ctx.moveTo(x - liqHalf, liqY);
      ctx.lineTo(x + liqHalf, liqY);
      ctx.stroke();
      return;
    }
    case 'round_flask': {
      const r = Math.min(hw * 0.62, hh * 0.42);
      const cy = y + hh * 0.1;
      const neckHalf = r * 0.32;
      const topY = y - hh * 0.68;
      if (isFilled) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, cy, r - 1, 0.15, Math.PI - 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(x - neckHalf, topY);
      ctx.lineTo(x - neckHalf, cy - r * 0.85);
      ctx.arc(x, cy, r, -Math.PI * 0.65, Math.PI * 1.65, true);
      ctx.lineTo(x + neckHalf, topY);
      ctx.moveTo(x - neckHalf - 5, topY);
      ctx.lineTo(x + neckHalf + 5, topY);
      ctx.stroke();
      return;
    }
    case 'test_tube': {
      const tubeW = Math.min(26, hw * 0.56);
      const halfT = tubeW / 2;
      const topY = y - hh * 0.66;
      const botArcY = y + hh * 0.34;
      if (isFilled) {
        ctx.beginPath();
        ctx.arc(x, botArcY, halfT - 1, 0, Math.PI);
        ctx.lineTo(x - halfT + 1, y - hh * 0.04);
        ctx.lineTo(x + halfT - 1, y - hh * 0.04);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(x - halfT - 5, topY);
      ctx.lineTo(x + halfT + 5, topY);
      ctx.moveTo(x - halfT, topY);
      ctx.lineTo(x - halfT, botArcY);
      ctx.arc(x, botArcY, halfT, Math.PI, 0, true);
      ctx.lineTo(x + halfT, topY);
      ctx.stroke();
      return;
    }
    case 'bunsen_burner': {
      const botY = y + hh * 0.48;
      const barrelTop = y - hh * 0.04;
      // Base
      ctx.strokeRect(x - hw * 0.48, botY - 8, hw * 0.96, 8);
      // Barrel
      ctx.strokeRect(x - 6, barrelTop, 12, botY - 8 - barrelTop);
      // Outer flame
      ctx.save();
      ctx.fillStyle = isFilled ? '#fb923c' : 'transparent';
      ctx.beginPath();
      ctx.moveTo(x, y - hh * 0.68);
      ctx.quadraticCurveTo(x + 14, barrelTop - 8, x, barrelTop);
      ctx.quadraticCurveTo(x - 14, barrelTop - 8, x, y - hh * 0.68);
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'benzene_ring': {
      const cy = y - hh * 0.1;
      const r = Math.min(hw, hh) * 0.64;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const px = x + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Aromatic delocalized ring
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.56, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'atom_bohr': {
      const cy = y - hh * 0.1;
      const rx = hw * 0.82;
      const ry = hh * 0.28;
      [0, Math.PI / 3, -Math.PI / 3].forEach((rot) => {
        ctx.beginPath();
        ctx.ellipse(x, cy, rx, ry, rot, 0, Math.PI * 2);
        ctx.stroke();
      });
      // Nucleus
      ctx.beginPath();
      ctx.arc(x, cy, Math.max(6, Math.min(rx, ry) * 0.42), 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Electron dots
      ctx.save();
      ctx.fillStyle = border;
      [
        { ex: x + rx * 0.88, ey: cy },
        { ex: x - rx * 0.44, ey: cy - rx * 0.72 },
        { ex: x - rx * 0.44, ey: cy + rx * 0.72 },
      ].forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.ex, pt.ey, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
      return;
    }
    case 'reaction_arrow': {
      const cy = y - hh * 0.12;
      const left = x - hw + 10;
      const right = x + hw - 10;
      ctx.beginPath();
      // Top forward half-arrow
      ctx.moveTo(left, cy - 5);
      ctx.lineTo(right, cy - 5);
      ctx.lineTo(right - 10, cy - 11);
      // Bottom reverse half-arrow
      ctx.moveTo(right, cy + 5);
      ctx.lineTo(left, cy + 5);
      ctx.lineTo(left + 10, cy + 11);
      ctx.stroke();
      return;
    }
    case 'bond_double': {
      const cy = y - hh * 0.12;
      ctx.beginPath();
      ctx.moveTo(x - hw + 10, cy - 4);
      ctx.lineTo(x + hw - 10, cy - 4);
      ctx.moveTo(x - hw + 10, cy + 4);
      ctx.lineTo(x + hw - 10, cy + 4);
      ctx.stroke();
      return;
    }
    case 'molecule_h2o': {
      const cy = y - hh * 0.14;
      const cr = Math.min(hw, hh) * 0.26;
      const sr = cr * 0.65;
      const leftX = x - hw * 0.56;
      const rightX = x + hw * 0.56;
      const satY = cy + hh * 0.28;
      // Bond lines
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(leftX, satY);
      ctx.moveTo(x, cy);
      ctx.lineTo(rightX, satY);
      ctx.stroke();
      // Central & satellite spheres
      [
        { cx: x, cy, r: cr },
        { cx: leftX, cy: satY, r: sr },
        { cx: rightX, cy: satY, r: sr },
      ].forEach((at) => {
        ctx.beginPath();
        ctx.arc(at.cx, at.cy, at.r, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
      });
      return;
    }

    // --- More Physics Shapes ---
    case 'convex_mirror': {
      const cy = y - hh * 0.1;
      const mh = hh * 0.68;
      const arcX = x - hw * 0.15;
      ctx.beginPath();
      ctx.moveTo(arcX + hw * 0.4, cy - mh);
      ctx.quadraticCurveTo(arcX - hw * 0.35, cy, arcX + hw * 0.4, cy + mh);
      ctx.stroke();
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const t = (i + 3) / 6;
        const my = cy - mh * 0.8 + t * mh * 1.6;
        const curveX = arcX + hw * 0.4 - Math.sin(t * Math.PI) * hw * 0.35;
        ctx.moveTo(curveX, my);
        ctx.lineTo(curveX + 7, my - 5);
      }
      ctx.stroke();
      return;
    }
    case 'ray_source': {
      const cy = y - hh * 0.12;
      const boxW = hw * 0.85;
      const boxH = hh * 0.46;
      drawRoundedRect(ctx, x - hw + 4, cy - boxH, boxW, boxH * 2, 4);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Collimated emitter beam
      ctx.beginPath();
      ctx.moveTo(x - hw + 4 + boxW, cy);
      ctx.lineTo(x + hw - 6, cy);
      ctx.stroke();
      drawArrowhead(ctx, x + hw - 4, cy, 0, 8, border);
      return;
    }
    case 'solenoid': {
      const cy = y - hh * 0.12;
      const coreW = w * 0.68;
      const coreH = hh * 0.42;
      if (isFilled) {
        ctx.save();
        ctx.globalAlpha *= 0.45;
        ctx.fillRect(x - coreW / 2, cy - coreH, coreW, coreH * 2);
        ctx.restore();
      }
      ctx.strokeRect(x - coreW / 2, cy - coreH, coreW, coreH * 2);
      // Helical windings + leads
      ctx.beginPath();
      ctx.moveTo(x - hw, cy + coreH);
      ctx.lineTo(x - coreW / 2, cy + coreH);
      const turns = 6;
      for (let i = 0; i < turns; i++) {
        const tx = x - coreW / 2 + (i / turns) * coreW;
        const step = coreW / turns;
        ctx.moveTo(tx + step * 0.15, cy - coreH - 4);
        ctx.quadraticCurveTo(tx + step * 0.5, cy - coreH - 12, tx + step * 0.85, cy + coreH + 4);
      }
      ctx.moveTo(x + coreW / 2, cy + coreH);
      ctx.lineTo(x + hw, cy + coreH);
      ctx.stroke();
      return;
    }
    case 'field_lines': {
      const cy = y - hh * 0.12;
      const rx = hw * 0.78;
      const ry = hh * 0.52;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, cy, rx * 0.58, ry * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Center flux vector & directional arrowheads
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.95, cy);
      ctx.lineTo(x + rx * 0.95, cy);
      ctx.stroke();
      drawArrowhead(ctx, x + rx * 0.92, cy, 0, 7, border);
      drawArrowhead(ctx, x - 6, cy - ry, Math.PI, 6, border);
      drawArrowhead(ctx, x + 6, cy + ry, 0, 6, border);
      return;
    }
    case 'lever_fulcrum': {
      const fulY = y + hh * 0.42;
      const pivotY = y - hh * 0.04;
      // Fulcrum triangle
      ctx.beginPath();
      ctx.moveTo(x, pivotY);
      ctx.lineTo(x + 16, fulY);
      ctx.lineTo(x - 16, fulY);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Tilted lever beam
      ctx.save();
      ctx.lineWidth = Math.max(3, node.borderWidth ?? 3);
      ctx.beginPath();
      ctx.moveTo(x - hw + 8, pivotY - 12);
      ctx.lineTo(x + hw - 8, pivotY + 12);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'cart_wheels': {
      const bodyTop = y - hh * 0.48;
      const bodyH = hh * 0.62;
      drawRoundedRect(ctx, x - hw + 10, bodyTop, w - 20, bodyH, 6);
      if (isFilled) ctx.fill();
      ctx.stroke();
      const wr = Math.min(11, hh * 0.24);
      const wy = bodyTop + bodyH + wr;
      [x - hw * 0.45, x + hw * 0.45].forEach((wx) => {
        ctx.beginPath();
        ctx.arc(wx, wy, wr, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
      });
      return;
    }
    case 'thermometer': {
      const cy = y - hh * 0.1;
      const bulbR = Math.min(13, hw * 0.28);
      const bulbY = cy + hh * 0.44;
      const stemTop = cy - hh * 0.64;
      const stemW = Math.max(8, bulbR * 0.72);
      ctx.beginPath();
      ctx.roundRect(x - stemW / 2, stemTop, stemW, bulbY - stemTop, stemW / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, bulbY, bulbR, 0, Math.PI * 2);
      ctx.save();
      ctx.fillStyle = isFilled ? '#ef4444' : 'transparent';
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.restore();
      // Scale ticks
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const ty = stemTop + 8 + i * ((bulbY - bulbR - stemTop - 12) / 3);
        ctx.moveTo(x + stemW / 2, ty);
        ctx.lineTo(x + stemW / 2 + 7, ty);
      }
      ctx.stroke();
      return;
    }
    case 'piston_cylinder': {
      const cy = y - hh * 0.1;
      const ch = hh * 0.56;
      const left = x - hw + 10;
      const right = x + hw - 10;
      // Gas chamber fill
      const pistX = x + hw * 0.14;
      if (isFilled) {
        ctx.fillRect(left + 2, cy - ch + 2, pistX - left - 4, ch * 2 - 4);
      }
      // Open-right cylinder walls
      ctx.beginPath();
      ctx.moveTo(right, cy - ch);
      ctx.lineTo(left, cy - ch);
      ctx.lineTo(left, cy + ch);
      ctx.lineTo(right, cy + ch);
      ctx.stroke();
      // Piston head + rod
      ctx.fillStyle = border;
      ctx.fillRect(pistX - 4, cy - ch + 2, 8, ch * 2 - 4);
      ctx.beginPath();
      ctx.moveTo(pistX + 4, cy);
      ctx.lineTo(right + 4, cy);
      ctx.stroke();
      return;
    }
    case 'projectile_arc': {
      const baseY = y + hh * 0.42;
      const sx = x - hw + 12;
      const ex = x + hw - 12;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(ex, baseY);
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.quadraticCurveTo(x, y - hh * 0.95, ex, baseY);
      ctx.stroke();
      ctx.restore();
      // Peak marker dot
      ctx.beginPath();
      ctx.arc(x, y - hh * 0.27, 4, 0, Math.PI * 2);
      ctx.fillStyle = border;
      ctx.fill();
      return;
    }

    // --- More Schematics & Electronics Shapes ---
    case 'opamp': {
      const left = x - hw * 0.58;
      const right = x + hw * 0.62;
      ctx.beginPath();
      ctx.moveTo(left, y - hh * 0.72);
      ctx.lineTo(right, y);
      ctx.lineTo(left, y + hh * 0.72);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      // + / - input leads & output lead
      ctx.beginPath();
      ctx.moveTo(x - hw, y - hh * 0.34);
      ctx.lineTo(left, y - hh * 0.34);
      ctx.moveTo(x - hw, y + hh * 0.34);
      ctx.lineTo(left, y + hh * 0.34);
      ctx.moveTo(right, y);
      ctx.lineTo(x + hw, y);
      ctx.stroke();
      ctx.save();
      ctx.fillStyle = border;
      ctx.font = '700 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', left + 10, y - hh * 0.34);
      ctx.fillText('−', left + 10, y + hh * 0.34);
      ctx.restore();
      return;
    }
    case 'xor_gate': {
      const bx = x - hw * 0.34;
      const gh = hh * 0.68;
      ctx.beginPath();
      ctx.moveTo(x - hw, y - gh * 0.48);
      ctx.lineTo(bx - 6, y - gh * 0.48);
      ctx.moveTo(x - hw, y + gh * 0.48);
      ctx.lineTo(bx - 6, y + gh * 0.48);
      ctx.moveTo(x + hw * 0.6, y);
      ctx.lineTo(x + hw, y);
      ctx.stroke();
      // Extra XOR curved input shield
      ctx.beginPath();
      ctx.moveTo(bx - 8, y - gh);
      ctx.quadraticCurveTo(bx + hw * 0.1, y, bx - 8, y + gh);
      ctx.stroke();
      // Main OR body
      ctx.beginPath();
      ctx.moveTo(bx, y - gh);
      ctx.quadraticCurveTo(x + hw * 0.3, y - gh, x + hw * 0.6, y);
      ctx.quadraticCurveTo(x + hw * 0.3, y + gh, bx, y + gh);
      ctx.quadraticCurveTo(bx + hw * 0.18, y, bx, y - gh);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'transformer': {
      const cy = y - hh * 0.12;
      const ch = hh * 0.56;
      // Dual core lines
      ctx.beginPath();
      ctx.moveTo(x - 3, cy - ch);
      ctx.lineTo(x - 3, cy + ch);
      ctx.moveTo(x + 3, cy - ch);
      ctx.lineTo(x + 3, cy + ch);
      ctx.stroke();
      // Primary & secondary coil bumps
      const bumps = 4;
      const step = (ch * 2) / bumps;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy - ch);
      ctx.lineTo(x - 10, cy - ch);
      for (let i = 0; i < bumps; i++) {
        ctx.arc(x - 10, cy - ch + (i + 0.5) * step, step / 2, -Math.PI / 2, Math.PI / 2, false);
      }
      ctx.lineTo(x - hw, cy + ch);
      ctx.moveTo(x + hw, cy - ch);
      ctx.lineTo(x + 10, cy - ch);
      for (let i = 0; i < bumps; i++) {
        ctx.arc(x + 10, cy - ch + (i + 0.5) * step, step / 2, -Math.PI / 2, Math.PI / 2, true);
      }
      ctx.lineTo(x + hw, cy + ch);
      ctx.stroke();
      return;
    }
    case 'fuse_sym': {
      const cy = y - hh * 0.14;
      const bw = w * 0.48;
      const bh = Math.min(20, hh * 0.42);
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      ctx.strokeRect(x - bw / 2, cy - bh / 2, bw, bh);
      return;
    }
    case 'potentiometer': {
      const cy = y - hh * 0.1;
      const bodyW = w * 0.54;
      const amp = Math.min(11, hh * 0.28);
      const startX = x - bodyW / 2;
      const peaks = 6;
      ctx.beginPath();
      ctx.moveTo(x - hw, cy);
      ctx.lineTo(startX, cy);
      for (let i = 0; i < peaks; i++) {
        const px = startX + ((i + 0.5) / peaks) * bodyW;
        const py = cy + (i % 2 === 0 ? -amp : amp);
        ctx.lineTo(px, py);
      }
      ctx.lineTo(x + bodyW / 2, cy);
      ctx.lineTo(x + hw, cy);
      ctx.stroke();
      // Diagonal wiper arrow
      ctx.beginPath();
      ctx.moveTo(x, y - hh * 0.68);
      ctx.lineTo(x, cy - amp - 2);
      ctx.stroke();
      drawArrowhead(ctx, x, cy - amp, Math.PI / 2, 7, border);
      return;
    }

    // --- More Maths Shapes ---
    case 'axes_3d': {
      const ox = x - hw * 0.14;
      const oy = y + hh * 0.16;
      ctx.beginPath();
      // Z up
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, y - hh + 14);
      // X right-down
      ctx.moveTo(ox, oy);
      ctx.lineTo(x + hw - 10, oy);
      // Y diag forward-left
      ctx.moveTo(ox, oy);
      ctx.lineTo(x - hw + 14, y + hh - 10);
      ctx.stroke();
      drawArrowhead(ctx, ox, y - hh + 12, -Math.PI / 2, 7, border);
      drawArrowhead(ctx, x + hw - 8, oy, 0, 7, border);
      drawArrowhead(ctx, x - hw + 12, y + hh - 8, Math.PI * 0.78, 7, border);
      return;
    }
    case 'sine_graph': {
      if (isFilled) {
        drawRoundedRect(ctx, x - hw, y - hh, w, h, 8);
        ctx.fill();
      }
      const cy = y + hh * 0.08;
      ctx.beginPath();
      ctx.moveTo(x - hw + 8, cy);
      ctx.lineTo(x + hw - 8, cy);
      ctx.moveTo(x - hw * 0.56, y - hh + 18);
      ctx.lineTo(x - hw * 0.56, y + hh - 8);
      ctx.stroke();
      ctx.save();
      ctx.lineWidth = Math.max(2, node.borderWidth ?? 2.2);
      ctx.beginPath();
      const span = w - 24;
      for (let i = 0; i <= 36; i++) {
        const t = i / 36;
        const px = x - span / 2 + t * span;
        const py = cy - Math.sin(t * Math.PI * 2) * (hh * 0.52);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'unit_circle': {
      const cy = y - hh * 0.1;
      const r = Math.min(hw, hh) * 0.64;
      ctx.beginPath();
      ctx.moveTo(x - r - 12, cy);
      ctx.lineTo(x + r + 12, cy);
      ctx.moveTo(x, cy - r - 10);
      ctx.lineTo(x, cy + r + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      if (isFilled) {
        ctx.save();
        ctx.globalAlpha *= 0.35;
        ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
      // Radius ray at 40 deg + sin/cos projection
      const ang = -Math.PI / 4.2;
      const px = x + Math.cos(ang) * r;
      const py = cy + Math.sin(ang) * r;
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, cy);
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'ellipse_conic': {
      const cy = y - hh * 0.1;
      const rx = hw * 0.84;
      const ry = hh * 0.52;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x - rx, cy);
      ctx.lineTo(x + rx, cy);
      ctx.moveTo(x, cy - ry);
      ctx.lineTo(x, cy + ry);
      ctx.stroke();
      ctx.restore();
      const foci = Math.sqrt(Math.max(4, rx * rx - ry * ry));
      [x - foci, x + foci].forEach((fx) => {
        ctx.beginPath();
        ctx.arc(fx, cy, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = border;
        ctx.fill();
      });
      return;
    }
    case 'bar_chart': {
      if (isFilled) {
        drawRoundedRect(ctx, x - hw, y - hh, w, h, 8);
        ctx.fill();
      }
      const left = x - hw + 14;
      const bot = y + hh - 12;
      const right = x + hw - 10;
      const top = y - hh + 20;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, bot);
      ctx.lineTo(right, bot);
      ctx.stroke();
      const heights = [0.38, 0.78, 0.56, 0.92];
      const slot = (right - left - 12) / heights.length;
      const bw = Math.max(8, slot * 0.65);
      heights.forEach((hf, idx) => {
        const bx = left + 8 + idx * slot;
        const bh = (bot - top) * hf;
        ctx.save();
        ctx.fillStyle = border;
        ctx.globalAlpha *= 0.28 + idx * 0.16;
        ctx.fillRect(bx, bot - bh, bw, bh);
        ctx.restore();
        ctx.strokeRect(bx, bot - bh, bw, bh);
      });
      return;
    }
    case 'scatter_plot': {
      if (isFilled) {
        drawRoundedRect(ctx, x - hw, y - hh, w, h, 8);
        ctx.fill();
      }
      const left = x - hw + 14;
      const bot = y + hh - 12;
      const right = x + hw - 10;
      const top = y - hh + 20;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, bot);
      ctx.lineTo(right, bot);
      ctx.stroke();
      // Linear fit line
      ctx.save();
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(left + 6, bot - (bot - top) * 0.16);
      ctx.lineTo(right - 6, top + (bot - top) * 0.14);
      ctx.stroke();
      ctx.restore();
      // Scatter points
      const pts = [
        [0.14, 0.2],
        [0.28, 0.38],
        [0.44, 0.42],
        [0.6, 0.64],
        [0.74, 0.68],
        [0.88, 0.85],
      ];
      ctx.fillStyle = border;
      pts.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(left + px * (right - left), bot - py * (bot - top), 3.4, 0, Math.PI * 2);
        ctx.fill();
      });
      return;
    }
    case 'box_plot': {
      const cy = y - hh * 0.14;
      const left = x - hw + 14;
      const right = x + hw - 14;
      const boxL = x - hw * 0.36;
      const boxR = x + hw * 0.32;
      const boxH = Math.min(28, hh * 0.5);
      // Whiskers
      ctx.beginPath();
      ctx.moveTo(left, cy);
      ctx.lineTo(boxL, cy);
      ctx.moveTo(left, cy - boxH * 0.45);
      ctx.lineTo(left, cy + boxH * 0.45);
      ctx.moveTo(boxR, cy);
      ctx.lineTo(right, cy);
      ctx.moveTo(right, cy - boxH * 0.45);
      ctx.lineTo(right, cy + boxH * 0.45);
      ctx.stroke();
      // IQR Box & Median
      if (isFilled) ctx.fillRect(boxL, cy - boxH / 2, boxR - boxL, boxH);
      ctx.strokeRect(boxL, cy - boxH / 2, boxR - boxL, boxH);
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.04, cy - boxH / 2);
      ctx.lineTo(x - hw * 0.04, cy + boxH / 2);
      ctx.stroke();
      return;
    }
    case 'fraction_bar': {
      const cy = y - hh * 0.14;
      const bw = w - 16;
      const bh = Math.min(28, hh * 0.56);
      const bx = x - bw / 2;
      const by = cy - bh / 2;
      const parts = 4;
      if (isFilled) {
        ctx.fillRect(bx, by, bw * 0.75, bh);
      }
      ctx.strokeRect(bx, by, bw, bh);
      ctx.beginPath();
      for (let i = 1; i < parts; i++) {
        const px = bx + (i / parts) * bw;
        ctx.moveTo(px, by);
        ctx.lineTo(px, by + bh);
      }
      ctx.stroke();
      return;
    }

    // --- More Biology Shapes ---
    case 'ribosome': {
      const cy = y - hh * 0.12;
      // mRNA strand running through
      ctx.beginPath();
      ctx.moveTo(x - hw + 6, cy + 4);
      ctx.lineTo(x + hw - 6, cy + 4);
      ctx.stroke();
      // Small 40S subunit
      ctx.beginPath();
      ctx.ellipse(x, cy + hh * 0.22, hw * 0.44, hh * 0.24, 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Large 60S subunit
      ctx.beginPath();
      ctx.ellipse(x, cy - hh * 0.22, hw * 0.54, hh * 0.34, 0, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'golgi_body': {
      const cy = y - hh * 0.12;
      [-0.36, 0, 0.36].forEach((off, idx) => {
        const cw = hw * (0.78 - Math.abs(idx - 1) * 0.12);
        const yOff = cy + off * hh;
        ctx.beginPath();
        ctx.ellipse(x, yOff, cw, 6, 0, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
      });
      // Budding secretory vesicles
      [
        [x + hw * 0.8, cy - hh * 0.35],
        [x + hw * 0.82, cy + hh * 0.28],
      ].forEach(([vx, vy]) => {
        ctx.beginPath();
        ctx.arc(vx, vy, 5, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
      });
      return;
    }
    case 'lipid_bilayer': {
      const cy = y - hh * 0.12;
      const cols = 6;
      const span = w - 24;
      const sx = x - span / 2;
      const headR = 5.5;
      const topY = cy - hh * 0.34;
      const botY = cy + hh * 0.34;
      for (let i = 0; i < cols; i++) {
        const hx = sx + (i + 0.5) * (span / cols);
        // Hydrophobic tails
        ctx.beginPath();
        ctx.moveTo(hx - 2, topY + headR);
        ctx.lineTo(hx - 2, cy - 3);
        ctx.moveTo(hx + 2, topY + headR);
        ctx.lineTo(hx + 2, cy - 3);
        ctx.moveTo(hx - 2, botY - headR);
        ctx.lineTo(hx - 2, cy + 3);
        ctx.moveTo(hx + 2, botY - headR);
        ctx.lineTo(hx + 2, cy + 3);
        ctx.stroke();
        // Hydrophilic heads
        ctx.beginPath();
        ctx.arc(hx, topY, headR, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hx, botY, headR, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
      }
      return;
    }
    case 'chromosome': {
      const cy = y - hh * 0.12;
      const rx = hw * 0.48;
      const ry = hh * 0.56;
      [-0.42, 0.42].forEach((rot) => {
        ctx.beginPath();
        ctx.ellipse(x, cy, rx * 0.28, ry, rot, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
      });
      // Centromere
      ctx.beginPath();
      ctx.arc(x, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = border;
      ctx.fill();
      return;
    }
    case 'petri_dish': {
      const cy = y - hh * 0.1;
      const r = Math.min(hw, hh) * 0.68;
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      if (isFilled) ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, cy, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      // Colony dots
      [
        [-0.35, -0.25, 4],
        [0.3, -0.32, 3.2],
        [0.12, 0.28, 4.5],
        [-0.25, 0.25, 3],
      ].forEach(([dx, dy, cr]) => {
        ctx.beginPath();
        ctx.arc(x + dx * r, cy + dy * r, cr, 0, Math.PI * 2);
        ctx.stroke();
      });
      return;
    }
    case 'microscope': {
      const cy = y - hh * 0.08;
      // Base
      ctx.strokeRect(x - hw * 0.45, cy + hh * 0.38, hw * 0.9, 8);
      // Curved arm
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.25, cy + hh * 0.38);
      ctx.quadraticCurveTo(x - hw * 0.62, cy, x - hw * 0.12, cy - hh * 0.46);
      ctx.stroke();
      // Body tube + eyepiece (angled)
      ctx.save();
      ctx.translate(x + hw * 0.04, cy - hh * 0.34);
      ctx.rotate(0.28);
      if (isFilled) ctx.fillRect(-7, -22, 14, 38);
      ctx.strokeRect(-7, -22, 14, 38);
      ctx.restore();
      // Stage
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.12, cy + hh * 0.12);
      ctx.lineTo(x + hw * 0.36, cy + hh * 0.12);
      ctx.stroke();
      return;
    }
    case 'heart_chamber': {
      const cy = y - hh * 0.1;
      const cw = hw * 0.68;
      const ch = hh * 0.62;
      drawRoundedRect(ctx, x - cw, cy - ch, cw * 2, ch * 2, 14);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Septum + valve division lines (RA, LA, RV, LV)
      ctx.beginPath();
      ctx.moveTo(x, cy - ch);
      ctx.lineTo(x, cy + ch);
      ctx.moveTo(x - cw, cy - ch * 0.12);
      ctx.lineTo(x + cw, cy - ch * 0.12);
      ctx.stroke();
      return;
    }
    case 'synapse_cleft': {
      const cy = y - hh * 0.12;
      // Presynaptic bulb (left)
      ctx.beginPath();
      ctx.moveTo(x - hw + 8, cy - hh * 0.18);
      ctx.lineTo(x - hw * 0.24, cy - hh * 0.18);
      ctx.arc(x - hw * 0.22, cy, hh * 0.42, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x - hw + 8, cy + hh * 0.18);
      if (isFilled) ctx.fill();
      ctx.stroke();
      // Postsynaptic membrane (right)
      ctx.beginPath();
      ctx.moveTo(x + hw * 0.24, cy - hh * 0.44);
      ctx.quadraticCurveTo(x + hw * 0.1, cy, x + hw * 0.24, cy + hh * 0.44);
      ctx.stroke();
      // Neurotransmitter dots in cleft
      [-10, 0, 10].forEach((dy) => {
        ctx.beginPath();
        ctx.arc(x + 2, cy + dy, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = border;
        ctx.fill();
      });
      return;
    }

    // --- More Chemistry Shapes ---
    case 'burette': {
      const tubeW = 12;
      const topY = y - hh * 0.72;
      const tapY = y + hh * 0.22;
      const tipY = y + hh * 0.52;
      if (isFilled) {
        ctx.fillRect(x - tubeW / 2 + 1, topY + 14, tubeW - 2, tapY - topY - 14);
      }
      ctx.strokeRect(x - tubeW / 2, topY, tubeW, tapY - topY);
      // Stopcock valve
      ctx.beginPath();
      ctx.moveTo(x - 12, tapY + 6);
      ctx.lineTo(x + 12, tapY + 6);
      // Tapered tip
      ctx.moveTo(x - tubeW / 2, tapY);
      ctx.lineTo(x, tipY);
      ctx.lineTo(x + tubeW / 2, tapY);
      ctx.stroke();
      return;
    }
    case 'funnel_filter': {
      const topY = y - hh * 0.64;
      const neckY = y - hh * 0.02;
      const tipY = y + hh * 0.48;
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.64, topY);
      ctx.lineTo(x + hw * 0.64, topY);
      ctx.lineTo(x + 5, neckY);
      ctx.lineTo(x + 5, tipY);
      ctx.lineTo(x - 5, tipY);
      ctx.lineTo(x - 5, neckY);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'graduated_cylinder': {
      const cw = Math.min(28, hw * 0.6);
      const topY = y - hh * 0.68;
      const botY = y + hh * 0.44;
      if (isFilled) {
        ctx.fillRect(x - cw / 2 + 1, y - hh * 0.16, cw - 2, botY - (y - hh * 0.16) - 1);
      }
      ctx.strokeRect(x - cw / 2, topY, cw, botY - topY);
      // Broad foot base + scale marks
      ctx.strokeRect(x - cw, botY, cw * 2, 6);
      ctx.beginPath();
      for (let i = 1; i <= 4; i++) {
        const ty = topY + (i / 5) * (botY - topY);
        ctx.moveTo(x + cw / 2 - 7, ty);
        ctx.lineTo(x + cw / 2, ty);
      }
      ctx.stroke();
      return;
    }
    case 'condenser_tube': {
      const cy = y - hh * 0.12;
      const jw = w * 0.58;
      const jh = hh * 0.36;
      if (isFilled) {
        ctx.fillRect(x - jw / 2, cy - jh, jw, jh * 2);
      }
      // Outer cooling jacket + water ports
      ctx.strokeRect(x - jw / 2, cy - jh, jw, jh * 2);
      ctx.beginPath();
      // Inner vapor tube
      ctx.moveTo(x - hw + 4, cy);
      ctx.lineTo(x + hw - 4, cy);
      // Coolant inlet/outlet stubs
      ctx.moveTo(x - jw * 0.3, cy + jh);
      ctx.lineTo(x - jw * 0.3, cy + jh + 10);
      ctx.moveTo(x + jw * 0.3, cy - jh);
      ctx.lineTo(x + jw * 0.3, cy - jh - 10);
      ctx.stroke();
      return;
    }
    case 'cyclohexane_chair': {
      const cy = y - hh * 0.1;
      const rx = hw * 0.78;
      const ry = hh * 0.44;
      ctx.beginPath();
      ctx.moveTo(x - rx, cy + ry * 0.25);
      ctx.lineTo(x - rx * 0.4, cy - ry * 0.45);
      ctx.lineTo(x + rx * 0.38, cy - ry * 0.22);
      ctx.lineTo(x + rx, cy - ry * 0.85);
      ctx.lineTo(x + rx * 0.4, cy + ry * 0.45);
      ctx.lineTo(x - rx * 0.38, cy + ry * 0.22);
      ctx.closePath();
      if (isFilled) ctx.fill();
      ctx.stroke();
      return;
    }
    case 'bond_triple': {
      const cy = y - hh * 0.12;
      ctx.beginPath();
      [-6, 0, 6].forEach((dy) => {
        ctx.moveTo(x - hw + 10, cy + dy);
        ctx.lineTo(x + hw - 10, cy + dy);
      });
      ctx.stroke();
      return;
    }
    case 'tetrahedral_mol': {
      const cy = y - hh * 0.1;
      const cr = Math.min(hw, hh) * 0.22;
      const sr = cr * 0.62;
      const pts = [
        { cx: x, cy: cy - hh * 0.56 },
        { cx: x - hw * 0.58, cy: cy + hh * 0.26 },
        { cx: x + hw * 0.58, cy: cy + hh * 0.26 },
        { cx: x + hw * 0.28, cy: cy + hh * 0.42 },
      ];
      ctx.beginPath();
      pts.forEach((p) => {
        ctx.moveTo(x, cy);
        ctx.lineTo(p.cx, p.cy);
      });
      ctx.stroke();
      [{ cx: x, cy, r: cr }, ...pts.map((p) => ({ ...p, r: sr }))].forEach((at) => {
        ctx.beginPath();
        ctx.arc(at.cx, at.cy, at.r, 0, Math.PI * 2);
        if (isFilled) ctx.fill();
        ctx.stroke();
      });
      return;
    }
    case 'energy_profile': {
      if (isFilled) {
        drawRoundedRect(ctx, x - hw, y - hh, w, h, 8);
        ctx.fill();
      }
      const left = x - hw + 14;
      const right = x + hw - 12;
      const bot = y + hh - 14;
      const top = y - hh + 22;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, bot);
      ctx.lineTo(right, bot);
      ctx.stroke();
      // Activation energy barrier curve
      const rY = y + hh * 0.04;
      const pY = y + hh * 0.34;
      ctx.save();
      ctx.lineWidth = Math.max(2, node.borderWidth ?? 2.2);
      ctx.beginPath();
      ctx.moveTo(left + 6, rY);
      ctx.lineTo(left + (right - left) * 0.22, rY);
      ctx.bezierCurveTo(
        x - hw * 0.1,
        rY,
        x - hw * 0.16,
        top + 6,
        x,
        top + 6
      );
      ctx.bezierCurveTo(
        x + hw * 0.18,
        top + 6,
        x + hw * 0.2,
        pY,
        left + (right - left) * 0.72,
        pY
      );
      ctx.lineTo(right - 6, pY);
      ctx.stroke();
      ctx.restore();
      return;
    }

    case 'progress_bar':
    case 'rounded':
    default:
      drawRoundedRect(ctx, x - hw, y - hh, w, h, 12);
      if (isFilled) ctx.fill();
      ctx.stroke();
  }
}

export function drawNodeLabelAndIcon(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  theme: ThemeMode
) {
  const icon = node.icon?.trim() || '';
  const hasText = Boolean(node.text?.trim());
  if (!hasText && !icon) return;

  const safe = getShapeSafeTextBox(node);
  const pos = node.iconPosition ?? 'inline';
  const isUnfilled = node.filled === false;
  const usesSchematicContrast =
    node.shape === 'resistor' ||
    node.shape === 'capacitor' ||
    node.shape === 'inductor' ||
    node.shape === 'battery' ||
    node.shape === 'ground' ||
    node.shape === 'switch_sym' ||
    node.shape === 'spring' ||
    node.shape === 'wave' ||
    node.shape === 'axes_2d' ||
    node.shape === 'number_line' ||
    node.shape === 'parabola' ||
    node.shape === 'vector_arrow' ||
    node.shape === 'angle_arc' ||
    node.shape === 'venn_2' ||
    node.shape === 'venn_3' ||
    node.shape === 'bell_curve' ||
    node.shape === 'pie_chart' ||
    node.shape === 'matrix_box' ||
    node.shape === 'concave_lens' ||
    node.shape === 'concave_mirror' ||
    node.shape === 'convex_mirror' ||
    node.shape === 'pendulum' ||
    node.shape === 'solenoid' ||
    node.shape === 'field_lines' ||
    node.shape === 'lever_fulcrum' ||
    node.shape === 'cart_wheels' ||
    node.shape === 'thermometer' ||
    node.shape === 'piston_cylinder' ||
    node.shape === 'projectile_arc' ||
    node.shape === 'ray_source' ||
    node.shape === 'xor_gate' ||
    node.shape === 'transformer' ||
    node.shape === 'fuse_sym' ||
    node.shape === 'potentiometer' ||
    node.shape === 'axes_3d' ||
    node.shape === 'sine_graph' ||
    node.shape === 'unit_circle' ||
    node.shape === 'ellipse_conic' ||
    node.shape === 'bar_chart' ||
    node.shape === 'scatter_plot' ||
    node.shape === 'box_plot' ||
    node.shape === 'fraction_bar' ||
    node.shape === 'cell_animal' ||
    node.shape === 'cell_plant' ||
    node.shape === 'dna_helix' ||
    node.shape === 'mitochondria' ||
    node.shape === 'chloroplast' ||
    node.shape === 'ribosome' ||
    node.shape === 'golgi_body' ||
    node.shape === 'lipid_bilayer' ||
    node.shape === 'chromosome' ||
    node.shape === 'neuron' ||
    node.shape === 'synapse_cleft' ||
    node.shape === 'antibody' ||
    node.shape === 'virus_capsid' ||
    node.shape === 'petri_dish' ||
    node.shape === 'microscope' ||
    node.shape === 'heart_chamber' ||
    node.shape === 'leaf_organ' ||
    node.shape === 'punnett_grid' ||
    node.shape === 'beaker' ||
    node.shape === 'erlenmeyer_flask' ||
    node.shape === 'round_flask' ||
    node.shape === 'test_tube' ||
    node.shape === 'burette' ||
    node.shape === 'funnel_filter' ||
    node.shape === 'graduated_cylinder' ||
    node.shape === 'condenser_tube' ||
    node.shape === 'bunsen_burner' ||
    node.shape === 'benzene_ring' ||
    node.shape === 'cyclohexane_chair' ||
    node.shape === 'atom_bohr' ||
    node.shape === 'reaction_arrow' ||
    node.shape === 'bond_double' ||
    node.shape === 'bond_triple' ||
    node.shape === 'molecule_h2o' ||
    node.shape === 'tetrahedral_mol' ||
    node.shape === 'energy_profile';

  const textColor =
    theme === 'high_contrast'
      ? '#ffffff'
      : node.shape === 'text' || isUnfilled || usesSchematicContrast
      ? node.textColor || (theme === 'dark' ? '#f8fafc' : '#0f172a')
      : node.textColor || getContrastTextColor(node.color);

  const vectorIcon = isVectorNodeIcon(icon);
  const label =
    icon && pos === 'inline' && !vectorIcon ? (hasText ? `${icon} ${node.text}` : icon) : node.text;
  let availW = safe.maxW;
  let availH = safe.maxH - (node.progress !== null && node.progress !== undefined ? 10 : 0);
  let textCenterX = node.x;
  let textCenterY =
    node.y + safe.offsetY - (node.progress !== null && node.progress !== undefined ? 4 : 0);

  const fontWeight =
    node.bold === true
      ? '700'
      : node.bold === false || node.shape === 'text'
      ? '400'
      : '600';
  const fontStyle: 'normal' | 'italic' = node.italic ? 'italic' : 'normal';
  const fontPrefix = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight}`;
  const isUnderline = Boolean(node.underline);

  const drawTextLineWithUnderline = (
    line: string,
    centerX: number,
    centerY: number,
    fontSize: number
  ) => {
    ctx.fillText(line, centerX, centerY);
    if (isUnderline && line.trim().length > 0) {
      const lineW = ctx.measureText(line).width;
      const ulY = centerY + fontSize * 0.48;
      ctx.save();
      ctx.strokeStyle = textColor;
      ctx.lineWidth = Math.max(1, fontSize * (fontWeight === '700' ? 0.085 : 0.065));
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(centerX - lineW / 2, ulY);
      ctx.lineTo(centerX + lineW / 2, ulY);
      ctx.stroke();
      ctx.restore();
    }
  };

  if (icon && pos === 'top') {
    if (vectorIcon) {
      drawVectorNodeIcon(ctx, icon, node.x, node.y - node.h * 0.22 + safe.offsetY, 17, textColor);
    } else {
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, node.x, node.y - node.h * 0.22 + safe.offsetY);
    }
    availH = Math.max(18, availH * 0.62);
    textCenterY += node.h * 0.14;
  } else if (icon && pos === 'left') {
    if (vectorIcon) {
      drawVectorNodeIcon(ctx, icon, node.x - safe.maxW * 0.36, textCenterY, 16, textColor);
    } else {
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, node.x - safe.maxW * 0.36, textCenterY);
    }
    availW = Math.max(32, availW * 0.72);
    textCenterX += safe.maxW * 0.12;
  } else if (vectorIcon && pos === 'inline') {
    if (!hasText) {
      drawVectorNodeIcon(ctx, icon, textCenterX, textCenterY, 18, textColor);
      return;
    }
    const inlineIconSize = Math.max(13, Math.min(18, (node.fs ?? 13) + 2));
    const layout = computeFittedTextLayout(
      ctx,
      node.text,
      Math.max(24, availW - inlineIconSize - 6),
      Math.max(14, availH),
      node.fs ?? 13,
      fontWeight,
      fontStyle
    );
    ctx.font = `${fontPrefix} ${layout.fontSize}px "Plus Jakarta Sans", sans-serif`;
    const maxLineW = layout.lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
    const gap = 5;
    const totalW = inlineIconSize + gap + maxLineW;
    const iconCx = textCenterX - totalW / 2 + inlineIconSize / 2;
    const shiftTextX = iconCx + inlineIconSize / 2 + gap + maxLineW / 2;

    drawVectorNodeIcon(ctx, icon, iconCx, textCenterY, inlineIconSize, textColor);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const startY = textCenterY - ((layout.lines.length - 1) * layout.lineHeight) / 2;
    layout.lines.forEach((line, i) => {
      drawTextLineWithUnderline(line, shiftTextX, startY + i * layout.lineHeight, layout.fontSize);
    });
    return;
  }

  if (!hasText && !icon) return;
  const layout = computeFittedTextLayout(
    ctx,
    label,
    availW,
    Math.max(14, availH),
    node.fs ?? 13,
    fontWeight,
    fontStyle
  );
  ctx.font = `${fontPrefix} ${layout.fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = textCenterY - ((layout.lines.length - 1) * layout.lineHeight) / 2;
  layout.lines.forEach((line, i) => {
    drawTextLineWithUnderline(line, textCenterX, startY + i * layout.lineHeight, layout.fontSize);
  });
}

export function drawTableContent(ctx: CanvasRenderingContext2D, node: GraphNode, theme: ThemeMode) {
  const table = node.tableData;
  if (!table) return;
  const x0 = node.x - node.w / 2;
  const y0 = node.y - node.h / 2;
  const cols = Math.max(1, table.headers.length);
  const totalRows = 2 + table.rows.length;
  const rowH = node.h / totalRows;
  const colW = node.w / cols;

  ctx.fillStyle = theme === 'high_contrast' ? '#18181b' : '#1e293b';
  ctx.fillRect(x0 + 1, y0 + 1, node.w - 2, rowH);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.text || 'Data Table', node.x, y0 + rowH / 2, node.w - 12);

  ctx.fillStyle = theme === 'high_contrast' ? '#27272a' : '#e2e8f0';
  ctx.fillRect(x0 + 1, y0 + rowH, node.w - 2, rowH);
  ctx.fillStyle = theme === 'high_contrast' ? '#ffffff' : '#0f172a';
  ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
  table.headers.forEach((h, ci) => {
    ctx.fillText(h, x0 + ci * colW + colW / 2, y0 + rowH * 1.5, colW - 8);
  });

  ctx.font = '400 10px "JetBrains Mono", monospace';
  table.rows.forEach((row, ri) => {
    const ry = y0 + (ri + 2) * rowH;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, ry);
    ctx.lineTo(x0 + node.w, ry);
    ctx.stroke();

    ctx.fillStyle = theme === 'high_contrast' ? '#ffffff' : '#1e293b';
    for (let ci = 0; ci < cols; ci++) {
      ctx.fillText(row[ci] ?? '', x0 + ci * colW + colW / 2, ry + rowH / 2, colW - 8);
    }
  });

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = 0.8;
  for (let ci = 1; ci < cols; ci++) {
    ctx.beginPath();
    ctx.moveTo(x0 + ci * colW, y0 + rowH);
    ctx.lineTo(x0 + ci * colW, y0 + node.h);
    ctx.stroke();
  }
}

/**
 * Renders a static, print-ready full-graph snapshot (edges, nodes, stickies,
 * highlighter strokes, pen strokes) onto an arbitrary canvas context for PDF reports.
 */
export function renderGraphSnapshotToContext(
  ctx: CanvasRenderingContext2D,
  g: GraphDocument,
  theme: ThemeMode
) {
  const layerVisible = new Map(g.layers.map((l) => [l.name, l.visible]));
  const { hiddenNodes } = computeMindmapVisibility(g.nodes, g.edges);
  const nodeMap = buildEntityMap(g.nodes, g.stickies);

  // 1. Edges
  const visibleEdges = g.edges.filter(
    (e) =>
      layerVisible.get(e.layer) !== false &&
      !hiddenNodes.has(e.a) &&
      !hiddenNodes.has(e.b)
  );
  const parallelMap = computeParallelEdgeIndexMap(visibleEdges);

  for (const edge of visibleEdges) {
    const geom = computeEdgeGeometry(edge, nodeMap, parallelMap.get(edge.id));
    if (!geom) continue;
    ctx.save();
    ctx.beginPath();
    geom.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = theme === 'high_contrast' ? '#22d3ee' : edge.color;
    ctx.lineWidth = edge.width;
    if (edge.lineStyle === 'dashed') ctx.setLineDash([8, 5]);
    else if (edge.lineStyle === 'dotted') ctx.setLineDash([2.5, 4.5]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);

    const arrowSize = Math.max(9, edge.width * 3.8);
    const endPt = geom.points[geom.points.length - 1];
    const startPt = geom.points[0];
    if (edge.arrow === 'forward' || edge.arrow === 'both') {
      drawArrowhead(ctx, endPt.x, endPt.y, geom.endAngle, arrowSize, ctx.strokeStyle as string);
    }
    if (edge.arrow === 'backward' || edge.arrow === 'both') {
      drawArrowhead(
        ctx,
        startPt.x,
        startPt.y,
        geom.startAngle + Math.PI,
        arrowSize,
        ctx.strokeStyle as string
      );
    }

    if (edge.label || edge.weight !== 1) {
      const labelText = edge.label
        ? edge.weight !== 1
          ? `${edge.label} (${edge.weight})`
          : edge.label
        : `w:${edge.weight}`;
      ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
      const tw = ctx.measureText(labelText).width;
      const pw = tw + 14;
      const ph = 20;
      ctx.fillStyle = theme === 'light' ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.92)';
      ctx.strokeStyle = theme === 'light' ? '#cbd5e1' : '#334155';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, geom.labelPos.x - pw / 2, geom.labelPos.y - ph / 2, pw, ph, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = theme === 'light' ? '#0f172a' : '#f1f5f9';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, geom.labelPos.x, geom.labelPos.y + 0.5);
    }
    ctx.restore();
  }

  // 2. Nodes & Shapes (layer-ordered)
  const layerRank = (layer: CanvasLayerName) =>
    layer === 'Background' ? 0 : layer === 'Data' ? 1 : 2;
  const orderedNodes = [...g.nodes].sort((a, b) => layerRank(a.layer) - layerRank(b.layer));

  for (const node of orderedNodes) {
    if (hiddenNodes.has(node.id) || layerVisible.get(node.layer) === false) continue;
    ctx.save();
    const fill = theme === 'high_contrast' ? '#000000' : node.color || '#dbeafe';
    const border =
      theme === 'high_contrast'
        ? '#ffffff'
        : node.borderColor || (theme === 'dark' ? '#64748b' : '#334155');
    drawNodeShape(ctx, node, fill, border);

    if (node.shape === 'table' && node.tableData) {
      drawTableContent(ctx, node, theme);
    } else {
      drawNodeLabelAndIcon(ctx, node, theme);
    }

    if (node.progress !== null && node.progress !== undefined) {
      const pct = Math.max(0, Math.min(100, node.progress));
      const barW = Math.max(30, node.w - 24);
      const barH = 5;
      const bx = node.x - barW / 2;
      const by = node.y + node.h / 2 - 11;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
      drawRoundedRect(ctx, bx, by, barW, barH, 2.5);
      ctx.fill();
      ctx.fillStyle = pct >= 80 ? '#16a34a' : pct >= 40 ? '#2563eb' : '#d97706';
      if (pct > 0) {
        drawRoundedRect(ctx, bx, by, (barW * pct) / 100, barH, 2.5);
        ctx.fill();
      }
    }

    if (node.badge) {
      const bx = node.x - node.w / 2 + 4;
      const by = node.y - node.h / 2 - 6;
      ctx.fillStyle = '#0f172a';
      drawRoundedRect(ctx, bx, by, 22, 16, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.badge, bx + 11, by + 8.5);
    }
    ctx.restore();
  }

  // 3. Sticky Notes
  for (const sticky of g.stickies) {
    if (layerVisible.get(sticky.layer) === false) continue;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = sticky.color || '#fef08a';
    ctx.strokeStyle = 'rgba(15,23,42,0.18)';
    ctx.lineWidth = 1;
    drawRoundedRect(
      ctx,
      sticky.x - sticky.w / 2,
      sticky.y - sticky.h / 2,
      sticky.w,
      sticky.h,
      8
    );
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lines = wrapTextLines(ctx, sticky.text, sticky.w - 20);
    const lh = 16;
    const hasTags = (sticky.tags?.length ?? 0) > 0;
    const reservedBottom = hasTags ? 24 : 12;
    const maxLines = Math.max(1, Math.floor((sticky.h - 10 - reservedBottom) / lh));
    lines.slice(0, maxLines).forEach((ln, idx) => {
      ctx.fillText(ln, sticky.x - sticky.w / 2 + 10, sticky.y - sticky.h / 2 + 10 + idx * lh);
    });
    if (hasTags && sticky.h >= 64) {
      const tagLabel = sticky.tags!.slice(0, 3).map((t) => `#${t}`).join(' ');
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(30, 41, 59, 0.65)';
      ctx.textBaseline = 'bottom';
      ctx.fillText(
        tagLabel,
        sticky.x - sticky.w / 2 + 10,
        sticky.y + sticky.h / 2 - 7,
        sticky.w - 20
      );
    }
    ctx.restore();
  }

  // 4. Highlighter & Pen Strokes on top of elements
  const drawStrokes = (strokes: FreehandStroke[], alpha: number) => {
    for (const st of strokes) {
      if (layerVisible.get(st.layer) === false || st.points.length < 2) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(st.points[0].x, st.points[0].y);
      for (let i = 1; i < st.points.length; i++) {
        ctx.lineTo(st.points[i].x, st.points[i].y);
      }
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = alpha;
      ctx.stroke();
      ctx.restore();
    }
  };
  drawStrokes(
    g.strokes.filter((s) => s.tool === 'highlight'),
    0.34
  );
  drawStrokes(
    g.strokes.filter((s) => s.tool !== 'highlight'),
    0.94
  );
}
