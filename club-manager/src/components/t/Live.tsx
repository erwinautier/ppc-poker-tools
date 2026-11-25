import { useMemo, useState } from 'react';
import { api, useClub, useNow, useWakeLock } from '../../lib/club';
import { levelNumber, withinLevel, type ClockView } from '../../lib/clock';
import { chipCount, finalRows, participants, payouts, replay, type PlayerState, type Replay } from '../../lib/engine';
import { placeOne } from '../../lib/seating';
import * as f from '../../lib/format';
import { go } from '../../lib/router';
import type { Entry, Knockout, Tournament } from '../../lib/types';
import type { TabProps } from '../../pages/Tournament';
import { ClockControls, MiniClock, useClockCommands, viewOf } from '../clockui';
import { Empty, Icon, Modal, useAction, useConfirm, useToast } from '../ui';

export function bountyValue(t: Tournament, x: number): string {
  const u = t.settings.bounty.unit;
  return u === 'eur' ? f.eur(x) : u === 'pts' ? f.plural(x, 'point') : f.plural(x, 'lot');
}

/** Annule une élimination ; si la place du joueur a été reprise, il en reçoit une autre. */
export async function undoKnockout(b: TabProps['b'], k: Knockout) {
  const { t, entries, knockouts } = b;
  await api.remove('club_knockouts', k.id);
  if (k.rebuy) return;
  const e = entries.find(x => x.id === k.victim_id);
  if (!e || e.table_no === null) return;
  const alive = replay(participants(t, entries), knockouts.filter(x => x.id !== k.id), t.settings).alive.map(p => p.entry);
  const clash = alive.some(x => x.id !== e.id && x.table_no === e.table_no && x.seat_no === e.seat_no);
  const closed = !alive.some(x => x.id !== e.id && x.table_no === e.table_no) && alive.some(x => x.id !== e.id && x.table_no !== null);
  if (clash || closed) {
    await api.rpc('club_save_seats', { p_tournament: t.id, p_seats: [placeOne(e.id, alive.filter(x => x.id !== e.id), t.seats_per_table)] });
  }
}

export function Live({ b, reload }: TabProps) {
  const { t, entries, knockouts } = b;
  const { isStaff, me } = useClub();
  const now = useNow();
  const v = viewOf(t, now);
  const c = useClockCommands(t, v, reload);
  const [victim, setVictim] = useState<string | null>(null);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  useWakeLock(t.status === 'running');

  const inPlay = useMemo(() => participants(t, entries), [t, entries]);
  const r = useMemo(() => replay(inPlay, knockouts, t.settings), [inPlay, knockouts, t.settings]);
  const chips = chipCount(t, inPlay, r.alive.length, v.level?.bb ?? 0);
  const mine = me ? r.players.find(p => p.entry.member_id === me.id) : undefined;
  const victimState = victim ? r.byId.get(victim) : undefined;
  const bounty = t.settings.bounty.mode !== 'none';

  if (t.status !== 'running') return <BeforeStart b={b} reload={reload} start={c.toggle} busy={c.busy} />;

  const undo = (k: Knockout) => run(async () => { await undoKnockout(b, k); await reload(); }, 'Élimination annulée.');
  const finish = () => run(async () => {
    await api.rpc('club_finish', { p_tournament: t.id, p_results: finalRows(r, t.settings) });
    await reload();
    go(`#/t/${t.id}/resultats`);
  }, 'Classement enregistré.');

  return (
    <div className="two">
      <div className="stack">
        {isStaff && r.alive.length === 1 && r.total > 1 && (
          <div className="card warn row between">
            <span><b>{r.alive[0].entry.name} remporte le tournoi !</b></span>
            <button className="btn primary" disabled={busy} onClick={finish}><Icon name="trophy" />Valider le classement</button>
          </div>
        )}
        <div className="card stack">
          <MiniClock t={t} v={v} />
          {isStaff && <ClockControls c={c} v={v} />}
        </div>
        {mine && <MyCard t={t} p={mine} aliveCount={r.alive.length} />}
        <div className="card">
          <dl className="facts">
            <div><dt>En course</dt><dd>{r.alive.length}<small> / {r.total}</small></dd></div>
            <div><dt>Tapis moyen</dt><dd>{f.num(chips.avgStack)}{chips.avgBB !== null && v.level?.kind === 'level' && <small> · {f.num(chips.avgBB)} BB</small>}</dd></div>
            <div><dt>Prochaine pause</dt><dd>{v.toBreakMs !== null ? f.duration(Math.ceil(v.toBreakMs / 60_000)) : 'aucune'}</dd></div>
            <div><dt>Durée de jeu</dt><dd>{f.duration(Math.floor(v.totalMs / 60_000))}</dd></div>
          </dl>
        </div>
        <Alive r={r} t={t} v={v} isStaff={isStaff} onKo={setVictim} />
      </div>

      <div className="stack">
        <PrizeCard b={b} inPlay={inPlay} />
        {r.players.some(p => p.kos > 0) && (
          <div className="card">
            <h2>Chasseurs</h2>
            <div className="plist">
              {[...r.players].filter(p => p.kos > 0).sort((a, z) => z.kos - a.kos || z.bountyWon - a.bountyWon).slice(0, 6).map(p => (
                <div className="prow" key={p.entry.id}><span className="pname">{p.entry.name}</span><span className="tnum muted">{f.kos(p.kos)}{bounty && p.bountyWon > 0 && ` · ${bountyValue(t, p.bountyWon)}`}</span></div>
              ))}
            </div>
          </div>
        )}
        <div className="card">
          <h2>Éliminations</h2>
          {knockouts.length === 0 ? <p className="muted">Aucune élimination pour l'instant.</p> : (
            <div className="feed">
              {[...knockouts].reverse().map((k, i) => {
                const p = r.byId.get(k.victim_id);
                const killers = k.killer_ids.map(x => r.byId.get(x)?.entry.name).filter(Boolean).join(' et ');
                return (
                  <div key={k.id}>
                    <span className="where">{k.rebuy ? '↻' : p?.position ?? ''}</span>
                    <p>{p?.entry.name ?? 'Joueur retiré'}{k.rebuy && ' (recave)'}<small>{killers ? `par ${killers}` : 'sans tombeur'}{k.level ? `, niveau ${k.level}` : ''}</small></p>
                    {isStaff && i === 0 && <button className="btn sm" disabled={busy} onClick={() => undo(k)}><Icon name="undo" size={14} />Annuler</button>}
                    {isStaff && i > 0 && (
                      <button className="iconbtn" disabled={busy} aria-label={`Annuler l'élimination de ${p?.entry.name}`} title="Annuler cette élimination" onClick={async () => {
                        if (await confirm({ title: `Remettre ${p?.entry.name ?? 'ce joueur'} en jeu ?`, text: 'Les places des joueurs éliminés ensuite seront recalculées.', ok: 'Remettre en jeu' })) await undo(k);
                      }}><Icon name="undo" size={15} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {isStaff && r.alive.length !== 1 && (
          <button className="btn ghost" onClick={async () => {
            if (await confirm({ title: 'Arrêter le tournoi maintenant ?', text: `Il reste ${f.plural(r.alive.length, 'joueur')}. Tu pourras fixer leur ordre dans l'onglet Résultats.`, ok: 'Saisir le classement' })) go(`#/t/${t.id}/resultats`);
          }}>Arrêter avant la fin</button>
        )}
      </div>

      {victimState?.alive && <KnockoutModal b={b} r={r} v={v} victim={victimState} reload={reload} onClose={() => setVictim(null)} />}
    </div>
  );
}

function MyCard({ t, p, aliveCount }: { t: Tournament; p: PlayerState; aliveCount: number }) {
  return (
    <div className="card note">
      <dl className="facts">
        {p.alive
          ? <div><dt>Ta place</dt><dd>{p.entry.table_no ? <>Table {p.entry.table_no}<small> · siège {p.entry.seat_no}</small></> : 'à tirer'}</dd></div>
          : <div><dt>Ton résultat</dt><dd>{f.ordinal(p.position!)}</dd></div>}
        {p.alive && <div><dt>Place assurée</dt><dd>{f.ordinal(aliveCount)}</dd></div>}
        <div><dt>Tes KO</dt><dd>{f.num(p.kos)}</dd></div>
        {t.settings.bounty.mode !== 'none' && <div><dt>Tes primes</dt><dd>{bountyValue(t, p.bountyWon)}</dd></div>}
        {t.settings.bounty.mode !== 'none' && p.alive && p.head > 0 && <div><dt>Sur ta tête</dt><dd>{bountyValue(t, p.head)}</dd></div>}
      </dl>
    </div>
  );
}

function PrizeCard({ b, inPlay }: { b: TabProps['b']; inPlay: Entry[] }) {
  const list = payouts(b.t, inPlay);
  if (list.length === 0) return null;
  return (
    <div className="card">
      <h2>Dotation</h2>
      <dl className="deflist">{list.map(p => <div key={p.place}><dt>{f.ordinal(p.place)}</dt><dd>{p.label || f.eur(p.amount!)}</dd></div>)}</dl>
    </div>
  );
}

function Alive({ r, t, v, isStaff, onKo }: { r: Replay; t: Tournament; v: ClockView; isStaff: boolean; onKo: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const bounty = t.settings.bounty.mode !== 'none';
  const groups = new Map<number | null, PlayerState[]>();
  for (const p of r.alive) groups.set(p.entry.table_no, [...(groups.get(p.entry.table_no) ?? []), p]);
  const match = (p: PlayerState) => p.entry.name.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'));
  return (
    <div className="card">
      <div className="sechead"><h2>En course</h2>{isStaff && r.alive.length > 8 && <input style={{ width: 170 }} placeholder="Rechercher" aria-label="Rechercher un joueur" value={search} onChange={e => setSearch(e.target.value)} />}</div>
      {r.alive.length === 0 && <Empty title="Personne n'est pointé">{isStaff && <a className="btn" href={`#/t/${t.id}/joueurs`}>Pointer les joueurs</a>}</Empty>}
      {[...groups.entries()].sort((a, z) => (a[0] ?? 99) - (z[0] ?? 99)).map(([no, list]) => {
        const shown = list.filter(match).sort((a, z) => (a.entry.seat_no ?? 0) - (z.entry.seat_no ?? 0));
        if (shown.length === 0) return null;
        return (
          <div key={no ?? 'x'} style={{ marginBottom: 10 }}>
            {groups.size > 1 || no ? <p className="muted" style={{ fontWeight: 700 }}>{no ? `Table ${no}` : 'Sans place'}</p> : null}
            <div className="plist">
              {shown.map(p => (
                <div className="prow" key={p.entry.id}>
                  <span className="idx">{p.entry.seat_no}</span>
                  <span className="pname">{p.entry.name}
                    {(p.kos > 0 || (bounty && p.head > 0)) && <small>{[p.kos > 0 && f.kos(p.kos), bounty && p.head > 0 && `prime ${bountyValue(t, p.head)}`].filter(Boolean).join(' · ')}</small>}
                  </span>
                  {isStaff && r.alive.length > 1 && <button className="btn danger sm" onClick={() => onKo(p.entry.id)} aria-label={`Éliminer ${p.entry.name}`}><Icon name="skull" size={15} />KO</button>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {isStaff && withinLevel(t.levels, v.index, t.settings.lateRegLevel) && (
        <p className="muted">Arrivées tardives ouvertes jusqu'au niveau {t.settings.lateRegLevel}. <a href={`#/t/${t.id}/joueurs`}>Ajouter un joueur</a></p>
      )}
    </div>
  );
}

export function KnockoutModal({ b, r, v, victim, reload, onClose }: TabProps & { r: Replay; v: ClockView; victim: PlayerState; onClose: () => void }) {
  const { t } = b;
  const [killers, setKillers] = useState<string[]>([]);
  const [nobody, setNobody] = useState(false);
  const [run, busy] = useAction();
  const toast = useToast();
  const s = t.settings;
  const e = victim.entry;

  const others = r.alive.filter(p => p.entry.id !== e.id)
    .sort((a, z) => Number(z.entry.table_no === e.table_no) - Number(a.entry.table_no === e.table_no) || a.entry.name.localeCompare(z.entry.name, 'fr'));
  const canRebuy = s.rebuy.enabled && withinLevel(t.levels, v.index, s.rebuy.untilLevel) && (s.rebuy.max === 0 || e.rebuys < s.rebuy.max);
  const place = r.alive.length;
  const chosen = nobody || killers.length > 0;

  const submit = async (rebuy: boolean) => {
    let created: Knockout | undefined;
    const ok = await run(async () => {
      [created] = await api.insert<Knockout>('club_knockouts', {
        tournament_id: t.id, victim_id: e.id, killer_ids: killers, rebuy, level: levelNumber(t.levels, v.index) || null,
      });
      await reload();
    });
    if (!ok) return;
    onClose();
    toast(rebuy ? `${e.name} recave.` : `${e.name} termine ${f.ordinal(place)}.`, 'ok', {
      label: 'Annuler',
      run: () => void run(async () => { await undoKnockout(b, created!); await reload(); }, 'Élimination annulée.'),
    });
  };

  return (
    <Modal title={`Qui élimine ${e.name} ?`} onClose={onClose} wide>
      <div className="stack">
        <div className="picks">
          {others.map(p => {
            const on = killers.includes(p.entry.id);
            return (
              <button key={p.entry.id} type="button" className={`pick ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => {
                setNobody(false);
                setKillers(l => on ? l.filter(x => x !== p.entry.id) : [...l, p.entry.id]);
              }}>{p.entry.name}<small>{p.entry.table_no ? `table ${p.entry.table_no}` : ''}{p.kos > 0 ? `${p.entry.table_no ? ' · ' : ''}${f.kos(p.kos)}` : ''}</small></button>
            );
          })}
          <button type="button" className={`pick ${nobody ? 'on' : ''}`} aria-pressed={nobody} onClick={() => { setKillers([]); setNobody(!nobody); }}>Personne<small>abandon, pénalité</small></button>
        </div>
        <p className="muted">
          {killers.length > 1 ? `KO partagé entre ${killers.length} joueurs. ` : ''}
          {s.bounty.mode !== 'none' && victim.head > 0 && killers.length > 0 && (s.bounty.mode === 'progressive'
            ? `Prime de ${bountyValue(t, victim.head)} : moitié gagnée, moitié ajoutée à la tête ${killers.length > 1 ? 'des tombeurs' : 'du tombeur'}. `
            : `Prime de ${bountyValue(t, victim.head)}${killers.length > 1 ? ' à partager' : ''}. `)}
          {!chosen && 'Choisis un joueur, ou plusieurs pour un KO partagé.'}
        </p>
        <div className="row end">
          <button className="btn" onClick={onClose}>Annuler</button>
          {canRebuy && <button className="btn" disabled={busy || !chosen} onClick={() => submit(true)}>Il recave{s.rebuy.price > 0 ? ` (${f.eur(s.rebuy.price)})` : ''}</button>}
          <button className="btn primary" disabled={busy || !chosen} onClick={() => submit(false)}>Valider, {f.ordinal(place)} place</button>
        </div>
      </div>
    </Modal>
  );
}

function BeforeStart({ b, reload, start, busy }: TabProps & { start: () => void; busy: boolean }) {
  const { t, entries } = b;
  const [run, working] = useAction();
  const confirm = useConfirm();
  const registered = entries.filter(e => e.status === 'registered');
  const present = registered.filter(e => e.checked_in);
  const seated = present.filter(e => e.table_no !== null);
  const steps: [boolean, string, string, string][] = [
    [t.levels.length > 0, 'Structure', t.levels.length > 0 ? `${t.structure_name || 'Personnalisée'}, ${f.plural(t.levels.filter(l => l.kind === 'level').length, 'niveau', 'niveaux')}` : 'aucun niveau', `#/t/${t.id}/structure`],
    [present.length >= 2, 'Pointage', `${present.length} sur place pour ${f.plural(registered.length, 'inscription')}`, `#/t/${t.id}/joueurs`],
    [present.length > 0 && seated.length === present.length, 'Tirage des places', seated.length === 0 ? 'à faire' : `${seated.length} places attribuées sur ${present.length}`, `#/t/${t.id}/tables`],
  ];
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <h2>Avant de lancer l'horloge</h2>
      <div className="plist" style={{ marginBottom: 18 }}>
        {steps.map(([ok, label, text, href]) => (
          <div className="prow" key={label}>
            <span className={`toggle ${ok ? 'on' : ''}`} aria-hidden="true">{ok ? <Icon name="check" size={14} /> : <Icon name="minus" size={14} />}</span>
            <span className="pname">{label}<small>{text}</small></span>
            <a className="btn sm" href={href}>Ouvrir</a>
          </div>
        ))}
      </div>
      <button className="btn primary big block" disabled={busy || working || t.levels.length === 0} onClick={async () => {
        if (present.length < 2 && registered.length >= 2) {
          if (!await confirm({ title: 'Tout le monde est là ?', text: `${present.length === 0 ? 'Personne n\'est pointé' : 'Une seule personne est pointée'}. Les ${registered.length} inscriptions seront pointées « sur place ».`, ok: 'Pointer tout le monde et lancer' })) return;
          if (!await run(async () => { await Promise.all(registered.filter(e => !e.checked_in).map(e => api.update('club_entries', e.id, { checked_in: true }))); await reload(); })) return;
        }
        start();
      }}><Icon name="play" />Lancer le tournoi</button>
    </div>
  );
}
