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
    node.shape === 'vector_arrow' ||
    node.shape === 'angle_arc' ||
    node.shape === 'venn_2' ||
    node.shape === 'bell_curve' ||
    node.shape === 'matrix_box';

  const textColor =
    theme === 'high_contrast'
      ? '#ffffff'
      : node.shape === 'text' || isUnfilled || usesSchematicContrast
      ? node.textColor || (theme === 'dark' ? '#f8fafc' : '#0f172a')
      : node.textColor || getContrastTextColor(node.color);

  const label = icon && pos === 'inline' ? (hasText ? `${icon} ${node.text}` : icon) : node.text;
  let availW = safe.maxW;
  let availH = safe.maxH - (node.progress !== null && node.progress !== undefined ? 10 : 0);
  let textCenterX = node.x;
  let textCenterY =
    node.y + safe.offsetY - (node.progress !== null && node.progress !== undefined ? 4 : 0);

  if (icon && pos === 'top') {
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, node.x, node.y - node.h * 0.22 + safe.offsetY);
    availH = Math.max(18, availH * 0.62);
    textCenterY += node.h * 0.14;
  } else if (icon && pos === 'left') {
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, node.x - safe.maxW * 0.36, textCenterY);
    availW = Math.max(32, availW * 0.72);
    textCenterX += safe.maxW * 0.12;
  }

  const layout = computeFittedTextLayout(
    ctx,
    label,
    availW,
    Math.max(14, availH),
    node.fs ?? 13
  );
  ctx.font = `600 ${layout.fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const startY = textCenterY - ((layout.lines.length - 1) * layout.lineHeight) / 2;
  layout.lines.forEach((line, i) => {
    ctx.fillText(line, textCenterX, startY + i * layout.lineHeight);
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
