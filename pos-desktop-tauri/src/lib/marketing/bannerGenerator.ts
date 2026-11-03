/**
 * @file bannerGenerator.ts
 * @description Generates rich visual promotional image banners locally via HTML5 Canvas.
 * 
 * Produces crisp, high-resolution (1200x630) marketing images encoded as local Data URLs.
 * Because the resulting data URL is stored in browser memory/localStorage:
 * 1. It is 100% offline-compatible.
 * 2. It stays downloaded until the user decides to remove it.
 * 3. Never breaks when network is disconnected.
 */

export interface BannerVisualOptions {
  title: string;
  subtitle: string;
  price_mt: number;
  original_price_mt?: number;
  badge?: string;
  category?: string;
  themeColor?: 'amber' | 'emerald' | 'rose' | 'indigo' | 'blue';
}

const THEMES = {
  amber: {
    bg1: '#78350f',
    bg2: '#b45309',
    bg3: '#ea580c',
    accent: '#fef08a',
    badgeBg: '#f59e0b',
    badgeText: '#451a03',
    cardBg: 'rgba(0, 0, 0, 0.45)'
  },
  emerald: {
    bg1: '#064e3b',
    bg2: '#047857',
    bg3: '#059669',
    accent: '#6ee7b7',
    badgeBg: '#10b981',
    badgeText: '#022c22',
    cardBg: 'rgba(0, 0, 0, 0.45)'
  },
  rose: {
    bg1: '#881337',
    bg2: '#be123c',
    bg3: '#e11d48',
    accent: '#fbcfe8',
    badgeBg: '#f43f5e',
    badgeText: '#4c0519',
    cardBg: 'rgba(0, 0, 0, 0.45)'
  },
  indigo: {
    bg1: '#1e1b4b',
    bg2: '#3730a3',
    bg3: '#4f46e5',
    accent: '#c7d2fe',
    badgeBg: '#6366f1',
    badgeText: '#1e1b4b',
    cardBg: 'rgba(0, 0, 0, 0.45)'
  },
  blue: {
    bg1: '#0c4a6e',
    bg2: '#0284c7',
    bg3: '#2563eb',
    accent: '#bae6fd',
    badgeBg: '#38bdf8',
    badgeText: '#082f49',
    cardBg: 'rgba(0, 0, 0, 0.45)'
  }
};

/**
 * Generates a promotional banner image as a Data URL (PNG).
 */
export function generatePromoBannerImage(options: BannerVisualOptions): string {
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const theme = THEMES[options.themeColor || 'amber'];

  // 1. Rich Radial/Linear Background
  const bgGradient = ctx.createLinearGradient(0, 0, 1200, 630);
  bgGradient.addColorStop(0, theme.bg1);
  bgGradient.addColorStop(0.5, theme.bg2);
  bgGradient.addColorStop(1, theme.bg3);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 1200, 630);

  // Decorative lighting glow
  const glow = ctx.createRadialGradient(1000, 100, 50, 1000, 100, 500);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 630);

  // Subtle diagonal geometric pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1.5;
  for (let i = -600; i < 1800; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 600, 630);
    ctx.stroke();
  }

  // 2. Top Header Ribbon: Store Brand & Category
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  roundRect(ctx, 60, 45, 340, 42, 21);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('⚡ SYCOMM POS • ESPECIAL DA LOJA', 82, 72);

  // Badge (e.g. SUPER PREÇO / OFERTA DO DIA)
  const badgeText = (options.badge || 'OFERTA DO DIA').toUpperCase();
  ctx.font = '900 22px "Inter", "Segoe UI", sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 36;

  ctx.fillStyle = theme.badgeBg;
  ctx.beginPath();
  roundRect(ctx, 1200 - 60 - badgeWidth, 45, badgeWidth, 46, 23);
  ctx.fill();

  ctx.fillStyle = theme.badgeText;
  ctx.fillText(badgeText, 1200 - 60 - badgeWidth + 18, 76);

  // Category
  if (options.category) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '600 20px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(`Categoria: ${options.category}`, 62, 130);
  }

  // 3. Product Title (bold, wrapped if necessary)
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 56px "Inter", "Segoe UI", sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  const titleLines = wrapText(ctx, options.title, 780);
  let textY = 200;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, 60, textY);
    textY += 68;
  }

  // 4. Subtitle / Description
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '500 26px "Inter", "Segoe UI", sans-serif';
  const subLines = wrapText(ctx, options.subtitle, 780);
  for (const line of subLines.slice(0, 2)) {
    ctx.fillText(line, 60, textY + 10);
    textY += 38;
  }

  // 5. Right Price Tag Card
  const cardX = 840;
  const cardY = 160;
  const cardW = 300;
  const cardH = 340;

  ctx.fillStyle = theme.cardBg;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fill();
  ctx.stroke();

  // Price header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PREÇO PROMOCIONAL', cardX + cardW / 2, cardY + 50);

  // Main Price
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 52px "Inter", "Segoe UI", monospace';
  const priceFormatted = `${Number(options.price_mt || 0).toLocaleString('pt-MZ')} MT`;
  ctx.fillText(priceFormatted, cardX + cardW / 2, cardY + 120);

  // Original Price & Discount calculation
  if (options.original_price_mt && options.original_price_mt > options.price_mt) {
    const discountPct = Math.round(
      ((options.original_price_mt - options.price_mt) / options.original_price_mt) * 100
    );

    // Strikethrough original price
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 22px "Inter", "Segoe UI", monospace';
    const origText = `Antes: ${Number(options.original_price_mt).toLocaleString('pt-MZ')} MT`;
    ctx.fillText(origText, cardX + cardW / 2, cardY + 175);

    // Strikethrough line
    const origWidth = ctx.measureText(origText).width;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cardX + cardW / 2 - origWidth / 2 - 4, cardY + 168);
    ctx.lineTo(cardX + cardW / 2 + origWidth / 2 + 4, cardY + 168);
    ctx.stroke();

    // Discount Pill
    ctx.fillStyle = '#facc15'; // bright yellow
    ctx.beginPath();
    roundRect(ctx, cardX + cardW / 2 - 75, cardY + 205, 150, 42, 21);
    ctx.fill();

    ctx.fillStyle = '#09090b';
    ctx.font = '900 20px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(`POUPE ${discountPct}%`, cardX + cardW / 2, cardY + 233);
  }

  // Stock availability reassurance
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('✓ Stock Disponível na Loja', cardX + cardW / 2, cardY + 295);

  // 6. Bottom Footer Bar
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 560, 1200, 70);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = 'bold 18px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('🇲🇿 Aceitamos Pagamentos por M-Pesa, e-Mola, Cartão e Numerário', 60, 602);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.textAlign = 'right';
  ctx.font = '16px "Inter", "Segoe UI", sans-serif';
  ctx.fillText('Válido até ao fim das existências', 1140, 602);

  return canvas.toDataURL('image/png', 0.92);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}
