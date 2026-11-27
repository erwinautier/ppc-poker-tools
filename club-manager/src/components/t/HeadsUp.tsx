import { useState } from 'react';
import { api, useClub, useNow, useWakeLock } from '../../lib/club';
import { participants } from '../../lib/engine';
import * as f from '../../lib/format';
import {
  BYE_POINTS, boardOf, champion, currentDuel, currentRound, drawPairs, eliminated, finished, fmtPoints, huResults, inPlay,
  needsPlayoff, nextIds, playoffPairs, roundComplete, roundLabel, standings, type Board, type Duel, type Pair,
} from '../../lib/hu';
import { go } from '../../lib/router';
import { HU_SYSTEM_LABEL, type Entry } from '../../lib/types';
import type { TabProps } from '../../pages/Tournament';
import { ClockControls, MiniClock, useClockCommands, viewOf } from '../clockui';
import { Empty, Icon, useAction, useConfirm } from '../ui';

/** Le tableau du tournoi heads-up, d'après les matchs enregistrés. */
export function huBoard(b: TabProps['b']): Board {
  return boardOf(b.t.settings, participants(b.t, b.entries).map(e => e.id), b.matches);
}

/** Onglet Direct d'un tournoi heads-up : tours, vainqueurs, classement. */
export function HeadsUp({ b, reload }: TabProps) {
  const { t, entries } = b;
  const { isStaff, me } = useClub();
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const now = useNow();
  const v = viewOf(t, now);
  const clock = useClockCommands(t, v, reload);
  useWakeLock(t.status === 'running');

  if (b.huMissing) {
    return <Empty title="Base à mettre à jour">Un administrateur doit exécuter le script <code>004_club_hu.sql</code> (voir SETUP.md) pour jouer ce tournoi heads-up.</Empty>;
  }

  const board = huBoard(b);
  const swiss = board.system === 'swiss';
  const name = (id: string) => entries.find(e => e.id === id)?.name ?? 'Joueur retiré';
  const round = currentRound(board);
  const over = finished(board);
  const champ = champion(board);
  const next = nextIds(board);
  const playing = t.status !== 'finished' && t.status !== 'cancelled';

  const send = (n: number, pairs: Pair[] | null, ok: string, opts: { replace?: boolean; playoff?: boolean } = {}) => run(async () => {
    await api.rpc('club_hu_round', { p_tournament: t.id, p_round: n, p_pairs: pairs, p_replace: !!opts.replace, p_playoff: !!opts.playoff });
    await reload();
  }, ok);
  const pick = (m: Duel, id: string) => run(async () => {
    await api.update('club_hu_matches', m.id, { winner: m.winner === id ? null : id });
    await reload();
  });
  const finish = () => run(async () => {
    await api.rpc('club_finish', { p_tournament: t.id, p_results: huResults(board) });
    await reload();
    go(`#/t/${t.id}/resultats`);
  }, 'Classement enregistré.');

  if (!round) return <FirstRound b={b} board={board} send={send} busy={busy} reload={reload} />;

  const mine = me ? entries.find(e => e.member_id === me.id && board.players.includes(e.id)) : undefined;
  const hasResult = round.matches.some(m => m.winner !== null);
  const left = inPlay(board);
  const history = board.rounds.filter(r => r !== round).reverse();
  const out = new Map(eliminated(board).map(x => [x.id, x.round]));

  const redraw = () => {
    const ids = [...round.matches.flatMap(m => [m.a, m.b]), ...(round.bye ? [round.bye] : [])];
    const before = { ...board, rounds: board.rounds.slice(0, -1) };
    return send(round.n, drawPairs(before, ids), `Tour ${round.n} retiré au sort.`, { replace: true });
  };
  const addRound = () => run(async () => {
    await api.update('club_tournaments', t.id, { settings: { ...t.settings, hu: { ...t.settings.hu, rounds: board.planned + 1 } } });
    const more = { ...board, planned: board.planned + 1 };
    await api.rpc('club_hu_round', { p_tournament: t.id, p_round: round.n + 1, p_pairs: drawPairs(more, board.active), p_replace: false, p_playoff: false });
    await reload();
  }, `Tour ${round.n + 1} tiré au sort.`);

  return (
    <div className="two">
      <div className="stack">
        {isStaff && playing && over && champ && (
          <div className="card warn row between">
            <span><b>{name(champ)} remporte le tournoi !</b></span>
            <button className="btn primary" disabled={busy} onClick={finish}><Icon name="trophy" />Valider le classement</button>
          </div>
        )}
        {needsPlayoff(board) && (() => {
          const [x, y] = standings(board);
          return (
            <div className="card warn row between">
              <span><b>{name(x.id)}</b> et <b>{name(y.id)}</b> sont à égalité parfaite pour la 1re place.</span>
              {isStaff && playing && <button className="btn primary" disabled={busy} onClick={() => send(round.n + 1, playoffPairs(board), 'Barrage tiré.', { playoff: true })}>Jouer un barrage</button>}
            </div>
          );
        })()}

        <div className="card">
          <div className="sechead">
            <h2>{round.playoff ? 'Barrage pour la 1re place' : `Tour ${round.n}`}{roundLabel(board, round) && <span className="muted" style={{ fontWeight: 500 }}> {swiss ? '' : '· '}{roundLabel(board, round)}</span>}</h2>
            {!swiss && <span className="muted">{f.plural(left.length, 'joueur')} en lice</span>}
          </div>
          <div className="duels">
            {round.matches.map(m => (
              <div className="duel" key={m.id}>
                {[m.a, m.b].map((id, i) => {
                  const btn = (
                    <button key={id} type="button" className={`pick ${m.winner === id ? 'on' : ''} ${m.winner && m.winner !== id ? 'lost' : ''}`}
                      aria-pressed={m.winner === id} disabled={!isStaff || !playing || busy} onClick={() => pick(m, id)}>
                      {name(id)}{m.winner === id && <small>vainqueur</small>}
                    </button>
                  );
                  return i === 0 ? [btn, <span key="vs" className="vs">VS</span>] : btn;
                })}
              </div>
            ))}
          </div>
          {round.bye && <p className="muted" style={{ marginTop: 10 }}>Exempté ce tour : <b>{name(round.bye)}</b>{swiss && ` (${fmtPoints(BYE_POINTS)} point)`}</p>}
          {isStaff && playing && (
            <div className="stack" style={{ marginTop: 14, gap: 10 }}>
              {!roundComplete(round) && <p className="muted">{round.playoff ? 'Touche le vainqueur du barrage.' : 'Touche le vainqueur de chaque match pour pouvoir tirer le tour suivant.'}</p>}
              {next && (
                <button className="btn primary block" disabled={busy} onClick={() => send(round.n + 1, drawPairs(board, next), `Tour ${round.n + 1} tiré au sort.`)}>
                  <Icon name="dice" />Tirer le tour {round.n + 1}{!swiss && ` (${f.plural(next.length, 'joueur')})`}
                </button>
              )}
              {over && swiss && !board.rounds.some(r => r.playoff) && (
                <button className="btn block" disabled={busy} onClick={addRound}><Icon name="plus" />Ajouter un tour {round.n + 1}</button>
              )}
              <div className="row">
                {!round.playoff && !hasResult && <button className="btn sm" disabled={busy} onClick={redraw}><Icon name="dice" size={15} />Retirer ce tour au sort</button>}
                <button className="btn sm ghost" disabled={busy} onClick={async () => {
                  if (await confirm({ title: `Annuler ${round.playoff ? 'le barrage' : `le tour ${round.n}`} ?`, text: 'Ses matchs et leurs résultats sont effacés.', ok: 'Annuler ce tour', danger: true })) await send(round.n, null, 'Tour annulé.');
                }}><Icon name="undo" size={15} />Annuler {round.playoff ? 'le barrage' : 'ce tour'}</button>
              </div>
            </div>
          )}
        </div>

        {swiss && <Standings board={board} name={name} me={mine?.id} final={over && !!champ} />}
      </div>

      <div className="stack">
        {mine && <MyCard board={board} id={mine.id} name={name} out={out.get(mine.id)} />}
        {t.levels.length > 0 && playing && (
          <div className="card stack">
            <MiniClock t={t} v={v} />
            {isStaff && <ClockControls c={clock} v={v} />}
          </div>
        )}
        {!swiss && (
          <div className="card">
            <h2>Joueurs</h2>
            <div className="plist">
              {board.players.map(id => (
                <div className={`prow ${out.has(id) ? 'out' : ''}`} key={id}>
                  <span className="pname">{name(id)}</span>
                  <span className="muted">{out.has(id) ? `éliminé au tour ${out.get(id)}` : champ === id ? 'vainqueur' : 'en lice'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {history.length > 0 && (
          <div className="card">
            <h2>Tours joués</h2>
            <div className="stack" style={{ gap: 12 }}>
              {history.map(r => (
                <div key={r.n}>
                  <p className="muted" style={{ fontWeight: 700, marginBottom: 4 }}>{r.playoff ? 'Barrage' : `Tour ${r.n}`}</p>
                  <div className="plist">
                    {r.matches.map(m => (
                      <div className="prow" key={m.id}>
                        <span className="pname">{name(m.winner ?? m.a)}<small>{m.winner ? `bat ${name(m.winner === m.a ? m.b : m.a)}` : `contre ${name(m.b)}`}</small></span>
                      </div>
                    ))}
                    {r.bye && <div className="prow out"><span className="pname">{name(r.bye)}<small>exempté</small></span></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {isStaff && playing && !(over && champ) && (
          <button className="btn ghost" onClick={async () => {
            if (await confirm({ title: 'Arrêter le tournoi maintenant ?', text: 'Tu fixeras le classement dans l\'onglet Résultats.', ok: 'Saisir le classement' })) go(`#/t/${t.id}/resultats`);
          }}>Arrêter avant la fin</button>
        )}
      </div>
    </div>
  );
}

/** Avant le premier tour : pointage, puis tirage. */
function FirstRound({ b, board, send, busy, reload }: TabProps & { board: Board; send: (n: number, pairs: Pair[], ok: string) => Promise<unknown>; busy: boolean }) {
  const { t, entries } = b;
  const { isStaff } = useClub();
  const confirm = useConfirm();
  const [run, working] = useAction();
  const registered = entries.filter(e => e.status === 'registered');
  const present = registered.filter(e => e.checked_in);
  const swiss = board.system === 'swiss';
  if (!isStaff) return <Empty title="Le premier tour n'est pas encore tiré">{HU_SYSTEM_LABEL[board.system]}{swiss ? `, ${f.plural(board.planned, 'tour', 'tours')}` : ''}.</Empty>;
  const start = async () => {
    let ids = present.map(e => e.id);
    if (present.length < 2) {
      if (registered.length < 2) return;
      if (!await confirm({ title: 'Tout le monde est là ?', text: `${present.length === 0 ? 'Personne n\'est pointé' : 'Une seule personne est pointée'}. Les ${registered.length} inscriptions seront pointées « sur place ».`, ok: 'Pointer tout le monde et tirer' })) return;
      if (!await run(async () => { await Promise.all(registered.filter(e => !e.checked_in).map(e => api.update('club_entries', e.id, { checked_in: true }))); await reload(); })) return;
      ids = registered.map(e => e.id);
    }
    await send(1, drawPairs({ ...board, active: ids, players: ids }, ids), 'Premier tour tiré au sort.');
  };
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <h2>Avant le premier tour</h2>
      <dl className="deflist" style={{ marginBottom: 14 }}>
        <div><dt>Format</dt><dd>Heads-up, {HU_SYSTEM_LABEL[board.system].toLowerCase()}{swiss ? ` en ${f.plural(board.planned, 'tour', 'tours')}` : ''}</dd></div>
        <div><dt>Pointage</dt><dd>{present.length} sur place pour {f.plural(registered.length, 'inscription')} <a href={`#/t/${t.id}/joueurs`}>Pointer</a></dd></div>
      </dl>
      <p className="muted" style={{ marginBottom: 14 }}>
        {swiss
          ? 'Personne n\'est éliminé : chaque tour oppose des joueurs au même score, sans revanche. Un nombre impair de joueurs donne une exemption, qui vaut ½ point.'
          : 'Le perdant de chaque match sort ; les places sont tirées au sort à chaque tour. Un nombre impair de joueurs donne une exemption.'}
      </p>
      <button className="btn primary big block" disabled={busy || working || registered.length < 2} onClick={start}>
        <Icon name="dice" />Tirer le premier tour ({f.plural(present.length >= 2 ? present.length : registered.length, 'joueur')})
      </button>
    </div>
  );
}

function MyCard({ board, id, name, out }: { board: Board; id: string; name: (id: string) => string; out?: number }) {
  const now = currentDuel(board, id);
  const champ = champion(board);
  const swiss = board.system === 'swiss';
  const pts = swiss ? standings(board).find(s => s.id === id) : undefined;
  let text: string;
  if (champ === id) text = 'Tu remportes le tournoi !';
  else if (out) text = `Éliminé au tour ${out}`;
  else if (!now) text = 'Pas de match ce tour-ci';
  else if (!now.duel) text = 'Exempté ce tour';
  else text = now.duel.winner ? (now.duel.winner === id ? 'Match gagné, attends le tour suivant' : 'Match perdu') : `Contre ${name(now.duel.a === id ? now.duel.b : now.duel.a)}`;
  return (
    <div className="card note">
      <dl className="facts">
        <div><dt>{now?.round.playoff ? 'Barrage' : now ? `Tour ${now.round.n}` : 'Ton tournoi'}</dt><dd style={{ fontSize: '1rem' }}>{text}</dd></div>
        {pts && <div><dt>Tes points</dt><dd>{fmtPoints(pts.points)}<small> · {f.ordinal(pts.rank)}</small></dd></div>}
      </dl>
    </div>
  );
}

function Standings({ board, name, me, final }: { board: Board; name: (id: string) => string; me?: string; final: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = standings(board);
  return (
    <div className="card flush">
      <div className="sechead" style={{ padding: '14px 16px 0' }}><h2>Classement{final ? ' final' : ''}</h2></div>
      <div className="scroll">
        <table className="table">
          <thead><tr>
            <th className="mid">Place</th><th>Joueur</th>
            <th className="num" title="1 point par victoire, ½ par exemption">Pts</th>
            <th className="num" title="Victoires et défaites">V-D</th>
            <th className="num" title="Buchholz : somme des points des adversaires rencontrés">Buch.</th>
            <th className="num" title="Sonneborn-Berger : somme des points des adversaires battus">SB</th>
          </tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id} className={`p${s.rank} ${s.id === me ? 'me' : ''}`} onClick={() => setOpen(open === s.id ? null : s.id)} style={{ cursor: 'pointer' }}>
                <td className="pos">{s.rank}</td>
                <td><b>{name(s.id)}</b>{open === s.id && <Detail board={board} id={s.id} name={name} />}</td>
                <td className="num total">{fmtPoints(s.points)}</td>
                <td className="num">{s.wins}-{s.losses}</td>
                <td className="num">{fmtPoints(s.buchholz)}</td>
                <td className="num">{fmtPoints(s.sb)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ padding: '0 16px 14px', fontSize: '.8rem' }}>
        Départage : points, Buchholz, barrage ou confrontation directe, puis Sonneborn-Berger. Une exemption vaut ½ point et compte comme un nul contre un adversaire de même score. Touche un joueur pour voir ses matchs.
      </p>
    </div>
  );
}

function Detail({ board, id, name }: { board: Board; id: string; name: (id: string) => string }) {
  const list = board.rounds.filter(r => !r.playoff).map(r => {
    if (r.bye === id) return `T${r.n} : exempté`;
    const m = r.matches.find(x => x.a === id || x.b === id);
    if (!m) return `T${r.n} : absent`;
    const opp = name(m.a === id ? m.b : m.a);
    return `T${r.n} : ${m.winner ? (m.winner === id ? 'bat' : 'perd contre') : 'joue'} ${opp}`;
  });
  return <small className="muted" style={{ display: 'block', fontWeight: 500 }}>{list.join(' · ')}</small>;
}

/** Bilan d'un joueur pour les résultats : victoires et défaites. */
export function huRecordText(board: Board, e: Entry): string {
  let w = 0, l = 0;
  for (const r of board.rounds) for (const m of r.matches) {
    if (!m.winner || (m.a !== e.id && m.b !== e.id)) continue;
    if (m.winner === e.id) w++; else l++;
  }
  return `${w}-${l}`;
}
