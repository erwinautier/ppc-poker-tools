/**
 * Partage sans serveur : la main tient tout entière dans le lien (compressée, après « #/voir/ »).
 * Le texte pour WhatsApp raconte la main et, s'il y a une décision, s'arrête juste avant.
 */
import { cardsText } from './cards';
import { bbs, chips, pct } from './format';
import { BOARD_AT, STREETS, positions, potOf } from './engine';
import { ctxText, decisionState, heroCards, involved, lineText, replayOf, sanitize, seatName, story, type HandData } from './hand';

// ── Encodage du lien ─────────────────────────────────────────────────────────

function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const canZip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/** « z… » : JSON compressé ; « j… » : JSON brut (navigateur sans compression). */
export async function encodeHand(h: HandData): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(h));
  if (canZip()) {
    try { return 'z' + toB64url(await pipe(json, new CompressionStream('deflate-raw'))); } catch { /* repli ci-dessous */ }
  }
  return 'j' + toB64url(json);
}

export async function decodeHand(code: string): Promise<HandData | null> {
  try {
    const body = fromB64url(code.slice(1));
    if (body.length > 64_000) return null;
    let bytes: Uint8Array;
    if (code[0] === 'z') {
      if (!canZip()) return null;
      bytes = await pipe(body, new DecompressionStream('deflate-raw'));
    } else if (code[0] === 'j') bytes = body;
    else return null;
    if (bytes.length > 200_000) return null;
    return sanitize(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

const base = () => `${location.origin}${import.meta.env.BASE_URL}`;
export const handLink = (code: string) => `${base()}#/voir/${code}`;
export const clubLink = (id: string) => `${base()}#/club/${id}`;

// ── Texte (WhatsApp) ─────────────────────────────────────────────────────────

export interface TextOptions {
  /** Montrer toute la main, même après la décision. */
  all: boolean;
  link?: string;
}

export function handText(h: HandData, o: TextOptions): string {
  const r = replayOf(h);
  const bb = h.ctx.blinds.bb;
  const n = h.seats.length;
  const pos = positions(n);
  const decision = decisionState(h, r);
  const stop = decision && !o.all ? h.decision! : h.actions.length;
  const out: string[] = [];

  out.push('🃏 *Carnet de mains PPC*');
  out.push(ctxText(h.ctx));
  const hs = h.seats[h.hero].stack;
  out.push(`${n} joueurs · héros ${pos[h.hero]}, ${chips(hs)} (${bbs(hs, bb)})`);
  const hc = heroCards(h);
  if (hc.length) out.push(`Héros : ${cardsText(hc)}`);
  const others = involved(h).filter(i => i !== h.hero);
  if (others.length) out.push(`Tapis : ${others.map(i => `${pos[i]} ${chips(h.seats[i].stack)} (${bbs(h.seats[i].stack, bb)})`).join(' · ')}`);

  const lines = story(h, r, stop);
  if (lines.length) out.push('');
  for (const line of lines) {
    const board = line.street > 0 ? ` ${cardsText(line.board.slice(BOARD_AT[line.street - 1]))}` : '';
    const pot = line.street > 0 ? ` (pot ${chips(line.pot)})` : '';
    out.push(`*${STREETS[line.street]}*${board}${pot} : ${lineText(h, line)}`);
  }

  if (decision && !o.all) {
    const s = decision;
    const call = Math.min(s.current - s.ps[h.hero].bet, s.ps[h.hero].stack);
    // Tour qui commence à la décision : on montre le board qui vient d'arriver.
    if (!lines.length || lines.at(-1)!.street !== s.street) {
      const cards = h.board.slice(BOARD_AT[s.street - 1] ?? 0, BOARD_AT[s.street]);
      if (s.street > 0) out.push(`*${STREETS[s.street]}* ${cardsText(cards)} (pot ${chips(potOf(s))})`);
    }
    out.push('');
    out.push(call > 0
      ? `❓ *Et toi, tu fais quoi ?* Il faut payer ${chips(call)} pour un pot de ${chips(potOf(s) + call)} (cote ${pct(call / (potOf(s) + call))}).`
      : `❓ *Et toi, tu fais quoi ?* Pot de ${chips(potOf(s))}, c'est au héros de parler.`);
  } else {
    const last = r.states.at(-1)!;
    const missing = h.board.length > BOARD_AT[lines.at(-1)?.street ?? 0];
    if (last.over && last.won === null && missing) out.push(`Board final : ${cardsText(h.board)}`);
    const shown = h.seats.map((s, i) => (i !== h.hero && s.cards?.length ? `${seatName(h, i)} montre ${cardsText(s.cards)}` : '')).filter(Boolean);
    if (shown.length) out.push(`Abattage : ${shown.join(' · ')}`);
    if (last.over) {
      const winners = last.won !== null ? [last.won] : h.winners;
      if (winners.length) out.push(`${winners.map(i => seatName(h, i)).join(' et ')} ${winners.length > 1 ? 'partagent' : 'remporte'} ${chips(potOf(last))}.`);
    }
  }
  if (h.tags.length) out.push(`#${h.tags.map(t => t.replace(/[^\p{L}\p{N}]+/gu, '')).filter(Boolean).join(' #')}`);
  if (o.link) { out.push(''); out.push(`${decision && !o.all ? 'La suite et le rejoueur' : 'Le rejoueur'} : ${o.link}`); }
  return out.join('\n');
}

/** Ouvre WhatsApp avec le texte (application sur téléphone, WhatsApp Web sinon). */
export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
