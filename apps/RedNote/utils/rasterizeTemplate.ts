import {
  TEMPLATE_BG,
  TEMPLATE_TEXT_COLOR,
  resolveTemplateId,
} from '../components/TemplatePreview';

const W = 540;
const H = 720; // 3:4 封面比例

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, color: string) {
  if (!text) return;

  const len = text.length;
  let fontPx: number;
  if (len <= 8) fontPx = W * 0.13;
  else if (len <= 20) fontPx = W * 0.10;
  else if (len <= 50) fontPx = W * 0.075;
  else if (len <= 120) fontPx = W * 0.055;
  else fontPx = W * 0.04;

  ctx.fillStyle = color;
  ctx.font = `600 ${fontPx}px -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  const maxWidth = W * 0.80;
  const lineHeight = fontPx * 1.35;

  const lines: string[] = [];
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const totalH = lines.length * lineHeight;
  const startY = H / 2 - totalH / 2 + fontPx;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, startY + i * lineHeight);
  }
}

function drawDecorations(ctx: CanvasRenderingContext2D, id: ReturnType<typeof resolveTemplateId>) {
  if (id === 'basic') {
    ctx.fillStyle = '#f6dd77';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `${W * 0.20}px Georgia, "Times New Roman", serif`;
    ctx.fillText('“', W * 0.05, H * 0.02);

    const uw = W * 0.08;
    const uh = W * 0.014;
    const ux = W - W * 0.08 - uw;
    const uy = H - H * 0.08 - uh;
    roundedRect(ctx, ux, uy, uw, uh, uh / 2);
    ctx.fill();
    return;
  }

  if (id === 'fresh') {
    const g = ctx.createRadialGradient(W, 0, 0, W, 0, W * 0.85);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const leafSize = W * 0.20;
    const lx = W - W * 0.06 - leafSize;
    const ly = H * 0.03;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.scale(leafSize / 24, leafSize / 24);
    ctx.fillStyle = '#7cc99b';
    ctx.beginPath();
    ctx.moveTo(21, 3);
    ctx.bezierCurveTo(13, 4, 6, 10, 3, 21);
    ctx.bezierCurveTo(14, 19, 20, 12, 21, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3f8f5b';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.lineTo(14, 10);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (id === 'memo') {
    const gap = H / 24;
    ctx.strokeStyle = 'rgba(234,179,8,0.28)';
    ctx.lineWidth = 1;
    for (let y = gap; y < H; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    return;
  }

  if (id === 'border') {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = W * 0.008;
    const outerInset = W * 0.03;
    roundedRect(ctx, outerInset, outerInset, W - outerInset * 2, H - outerInset * 2, 28);
    ctx.stroke();
    ctx.lineWidth = W * 0.003;
    const innerInset = W * 0.055;
    roundedRect(ctx, innerInset, innerInset, W - innerInset * 2, H - innerInset * 2, 20);
    ctx.stroke();
    return;
  }

  if (id === 'scribble') {
    const sx = W / 100;
    const sy = H / 100;
    ctx.strokeStyle = '#0ea5e9';
    ctx.fillStyle = '#0ea5e9';
    ctx.lineCap = 'round';
    ctx.lineWidth = W * 0.006;

    ctx.beginPath();
    ctx.moveTo(6 * sx, 14 * sy);
    ctx.quadraticCurveTo(12 * sx, 6 * sy, 18 * sx, 14 * sy);
    ctx.quadraticCurveTo(24 * sx, 22 * sy, 30 * sx, 14 * sy);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(86 * sx, 16 * sy, 2.5 * sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(92 * sx, 24 * sy, 1.5 * sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(80 * sx, 24 * sy, 1.2 * sx, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(8 * sx, 86 * sy);
    ctx.quadraticCurveTo(16 * sx, 78 * sy, 24 * sx, 86 * sy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(74 * sx, 82 * sy);
    ctx.lineTo(92 * sx, 90 * sy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(78 * sx, 70 * sy);
    ctx.lineTo(86 * sx, 74 * sy);
    ctx.stroke();
    return;
  }
}

// 模拟真机小红书"发文字贴"流程：卡片在发布时烘焙成图片，
// 因此 note 里不保留 templateId 结构化字段。
export function rasterizeTemplateCard(templateId: string, text: string): string {
  const id = resolveTemplateId(templateId);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = TEMPLATE_BG[id];
  ctx.fillRect(0, 0, W, H);

  drawDecorations(ctx, id);
  drawWrappedText(ctx, text, TEMPLATE_TEXT_COLOR[id]);

  return canvas.toDataURL('image/png');
}
