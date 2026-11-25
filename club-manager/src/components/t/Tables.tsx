import { useState } from 'react';
import { api, useClub } from '../../lib/club';
import { participants, replay } from '../../lib/engine';
import { advise, breakTable, draw, freeSeats, placeOne, tablesOf, type Advice, type Seat } from '../../lib/seating';
import * as f from '../../lib/format';
import type { Entry } from '../../lib/types';
import type { TabProps } from '../../pages/Tournament';
import { Empty, Icon, Modal, useAction, useConfirm } from '../ui';

export function Tables({ b, reload }: TabProps) {
  const { t, entries, knockouts } = b;
  const { isStaff, me } = useClub();
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const [moving, setMoving] = useState<string | null>(null);
  const [from, setFrom] = useState<Extract<Advice, { kind: 'move' }> | null>(null);

  const alive = replay(participants(t, entries), knockouts, t.settings).alive.map(p => p.entry);
  const size = t.seats_per_table;
  const tables = tablesOf(alive);
  const advices = isStaff ? advise(alive, size) : [];
  const mover = moving ? alive.find(e => e.id === moving) : undefined;

  const save = (seats: Seat[], ok: string) => run(async () => {
    await api.rpc('club_save_seats', { p_tournament: t.id, p_seats: seats });
    await reload();
  }, ok);
  const redraw = async (title: string, text: string) => {
    if (tables.length > 0 && !await confirm({ title, text, ok: 'Tirer au sort' })) return;
    await save(draw(alive.map(e => e.id), size), 'Places tirées au sort.');
  };

  if (alive.length === 0) {
    return <Empty title="Personne à placer">{isStaff ? <>Le tirage porte sur les joueurs pointés « sur place ». <a className="btn" href={`#/t/${t.id}/joueurs`}>Pointer les joueurs</a></> : 'Les places seront tirées au sort sur place.'}</Empty>;
  }

  return (
    <div className="stack">
      {isStaff && (
        <div className="row">
          <button className={`btn ${tables.length === 0 ? 'primary' : ''}`} disabled={busy} onClick={() => redraw('Refaire tout le tirage ?', 'Toutes les places actuelles seront remplacées.')}>
            <Icon name="dice" />{tables.length === 0 ? `Tirer les places au sort (${f.plural(alive.length, 'joueur')})` : 'Refaire le tirage'}
          </button>
        </div>
      )}
      {advices.map(a => (
        <div className="card warn row between" key={a.kind}>
          {a.kind === 'unseated' && <>
            <span><b>{f.plural(a.ids.length, 'joueur')} sans place</b> : {alive.filter(e => a.ids.includes(e.id)).map(e => e.name).join(', ')}</span>
            <button className="btn primary sm" disabled={busy} onClick={() => {
              const seats: Seat[] = [];
              let current = alive;
              for (const id of a.ids) {
                const s = placeOne(id, current, size);
                seats.push(s);
                current = current.map(e => e.id === id ? { ...e, table_no: s.table_no, seat_no: s.seat_no } : e);
              }
              void save(seats, 'Joueurs placés.');
            }}>Placer aux tables les moins remplies</button>
          </>}
          {a.kind === 'final' && <>
            <span><b>Table finale</b> : il reste {alive.length} joueurs, une seule table suffit.</span>
            <button className="btn primary sm" disabled={busy} onClick={() => save(draw(alive.map(e => e.id), size), 'Table finale tirée au sort.')}>Tirer la table finale</button>
          </>}
          {a.kind === 'break' && <>
            <span><b>Table {a.table} à fermer</b> : une table de moins suffit.</span>
            <button className="btn primary sm" disabled={busy} onClick={() => { const m = breakTable(alive, a.table, size); if (m) void save(m, `Table ${a.table} fermée.`); }}>Fermer et répartir</button>
          </>}
          {a.kind === 'move' && <>
            <span><b>Tables déséquilibrées</b> : un joueur de la table {a.from} va en table {a.to}, place {a.seat}. En général, celui qui prend la prochaine grosse blinde.</span>
            <button className="btn primary sm" disabled={busy} onClick={() => setFrom(a)}>Choisir le joueur</button>
          </>}
        </div>
      ))}
      <div className="felts">
        {tables.map(table => {
          const free = freeSeats(table, size);
          const bySeat = new Map(table.players.map(p => [p.seat_no, p]));
          // Un siège en double (retour d'un joueur éliminé) doit rester visible.
          const extra = table.players.filter(p => bySeat.get(p.seat_no) !== p);
          return (
            <section className="felt" key={table.no}>
              <header>
                <b>Table {table.no}</b>
                <span className="row" style={{ gap: 4 }}>
                  <span className="muted">{f.plural(table.players.length, 'joueur')}</span>
                  {isStaff && tables.length > 1 && (
                    <button className="iconbtn" disabled={busy} title="Fermer cette table" aria-label={`Fermer la table ${table.no}`} onClick={async () => {
                      const m = breakTable(alive, table.no, size);
                      if (!m) { await confirm({ title: 'Pas assez de places', text: 'Les autres tables ne peuvent pas accueillir tous ces joueurs.', ok: 'Compris' }); return; }
                      if (await confirm({ title: `Fermer la table ${table.no} ?`, text: 'Ses joueurs sont répartis au hasard sur les autres tables.', ok: 'Fermer la table' })) await save(m, `Table ${table.no} fermée.`);
                    }}><Icon name="close" size={15} /></button>
                  )}
                </span>
              </header>
              <ol>
                {Array.from({ length: size }, (_, i) => i + 1).map(s => {
                  const p = bySeat.get(s);
                  return p ? <SeatRow key={s} p={p} mine={p.member_id !== null && p.member_id === me?.id} onMove={isStaff ? () => setMoving(p.id) : undefined} />
                    : free.includes(s) && <li key={s} className="free"><div><span className="seat">{s}</span>libre</div></li>;
                })}
                {extra.map(p => <SeatRow key={p.id} p={p} mine={false} onMove={isStaff ? () => setMoving(p.id) : undefined} />)}
              </ol>
            </section>
          );
        })}
      </div>

      {from && (
        <Modal title={`Qui quitte la table ${from.from} ?`} onClose={() => setFrom(null)}>
          <div className="picks">
            {tables.find(x => x.no === from.from)?.players.map(p => (
              <button key={p.id} className="pick" disabled={busy} onClick={async () => {
                if (await save([{ entry_id: p.id, table_no: from.to, seat_no: from.seat }], `${p.name} : table ${from.to}, place ${from.seat}.`)) setFrom(null);
              }}>{p.name}<small>place {p.seat_no}</small></button>
            ))}
          </div>
        </Modal>
      )}
      {mover && (
        <Modal title={`Déplacer ${mover.name}`} onClose={() => setMoving(null)}>
          <div className="stack">
            {tables.map(table => (
              <div key={table.no}>
                <p className="muted" style={{ marginBottom: 6 }}>Table {table.no}</p>
                <div className="row">
                  {Array.from({ length: size }, (_, i) => i + 1).map(s => {
                    const p = table.players.find(x => x.seat_no === s);
                    if (p?.id === mover.id) return null;
                    return (
                      <button key={s} className="btn sm" disabled={busy} title={p ? `Échanger avec ${p.name}` : 'Place libre'} onClick={async () => {
                        const seats: Seat[] = [{ entry_id: mover.id, table_no: table.no, seat_no: s }];
                        if (p) seats.push({ entry_id: p.id, table_no: mover.table_no, seat_no: mover.seat_no });
                        if (await save(seats, p ? `${mover.name} et ${p.name} échangent leurs places.` : `${mover.name} : table ${table.no}, place ${s}.`)) setMoving(null);
                      }}>{p ? <><Icon name="swap" size={14} />{s} · {p.name}</> : `${s} · libre`}</button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div><button className="btn" disabled={busy} onClick={async () => {
              const no = (tables.at(-1)?.no ?? 0) + 1;
              if (await save([{ entry_id: mover.id, table_no: no, seat_no: 1 }], `${mover.name} ouvre la table ${no}.`)) setMoving(null);
            }}><Icon name="plus" />Nouvelle table</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SeatRow({ p, mine, onMove }: { p: Entry; mine: boolean; onMove?: () => void }) {
  const inner = <><span className="seat">{p.seat_no}</span>{p.name}{mine && <span className="tag open">Toi</span>}</>;
  return <li className={mine ? 'me' : ''}>{onMove ? <button onClick={onMove} title="Déplacer">{inner}</button> : <div>{inner}</div>}</li>;
}
