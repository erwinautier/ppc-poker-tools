import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { getDA, logoFile, subscribeDA, toggleDA } from '../../shared/ppc-da.js';
import { CardSlot } from './components/CardSlot';
import { CardPicker } from './components/CardPicker';
import { RangePanel } from './components/RangePanel';
import { handCombos } from './lib/cards';
import { ALL_HANDS, parseRange } from './lib/range';
import type { SimPlayer, SimResult } from './lib/sim.worker';

interface Player {
  id: number;
  name: string;
  active: boolean;
  hole: [number | null, number | null];
  range: Set<string>;
}

interface Results { wins: number[]; ties: number[]; equity: number[]; iterations: number; skipped: number }

type PickerTarget = { kind: 'board'; idx: number } | { kind: 'hole'; player: number; idx: number } | null;

const DEFAULT_RANGES = ['22+, A2s+, K9s+, Q9s+, J9s+, T9s, ATo+, KJo+', '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 97s+, 87s, 76s, A7o+, K9o+, QTo+, JTo'];

let nextId = 3;

function potOdds(eq: number): string {
  if (eq <= 0) return '∞';
  if (eq >= 1) return '0';
  const r = (1 - eq) / eq;
  const round = (x: number) => (x < 5 ? Math.round(x * 2) / 2 : Math.round(x));
  return r >= 1 ? `${round(r)} : 1` : `1 : ${round(1 / r)}`;
}

export default function App() {
  const da = useSyncExternalStore(subscribeDA, getDA);
  const [players, setPlayers] = useState<Player[]>(() => [
    { id: 1, name: 'Hero',      active: true, hole: [null, null], range: parseRange(DEFAULT_RANGES[0]).range },
    { id: 2, name: 'Villain 1', active: true, hole: [null, null], range: parseRange(DEFAULT_RANGES[1]).range },
  ]);
  const [board, setBoard] = useState<(number | null)[]>([null, null, null, null, null]);
  const [picker, setPicker] = useState<PickerTarget>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const usedCards = useMemo(() => {
    const s = new Set<number>();
    for (const c of board) if (c !== null) s.add(c);
    for (const p of players) for (const c of p.hole) if (c !== null) s.add(c);
    return s;
  }, [board, players]);

  /** Hands with no live combo once dead cards are removed (visual hint on grids). */
  const deadHands = useMemo(() => {
    const s = new Set<string>();
    if (usedCards.size === 0) return s;
    for (const h of ALL_HANDS) {
      if (handCombos(h).every(([a, b]) => usedCards.has(a) || usedCards.has(b))) s.add(h);
    }
    return s;
  }, [usedCards]);

  // Any change invalidates results and stops the sim
  useEffect(() => { stop(); setResults(null); setError(null); }, [players, board]); // eslint-disable-line react-hooks/exhaustive-deps

  function stop() {
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    setRunning(false);
  }

  function simulate() {
    if (running) { stop(); return; }
    const active = players.filter(p => p.active);
    if (active.length < 2) { setError('Il faut au moins 2 joueurs actifs.'); return; }
    const boardCards = board.filter((c): c is number => c !== null);
    if (boardCards.length === 1 || boardCards.length === 2) {
      setError('Le board doit avoir 0 cartes (préflop), 3 (flop), 4 (turn) ou 5 (river).'); return;
    }
    const simPlayers: SimPlayer[] = [];
    for (const p of active) {
      const [a, b] = p.hole;
      if (a !== null && b !== null) simPlayers.push({ lock: [a, b], hands: [] });
      else {
        if ((a === null) !== (b === null)) { setError(`${p.name} : choisis les deux cartes ou aucune.`); return; }
        const hands = [...p.range].filter(h => !deadHands.has(h));
        if (hands.length === 0) { setError(`${p.name} : la range est vide.`); return; }
        simPlayers.push({ lock: null, hands });
      }
    }
    setError(null);
    setResults(null);
    const w = new Worker(new URL('./lib/sim.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<SimResult>) => {
      const r = e.data;
      setResults({ wins: r.wins, ties: r.ties, equity: r.equity, iterations: r.iterations, skipped: r.skipped });
      if (r.iterations >= 200_000) stop();
    };
    workerRef.current = w;
    setRunning(true);
    w.postMessage({ type: 'start', players: simPlayers, board: boardCards, batch: 5000 });
  }

  function updatePlayer(id: number, patch: Partial<Player>) {
    setPlayers(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }
  function addPlayer() {
    if (players.length >= 9) return;
    const n = players.length;
    setPlayers(ps => [...ps, { id: nextId++, name: `Villain ${n}`, active: true, hole: [null, null], range: parseRange(DEFAULT_RANGES[1]).range }]);
  }
  function removePlayer(id: number) {
    if (players.length <= 2) return;
    setPlayers(ps => ps.filter(p => p.id !== id));
  }

  function onPick(card: number | null) {
    if (!picker) return;
    if (picker.kind === 'board') {
      setBoard(b => b.map((c, i) => (i === picker.idx ? card : c)));
    } else {
      const p = players.find(x => x.id === picker.player)!;
      const hole: [number | null, number | null] = [...p.hole];
      hole[picker.idx] = card;
      updatePlayer(p.id, { hole });
    }
    // Auto-advance to the next empty slot of the same kind
    if (card !== null) {
      if (picker.kind === 'board' && picker.idx < 4) { setPicker({ kind: 'board', idx: picker.idx + 1 }); return; }
      if (picker.kind === 'hole' && picker.idx === 0) { setPicker({ kind: 'hole', player: picker.player, idx: 1 }); return; }
    }
    setPicker(null);
  }

  const pickerCurrent = picker
    ? picker.kind === 'board' ? board[picker.idx] : players.find(p => p.id === picker.player)!.hole[picker.idx]
    : null;
  const pickerTitle = picker
    ? picker.kind === 'board'
      ? ['Flop (1)', 'Flop (2)', 'Flop (3)', 'Turn', 'River'][picker.idx]
      : `${players.find(p => p.id === picker.player)!.name} · carte ${picker.idx + 1}`
    : '';

  // Map results (indexed on active players) back to player ids
  const activeIds = players.filter(p => p.active).map(p => p.id);
  const resFor = (id: number) => {
    if (!results) return null;
    const i = activeIds.indexOf(id);
    if (i < 0 || results.iterations === 0) return null;
    return {
      win: (results.wins[i] / results.iterations) * 100,
      tie: (results.ties[i] / results.iterations) * 100,
      eq: results.equity[i] / results.iterations,
    };
  };

  return (
    <div className="page">
      <div className="header">
        <a href="/" title="Accueil"><img src={`${import.meta.env.BASE_URL}${logoFile(da)}`} alt="PPC" /></a>
        <div>
          <h1>Calculateur d'équité</h1>
          <div className="sub">Range vs range · Monte Carlo · NLHE</div>
        </div>
        <button type="button" className="ppc-da-switch" onClick={toggleDA} title="Changer de direction artistique" aria-label="Changer de direction artistique" />
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="ptable">
            <thead>
              <tr>
                <th></th><th style={{ textAlign: 'left' }}>Joueur</th><th>Cartes</th><th>Range</th>
                <th>Équité</th><th>Win %</th><th>Tie %</th><th>Pot odds</th><th></th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => {
                const r = resFor(p.id);
                return (
                  <tr key={p.id} className={p.active ? '' : 'off'}>
                    <td><input type="checkbox" checked={p.active} onChange={e => updatePlayer(p.id, { active: e.target.checked })} /></td>
                    <td className="name"><input value={p.name} onChange={e => updatePlayer(p.id, { name: e.target.value })} /></td>
                    <td className="cards">
                      <CardSlot card={p.hole[0]} onClick={() => setPicker({ kind: 'hole', player: p.id, idx: 0 })} title="Carte 1 (optionnel)" />
                      <CardSlot card={p.hole[1]} onClick={() => setPicker({ kind: 'hole', player: p.id, idx: 1 })} title="Carte 2 (optionnel)" />
                    </td>
                    <td className="num">{p.hole[0] !== null && p.hole[1] !== null ? '—' : `${(([...p.range].reduce((a, h) => a + handCombos(h).length, 0) / 1326) * 100).toFixed(1)}%`}</td>
                    <td className="num eq-big">{r ? `${(r.eq * 100).toFixed(1)}%` : '-'}</td>
                    <td className="num">{r ? `${r.win.toFixed(1)}%` : '-'}</td>
                    <td className="num">{r ? `${r.tie.toFixed(1)}%` : '-'}</td>
                    <td className="num">{r ? potOdds(r.eq) : '-'}</td>
                    <td><button className="btn sm" onClick={() => removePlayer(p.id)} disabled={players.length <= 2} title="Retirer">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="board-row">
          {board.map((c, i) => (
            <CardSlot key={i} card={c} large onClick={() => setPicker({ kind: 'board', idx: i })} title={['Flop', 'Flop', 'Flop', 'Turn', 'River'][i]} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
          {results && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: 'auto' }}>
              {results.iterations.toLocaleString('fr-FR')} tirages{running ? '…' : ''}
              {results.skipped > 0 && ` · ${results.skipped} ignorés`}
            </span>
          )}
          {error && <span style={{ fontSize: '0.78rem', color: 'var(--red)', marginRight: 'auto' }}>{error}</span>}
          <button className="btn" onClick={() => setBoard([null, null, null, null, null])}>Vider le board</button>
          <button className="btn" onClick={addPlayer} disabled={players.length >= 9}>Ajouter un joueur</button>
          <button className={`btn ${running ? 'danger' : 'primary'}`} onClick={simulate}>
            {running ? '■ Stop' : '▶ Simuler'}
          </button>
        </div>
      </div>

      <div className="panels">
        {players.map(p => (
          <RangePanel
            key={p.id}
            name={p.name}
            range={p.range}
            deadHands={deadHands}
            onChange={r => updatePlayer(p.id, { range: r })}
          />
        ))}
      </div>

      <div className="help">
        <h3>Comment ça marche</h3>
        <p>Pour chaque joueur, définis une range de trois façons synchronisées : en texte (<code>AA, AKs, T5o+, 96s-, 66-99, QJ</code>), avec le slider (top X % des mains) ou en cliquant / glissant sur la grille.</p>
        <p>Les cartes du board sont optionnelles : vide = préflop, 3 cartes = flop, 4 = turn, 5 = river. Tu peux aussi fixer les deux cartes d'un joueur pour tester une main précise contre une range.</p>
        <p><b>Équité</b> = win + part des ties. <b>Pot odds</b> = cote minimale pour que le call soit rentable (ex. 2 : 1 ⇒ il faut au moins 33 % d'équité). La simulation tourne en continu jusqu'à Stop ou 200 000 tirages ; la précision dépasse rapidement ±0,5 %.</p>
      </div>

      {picker && (
        <CardPicker title={pickerTitle} used={usedCards} current={pickerCurrent} onPick={onPick} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
