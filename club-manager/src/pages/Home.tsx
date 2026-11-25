import { entriesOf, knockoutsOf, listChampionships, listTournaments, useClub, useLoad } from '../lib/club';
import { standings } from '../lib/scoring';
import * as f from '../lib/format';
import { Empty, State } from '../components/ui';
import { LiveTicket, TournamentRow } from '../components/cards';

export function Home() {
  const { me, user, request, isStaff } = useClub();
  const q = useLoad(async () => {
    const [tournaments, championships] = await Promise.all([listTournaments(), listChampionships()]);
    const active = championships.filter(c => c.status === 'active').slice(0, 2);
    const upcoming = tournaments.filter(t => t.status === 'open' || t.status === 'closed').reverse();
    const running = tournaments.filter(t => t.status === 'running');
    const last = tournaments.filter(t => t.status === 'finished').slice(0, 3);
    const ranked = tournaments.filter(t => active.some(c => c.id === t.championship_id) && t.status === 'finished');
    const ids = new Set([...upcoming, ...running, ...last, ...ranked].map(t => t.id));
    const [entries, knockouts] = await Promise.all([entriesOf([...ids]), knockoutsOf(running.map(t => t.id))]);
    return { championships, active, upcoming, running, last, ranked, entries, knockouts, total: tournaments.length };
  }, [me?.id, user?.id], {});

  const d = q.data;
  const champName = (id: string | null) => d?.championships.find(c => c.id === id)?.name;
  const of = (id: string) => d!.entries.filter(e => e.tournament_id === id);

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="pagehead" style={{ marginBottom: 0 }}><div>
        <h1>{me ? `Salut ${me.name.split(' ')[0]}` : 'Championnats et tournois'}</h1>
        <p>{me ? 'La vie du club, en direct.' : 'Les prochaines soirées, les résultats et les classements du club.'}</p>
      </div></div>

      {!user && <div className="card note row between"><span>Adhérent du club ? Connecte-toi pour t'inscrire et voir toutes les soirées.</span><a className="btn primary" href="#/compte">Se connecter</a></div>}
      {user && !me && (
        <div className="card note row between">
          <span>{request ? 'Ta demande de rattachement est entre les mains du bureau.' : 'Dernière étape : rattache ton compte à ta fiche d\'adhérent.'}</span>
          {!request && <a className="btn primary" href="#/compte">Rattacher mon compte</a>}
        </div>
      )}

      {!d ? <State loading={q.loading} error={q.error} onRetry={q.reload} /> : (
        <>
          {d.running.map(t => <LiveTicket key={t.id} t={t} entries={of(t.id)} knockouts={d.knockouts.filter(k => k.tournament_id === t.id)} />)}

          {isStaff && d.total === 0 && (
            <div className="card">
              <h2>Mise en route</h2>
              <ol style={{ paddingLeft: 20, display: 'grid', gap: 8 }}>
                <li><a href="#/adherents">Ajouter les adhérents</a> (un nom par ligne, en une fois)</li>
                <li><a href="#/structures">Choisir une structure de blindes</a></li>
                <li><a href="#/championnats/nouveau">Créer le championnat</a> et son barème</li>
                <li><a href="#/tournois/nouveau">Programmer le premier tournoi</a></li>
              </ol>
            </div>
          )}

          <div className="two">
            <div>
              <section className="sec">
                <div className="sechead"><h2>Prochaines soirées</h2><a href="#/tournois">Tout l'agenda</a></div>
                <div className="card" style={{ paddingBlock: 4 }}>
                  {d.upcoming.length === 0
                    ? <Empty title="Aucune soirée programmée">{isStaff && <a className="btn primary" href="#/tournois/nouveau">Programmer un tournoi</a>}</Empty>
                    : <div className="tlist">{d.upcoming.slice(0, 4).map(t => <TournamentRow key={t.id} t={t} entries={of(t.id)} championship={champName(t.championship_id)} reload={q.reload} />)}</div>}
                </div>
              </section>
              {d.last.length > 0 && (
                <section className="sec">
                  <div className="sechead"><h2>Derniers résultats</h2><a href="#/tournois/passes">Tous les résultats</a></div>
                  <div className="card" style={{ paddingBlock: 4 }}>
                    <div className="tlist">{d.last.map(t => <TournamentRow key={t.id} t={t} championship={champName(t.championship_id)} winner={of(t.id).find(e => e.final_position === 1)?.name} />)}</div>
                  </div>
                </section>
              )}
            </div>
            <div className="stack">
              {d.active.map(c => {
                const rows = standings({ scoring: c.scoring, tournaments: d.ranked.filter(t => t.championship_id === c.id), entries: d.entries, knockouts: [] });
                const mine = me ? rows.find(r => r.memberId === me.id) : undefined;
                return (
                  <section key={c.id}>
                    <div className="sechead"><h2>{c.name}</h2><a href={`#/c/${c.id}`}>Classement complet</a></div>
                    <div className="card flush">
                      {rows.length === 0 ? <Empty title="Pas encore de résultat">Le classement apparaîtra après la première manche.</Empty> : (
                        <table className="table">
                          <tbody>
                            {[...rows.slice(0, 5), ...(mine && mine.rank > 5 && !rows.slice(0, 5).includes(mine) ? [mine] : [])].map(r => (
                              <tr key={r.key} className={`p${r.rank} ${mine === r ? 'me' : ''}`}>
                                <td className="pos">{r.rank}</td>
                                <td>{r.memberId ? <a href={`#/j/${r.memberId}`}>{r.name}</a> : r.name}</td>
                                <td className="num total">{f.num(r.total)} pts</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
