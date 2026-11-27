/** Club fictif (« ?demo ») : un tournoi en cours et trois mains au vote, gardés dans ce navigateur. */
import type { ClubApi, Feed, Post } from './club';
import { replay, type Action } from './engine';
import type { HandData } from './hand';
import type { ClubTournament } from './levels';
import { voteOptions, type VoteOption } from './vote';

export type DemoRole = 'member' | 'staff' | 'anon';

interface DemoPost {
  id: string;
  mine: boolean;
  author_name: string | null;
  hand: HandData;
  options: VoteOption[];
  hidden: boolean;
  created_at: string;
  votes: { voter: string; choice: number; reasons: number[] }[];
}
interface DemoState { role: DemoRole; posts: DemoPost[] }

const KEY = 'ppc-carnet-demo-v1';
const ME = 'moi';
const f = (p: number): Action => ({ p, k: 'fold' });

function post(id: string, mine: boolean, author: string | null, hand: HandData, ago: number, counts: number[], reasons: number[][]): DemoPost {
  const s = replay(hand.ctx.blinds, hand.seats, hand.actions).states[hand.decision!];
  const options = voteOptions(s, hand.ctx.blinds.bb);
  const votes: DemoPost['votes'] = [];
  counts.forEach((n, choice) => { for (let i = 0; i < n; i++) votes.push({ voter: `${id}-${choice}-${i}`, choice, reasons: reasons[(choice + i) % reasons.length] ?? [] }); });
  return { id, mine, author_name: author, hand, options, hidden: false, created_at: new Date(Date.now() - ago * 3600_000).toISOString(), votes };
}

function seed(): DemoState {
  const day = Date.now() - 86400_000;
  const turnShove: HandData = {
    v: 1, date: day, complete: true, tags: ['Hésitation', 'Cooler'],
    ctx: { kind: 'club', name: 'Tournoi d\'hiver', level: 7, blinds: { sb: 300, bb: 600, ante: 600, anteMode: 'bb' }, table: 9 },
    seats: [{ stack: 20500, cards: [44, 47] }, ...Array.from({ length: 5 }, () => ({ stack: 23000 })), { stack: 23000, cards: [48, 46] }, { stack: 23000 }, { stack: 23000 }],
    hero: 6,
    actions: [{ p: 0, k: 'raise', to: 1500 }, f(1), f(2), f(3), f(4), f(5), { p: 6, k: 'call' }, f(7), { p: 8, k: 'call' },
      { p: 8, k: 'check' }, { p: 0, k: 'bet', to: 2500 }, { p: 6, k: 'call' }, f(8),
      { p: 0, k: 'bet', to: 16500 }, { p: 6, k: 'call' }],
    board: [45, 23, 2, 28, 9], decision: 14, winners: [0],
  };
  const squeeze: HandData = {
    v: 1, date: day - 3600_000, complete: true, tags: ['À revoir'],
    ctx: { kind: 'club', name: 'Tournoi d\'hiver', level: 5, blinds: { sb: 200, bb: 400, ante: 400, anteMode: 'bb' }, table: 6 },
    seats: [{ stack: 15000 }, { stack: 15000 }, { stack: 15000, cards: [51, 44] }, { stack: 15000 }, { stack: 6800, cards: [28, 29] }, { stack: 15000 }],
    hero: 4,
    actions: [f(0), f(1), { p: 2, k: 'raise', to: 900 }, f(3), { p: 4, k: 'raise', to: 6800 }, f(5), { p: 2, k: 'call' }],
    board: [43, 26, 4, 37, 15], decision: 4, winners: [4],
  };
  const river: HandData = {
    v: 1, date: day - 7 * 86400_000, complete: true, tags: ['Hésitation'],
    ctx: { kind: 'other', name: 'Open de Lamballe', level: 12, blinds: { sb: 1000, bb: 2000, ante: 2000, anteMode: 'bb' }, table: 9 },
    seats: [...Array.from({ length: 5 }, () => ({ stack: 70000 })), { stack: 80000, cards: [32, 20] }, { stack: 70000 }, { stack: 70000 }, { stack: 64000, cards: [49, 37] }],
    hero: 8,
    actions: [f(0), f(1), f(2), f(3), f(4), { p: 5, k: 'raise', to: 4500 }, f(6), f(7), { p: 8, k: 'call' },
      { p: 8, k: 'check' }, { p: 5, k: 'bet', to: 4000 }, { p: 8, k: 'call' },
      { p: 8, k: 'check' }, { p: 5, k: 'check' },
      { p: 8, k: 'check' }, { p: 5, k: 'bet', to: 20000 }, { p: 8, k: 'call' }],
    board: [39, 25, 10, 0, 30], decision: 16, winners: [5],
  };
  return {
    role: 'member',
    posts: [
      post('demo-turn', false, 'Camille', turnShove, 5, [4, 9], [[0], [0, 2], [1], [6], []]),
      post('demo-squeeze', true, null, squeeze, 20, [2, 1, 0, 8], [[6], [2, 6], [0], [5]]),
      post('demo-river', false, null, river, 150, [3, 5, 1], [[1], [0], [0, 7], [4]]),
    ],
  };
}

function load(): DemoState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as DemoState | null;
    if (s && Array.isArray(s.posts)) return s;
  } catch { /* démo neuve */ }
  return seed();
}

export interface DemoClub extends ClubApi { role(): DemoRole; setRole(r: DemoRole): void; reset(): void }

export function demoClub(): DemoClub {
  let state = load();
  const auth = new Set<(u: { id: string; email: string } | null) => void>();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* démo en mémoire */ } };
  const me = () => (state.role === 'anon' ? null : { id: ME, email: 'demo@exemple.test' });
  const member = () => state.role !== 'anon';
  const staff = () => state.role === 'staff';
  const wait = () => new Promise(r => setTimeout(r, 120));

  function view(p: DemoPost): Post {
    const mine = p.votes.find(v => v.voter === ME);
    const n = p.options.length;
    const show = p.mine || !!mine || staff();
    return {
      id: p.id, author_name: p.author_name, mine: p.mine, hand: p.hand, options: p.options, hidden: p.hidden,
      created_at: p.created_at, votes: p.votes.length, my_vote: mine?.choice ?? null, my_reasons: mine?.reasons ?? [],
      results: show ? {
        total: p.votes.length,
        counts: Array.from({ length: n }, (_, c) => p.votes.filter(v => v.choice === c).length),
        reasons: Array.from({ length: n }, (_, c) => Array.from({ length: 8 }, (_, r) => p.votes.filter(v => v.choice === c && v.reasons.includes(r)).length)),
      } : null,
    };
  }
  const find = (id: string) => {
    const p = state.posts.find(x => x.id === id);
    if (!p || (p.hidden && !p.mine && !staff())) throw new Error('Main introuvable.');
    return p;
  };
  const needMember = () => { if (!member()) throw new Error('Réservé aux adhérents du club.'); };

  const t0 = Date.now() - 27 * 60_000;
  const tournament: ClubTournament = {
    id: 'demo-t', name: 'Tournoi d\'hiver', status: 'running', seats_per_table: 9, starting_stack: 25000,
    clock_level: 0, clock_elapsed_ms: 0, clock_anchor: new Date(t0).toISOString(),
    levels: [
      { kind: 'level', sb: 100, bb: 200, ante: 200, minutes: 20 },
      { kind: 'level', sb: 200, bb: 400, ante: 400, minutes: 20 },
      { kind: 'level', sb: 300, bb: 600, ante: 600, minutes: 20 },
      { kind: 'break', sb: 0, bb: 0, ante: 0, minutes: 10 },
      { kind: 'level', sb: 400, bb: 800, ante: 800, minutes: 20 },
      { kind: 'level', sb: 500, bb: 1000, ante: 1000, minutes: 20 },
    ],
  };

  return {
    kind: 'demo',
    async user() { return me(); },
    onAuth(cb) { auth.add(cb); return () => auth.delete(cb); },
    async signIn() { state.role = 'member'; save(); auth.forEach(cb => cb(me())); },
    async signOut() { state.role = 'anon'; save(); auth.forEach(cb => cb(null)); },
    async running() { await wait(); return member() ? [tournament] : []; },
    async feed(id): Promise<Feed> {
      await wait();
      if (!member()) return { member: false, staff: false, pending: false, posts: [] };
      const list = state.posts.filter(p => (!id || p.id === id) && (!p.hidden || p.mine || staff()));
      return { member: true, staff: staff(), pending: false, posts: list.sort((a, b) => b.created_at.localeCompare(a.created_at)).map(view) };
    },
    async publish(hand, options) {
      await wait(); needMember();
      const id = `demo-${Date.now().toString(36)}`;
      state.posts.push({ id, mine: true, author_name: null, hand, options, hidden: false, created_at: new Date().toISOString(), votes: [] });
      save();
      return id;
    },
    async vote(id, choice, reasons) {
      await wait(); needMember();
      const p = find(id);
      if (p.mine) throw new Error('C\'est ta main : tu vois les votes sans voter.');
      p.votes = [...p.votes.filter(v => v.voter !== ME), { voter: ME, choice, reasons }];
      save();
    },
    async remove(id) {
      await wait();
      const p = find(id);
      if (!p.mine && !staff()) throw new Error('Main introuvable, ou publiée par quelqu\'un d\'autre.');
      state.posts = state.posts.filter(x => x.id !== id);
      save();
    },
    async hide(id, hidden) {
      await wait();
      if (!staff()) throw new Error('Réservé aux gestionnaires.');
      find(id).hidden = hidden;
      save();
    },
    role: () => state.role,
    setRole(r) { state.role = r; save(); auth.forEach(cb => cb(me())); },
    reset() { state = seed(); save(); auth.forEach(cb => cb(me())); },
  };
}
