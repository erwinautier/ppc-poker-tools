/**
 * Fiches de synthèse et attestation en PDF (jsPDF, comme l'export du Range Editor).
 * Les polices standard des PDF ne contiennent pas les symboles ♠♥♦♣ : les cartes sont dessinées.
 */
import { jsPDF } from 'jspdf';
import type { Fiche, FicheBlock, Lesson } from '../content/types';
import { type Term, altOf } from '../content/lexique';
import { labelForId } from '../content/labels';
import { cards as parseCards, rankLabel } from './cards';
import { type DA, getDA, logoFile } from '../../../shared/ppc-da.js';

// Couleurs de la DA du club, adaptées à l'impression sur blanc : celles de la DA
// affichée au moment de l'export (voir shared/ppc-da.css).
type RGB = [number, number, number];
interface PrintPalette {
  ink: RGB; muted: RGB; gold: RGB; line: RGB; soft: RGB;
  accent: RGB;     // accent assombri : lisible en petit texte
  or: RGB;         // liserés (encadrés, attestation)
  ivoire: RGB;     // fond des encadrés et en-têtes de tableau
  mark: RGB;       // repère devant les intertitres
  frise: RGB[];    // bandeau de pied de page
}
const PRINT: Record<DA, PrintPalette> = {
  vice: {
    ink: [38, 8, 45], muted: [125, 90, 116], gold: [196, 140, 0], line: [236, 220, 196], soft: [255, 249, 238],
    accent: [216, 40, 82], or: [242, 184, 26], ivoire: [255, 242, 220], mark: [255, 77, 112],
    frise: [[38, 8, 45], [255, 242, 220], [242, 184, 26], [255, 77, 112], [15, 198, 204]],
  },
  nuit: {
    ink: [11, 34, 56], muted: [86, 104, 124], gold: [161, 128, 56], line: [228, 220, 205], soft: [251, 247, 240],
    accent: [146, 113, 44], or: [201, 168, 91], ivoire: [247, 236, 221], mark: [201, 168, 91],
    frise: [[201, 168, 91]],
  },
};
let PRUNE: RGB, INK: RGB, MUTED: RGB, ACCENT: RGB, GOLD: RGB, LINE: RGB, SOFT: RGB, OR: RGB, IVOIRE: RGB, MARK: RGB, FRISE: RGB[];
/** Prend les couleurs de la DA affichée ; à appeler au début de chaque export. */
function choosePalette() {
  const p = PRINT[getDA()];
  PRUNE = INK = p.ink; MUTED = p.muted; ACCENT = p.accent; GOLD = p.gold;
  LINE = p.line; SOFT = p.soft; OR = p.or; IVOIRE = p.ivoire; MARK = p.mark; FRISE = p.frise;
}
choosePalette();
const SUIT_RGB: Record<string, [number, number, number]> = { s: [26, 31, 46], h: [220, 38, 38], d: [37, 99, 235], c: [21, 128, 61] };

const W = 210, H = 297, M = 16, CW = W - 2 * M;

/** Ramène le texte au jeu de caractères Latin-1 des polices standard. */
export function latin(s: string): string {
  return s
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—−]/g, '-')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/→/g, '->').replace(/≈/g, 'env. ').replace(/≥/g, '>=').replace(/≤/g, '<=')
    .replace(/€/g, 'euros').replace(/♠/g, ' pique').replace(/♥/g, ' coeur').replace(/♦/g, ' carreau').replace(/♣/g, ' trefle')
    .replace(/[  ]/g, ' ')
    .replace(/[^\u0000-ÿ]/g, '');
}

const logoCache = new Map<string, string | null>();
/** Jeton du club dans la DA affichée, en data URL. */
async function logo(): Promise<string | null> {
  const file = logoFile();
  if (logoCache.has(file)) return logoCache.get(file)!;
  let data: string | null = null;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}${file}`);
    const b = await r.blob();
    data = await new Promise<string>(res => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.readAsDataURL(b); });
  } catch { data = null; }
  logoCache.set(file, data);
  return data;
}

class Writer {
  doc: jsPDF;
  y = M;
  constructor(doc: jsPDF) { this.doc = doc; }
  ensure(h: number) { if (this.y + h > H - 18) { this.doc.addPage(); this.y = M + 4; } }
  text(s: string, x: number, size = 10, style: 'normal' | 'bold' | 'italic' = 'normal', color = INK) {
    this.doc.setFont('helvetica', style); this.doc.setFontSize(size); this.doc.setTextColor(...color);
    this.doc.text(latin(s), x, this.y);
  }
  wrap(s: string, width: number, size = 10, style: 'normal' | 'bold' = 'normal'): string[] {
    this.doc.setFont('helvetica', style); this.doc.setFontSize(size);
    return this.doc.splitTextToSize(latin(s), width) as string[];
  }
  para(s: string, x: number, width: number, size = 10, style: 'normal' | 'bold' = 'normal', color = INK, lh = 4.6) {
    const lines = this.wrap(s, width, size, style);
    for (const l of lines) { this.ensure(lh); this.doc.setFont('helvetica', style); this.doc.setFontSize(size); this.doc.setTextColor(...color); this.doc.text(l, x, this.y); this.y += lh; }
  }
  section(title: string) {
    this.ensure(14);
    this.y += 4;
    this.doc.setFillColor(...MARK); this.doc.rect(M, this.y - 3.4, 1.4, 4.4, 'F');
    this.text(title.toUpperCase(), M + 3.5, 9.5, 'bold', PRUNE);
    this.y += 6;
  }
  bullets(items: string[], mark = '•', color = INK) {
    for (const it of items) {
      const lines = this.wrap(it, CW - 7);
      this.ensure(lines.length * 4.6 + 1);
      this.doc.setTextColor(...(mark === '!' ? GOLD : ACCENT)); this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(10);
      this.doc.text(mark, M + 1.5, this.y);
      this.doc.setFont('helvetica', 'normal'); this.doc.setTextColor(...color);
      lines.forEach((l, i) => this.doc.text(l, M + 6, this.y + i * 4.6));
      this.y += lines.length * 4.6 + 1.2;
    }
  }
}

// ── Cartes dessinées ───────────────────────────────────────────────────────

function suitShape(doc: jsPDF, s: string, cx: number, cy: number, r: number) {
  doc.setFillColor(...SUIT_RGB[s]);
  if (s === 'd') {
    doc.triangle(cx, cy - r, cx + r * 0.75, cy, cx - r * 0.75, cy, 'F');
    doc.triangle(cx, cy + r, cx + r * 0.75, cy, cx - r * 0.75, cy, 'F');
  } else if (s === 'h') {
    doc.circle(cx - r * 0.45, cy - r * 0.25, r * 0.52, 'F');
    doc.circle(cx + r * 0.45, cy - r * 0.25, r * 0.52, 'F');
    doc.triangle(cx - r * 0.95, cy - r * 0.05, cx + r * 0.95, cy - r * 0.05, cx, cy + r, 'F');
  } else if (s === 's') {
    doc.circle(cx - r * 0.45, cy + r * 0.2, r * 0.5, 'F');
    doc.circle(cx + r * 0.45, cy + r * 0.2, r * 0.5, 'F');
    doc.triangle(cx - r * 0.93, cy + r * 0.05, cx + r * 0.93, cy + r * 0.05, cx, cy - r, 'F');
    doc.triangle(cx, cy + r * 0.2, cx - r * 0.4, cy + r * 1.05, cx + r * 0.4, cy + r * 1.05, 'F');
  } else {
    doc.circle(cx, cy - r * 0.45, r * 0.42, 'F');
    doc.circle(cx - r * 0.47, cy + r * 0.15, r * 0.42, 'F');
    doc.circle(cx + r * 0.47, cy + r * 0.15, r * 0.42, 'F');
    doc.triangle(cx, cy, cx - r * 0.38, cy + r * 1.05, cx + r * 0.38, cy + r * 1.05, 'F');
  }
}

function drawCard(doc: jsPDF, c: string, x: number, y: number, w = 7.5, h = 10.5) {
  doc.setDrawColor(190, 196, 210); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 0.9, 0.9, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...SUIT_RGB[c[1]]);
  doc.text(rankLabel(c), x + w / 2, y + 4.1, { align: 'center' });
  suitShape(doc, c[1], x + w / 2, y + 7.2, 1.45);
}

// ── Blocs ──────────────────────────────────────────────────────────────────

function block(wr: Writer, b: FicheBlock) {
  const { doc } = wr;
  if (b.title) wr.section(b.title);
  if (b.kind === 'text') { wr.para(b.text, M, CW); return; }
  if (b.kind === 'steps') {
    b.steps.forEach((s, i) => {
      const lines = wr.wrap(s, CW - 9);
      wr.ensure(lines.length * 4.6 + 2);
      doc.setFillColor(...IVOIRE); doc.setDrawColor(...OR); doc.setLineWidth(0.4);
      doc.circle(M + 2.6, wr.y - 1.3, 2.4, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...ACCENT);
      doc.text(String(i + 1), M + 2.6, wr.y - 0.2, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
      lines.forEach((l, k) => doc.text(l, M + 7.5, wr.y + k * 4.6));
      wr.y += lines.length * 4.6 + 1.8;
    });
    return;
  }
  if (b.kind === 'cards') {
    for (const r of b.rows) {
      wr.ensure(13);
      const cs = parseCards(r.cards);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      const lab = wr.wrap(r.label, 44, 9.5, 'bold');
      lab.forEach((l, k) => doc.text(l, M, wr.y + 3 + k * 4));
      cs.forEach((c, k) => drawCard(doc, c, M + 46 + k * 8.5, wr.y - 2));
      if (r.note) {
        const nx = M + 46 + cs.length * 8.5 + 3;
        const nl = wr.wrap(r.note, W - M - nx, 9);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
        nl.forEach((l, k) => doc.text(l, nx, wr.y + 3 + k * 4));
      }
      wr.y += 13;
    }
    return;
  }
  // tableau
  const n = b.head.length;
  const raw = b.widths ?? Array(n).fill(1);
  const tot = raw.reduce((a, x) => a + x, 0);
  const ws = raw.map(x => (x / tot) * CW);
  const rowH = (cells: string[], size: number, bold: boolean) => Math.max(...cells.map((c, i) => wr.wrap(c, ws[i] - 3, size, bold ? 'bold' : 'normal').length)) * 4.1 + 2.6;
  const drawRow = (cells: string[], header: boolean, zebra: boolean) => {
    const size = header ? 8.5 : 9;
    const h = rowH(cells, size, header);
    wr.ensure(h);
    if (header || zebra) { doc.setFillColor(...(header ? IVOIRE : SOFT)); doc.rect(M, wr.y - 3.6, CW, h, 'F'); }
    let x = M;
    cells.forEach((c, i) => {
      const lines = wr.wrap(c, ws[i] - 3, size, header ? 'bold' : 'normal');
      doc.setFont('helvetica', header ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...INK);
      lines.forEach((l, k) => doc.text(l, x + 1.5, wr.y + k * 4.1));
      x += ws[i];
    });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M, wr.y - 3.6 + h, M + CW, wr.y - 3.6 + h);
    wr.y += h;
  };
  drawRow(b.head, true, false);
  b.rows.forEach((r, i) => drawRow(r, false, i % 2 === 1));
  wr.y += 1;
}

// ── Fiche ──────────────────────────────────────────────────────────────────

async function header(wr: Writer, kicker: string, title: string, subtitle: string) {
  const { doc } = wr;
  const lg = await logo();
  if (lg) doc.addImage(lg, 'PNG', M, M - 2, 15, 15);
  const tx = lg ? M + 19 : M;
  wr.y = M + 2;
  wr.text(kicker, tx, 8.5, 'bold', MUTED);
  wr.y += 6.2;
  const tl = wr.wrap(title, W - M - tx, 16, 'bold');
  tl.forEach((l, i) => { wr.y += i ? 6.5 : 0; wr.text(l, tx, 16, 'bold'); });
  wr.y += 5.5;
  wr.text(subtitle, tx, 9.5, 'normal', MUTED);
  wr.y += 4;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.4); doc.line(M, wr.y, W - M, wr.y);
  wr.y += 5;
}

/** La frise du club : les cinq couleurs (Vice City) ou un filet d'or (Bleu nuit & or). */
function stripe(doc: jsPDF, x: number, y: number, w: number, h: number) {
  FRISE.forEach((c, i) => { doc.setFillColor(...c); doc.rect(x + (i * w) / FRISE.length, y, w / FRISE.length, h, 'F'); });
}

function footers(doc: jsPDF, parcours: 'initiation' | 'exploration' = 'initiation') {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    stripe(doc, M, H - 7, CW, 1.6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(latin(parcours === 'exploration' ? 'Penthièvre Poker Club · Exploration, niveau 2' : 'Penthièvre Poker Club · Initiation au No Limit Hold’em'), M, H - 9);
    doc.text(`${i} / ${n}`, W - M, H - 9, { align: 'right' });
  }
}

async function writeFiche(wr: Writer, lesson: Lesson, moduleTitle: string, terms: Term[]) {
  const f: Fiche = lesson.fiche;
  const ex = lesson.parcours === 'exploration';
  await header(wr, `FICHE DE SYNTHÈSE · ${ex ? 'EXPLORATION · ' : ''}LEÇON ${labelForId(lesson.id)}${lesson.bonus ? ' (BONUS)' : ''}`, lesson.title, `${ex ? `Module ${labelForId(lesson.id)[0]}` : `Module ${lesson.module}`} · ${moduleTitle} — ${lesson.objective}`);
  wr.section('L’essentiel');
  wr.bullets(f.essentiel);
  f.blocks?.forEach(b => block(wr, b));
  if (f.pieges?.length) { wr.section('Pièges à éviter'); wr.bullets(f.pieges, '!'); }
  if (terms.length && lesson.id !== 19) {
    wr.section('Les mots de la leçon');
    for (const t of terms) {
      const head = `${t.term}${altOf(t) ? ` (${altOf(t)})` : ''} : `;
      wr.doc.setFont('helvetica', 'bold'); wr.doc.setFontSize(9.5);
      const hw = wr.doc.getTextWidth(latin(head));
      const lines = wr.wrap(t.def, CW - hw, 9.5);
      wr.ensure(lines.length * 4.4 + 1);
      wr.doc.setTextColor(...INK); wr.doc.text(latin(head), M, wr.y);
      wr.doc.setFont('helvetica', 'normal');
      wr.doc.text(lines[0] ?? '', M + hw, wr.y);
      const rest = lines.slice(1).join(' ');
      wr.y += 4.4;
      if (rest) { const rl = wr.wrap(rest, CW, 9.5); rl.forEach(l => { wr.ensure(4.4); wr.doc.text(l, M, wr.y); wr.y += 4.4; }); }
      wr.y += 0.8;
    }
  }
}

function slug(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function downloadFiche(lesson: Lesson, moduleTitle: string, terms: Term[]) {
  choosePalette();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const wr = new Writer(doc);
  await writeFiche(wr, lesson, moduleTitle, terms);
  footers(doc, lesson.parcours);
  doc.save(lesson.parcours === 'exploration'
    ? `PPC-Exploration-Lecon-${labelForId(lesson.id)}-${slug(lesson.title)}.pdf`
    : `PPC-Initiation-Lecon-${String(lesson.id).padStart(2, '0')}-${slug(lesson.title)}.pdf`);
}

export async function downloadAllFiches(items: { lesson: Lesson; moduleTitle: string; terms: Term[] }[], parcours: 'initiation' | 'exploration' = 'initiation') {
  choosePalette();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const wr = new Writer(doc);
  for (let i = 0; i < items.length; i++) {
    if (i > 0) { doc.addPage(); wr.y = M; }
    await writeFiche(wr, items[i].lesson, items[i].moduleTitle, items[i].terms);
  }
  footers(doc, parcours);
  doc.save(parcours === 'exploration' ? 'PPC-Exploration-Toutes-les-fiches.pdf' : 'PPC-Initiation-Toutes-les-fiches.pdf');
}

// ── Attestation ────────────────────────────────────────────────────────────

export async function downloadAttestation(name: string, avg: number, parcours: 'initiation' | 'exploration' = 'initiation') {
  const ex = parcours === 'exploration';
  choosePalette();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const w = 297, h = 210;
  doc.setFillColor(...SOFT); doc.rect(0, 0, w, h, 'F');
  doc.setDrawColor(...PRUNE); doc.setLineWidth(1.4); doc.rect(10, 10, w - 20, h - 20);
  doc.setDrawColor(...OR); doc.setLineWidth(0.5); doc.rect(14, 14, w - 28, h - 28);
  stripe(doc, 14, h - 20, w - 28, 2.2);
  const lg = await logo();
  if (lg) doc.addImage(lg, 'PNG', w / 2 - 14, 24, 28, 28);
  const c = (s: string, y: number, size: number, style: 'normal' | 'bold' | 'italic' = 'normal', col = INK) => {
    doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...col);
    doc.text(latin(s), w / 2, y, { align: 'center' });
  };
  c('PENTHIÈVRE POKER CLUB', 64, 11, 'bold', MUTED);
  c(ex ? 'ATTESTATION EXPLORATION' : 'ATTESTATION D’INITIATION', 80, 28, 'bold', PRUNE);
  c(ex ? 'No Limit Texas Hold’em · niveau 2' : 'au No Limit Texas Hold’em', 91, 16, 'normal', MUTED);
  c('décernée à', 108, 12, 'italic', MUTED);
  c(name || '________________________', 123, 26, 'bold', ACCENT);
  doc.setDrawColor(...OR); doc.setLineWidth(0.6); doc.line(w / 2 - 60, 128, w / 2 + 60, 128);
  c(ex ? `pour avoir validé les 14 leçons du parcours Exploration (score moyen : ${Math.round(avg * 100)} %).` : `pour avoir validé les 19 leçons du parcours d’initiation (score moyen : ${Math.round(avg * 100)} %).`, 138, 12);
  c(ex ? 'Parler poker · Les chiffres qui comptent · Penser en ranges · Sizing : les maths' : 'Le but du jeu · Les combinaisons · Le déroulement d’une main · Le préflop · Le postflop · Repères et vocabulaire', 148, 9.5, 'normal', MUTED);
  c(`Le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, 172, 11);
  doc.save(`PPC-Attestation-${ex ? 'Exploration' : 'Initiation'}${name ? '-' + slug(name) : ''}.pdf`);
}
