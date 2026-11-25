import { useMemo, useState } from 'react';
import { api, entriesOf, fixChampionship, fixTournament, knockoutsOf, useClub, useLoad } from '../lib/club';
import { bracketFor, standings, type Row } from '../lib/scoring';
import * as f from '../lib/format';
import { download } from '../lib/ics';
import type { Championship, Scoring, Tournament } from '../lib/types';
import { Empty, Icon, State, Switch } from '../components/ui';
import { TournamentRow } from '../components/cards';
import { csv } from '../components/t/Results';

export function ChampionshipPage({ id, tab }: { id: string; tab: string }) {
  const { isStaff, me, user } = useClub();
  const [withLive, setWithLive] = useState(true);
  const q = useLoad(async () => {
    const [c] = await api.select<Championship>('club_championships', { eq: { id } });
    if (!c) return null;
    const tournaments = (await api.select<Tournament>('club_tournaments', { eq: { championship_id: id }, order: ['starts_at', 'asc'] })).map(fixTournament);
    const ids = tournaments.filter(t => t.status !== 'draft').map(t => t.id);
    const live = tournaments.filter(t => t.status === 'running').map(t => t.id);
    const [entries, knockouts] = await Promise.all([entriesOf(ids), knockoutsOf(live)]);
    return { c: fixChampionship(c), tournaments, entries, knockouts };
  }, [id, me?.id, user?.id], {});

  const rows = useMemo(() => q.data ? standings({
    scoring: q.data.c.scoring,
    tournaments: q.data.tournaments.filter(t => t.status === 'finished' || withLive),
    entries: q.data.entries, knockouts: q.data.knockouts,
  }) : [], [q.data, withLive]);

  if (q.data === null && !q.loading && !q.error) return <Empty title="Championnat introuvable">{!user && <a className="btn primary" href="#/compte">Se connecter</a>}</Empty>;
  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  const { c, tournaments, entries } = q.data;
  const running = tournaments.filter(t => t.status === 'running');
  const played = tournaments.filter(t => t.status === 'finished' || (withLive && t.status === 'running'));
  const tabs = [['', 'Classement'], ['ko', 'KO'], ['manches', 'Manches'], ['regles', 'Barème']];
  const current = tabs.some(([k]) => k === tab) ? tab : '';

  return (
    <>
      <a className="crumb" href="#/championnats"><Icon name="back" size={15} />Championnats</a>
      <div className="pagehead">
        <div><h1>{c.name}</h1><p>{[c.season, c.description].filter(Boolean).join(' · ')}</p></div>
        {isStaff && <div className="row no-print"><a className="btn" href={`#/c/${c.id}/modifier`}><Icon name="edit" />Modifier</a><a className="btn primary" href={`#/tournois/nouveau?championnat=${c.id}`}><Icon name="plus" />Manche</a></div>}
      </div>
      <div className="tabs">{tabs.map(([k, label]) => <a key={k} href={`#/c/${c.id}${k && `/${k}`}`} className={k === current ? 'on' : ''}>{label}</a>)}</div>

      {running.length > 0 && (current === '' || current === 'ko') && (
        <div className="card note row between no-print" style={{ marginBottom: 16 }}>
          <Switch label={`Inclure ${running.map(t => t.name).join(', ')} (en direct)`} hint="Classement provisoire : chaque joueur en course compte la place qui lui est assurée" checked={withLive} onChange={setWithLive} />
          <a className="btn sm" href={`#/t/${running[0].id}/direct`}>Suivre</a>
        </div>
      )}

      {current === '' && (rows.length === 0 ? <div className="card"><Empty title="Pas encore de résultat">Le classement apparaîtra après la première manche.</Empty></div> : (
        <div className="stack">
          <Standings rows={rows} played={played} c={c} meId={me?.id} linked={!!me} />
          <div className="row no-print">
            <button className="btn sm" onClick={() => download(`${c.name} ${c.season}.csv`, csv([
              ['Rang', 'Joueur', 'Total', 'Manches', 'Victoires', 'KO', ...played.map(t => t.name)],
              ...rows.map(r => [r.rank, r.name, r.total, r.played, r.wins, r.kos, ...played.map(t => r.cells.get(t.id)?.points ?? '')]),
            ]), 'text/csv')}><Icon name="download" size={15} />Exporter (CSV)</button>
            <button className="btn sm" onClick={() => window.print()}>Imprimer</button>
          </div>
        </div>
      ))}

      {current === 'ko' && (
        <div className="card flush" style={{ maxWidth: 640 }}>
          {rows.every(r => r.kos === 0) ? <Empty title="Aucun KO enregistré" /> : (
            <table className="table">
              <thead><tr><th className="mid">Rang</th><th>Joueur</th><th className="num">KO</th><th className="num">Par manche</th></tr></thead>
              <tbody>
                {[...rows].filter(r => r.kos > 0).sort((a, b) => b.kos - a.kos || a.played - b.played).map((r, _, l) => {
                  const rank = l.findIndex(x => x.kos === r.kos) + 1;
                  return <tr key={r.key} className={`p${rank} ${r.memberId && r.memberId === me?.id ? 'me' : ''}`}><td className="pos">{rank}</td><td><b>{r.name}</b></td><td className="num total">{f.num(r.kos)}</td><td className="num">{f.num(Math.round((r.kos / r.played) * 10) / 10)}</td></tr>;
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {current === 'manches' && (
        <div className="card" style={{ paddingBlock: 4 }}>
          {tournaments.length === 0 ? <Empty title="Aucune manche programmée" /> : (
            <div className="tlist">{tournaments.map(t => {
              const es = entries.filter(e => e.tournament_id === t.id);
              return <TournamentRow key={t.id} t={t} entries={t.status === 'draft' ? undefined : es} reload={q.reload} winner={es.find(e => e.final_position === 1)?.name} />;
            })}</div>
          )}
        </div>
      )}

      {current === 'regles' && <Rules s={c.scoring} />}
    </>
  );
}

function Standings({ rows, played, c, meId, linked }: { rows: Row[]; played: Tournament[]; c: Championship; meId?: string; linked: boolean }) {
  return (
    <div className="card flush"><div className="scroll">
      <table className="table sticky">
        <thead><tr>
          <th className="mid">Rang</th><th>Joueur</th><th className="num">Total</th><th className="num">Manches</th><th className="num">Victoires</th><th className="num">KO</th>
          {played.map(t => <th key={t.id} className="mid"><a href={`#/t/${t.id}`} style={{ color: 'inherit' }}>{t.name}</a></th>)}
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className={`p${r.rank} ${r.memberId && r.memberId === meId ? 'me' : ''}`}>
              <td className="pos">{r.rank}</td>
              <td>{r.memberId && linked ? <a href={`#/j/${r.memberId}`}>{r.name}</a> : <b>{r.name}</b>}</td>
              <td className="num total">{f.num(r.total)}</td>
              <td className="num">{r.played}</td>
              <td className="num">{r.wins || ''}</td>
              <td className="num">{r.kos ? f.num(r.kos) : ''}</td>
              {played.map(t => {
                const x = r.cells.get(t.id);
                return <td key={t.id} className="mid">{x && <><span className={x.counted ? '' : 'dropped'} title={x.counted ? undefined : 'Résultat non retenu'}>{f.num(x.points)}</span><span className="cellpos">{x.provisional ? 'en cours' : f.ordinal(x.position)}</span></>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      {c.scoring.bestOf !== null && <p className="muted" style={{ padding: '10px 16px' }}>Seuls les {c.scoring.bestOf} meilleurs résultats de chaque joueur comptent ; les autres sont barrés.</p>}
    </div>
  );
}

export function Rules({ s }: { s: Scoring }) {
  const brackets = [...s.brackets].sort((a, b) => a.minPlayers - b.minPlayers);
  const places = Math.max(0, ...brackets.map(b => b.points.length));
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div className="card">
        <dl className="deflist">
          <div><dt>Place</dt><dd>{s.method === 'linear' ? `(joueurs − place + 1) × ${f.num(s.factor)}` : s.method === 'sqrt' ? `${f.num(s.factor)} × √(joueurs ÷ place)` : 'selon le tableau'}</dd></div>
          <div><dt>Participation</dt><dd>{f.plural(s.participation, 'point')}</dd></div>
          <div><dt>Par KO</dt><dd>{s.koPoints > 0 ? f.plural(s.koPoints, 'point') : 'aucun point'}</dd></div>
          <div><dt>Résultats retenus</dt><dd>{s.bestOf === null ? 'tous' : `les ${s.bestOf} meilleurs`}</dd></div>
          <div><dt>Invités</dt><dd>{s.rankGuests ? 'classés comme les adhérents' : 'ils jouent, sans être classés'}</dd></div>
          <div><dt>Égalité</dt><dd>victoires, puis 2es places, puis 3es places et ainsi de suite, puis KO</dd></div>
        </dl>
      </div>
      {s.method === 'table' && places > 0 && (
        <div className="card flush"><table className="table">
          <thead><tr><th className="mid">Place</th>{brackets.map((b, i) => <th key={i} className="num">{brackets.length === 1 ? 'Points' : i === 0 ? `Moins de ${brackets[1].minPlayers} joueurs` : `${b.minPlayers} joueurs et plus`}</th>)}</tr></thead>
          <tbody>{Array.from({ length: places }, (_, p) => <tr key={p}><td className="pos">{p + 1}</td>{brackets.map((b, i) => <td key={i} className="num">{bracketFor({ ...s, brackets: [b] }, 999)[p] ?? ''}</td>)}</tr>)}</tbody>
        </table></div>
      )}
    </div>
  );
}
