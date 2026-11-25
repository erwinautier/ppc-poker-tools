import { useMemo, useState } from 'react';
import { api, listMembers, useClub, useLoad, useNow } from '../../lib/club';
import { withinLevel } from '../../lib/clock';
import { money, participants, replay } from '../../lib/engine';
import { placeOne } from '../../lib/seating';
import * as f from '../../lib/format';
import type { Entry } from '../../lib/types';
import type { TabProps } from '../../pages/Tournament';
import { viewOf } from '../clockui';
import { Empty, Field, Icon, Modal, NumberInput, Stepper, useAction, useConfirm } from '../ui';

/** Joueur qui arrive pendant le tournoi : on lui donne tout de suite une place. */
export async function checkIn(b: TabProps['b'], e: Entry) {
  const { t, entries, knockouts } = b;
  await api.update('club_entries', e.id, { status: 'registered', checked_in: true });
  if (t.status !== 'running') return;
  const alive = replay(participants(t, entries), knockouts, t.settings).alive.map(p => p.entry);
  if (alive.some(x => x.table_no !== null)) {
    await api.rpc('club_save_seats', { p_tournament: t.id, p_seats: [placeOne(e.id, alive, t.seats_per_table)] });
  }
}

export function Players({ b, reload }: TabProps) {
  const { t, entries, knockouts, paid } = b;
  const { isStaff, me } = useClub();
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [run, busy] = useAction();
  const confirm = useConfirm();

  const list = entries.filter(e => e.status === 'registered');
  const waiting = entries.filter(e => e.status === 'waitlist');
  const cancelled = entries.filter(e => e.status === 'cancelled');
  const inPlay = participants(t, entries);
  const live = useMemo(() => replay(inPlay, knockouts, t.settings), [entries, knockouts, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const cash = money(t, inPlay);
  const paying = cash.total > 0 || t.settings.buyIn + t.settings.fee > 0;
  const editable = isStaff && t.status !== 'cancelled';
  const shown = [...list].sort((x, y) => x.name.localeCompare(y.name, 'fr'))
    .filter(e => e.name.toLocaleLowerCase('fr').includes(filter.trim().toLocaleLowerCase('fr')));
  const edited = detail ? entries.find(e => e.id === detail) : undefined;

  const act = (fn: () => Promise<unknown>, ok?: string) => run(async () => { await fn(); await reload(); }, ok);

  return (
    <div className="stack">
      {isStaff && (
        <div className="card">
          <dl className="facts">
            <div><dt>Inscriptions</dt><dd>{list.length}{t.max_players && <small> / {t.max_players}</small>}</dd></div>
            <div><dt>Sur place</dt><dd>{inPlay.length}</dd></div>
            <div><dt>Attente</dt><dd>{waiting.length}</dd></div>
            {paying && <div><dt>Réglés</dt><dd>{list.filter(e => paid.has(e.id)).length}</dd></div>}
            {cash.pool > 0 && <div><dt>Cagnotte</dt><dd>{f.eur(cash.pool)}</dd></div>}
          </dl>
        </div>
      )}
      {editable && (
        <div className="row">
          <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter des joueurs</button>
          {list.some(e => !e.checked_in) && t.status !== 'finished' && (
            <button className="btn" disabled={busy} onClick={async () => {
              const absent = list.filter(e => !e.checked_in);
              if (await confirm({ title: 'Tout le monde est là ?', text: `${f.plural(absent.length, 'personne')} à pointer.`, ok: 'Pointer tout le monde' })) {
                await act(async () => {
                  await Promise.all(absent.map(e => api.update('club_entries', e.id, { checked_in: true })));
                }, 'Pointage terminé.');
              }
            }}>Tout le monde est là</button>
          )}
          <span className="spacer" />
          {list.length > 8 && <input style={{ width: 190 }} placeholder="Rechercher" aria-label="Rechercher un joueur" value={filter} onChange={e => setFilter(e.target.value)} />}
        </div>
      )}

      <div className="card" style={{ paddingBlock: 6 }}>
        {list.length === 0 ? <Empty title="Aucune inscription">{editable && 'Ajoute des adhérents ou des invités.'}</Empty> : (
          <div className="plist">
            {shown.map(e => {
              const p = live.byId.get(e.id);
              const out = t.status === 'running' && p && !p.alive;
              const extras = [
                e.rebuys > 0 && f.plural(e.rebuys, 'recave'),
                e.addons > 0 && f.plural(e.addons, 'add-on'),
                e.table_no && !out && t.status !== 'finished' && `table ${e.table_no}, place ${e.seat_no}`,
                out && `KO, ${f.ordinal(p.position!)}`,
                e.bounty_start !== null && t.settings.bounty.mode !== 'none' && 'prime spéciale',
                !e.member_id && 'invité',
              ].filter(Boolean).join(' · ');
              return (
                <div className={`prow ${out ? 'out' : ''}`} key={e.id}>
                  <span className="pname">{e.member_id && me ? <a href={`#/j/${e.member_id}`}>{e.name}</a> : e.name}{extras && <small>{extras}</small>}</span>
                  {editable && t.status !== 'finished' && (
                    <>
                      <button className={`toggle ${e.checked_in ? 'on' : ''}`} aria-pressed={e.checked_in} disabled={busy || out}
                        onClick={() => act(() => e.checked_in ? api.update('club_entries', e.id, { checked_in: false, table_no: null, seat_no: null }) : checkIn(b, e))}>
                        {e.checked_in && <Icon name="check" size={13} />}Sur place
                      </button>
                      {paying && (
                        <button className={`toggle ${paid.has(e.id) ? 'on' : ''}`} aria-pressed={paid.has(e.id)} disabled={busy}
                          onClick={() => act(() => paid.has(e.id) ? api.remove('club_payments', e.id) : api.insert('club_payments', { entry_id: e.id, tournament_id: t.id }))}>
                          {paid.has(e.id) && <Icon name="check" size={13} />}Réglé
                        </button>
                      )}
                    </>
                  )}
                  {!isStaff && e.checked_in && t.status !== 'finished' && <span className="tag">Sur place</span>}
                  {editable && <button className="iconbtn" onClick={() => setDetail(e.id)} aria-label={`Modifier ${e.name}`}><Icon name="edit" size={16} /></button>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {waiting.length > 0 && (
        <div className="card">
          <h2>Liste d'attente</h2>
          <div className="plist">
            {waiting.map((e, i) => (
              <div className="prow" key={e.id}>
                <span className="idx">{i + 1}</span><span className="pname">{e.name}</span>
                {editable && (
                  <>
                    <button className="btn sm" disabled={busy} onClick={() => act(() => api.update('club_entries', e.id, { status: 'registered' }), `${e.name} participe.`)}>Faire entrer</button>
                    <button className="iconbtn danger" disabled={busy} aria-label={`Retirer ${e.name}`} onClick={() => act(() => api.update('club_entries', e.id, { status: 'cancelled' }))}><Icon name="close" size={16} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isStaff && cancelled.length > 0 && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Désinscriptions ({cancelled.length})</summary>
          <div className="plist" style={{ marginTop: 8 }}>
            {cancelled.map(e => (
              <div className="prow out" key={e.id}>
                <span className="pname">{e.name}</span>
                {editable && <button className="btn sm" disabled={busy} onClick={() => act(() => api.update('club_entries', e.id, { status: 'registered' }))}>Réinscrire</button>}
              </div>
            ))}
          </div>
        </details>
      )}

      {adding && <AddPlayers b={b} reload={reload} onClose={() => setAdding(false)} />}
      {edited && <EntryModal b={b} e={edited} act={act} busy={busy} onClose={() => setDetail(null)} />}
    </div>
  );
}

function AddPlayers({ b, reload, onClose }: TabProps & { onClose: () => void }) {
  const { t, entries } = b;
  const members = useLoad(listMembers, []);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [guest, setGuest] = useState('');
  const [present, setPresent] = useState(t.status === 'running');
  const [run, busy] = useAction();
  const now = useNow(5000);
  const late = t.status === 'running' && !withinLevel(t.levels, viewOf(t, now).index, t.settings.lateRegLevel);

  const taken = new Set(entries.filter(e => e.status !== 'cancelled').map(e => e.member_id));
  const free = (members.data ?? []).filter(m => m.active && !taken.has(m.id));
  const shown = free.filter(m => m.name.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')));
  const guests = guest.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  const count = picked.size + guests.length;

  const save = () => run(async () => {
    const back = entries.filter(e => e.status === 'cancelled' && e.member_id && picked.has(e.member_id));
    const rows = [
      ...free.filter(m => picked.has(m.id) && !back.some(e => e.member_id === m.id)).map(m => ({ member_id: m.id, name: m.name })),
      ...guests.map(name => ({ member_id: null, name: name.slice(0, 60) })),
    ].map(r => ({ ...r, tournament_id: t.id, status: 'registered' }));
    const created = rows.length ? await api.insert<Entry>('club_entries', rows) : [];
    for (const e of back) await api.update('club_entries', e.id, { status: 'registered' });
    if (present) {
      // Place les arrivants un par un, en tenant compte des précédents.
      const bundle = { ...b, entries: [...entries] };
      for (const e of [...created, ...back]) {
        await checkIn(bundle, e);
        bundle.entries = (await api.select<Entry>('club_entries', { eq: { tournament_id: t.id } }));
      }
    }
    await reload();
  }, `${f.plural(count, 'joueur')} ajouté${count > 1 ? 's' : ''}.`).then(ok => { if (ok) onClose(); });

  return (
    <Modal title="Ajouter des joueurs" onClose={onClose} wide>
      <div className="stack">
        {late && <div className="card warn" style={{ padding: 12 }}>Les arrivées tardives sont closes depuis le niveau {t.settings.lateRegLevel}. Tu peux quand même ajouter un joueur.</div>}
        <div>
          <div className="row" style={{ marginBottom: 10 }}>
            <input placeholder="Rechercher un adhérent" aria-label="Rechercher un adhérent" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
            {picked.size > 0 && <span className="tag done">{f.plural(picked.size, 'choix', 'choix')}</span>}
          </div>
          {members.loading ? <p className="muted">Chargement des adhérents</p> : shown.length === 0
            ? <p className="muted">{free.length === 0 ? 'Tous les adhérents sont déjà inscrits.' : 'Aucun adhérent à ce nom : ajoute-le comme invité ci-dessous.'}</p>
            : (
              <div className="picks">
                {shown.map(m => (
                  <button key={m.id} type="button" className={`pick ${picked.has(m.id) ? 'on' : ''}`} aria-pressed={picked.has(m.id)}
                    onClick={() => setPicked(s => { const n = new Set(s); if (!n.delete(m.id)) n.add(m.id); return n; })}>{m.name}</button>
                ))}
              </div>
            )}
        </div>
        <Field label="Invités" hint="Un nom par ligne. Un invité joue, mais n'entre pas au classement (sauf réglage du championnat).">
          <textarea value={guest} onChange={e => setGuest(e.target.value)} rows={2} />
        </Field>
        <div className="row between">
          <button type="button" className={`toggle ${present ? 'on' : ''}`} aria-pressed={present} onClick={() => setPresent(!present)}>{present && <Icon name="check" size={13} />}Déjà sur place</button>
          <div className="row">
            <button className="btn" onClick={onClose}>Annuler</button>
            <button className="btn primary" disabled={busy || count === 0} onClick={save}>Ajouter{count > 0 ? ` (${count})` : ''}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EntryModal({ b, e, act, busy, onClose }: { b: TabProps['b']; e: Entry; act: (fn: () => Promise<unknown>, ok?: string) => Promise<boolean>; busy: boolean; onClose: () => void }) {
  const { t, knockouts } = b;
  const [bounty, setBounty] = useState(e.bounty_start);
  const [adjust, setAdjust] = useState<number | null>(e.points_adjust || null);
  const [name, setName] = useState(e.name);
  const confirm = useConfirm();
  const inLog = knockouts.some(k => k.victim_id === e.id || k.killer_ids.includes(e.id));
  return (
    <Modal title={e.name} onClose={onClose}>
      <div className="stack">
        {!e.member_id && <Field label="Nom de l'invité"><input value={name} maxLength={60} onChange={x => setName(x.target.value)} /></Field>}
        {t.settings.rebuy.enabled && <div className="row between"><span>Recaves</span><Stepper label="Recaves" value={e.rebuys} disabled={busy} onChange={v => act(() => api.update('club_entries', e.id, { rebuys: v }))} /></div>}
        {t.settings.addon.enabled && <div className="row between"><span>Add-ons</span><Stepper label="Add-ons" value={e.addons} disabled={busy} onChange={v => act(() => api.update('club_entries', e.id, { addons: v }))} /></div>}
        {t.settings.bounty.mode !== 'none' && (
          <Field label="Prime spéciale sur ce joueur" hint={`Remplace la prime du tournoi (${f.num(t.settings.bounty.amount)}). Vide : prime normale.`}>
            <NumberInput value={bounty} onChange={setBounty} step={0.5} />
          </Field>
        )}
        {t.championship_id && <Field label="Points en plus ou en moins" hint="Bonus ou pénalité, ajouté au total de ce tournoi."><NumberInput value={adjust} onChange={setAdjust} min={-1000} step={0.5} placeholder="0" /></Field>}
        <div className="row between">
          <button className="btn danger" disabled={busy} onClick={async () => {
            if (inLog) {
              await confirm({ title: 'Impossible de retirer ce joueur', text: 'Il figure dans les éliminations. Annule d\'abord les éliminations concernées dans l\'onglet Direct.', ok: 'Compris' });
              return;
            }
            if (await confirm({ title: `Retirer ${e.name} ?`, text: 'Son inscription est annulée ; la liste d\'attente avance.', ok: 'Retirer', danger: true })) {
              if (await act(() => e.member_id
                ? api.update('club_entries', e.id, { status: 'cancelled', checked_in: false, table_no: null, seat_no: null, final_position: null, final_kos: null, final_bounty: null })
                : api.remove('club_entries', e.id), `${e.name} ne participe plus.`)) onClose();
            }
          }}>Retirer du tournoi</button>
          <button className="btn primary" disabled={busy || !name.trim()} onClick={async () => {
            if (await act(() => api.update('club_entries', e.id, { bounty_start: bounty, points_adjust: adjust ?? 0, ...(e.member_id ? {} : { name: name.trim() }) }), 'Enregistré.')) onClose();
          }}>Enregistrer</button>
        </div>
      </div>
    </Modal>
  );
}
