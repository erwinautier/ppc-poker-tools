/** Le tableau papier, en tactile : les noms à gauche, les consos et leurs prix en haut. */
import { useState, useSyncExternalStore } from 'react';
import { getDA, logoFile, subscribeDA } from '../../../shared/ppc-da.js';
import { bar, isDemo, useClub, useLoad } from '../lib/club';
import { useBarRefresh } from '../lib/barContext';
import { key } from '../lib/accounts';
import { leaveKiosk } from '../lib/kiosk';
import * as b from '../lib/bar';
import { Empty, Icon, State, useConfirm } from '../components/ui';
import { Queued, useTake } from './Bar';

export function BarCounter() {
  const da = useSyncExternalStore(subscribeDA, getDA);
  const { kiosk, me } = useClub();
  const q = useLoad(() => bar.counter(), [kiosk, me?.id]);
  useBarRefresh(!!q.data, q.reload, kiosk ? 8_000 : 15_000);
  const [search, setSearch] = useState('');
  const [guest, setGuest] = useState(false);
  const [hit, setHit] = useState('');
  const take = useTake(q.reload);
  const confirm = useConfirm();
  const leave = async () => {
    if (!await confirm({ title: 'Quitter le comptoir ?', text: 'Il faudra rouvrir le lien de la tablette pour y revenir.', ok: 'Quitter', danger: true })) return;
    leaveKiosk();
    location.hash = '#/';
    location.reload();
  };
  const d = q.data;
  if (!d) {
    return (
      <div className="main">
        <State loading={q.loading} error={q.error} onRetry={q.reload} />
        {q.error && <div className="row" style={{ marginTop: 14 }}>{kiosk ? !isDemo && <button className="btn" onClick={leave}>Quitter le comptoir</button> : <a className="btn" href="#/buvette">Retour à la buvette</a>}</div>}
      </div>
    );
  }
  const items = d.items.filter(i => i.active);
  const people = d.people.filter(x => key(x.name).includes(key(search)));
  const t = new Map(d.tally.map(x => [`${x.member_id}/${x.item_id}`, x.n]));
  return (
    <div className="counter">
      <header className="counterhead">
        <img src={`${import.meta.env.BASE_URL}${logoFile(da)}`} alt="" />
        <h1>Buvette</h1>
        <Queued n={d.queued} />
        <input placeholder="Chercher un nom" aria-label="Chercher un nom" value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button className="btn" onClick={() => setSearch('')}>Tous les noms</button>}
        <button className={`btn ${guest ? 'primary' : ''}`} aria-pressed={guest} onClick={() => setGuest(!guest)}>Pour un invité</button>
        {kiosk ? !isDemo && <button className="iconbtn" aria-label="Quitter le comptoir" onClick={leave}><Icon name="close" size={16} /></button>
          : <a className="btn ghost" href="#/buvette/suivi"><Icon name="close" />Quitter</a>}
      </header>
      {guest && <p className="counterguest">Invité : touche la case de la personne qui l'invite, la conso ira sur son ardoise.</p>}
      <div className="counterwrap">
        {items.length === 0 ? <Empty title="Aucun produit">Un gestionnaire les ajoute dans Buvette, Tarifs et réglages.</Empty> : (
          <table className="countertable">
            <thead>
              <tr><th scope="col">Nom</th>{items.map(i => <th scope="col" key={i.id}><span aria-hidden="true">{i.emoji}</span><b>{i.name}</b><em>{b.money(i.price)}</em></th>)}</tr>
            </thead>
            <tbody>
              {people.map(p => (
                <tr key={p.id}>
                  <th scope="row">{p.name}</th>
                  {items.map(i => {
                    const k = `${p.id}/${i.id}`, n = t.get(k) ?? 0;
                    return (
                      <td key={i.id}>
                        <button className={`cell ${n ? 'on' : ''} ${hit === k ? 'hit' : ''}`} aria-label={`${p.name}, ${i.name}, ${n} ce soir. Ajouter`}
                          onClick={() => { setHit(''); requestAnimationFrame(() => setHit(k)); void take(p.id, i, guest, p.name); setGuest(false); }}>
                          {n > 0 ? <Marks n={n} /> : <Icon name="plus" size={16} />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {items.length > 0 && people.length === 0 && <Empty title="Personne à ce nom" />}
      </div>
    </div>
  );
}

/** Les traits, par paquets de cinq, comme sur le papier. */
function Marks({ n }: { n: number }) {
  if (n > 19) return <b>{n}</b>;
  const full = Math.floor(n / 5), rest = n % 5, w = full * 26 + rest * 5 + 2;
  return (
    <svg className="marks" width={w} height="20" viewBox={`0 0 ${w} 20`} aria-hidden="true">
      {Array.from({ length: full }, (_, g) => <path key={g} d={`M${g * 26 + 4} 3v14M${g * 26 + 9} 3v14M${g * 26 + 14} 3v14M${g * 26 + 19} 3v14M${g * 26 + 1} 15L${g * 26 + 22} 5`} />)}
      {Array.from({ length: rest }, (_, i) => <path key={`r${i}`} d={`M${full * 26 + i * 5 + 3} 3v14`} />)}
    </svg>
  );
}
