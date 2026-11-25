import { api, entriesOf, fixEntry, knockoutsOf, listTournaments, useClub, useLoad } from '../lib/club';
import { outcomes } from '../lib/engine';
import * as f from '../lib/format';
import type { Entry, Member } from '../lib/types';
import { Empty, Icon, State } from '../components/ui';

export function PlayerPage({ id }: { id: string }) {
  const { me } = useClub();
  const q = useLoad(async () => {
    const [[member], mine] = await Promise.all([
      api.select<Member>('club_members', { eq: { id } }),
      api.select<Entry>('club_entries', { eq: { member_id: id } }),
    ]);
    const entries = mine.map(fixEntry);
    const tournaments = (await listTournaments()).filter(t => t.status === 'finished' && entries.some(e => e.tournament_id === t.id && e.final_position !== null));
    const ids = tournaments.map(t => t.id);
    const [all, knockouts] = await Promise.all([entriesOf(ids), knockoutsOf(ids)]);
    return { member, entries, tournaments, all, knockouts };
  }, [id, me?.id]);
  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  const { member, entries, tournaments, all, knockouts } = q.data;
  const name = member?.name ?? entries[0]?.name;
  if (!name) return <Empty title="Joueur introuvable">{!me && <a className="btn primary" href="#/compte">Se connecter</a>}</Empty>;

  const games = tournaments.map(t => {
    const list = outcomes(t, all.filter(e => e.tournament_id === t.id), []);
    return { t, me: list.find(o => o.entry.member_id === id)!, players: list.length };
  });
  const n = games.length;
  const wins = games.filter(g => g.me.position === 1).length;
  const podiums = games.filter(g => g.me.position <= 3).length;
  const kos = games.reduce((s, g) => s + g.me.kos, 0);
  // Part du champ battue, comparable d'un tournoi à l'autre.
  const beaten = n ? games.reduce((s, g) => s + (g.players > 1 ? (g.players - g.me.position) / (g.players - 1) : 1), 0) / n : 0;

  const myIds = new Set(entries.map(e => e.id));
  const person = (entryId: string) => { const e = all.find(x => x.id === entryId); return e ? { key: e.member_id ?? e.name, name: e.name } : null; };
  const tally = (ids: string[]) => {
    const m = new Map<string, { name: string; n: number }>();
    for (const x of ids) { const p = person(x); if (p) m.set(p.key, { name: p.name, n: (m.get(p.key)?.n ?? 0) + 1 }); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  };
  const victims = tally(knockouts.filter(k => k.killer_ids.some(x => myIds.has(x))).map(k => k.victim_id));
  const killers = tally(knockouts.filter(k => myIds.has(k.victim_id)).flatMap(k => k.killer_ids));

  return (
    <>
      <a className="crumb" href="#/championnats"><Icon name="back" size={15} />Classements</a>
      <div className="pagehead"><div><h1>{name}</h1>{member && !member.active && <p>Ancien adhérent</p>}</div></div>
      {n === 0 ? <div className="card"><Empty title="Aucun tournoi terminé" /></div> : (
        <div className="stack">
          <div className="card">
            <dl className="facts">
              <div><dt>Tournois</dt><dd>{n}</dd></div>
              <div><dt>Victoires</dt><dd>{wins}</dd></div>
              <div><dt>Podiums</dt><dd>{podiums}<small> · {Math.round((podiums / n) * 100)} %</small></dd></div>
              <div><dt>Meilleure place</dt><dd>{f.ordinal(Math.min(...games.map(g => g.me.position)))}</dd></div>
              <div><dt>Adversaires devancés</dt><dd>{Math.round(beaten * 100)} %</dd></div>
              <div><dt>KO</dt><dd>{f.num(Math.round(kos * 100) / 100)}<small> · {f.num(Math.round((kos / n) * 10) / 10)} par tournoi</small></dd></div>
            </dl>
          </div>
          {(victims[0]?.n > 1 || killers[0]?.n > 1) && (
            <div className="card">
              <dl className="deflist">
                {victims[0]?.n > 1 && <div><dt>Victime favorite</dt><dd>{victims[0].name} ({victims[0].n} fois)</dd></div>}
                {killers[0]?.n > 1 && <div><dt>Bête noire</dt><dd>{killers[0].name} ({killers[0].n} fois)</dd></div>}
              </dl>
            </div>
          )}
          <div className="card flush"><div className="scroll"><table className="table">
            <thead><tr><th>Date</th><th>Tournoi</th><th className="num">Place</th><th className="num">KO</th></tr></thead>
            <tbody>{games.map(g => (
              <tr key={g.t.id} className={`p${g.me.position}`}>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>{f.shortDate(g.t.starts_at)}</td>
                <td><a href={`#/t/${g.t.id}`}>{g.t.name}</a></td>
                <td className="num"><b>{f.ordinal(g.me.position)}</b> <span className="muted">/ {g.players}</span></td>
                <td className="num">{g.me.kos ? f.num(g.me.kos) : ''}</td>
              </tr>
            ))}</tbody>
          </table></div></div>
        </div>
      )}
    </>
  );
}
