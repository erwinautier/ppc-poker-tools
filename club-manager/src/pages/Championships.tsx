import { listChampionships, listTournaments, useClub, useLoad } from '../lib/club';
import * as f from '../lib/format';
import { Empty, Icon, State } from '../components/ui';

export function Championships() {
  const { isStaff, me, user } = useClub();
  const q = useLoad(async () => {
    const [list, tournaments] = await Promise.all([listChampionships(), listTournaments()]);
    return { list, tournaments };
  }, [me?.id, user?.id]);
  return (
    <>
      <div className="pagehead">
        <div><h1>Championnats</h1></div>
        {isStaff && <a className="btn primary" href="#/championnats/nouveau"><Icon name="plus" />Nouveau championnat</a>}
      </div>
      {!q.data ? <State loading={q.loading} error={q.error} onRetry={q.reload} /> : q.data.list.length === 0
        ? <div className="card"><Empty title="Aucun championnat">{isStaff ? <a className="btn primary" href="#/championnats/nouveau">Créer le premier championnat</a> : !user && 'Connecte-toi pour voir ceux du club.'}</Empty></div>
        : (
          <div className="card" style={{ paddingBlock: 4 }}>
            <div className="plist">
              {[...q.data.list].sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived')).map(c => {
                const ts = q.data!.tournaments.filter(t => t.championship_id === c.id && t.status !== 'cancelled' && t.status !== 'draft');
                const done = ts.filter(t => t.status === 'finished').length;
                return (
                  <div className="prow" key={c.id} style={{ paddingBlock: 14 }}>
                    <span className="pname"><a href={`#/c/${c.id}`}>{c.name}{c.season && ` ${c.season}`}</a><small>{done} {done > 1 ? 'manches jouées' : 'manche jouée'} sur {f.num(ts.length)}</small></span>
                    {c.status === 'archived' && <span className="tag">Archivé</span>}
                    {ts.some(t => t.status === 'running') && <span className="tag live">En direct</span>}
                    <a className="btn sm" href={`#/c/${c.id}`}>Classement</a>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </>
  );
}
