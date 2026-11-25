import { entriesOf, listChampionships, listTournaments, useClub, useLoad } from '../lib/club';
import { useRoute } from '../lib/router';
import { Empty, Icon, State } from '../components/ui';
import { TournamentRow } from '../components/cards';

export function Tournaments() {
  const { isStaff, me, user } = useClub();
  const past = useRoute().parts[1] === 'passes';
  const q = useLoad(async () => {
    const [tournaments, championships] = await Promise.all([listTournaments(), listChampionships()]);
    const list = past
      ? tournaments.filter(t => t.status === 'finished' || t.status === 'cancelled')
      : tournaments.filter(t => t.status !== 'finished' && t.status !== 'cancelled').reverse();
    return { list, championships, entries: await entriesOf(list.map(t => t.id)) };
  }, [past, me?.id, user?.id], {});

  return (
    <>
      <div className="pagehead">
        <div><h1>Tournois</h1></div>
        {isStaff && <a className="btn primary" href="#/tournois/nouveau"><Icon name="plus" />Nouveau tournoi</a>}
      </div>
      <div className="tabs">
        <a href="#/tournois" className={past ? '' : 'on'}>À venir et en cours</a>
        <a href="#/tournois/passes" className={past ? 'on' : ''}>Terminés</a>
      </div>
      {!q.data ? <State loading={q.loading} error={q.error} onRetry={q.reload} /> : (
        <div className="card" style={{ paddingBlock: 4 }}>
          {q.data.list.length === 0
            ? <Empty title={past ? 'Aucun tournoi terminé' : 'Aucun tournoi à venir'}>{isStaff && <a className="btn primary" href="#/tournois/nouveau">Programmer un tournoi</a>}</Empty>
            : (
              <div className="tlist">
                {q.data.list.map(t => {
                  const entries = q.data!.entries.filter(e => e.tournament_id === t.id);
                  return (
                    <TournamentRow key={t.id} t={t} entries={entries} reload={q.reload}
                      championship={q.data!.championships.find(c => c.id === t.championship_id)?.name}
                      winner={t.status === 'finished' ? entries.find(e => e.final_position === 1)?.name : undefined} />
                  );
                })}
              </div>
            )}
        </div>
      )}
    </>
  );
}
