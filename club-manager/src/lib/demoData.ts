/** Club fictif du mode démo. Tous les noms sont inventés. */
import { generateLevels, PRESETS, DEFAULT_CHIPS } from './structure';
import { DEFAULT_SCORING, withSettings, type Account, type Championship, type Entry, type JoinRequest, type Knockout, type Member, type Payment, type Structure, type Tournament } from './types';

export interface DemoDb {
  club_members: Member[];
  club_join_requests: JoinRequest[];
  club_structures: Structure[];
  club_championships: Championship[];
  club_tournaments: Tournament[];
  club_entries: Entry[];
  club_payments: Payment[];
  club_knockouts: Knockout[];
  refused: string[];
  accounts: Pick<Account, 'user_id' | 'username' | 'email' | 'confirmed' | 'created_at'>[];
  seq: number;
}

const NAMES = [
  'Maël Kervran', 'Soizic Le Goff', 'Yann Briand', 'Nolwenn Tanguy', 'Erwan Guillou', 'Gaëlle Morvan',
  'Ronan Le Bihan', 'Katell Hamon', 'Loïc Perrot', 'Enora Jaouen', 'Tugdual Riou', 'Maïwenn Corre',
  'Gwendal Salaün', 'Rozenn Cadiou', 'Alan Quéré', 'Bleuenn Le Roux', 'Denez Floch', 'Aziliz Prigent',
  'Kilian Stéphan', 'Morgane Le Gall', 'Brieuc Hervé', 'Lena Coadou',
];

/** Générateur pseudo-aléatoire fixe : la démo est la même pour tout le monde. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
function shuffled<T>(a: T[], r: () => number): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

export const DEMO_USERS = { admin: 'demo-user-0', director: 'demo-user-1', member: 'demo-user-3', pending: 'demo-user-91' };

export function seedDemo(now: number): DemoDb {
  const r = rng(22);
  let n = 0;
  const id = (p: string) => `demo-${p}-${++n}`;
  const iso = (ms: number) => new Date(ms).toISOString();
  const DAY = 86_400_000;
  /** Un soir à 20 h, à n jours d'aujourd'hui. */
  const evening = (days: number, h = 20) => { const d = new Date(now + days * DAY); d.setHours(h, 0, 0, 0); return d.toISOString(); };

  const members: Member[] = NAMES.map((name, i) => ({
    id: `demo-m-${i}`, user_id: i === 0 ? DEMO_USERS.admin : i === 3 ? DEMO_USERS.member : i < 12 ? `demo-user-${i}` : null,
    name, role: i === 0 ? 'admin' : i === 1 ? 'director' : 'member', active: true, created_at: iso(now - 200 * DAY),
  }));

  const structures: Structure[] = PRESETS.map(p => ({
    id: id('s'), name: p.name, description: p.description, starting_stack: p.stack,
    levels: generateLevels(p.input), chips: DEFAULT_CHIPS, created_at: iso(now - 100 * DAY),
  }));
  const club = structures[1];

  const championship: Championship = {
    id: id('c'), name: 'Championnat du club', season: '2026-2027', status: 'active', visibility: 'public',
    description: 'Huit manches, les six meilleurs résultats comptent. La finale compte une fois et demie.',
    scoring: { ...DEFAULT_SCORING, participation: 5, koPoints: 2, bestOf: 6, brackets: [
      { minPlayers: 0, points: [100, 75, 55, 40, 30, 20, 15, 10] },
      { minPlayers: 16, points: [120, 90, 70, 55, 42, 32, 24, 18, 12, 8] },
    ] },
    created_at: iso(now - 90 * DAY),
  };

  const tournaments: Tournament[] = [];
  const entries: Entry[] = [];
  const payments: Payment[] = [];
  const knockouts: Knockout[] = [];
  let seq = 0;

  const addTournament = (over: Partial<Tournament>): Tournament => {
    const t: Tournament = {
      id: id('t'), championship_id: championship.id, name: '', description: '', venue: 'Salle des associations',
      starts_at: iso(now), status: 'draft', visibility: 'public', max_players: 24, seats_per_table: 8,
      starting_stack: club.starting_stack, structure_name: club.name, levels: club.levels, chips: club.chips,
      settings: withSettings({ bounty: { mode: 'fixed', unit: 'lot', amount: 0 } }),
      clock_level: 0, clock_elapsed_ms: 0, clock_anchor: null, finished_at: null, rev: 0, created_at: iso(now - 80 * DAY), ...over,
    };
    tournaments.push(t);
    return t;
  };
  const addEntry = (t: Tournament, m: Member | string, over: Partial<Entry> = {}): Entry => {
    const e: Entry = {
      id: id('e'), tournament_id: t.id, member_id: typeof m === 'string' ? null : m.id, name: typeof m === 'string' ? m : m.name,
      status: 'registered', registered_at: iso(now - 10 * DAY + n * 1000), checked_in: false, rebuys: 0, addons: 0, table_no: null, seat_no: null,
      bounty_start: null, points_adjust: 0, final_position: null, final_kos: null, final_bounty: null, ...over,
    };
    entries.push(e);
    return e;
  };

  // Trois manches jouées.
  [-63, -42, -21].forEach((days, k) => {
    const t = addTournament({ name: `Manche ${k + 1}`, starts_at: evening(days), status: 'finished', finished_at: evening(days, 23) });
    const field = shuffled(members, r).slice(0, [18, 15, 19][k]);
    if (!field.includes(members[0])) field[4] = members[0];
    if (!field.includes(members[3])) field[2] = members[3];
    const list: (Member | string)[] = [...new Set(field)];
    if (k === 2) list.splice(9, 0, 'Invité : Paol');
    const es = list.map(m => addEntry(t, m, { checked_in: true }));
    const kos = new Map<string, number>();
    for (let i = es.length - 1; i > 0; i--) {
      const killer = es[Math.floor(r() * i)];
      kos.set(killer.id, (kos.get(killer.id) ?? 0) + 1);
      knockouts.push({ id: id('k'), seq: ++seq, tournament_id: t.id, victim_id: es[i].id, killer_ids: [killer.id], rebuy: false, level: 4, created_at: t.starts_at });
    }
    es.forEach((e, i) => { e.final_position = i + 1; e.final_kos = kos.get(e.id) ?? 0; e.final_bounty = 0; });
  });

  // Une manche en cours, au milieu du niveau 6.
  const live = addTournament({
    name: 'Manche 4', starts_at: iso(now - 95 * 60_000), status: 'running',
    settings: withSettings({
      lateRegLevel: 4,
      rebuy: { enabled: true, price: 0, stack: 15000, untilLevel: 4, max: 1 },
      bounty: { mode: 'fixed', unit: 'pts', amount: 3 },
      payouts: { mode: 'lots', percents: [50, 30, 20], lots: ['Trophée de la manche', 'Jeu de cartes', 'Protège-cartes'], rounding: 1 },
    }),
    clock_level: 6, clock_elapsed_ms: 4 * 60_000 + 12_000, clock_anchor: iso(now),
  });
  const field = shuffled(members.filter(m => m !== members[3]), r).slice(0, 17);
  field.splice(5, 0, members[3]);
  const es = field.map((m, i) => addEntry(live, m, { checked_in: true, table_no: (i % 3) + 1, seat_no: Math.floor(i / 3) + 1 }));
  es.forEach((e, i) => { if (i % 3 !== 2) payments.push({ entry_id: e.id, tournament_id: live.id }); });
  es[4].bounty_start = 10;
  const out: [number, number[], boolean][] = [[16, [2], true], [11, [5], false], [17, [2], false], [8, [13, 1], false], [14, [5], false]];
  out.forEach(([v, ks, rebuy], i) => {
    if (rebuy) es[v].rebuys++;
    knockouts.push({ id: id('k'), seq: ++seq, tournament_id: live.id, victim_id: es[v].id, killer_ids: ks.map(x => es[x].id), rebuy, level: 2 + i, created_at: iso(now - (60 - i * 11) * 60_000) });
  });

  // À venir.
  const next = addTournament({ name: 'Manche 5', starts_at: evening(16), status: 'open', max_players: 12, settings: withSettings({ bounty: { mode: 'fixed', unit: 'pts', amount: 3 } }), description: 'Inscription obligatoire avant la veille, 18 h.' });
  shuffled(members.filter(m => m !== members[3]), r).slice(0, 14).forEach((m, i) => addEntry(next, m, { status: i < 12 ? 'registered' : 'waitlist', registered_at: iso(now - 5 * DAY + i * 3_600_000) }));
  const fun = addTournament({ name: 'Soirée Turbo de Noël', championship_id: null, starts_at: evening(24, 19), status: 'open', max_players: 30, venue: 'Bar Le Ponant', structure_name: structures[0].name, levels: structures[0].levels, starting_stack: structures[0].starting_stack, settings: withSettings({ bounty: { mode: 'progressive', unit: 'pts', amount: 10 } }) });
  shuffled(members, r).slice(0, 7).forEach(m => addEntry(fun, m));
  addTournament({ name: 'Finale de la saison', starts_at: evening(170), status: 'draft', settings: withSettings({ coefficient: 1.5 }) });

  return {
    club_members: members,
    club_join_requests: [{ user_id: 'demo-user-90', name: 'Ewen Madec', email: 'ewen@exemple.test', created_at: iso(now - DAY) }],
    club_structures: structures,
    club_championships: [championship],
    club_tournaments: tournaments,
    club_entries: entries,
    club_payments: payments,
    club_knockouts: knockouts,
    refused: ['demo-user-94'],
    accounts: [
      ...members.filter(m => m.user_id).map((m, i) => ({ user_id: m.user_id!, username: m.name.split(' ')[0], email: `adherent${i + 1}@exemple.test`, confirmed: true, created_at: iso(now - (180 - i) * DAY) })),
      { user_id: 'demo-user-90', username: 'Ewen', email: 'ewen@exemple.test', confirmed: true, created_at: iso(now - DAY) },
      { user_id: 'demo-user-91', username: 'Tifenn', email: 'pending@exemple.test', confirmed: true, created_at: iso(now - 3 * 3_600_000) },
      { user_id: 'demo-user-92', username: 'Gwendal', email: 'gwendal@exemple.test', confirmed: true, created_at: iso(now - 4 * DAY) },
      { user_id: 'demo-user-93', username: 'Goulven29', email: 'goulven@exemple.test', confirmed: false, created_at: iso(now - 2 * DAY) },
      { user_id: 'demo-user-94', username: 'Essai', email: 'essai@exemple.test', confirmed: true, created_at: iso(now - 80 * DAY) },
    ],
    seq,
  };
}
