/**
 * Image de la main (PNG, 1080 px de large) pour l'envoyer dans une discussion : couleurs de la DA
 * affichée, cartes du héros, board et déroulé. S'arrête à la décision si la suite est cachée.
 */
import { SUIT_SYMBOL, rankLabel, rankOf, suitOf, type Card } from './cards';
import { BOARD_AT, STREETS, positions, potOf } from './engine';
import { bbs, chips, pct } from './format';
import { ctxText, decisionState, heroCards, lineText, replayOf, story, type HandData } from './hand';

const W = 1080;
const PAD = 64;
const SUIT_INK = ['#1d2433', '#c0392b', '#1f5fbf', '#1e7d3c'];

function css(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function card(ctx: CanvasRenderingContext2D, c: Card, x: number, y: number, w: number) {
  const h = w * 1.36;
  ctx.fillStyle = '#F7ECDD';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, w * 0.12);
  ctx.fill();
  ctx.fillStyle = SUIT_INK[suitOf(c)];
  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(w * 0.5)}px Montserrat, sans-serif`;
  ctx.fillText(rankLabel(rankOf(c)), x + w / 2, y + h * 0.48);
  ctx.font = `700 ${Math.round(w * 0.42)}px Montserrat, sans-serif`;
  ctx.fillText(SUIT_SYMBOL[suitOf(c)], x + w / 2, y + h * 0.86);
  ctx.textAlign = 'left';
}

export async function handImage(h: HandData, all: boolean): Promise<Blob> {
  await document.fonts?.ready;
  const colors = {
    bg: css('--bg', '#081A2B'), surface: css('--surface', '#0F2740'), border: css('--border', '#2C4864'),
    text: css('--text', '#F7ECDD'), muted: css('--text-muted', '#A9B5C3'), gold: css('--gold', '#C9A85B'),
    felt: css('--felt', '#15395C'), edge: css('--felt-edge', '#8C7442'),
  };
  const r = replayOf(h);
  const decision = decisionState(h, r);
  const stop = decision && !all ? h.decision! : h.actions.length;
  const lines = story(h, r, stop);
  const bb = h.ctx.blinds.bb;
  const pos = positions(h.seats.length);

  // Mesure d'abord, dessine ensuite : la hauteur dépend du texte.
  const draw = (ctx: CanvasRenderingContext2D, paint: boolean): number => {
    let y = PAD;
    const text = (t: string, size: number, color: string, weight = 600, x = PAD) => {
      ctx.font = `${weight} ${size}px Montserrat, sans-serif`;
      for (const l of wrap(ctx, t, W - x - PAD)) {
        y += size * 1.3;
        if (paint) { ctx.fillStyle = color; ctx.fillText(l, x, y); }
      }
    };
    text('CARNET DE MAINS · PPC', 30, colors.gold, 800);
    y += 8;
    text(ctxText(h.ctx), 34, colors.text, 700);
    const hs = h.seats[h.hero].stack;
    text(`${h.seats.length} joueurs · héros ${pos[h.hero]} · ${chips(hs)} (${bbs(hs, bb)})`, 30, colors.muted, 500);
    y += 28;

    // Tapis : cartes du héros, board.
    const feltH = 300;
    if (paint) {
      ctx.fillStyle = colors.felt; ctx.strokeStyle = colors.edge; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.roundRect(PAD, y, W - 2 * PAD, feltH, feltH / 2); ctx.fill(); ctx.stroke();
      const hc = heroCards(h);
      hc.forEach((c, i) => card(ctx, c, PAD + 70 + i * 120, y + 50, 110));
      const visible = decision && !all ? h.board.slice(0, BOARD_AT[decision.street]) : h.board;
      visible.forEach((c, i) => card(ctx, c, PAD + 380 + i * 104, y + 70, 92));
      ctx.fillStyle = colors.gold; ctx.font = '700 30px Montserrat, sans-serif';
      ctx.fillText(hc.length ? `${pos[h.hero]} (héros)` : '', PAD + 70, y + feltH - 34);
    }
    y += feltH + 24;

    for (const line of lines) {
      const board = line.street > 0 ? ` · pot ${chips(line.pot)}` : '';
      y += 14;
      text(`${STREETS[line.street].toUpperCase()}${board}`, 26, colors.gold, 800);
      text(lineText(h, line), 30, colors.text, 500);
    }
    if (decision && !all) {
      const call = Math.min(decision.current - decision.ps[h.hero].bet, decision.ps[h.hero].stack);
      y += 30;
      text('Et toi, tu fais quoi ?', 46, colors.gold, 800);
      text(call > 0 ? `Il faut payer ${chips(call)} pour un pot de ${chips(potOf(decision) + call)} (cote ${pct(call / (potOf(decision) + call))}).` : `Pot de ${chips(potOf(decision))}, c'est au héros de parler.`, 30, colors.text, 500);
    }
    y += PAD;
    return y;
  };

  const probe = document.createElement('canvas').getContext('2d')!;
  const height = Math.ceil(draw(probe, false));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = colors.gold;
  ctx.fillRect(0, 0, W, 6);
  draw(ctx, true);
  return new Promise((done, fail) => canvas.toBlob(b => (b ? done(b) : fail(new Error('Image impossible à créer.'))), 'image/png'));
}
