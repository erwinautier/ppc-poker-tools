/// <reference lib="webworker" />
import { evaluate } from './evaluator';
import { handCombos } from './cards';

export interface SimPlayer {
  /** Locked hole cards (card ints) or null to sample from the range. */
  lock: [number, number] | null;
  /** Hand labels in the player's range. */
  hands: string[];
}

export interface SimRequest { type: 'start'; players: SimPlayer[]; board: number[]; batch: number }
export interface SimStop { type: 'stop' }
export interface SimResult {
  type: 'result';
  wins: number[];
  ties: number[];
  equity: number[];
  iterations: number;
  skipped: number;
}

let running = false;

self.onmessage = (e: MessageEvent<SimRequest | SimStop>) => {
  if (e.data.type === 'stop') { running = false; return; }
  running = true;
  run(e.data);
};

function run(req: SimRequest) {
  const n = req.players.length;
  const combos = req.players.map(p => p.lock ? [p.lock] : p.hands.flatMap(h => handCombos(h)));
  const wins = new Array(n).fill(0);
  const ties = new Array(n).fill(0);
  const equity = new Array(n).fill(0);
  let iterations = 0, skipped = 0;

  const used = new Uint8Array(52);
  const boardFixed = req.board;
  const deck: number[] = [];
  const hole: [number, number][] = new Array(n);
  const vals = new Array<number>(n);
  const cards7 = new Array<number>(7);

  const loop = () => {
    if (!running) return;
    for (let it = 0; it < req.batch; it++) {
      used.fill(0);
      for (const c of boardFixed) used[c] = 1;

      // Sample hole cards for each player (rejection on collision)
      let ok = true;
      for (let p = 0; p < n && ok; p++) {
        const list = combos[p];
        let tries = 0;
        for (;;) {
          const c = list[(Math.random() * list.length) | 0];
          if (!used[c[0]] && !used[c[1]]) { used[c[0]] = 1; used[c[1]] = 1; hole[p] = c; break; }
          if (++tries > 200) { ok = false; break; }
        }
      }
      if (!ok) { skipped++; continue; }

      // Deal the rest of the board
      deck.length = 0;
      for (let c = 0; c < 52; c++) if (!used[c]) deck.push(c);
      const need = 5 - boardFixed.length;
      for (let k = 0; k < need; k++) {
        const j = k + ((Math.random() * (deck.length - k)) | 0);
        const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
      }

      // Evaluate
      let best = -1, nBest = 0;
      for (let p = 0; p < n; p++) {
        cards7[0] = hole[p][0]; cards7[1] = hole[p][1];
        let i = 2;
        for (const c of boardFixed) cards7[i++] = c;
        for (let k = 0; k < need; k++) cards7[i++] = deck[k];
        const v = evaluate(cards7);
        vals[p] = v;
        if (v > best) { best = v; nBest = 1; } else if (v === best) nBest++;
      }
      for (let p = 0; p < n; p++) {
        if (vals[p] !== best) continue;
        if (nBest === 1) { wins[p]++; equity[p] += 1; }
        else { ties[p]++; equity[p] += 1 / nBest; }
      }
      iterations++;
    }

    const msg: SimResult = { type: 'result', wins, ties, equity, iterations, skipped };
    (self as unknown as Worker).postMessage(msg);
    setTimeout(loop, 0);
  };
  loop();
}
