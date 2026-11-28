/** Mécaniques propres au parcours Exploration. */
import { useEffect, useRef, useState } from 'react';
import { type Card, cardLabel } from '../lib/cards';
import { parseRange } from '../lib/chart';
import {
  type RvR, alpha, bluffShare, combosOf, geometricFraction, icm, mdf, potAfterBet, priceNeeded, rangeVsRange, shareA, strongDetail,
} from '../lib/theory';
import { CardRow, HandGrid } from './Cards';

export const pct = (x: number, d = 0) => `${(x * 100).toLocaleString('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d })} %`;
const num = (x: number, d = 1) => x.toLocaleString('fr-FR', { maximumFractionDigits: d });

// ── Calculatrice de sizing ─────────────────────────────────────────────────

/** Curseur de mise : prix offert, alpha, MDF et part de bluffs, en direct. */
export function SizingCalc({ pot = 100, show = ['price', 'alpha', 'mdf', 'bluffs'] }: { pot?: number; show?: ('price' | 'alpha' | 'mdf' | 'bluffs')[] }) {
  const [frac, setFrac] = useState(0.75);
  const bet = Math.round(pot * frac);
  const tiles: Record<string, [string, string, string]> = {
    price: ['Prix offert', pct(priceNeeded(bet, pot)), 'équité pour suivre'],
    alpha: ['Alpha', pct(alpha(bet, pot)), 'réussite du bluff'],
    mdf: ['MDF', pct(mdf(bet, pot)), 'défense minimale'],
    bluffs: ['Bluffs', pct(bluffShare(bet, pot)), 'de la range de mise'],
  };
  return (
    <div className="scene stack">
      <div className="row between"><span className="muted small">Pot</span><strong>{pot}</strong></div>
      <div className="row between"><span className="muted small">Mise</span><strong>{bet} · {num(frac * 100, 0)} % du pot</strong></div>
      <input type="range" min={10} max={300} step={5} value={Math.round(frac * 100)} onChange={e => setFrac(Number(e.target.value) / 100)} aria-label="Taille de la mise en % du pot" />
      <div className="tiles">
        {show.map(k => (
          <div key={k} className="tile"><div className="muted small">{tiles[k][0]}</div><div className="tv">{tiles[k][1]}</div><div className="muted small">{tiles[k][2]}</div></div>
        ))}
      </div>
    </div>
  );
}

// ── Géométrie des mises ────────────────────────────────────────────────────

/** Trois mises égales : la fraction qui met tout le monde à tapis à la river. */
export function GeoCalc({ pot = 6, stack = 50, initial = 0.5, onPick, reveal = true }: { pot?: number; stack?: number; initial?: number; onPick?: (f: number) => void; reveal?: boolean }) {
  const [f, setF] = useState(initial);
  const rows: { street: string; pot: number; bet: number; left: number }[] = [];
  let p = pot, left = stack;
  for (const street of ['Flop', 'Turn', 'River']) {
    const bet = Math.min(left, p * f);
    rows.push({ street, pot: p, bet, left: left - bet });
    p = p + 2 * bet; left -= bet;
  }
  const geo = geometricFraction(pot, stack, 3);
  const eps = stack * 0.01; // à 1 % du tapis près, on est à tapis
  return (
    <div className="scene stack">
      <div className="row between"><span className="muted small">Pot au flop · tapis effectif</span><strong>{pot} BB · {stack} BB</strong></div>
      <div className="row between"><span className="muted small">Mise à chaque tour</span><strong>{num(f * 100, 0)} % du pot</strong></div>
      <input type="range" min={20} max={150} step={1} value={Math.round(f * 100)} onChange={e => { const v = Number(e.target.value) / 100; setF(v); onPick?.(v); }} aria-label="Fraction du pot misée à chaque tour" />
      <table className="tbl">
        <thead><tr><th>Tour</th><th className="r">Pot</th><th className="r">Mise</th><th className="r">Reste</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.street}><td>{r.street}</td><td className="r">{num(r.pot)}</td><td className="r">{num(r.bet)}</td><td className="r">{num(r.left)}</td></tr>)}</tbody>
      </table>
      <p className="small">{rows[2].left < eps ? (rows[1].left < eps ? '⚠ Tapis avant la river : la mise est trop grosse.' : '✓ Tout le monde est à tapis à la river.') : `Il reste ${num(rows[2].left)} BB derrière à la river.`}</p>
      {reveal && <p className="muted small">Taille géométrique exacte : {num(geo * 100, 0)} % du pot à chaque tour.</p>}
    </div>
  );
}

// ── Comparateur de ranges ──────────────────────────────────────────────────

/** Grille 13×13 d'une range, sans étiquettes (range A en or, range B en turquoise). */
export function RangeGrid({ set, tone = 'a' }: { set: Set<string>; tone?: 'a' | 'b' }) {
  return <div className="rgrid"><HandGrid showLabels={false} classFor={h => (set.has(h) ? `rg${tone}` : undefined)} /></div>;
}

interface RangeSide { name: string; spec: string }

/** Deux ranges sur un board : équité simulée (range advantage) et mains très fortes (nut advantage). */
export function RangeCompare({ a, b, board, run = true }: { a: RangeSide; b: RangeSide; board: Card[]; run?: boolean }) {
  const ra = parseRange(a.spec), rb = parseRange(b.spec);
  const [eq, setEq] = useState<RvR | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!run) return;
    let acc: RvR | undefined, k = 0;
    const step = () => {
      acc = rangeVsRange(ra, rb, board, 600, acc);
      setEq(acc);
      if (++k < 12) timer.current = window.setTimeout(step, 40);
    };
    step();
    return () => clearTimeout(timer.current);
  }, [run, a.spec, b.spec, board.join()]);
  const da = strongDetail(ra, board), db = strongDetail(rb, board);
  const sa = eq ? shareA(eq) : 0;
  return (
    <div className="scene stack">
      <CardRow cs={board} size="sm" />
      <div className="grid2">
        <div><p className="muted small mb">{a.name}</p><RangeGrid set={ra} tone="a" /></div>
        <div><p className="muted small mb">{b.name}</p><RangeGrid set={rb} tone="b" /></div>
      </div>
      {run && eq && (
        <>
          <div className="eqbar">
            <div className="ea" style={{ width: `${sa * 100}%` }}>{a.name.split(' ')[0]} {Math.round(sa * 100)} %</div>
            <div className="eb" style={{ width: `${(1 - sa) * 100}%` }}>{b.name.split(' ')[0]} {Math.round((1 - sa) * 100)} %</div>
          </div>
          <span className="muted small center">Équité range contre range · {eq.n.toLocaleString('fr-FR')} mains simulées</span>
          <table className="tbl">
            <thead><tr><th>Deux paires ou mieux</th><th className="r">{a.name.split(' ')[0]}</th><th className="r">{b.name.split(' ')[0]}</th></tr></thead>
            <tbody>
              <tr><td>Deux paires</td><td className="r">{da.twoPair}</td><td className="r">{db.twoPair}</td></tr>
              <tr><td>Sets</td><td className="r">{da.sets}</td><td className="r">{db.sets}</td></tr>
              <tr><td>Suites et mieux</td><td className="r">{da.straights + da.better}</td><td className="r">{db.straights + db.better}</td></tr>
              <tr><td>Total (combos)</td><td className="r">{da.total} / {da.combos}</td><td className="r">{db.total} / {db.combos}</td></tr>
              <tr><td><strong>Part de la range</strong></td><td className="r"><strong>{pct(da.share, 1)}</strong></td><td className="r"><strong>{pct(db.share, 1)}</strong></td></tr>
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Résultat d'un comparateur, calculé d'un coup (pour corriger les exercices). */
export function compareRanges(aSpec: string, bSpec: string, board: Card[], n = 6000) {
  const ra = parseRange(aSpec), rb = parseRange(bSpec);
  const e = rangeVsRange(ra, rb, board, n);
  return { equityA: shareA(e), nutShareA: strongDetail(ra, board).share, nutShareB: strongDetail(rb, board).share };
}

// ── Combos et bloqueurs ────────────────────────────────────────────────────

/** Tous les combos d'une main, ceux bloqués par les cartes mortes étant barrés. */
export function ComboList({ code, dead }: { code: string; dead: Card[] }) {
  const all = combosOf(code);
  const live = new Set(combosOf(code, dead).map(c => c.join()));
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="combos">
        {all.map(c => {
          const ok = live.has(c.join());
          return <span key={c.join()} className={ok ? 'live' : 'dead'}>{c.map(cardLabel).join('')}</span>;
        })}
      </div>
      <span className="small">{all.length} combos au départ · <strong>{live.size} restant{live.size > 1 ? 's' : ''}</strong>{dead.length ? ` (cartes mortes : ${dead.map(cardLabel).join(' ')})` : ''}</span>
    </div>
  );
}

// ── ICM ────────────────────────────────────────────────────────────────────

export function IcmTable({ names, stacks, payouts, prize }: { names: string[]; stacks: number[]; payouts: number[]; prize: number }) {
  const ev = icm(stacks, payouts.map(p => p * prize));
  const total = stacks.reduce((a, b) => a + b, 0);
  return (
    <table className="tbl">
      <thead><tr><th>Joueur</th><th className="r">Jetons</th><th className="r">% des jetons</th><th className="r">Valeur ICM</th><th className="r">% du prize pool</th></tr></thead>
      <tbody>
        {names.map((n, i) => (
          <tr key={n}><td>{n}</td><td className="r">{stacks[i].toLocaleString('fr-FR')}</td><td className="r">{pct(stacks[i] / total, 1)}</td><td className="r">{num(ev[i], 0)} €</td><td className="r">{pct(ev[i] / prize, 1)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Simulation de bluffs répétés ───────────────────────────────────────────

/** 200 bluffs simulés : mise B dans un pot P, l'adversaire se couche avec une fréquence donnée. */
export function BluffSim({ pot, bet, fold }: { pot: number; bet: number; fold: number }) {
  const [series] = useState(() => {
    const s = [0];
    for (let i = 0; i < 200; i++) s.push(s[s.length - 1] + (Math.random() < fold ? pot : -bet));
    return s;
  });
  const w = 300, h = 70;
  const min = Math.min(0, ...series), max = Math.max(0, ...series);
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * h;
  const end = series[series.length - 1];
  const ev = fold * pot - (1 - fold) * bet;
  return (
    <div className="scene stack" style={{ gap: 4 }}>
      <span className="small muted">200 bluffs de {bet} dans un pot de {pot}, l’adversaire se couche {pct(fold)} du temps :</span>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Résultat : ${end}`}>
        <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="var(--border)" strokeDasharray="4 4" />
        <polyline points={series.map((v, i) => `${(i / (series.length - 1)) * w},${y(v)}`).join(' ')} fill="none" stroke={end >= 0 ? 'var(--success)' : 'var(--danger)'} strokeWidth="2" />
      </svg>
      <span className="small">Résultat : <strong>{end >= 0 ? '+' : ''}{end}</strong> · en moyenne <strong>{ev >= 0 ? '+' : ''}{num(ev)}</strong> par bluff.</span>
    </div>
  );
}

// ── Passerelle vers l'Initiation ──────────────────────────────────────────

/** Lien vers les leçons de l'Initiation qui posent les bases d'une notion. */
export function Basics({ refs }: { refs: [number, string][] }) {
  return (
    <p className="small muted">
      Revoir les bases dans l’Initiation :{' '}
      {refs.map(([id, title], i) => <span key={id}>{i ? ' · ' : ''}<a href={`#/lecon/${id}`}>leçon {id}, {title}</a></span>)}
    </p>
  );
}

export { potAfterBet };
