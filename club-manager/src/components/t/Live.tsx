import { useMemo, useState } from 'react';
import { api, useClub, useNow, useWakeLock } from '../../lib/club';
import { levelNumber, withinLevel, type ClockView } from '../../lib/clock';
import { beforeKnockout, chipCount, distinctPrizes, finalRows, isSng, participants, possibleKillers, prizeGroups, replay, type PlayerState, type PrizeGroup, type Replay } from '../../lib/engine';
import { layoutOf, returnSeat } from '../../lib/seating';
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
    await api.rpc('club_save_seats', { p_tournament: t.id, p_seats: [returnSeat(e, alive, layoutOf(t))] });
  }
}

/**
 * Change les tombeurs d'une élimination, sans toucher à son ordre ni aux places.
 * La base ne prévient les écrans connectés qu'à l'ajout ou au retrait d'une
 * élimination : on touche le tournoi pour qu'ils se rechargent aussi.
 */
async function setKillers(t: Tournament, id: string, killers: string[]) {
  await api.update('club_knockouts', id, { killer_ids: killers });
  await api.update('club_tournaments', t.id, { rev: Number(t.rev) + 1 });
}

export function Live({ b, reload }: TabProps) {
  const { t, entries, knockouts } = b;
  const { isStaff, me } = useClub();
  const now = useNow();
  const v = viewOf(t, now);
  const c = useClockCommands(t, v, reload);
  const [victim, setVictim] = useState<string | null>(null);
  const [editing, setEditing] = useState<Knockout | null>(null);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  useWakeLock(t.status === 'running');

  const inPlay = useMemo(() => participants(t, entries), [t, entries]);
  const r = useMemo(() => replay(inPlay, knockouts, t.settings), [inPlay, knockouts, t.settings]);
  const chips = chipCount(t, inPlay, r.alive.length, v.level?.bb ?? 0);
  const mine = me ? r.players.find(p => p.entry.member_id === me.id) : undefined;
  const victimState = victim ? r.byId.get(victim) : undefined;
  const bounty = t.settings.bounty.mode !== 'none';
  const sng = isSng(t.settings);
  const tables = r.rankings.filter(g => g.table !== null);

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
        {isStaff && r.done && (
          <div className="card warn row between">
            {sng && r.rankings.length > 1
              ? <span><b>Toutes les tables sont terminées</b> : {r.rankings.filter(g => g.alive.length > 0).map(g => `${g.alive[0].entry.name}${g.table ? ` (table ${g.table})` : ''}`).join(', ')}.</span>
              : <span><b>{r.alive[0].entry.name} remporte le tournoi !</b></span>}
            <button className="btn primary" disabled={busy} onClick={finish}><Icon name="trophy" />Valider le classement</button>
          </div>
        )}
        <div className="card stack">
          <MiniClock t={t} v={v} />
          {isStaff && <ClockControls c={c} v={v} />}
        </div>
        {mine && <MyCard t={t} p={mine} aliveCount={r.rankingOf(mine.entry.id).alive.length} sng={sng} />}
        <div className="card">
          <dl className="facts">
            <div><dt>En course</dt><dd>{r.alive.length}<small> / {r.total}</small></dd></div>
            {sng && tables.length > 1 && <div><dt>Tables en jeu</dt><dd>{tables.filter(g => g.alive.length > 1).length}<small> / {tables.length}</small></dd></div>}
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
                    <p>{p?.entry.name ?? 'Joueur retiré'}{k.rebuy && ' (recave)'}<small>{sng && p?.entry.table_no ? `table ${p.entry.table_no}, ` : ''}{killers ? `par ${killers}` : 'sans tombeur'}{k.level ? `, niveau ${k.level}` : ''}</small></p>
                    {isStaff && p && (
                      <button className="iconbtn" disabled={busy} aria-label={`Changer le tombeur de ${p.entry.name}`} title="Changer le tombeur" onClick={() => setEditing(k)}><Icon name="edit" size={15} /></button>
                    )}
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
        {isStaff && !r.done && (
          <button className="btn ghost" onClick={async () => {
            if (await confirm({ title: 'Arrêter le tournoi maintenant ?', text: `Il reste ${f.plural(r.alive.length, 'joueur')}. Tu pourras fixer leur ordre dans l'onglet Résultats.`, ok: 'Saisir le classement' })) go(`#/t/${t.id}/resultats`);
          }}>Arrêter avant la fin</button>
        )}
      </div>

      {victimState?.alive && <KnockoutModal b={b} r={r} v={v} victim={victimState} reload={reload} onClose={() => setVictim(null)} />}
      {editing && <KillerModal b={b} r={r} k={editing} reload={reload} onClose={() => setEditing(null)} />}
    </div>
  );
}

function MyCard({ t, p, aliveCount, sng }: { t: Tournament; p: PlayerState; aliveCount: number; sng: boolean }) {
  const ofTable = sng && p.entry.table_no ? <small> de ta table</small> : null;
  return (
    <div className="card note">
      <dl className="facts">
        {p.alive
          ? <div><dt>Ta place</dt><dd>{p.entry.table_no ? <>Table {p.entry.table_no}<small> · siège {p.entry.seat_no}</small></> : 'à tirer'}</dd></div>
          : <div><dt>Ton résultat</dt><dd>{f.ordinal(p.position!)}{ofTable}</dd></div>}
        {p.alive && <div><dt>Place assurée</dt><dd>{f.ordinal(aliveCount)}{ofTable}</dd></div>}
        <div><dt>Tes KO</dt><dd>{f.num(p.kos)}</dd></div>
        {t.settings.bounty.mode !== 'none' && <div><dt>Tes primes</dt><dd>{bountyValue(t, p.bountyWon)}</dd></div>}
        {t.settings.bounty.mode !== 'none' && p.alive && p.head > 0 && <div><dt>Sur ta tête</dt><dd>{bountyValue(t, p.head)}</dd></div>}
      </dl>
    </div>
  );
}

function PrizeCard({ b, inPlay }: { b: TabProps['b']; inPlay: Entry[] }) {
  const groups = distinctPrizes(prizeGroups(b.t, inPlay));
  if (groups.length === 0) return null;
  return (
    <div className="card">
      <h2>Dotation{isSng(b.t.settings) && groups.length === 1 ? ' par table' : ''}</h2>
      <PrizeLists groups={groups} />
    </div>
  );
}

/** Une liste par dotation différente : une seule pour un MTT ou des tables qui rapportent pareil. */
export function PrizeLists({ groups }: { groups: PrizeGroup[] }) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      {groups.map((g, i) => (
        <div key={i}>
          {groups.length > 1 && <p className="muted" style={{ fontWeight: 700, marginBottom: 4 }}>{g.table ? `Table ${g.table}` : 'Table'} de {g.players} joueurs</p>}
          <dl className="deflist">{g.list.map(p => <div key={p.place}><dt>{f.ordinal(p.place)}</dt><dd>{p.label || f.eur(p.amount!)}</dd></div>)}</dl>
        </div>
      ))}
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
        const done = isSng(t.settings) && list.length === 1 && r.rankingOf(list[0].entry.id).total > 1;
        return (
          <div key={no ?? 'x'} style={{ marginBottom: 10 }}>
            {groups.size > 1 || no ? <p className="muted" style={{ fontWeight: 700 }}>{no ? `Table ${no}` : 'Sans place'}{done && ' · terminée'}</p> : null}
            <div className="plist">
              {shown.map(p => (
                <div className="prow" key={p.entry.id}>
                  <span className="idx">{p.entry.seat_no}</span>
                  <span className="pname">{p.entry.name}
                    {(p.kos > 0 || (bounty && p.head > 0)) && <small>{[p.kos > 0 && f.kos(p.kos), bounty && p.head > 0 && `prime ${bountyValue(t, p.head)}`].filter(Boolean).join(' · ')}</small>}
                  </span>
                  {done && <span className="tag open"><Icon name="trophy" size={13} />Vainqueur</span>}
                  {isStaff && r.rankingOf(p.entry.id).alive.length > 1 && <button className="btn danger sm" onClick={() => onKo(p.entry.id)} aria-label={`Éliminer ${p.entry.name}`}><Icon name="skull" size={15} />KO</button>}
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
  const [killers, setPicked] = useState<string[]>([]);
  const [nobody, setNobody] = useState(false);
  const [run, busy] = useAction();
  const toast = useToast();
  const s = t.settings;
  const e = victim.entry;

  const ranking = r.rankingOf(e.id);
  // Sit'N Go : seuls les joueurs de sa table peuvent l'éliminer.
  const others = possibleKillers(r, e, s);
  const canRebuy = s.rebuy.enabled && withinLevel(t.levels, v.index, s.rebuy.untilLevel) && (s.rebuy.max === 0 || e.rebuys < s.rebuy.max);
  const place = ranking.alive.length;
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
    toast(rebuy ? `${e.name} recave.` : `${e.name} termine ${f.ordinal(place)}${isSng(s) && e.table_no ? ` de la table ${e.table_no}` : ''}.`, 'ok', {
      label: 'Annuler',
      run: () => void run(async () => { await undoKnockout(b, created!); await reload(); }, 'Élimination annulée.'),
    });
  };

  return (
    <Modal title={`Qui élimine ${e.name} ?`} onClose={onClose} wide>
      <div className="stack">
        <KillerPicks t={t} victim={victim} others={others} killers={killers} nobody={nobody} onChange={(l, n) => { setPicked(l); setNobody(n); }} />
        <div className="row end">
          <button className="btn" onClick={onClose}>Annuler</button>
          {canRebuy && <button className="btn" disabled={busy || !chosen} onClick={() => submit(true)}>Il recave{s.rebuy.price > 0 ? ` (${f.eur(s.rebuy.price)})` : ''}</button>}
          <button className="btn primary" disabled={busy || !chosen} onClick={() => submit(false)}>Valider, {f.ordinal(place)} place</button>
        </div>
      </div>
    </Modal>
  );
}

/** Choix du ou des tombeurs (KO partagé), ou de « Personne ». */
function KillerPicks({ t, victim, others, killers, nobody, onChange }: {
  t: Tournament; victim: PlayerState; others: PlayerState[]; killers: string[]; nobody: boolean;
  onChange: (killers: string[], nobody: boolean) => void;
}) {
  const s = t.settings;
  return (
    <>
      <div className="picks">
        {others.map(p => {
          const on = killers.includes(p.entry.id);
          return (
            <button key={p.entry.id} type="button" className={`pick ${on ? 'on' : ''}`} aria-pressed={on}
              onClick={() => onChange(on ? killers.filter(x => x !== p.entry.id) : [...killers, p.entry.id], false)}>
              {p.entry.name}<small>{p.entry.table_no ? `table ${p.entry.table_no}` : ''}{p.kos > 0 ? `${p.entry.table_no ? ' · ' : ''}${f.kos(p.kos)}` : ''}</small>
            </button>
          );
        })}
        <button type="button" className={`pick ${nobody ? 'on' : ''}`} aria-pressed={nobody} onClick={() => onChange([], !nobody)}>Personne<small>abandon, pénalité</small></button>
      </div>
      <p className="muted">
        {killers.length > 1 ? `KO partagé entre ${killers.length} joueurs. ` : ''}
        {s.bounty.mode !== 'none' && victim.head > 0 && killers.length > 0 && (s.bounty.mode === 'progressive'
          ? `Prime de ${bountyValue(t, victim.head)} : moitié gagnée, moitié ajoutée à la tête ${killers.length > 1 ? 'des tombeurs' : 'du tombeur'}. `
          : `Prime de ${bountyValue(t, victim.head)}${killers.length > 1 ? ' à partager' : ''}. `)}
        {!nobody && killers.length === 0 && 'Choisis un joueur, ou plusieurs pour un KO partagé.'}
      </p>
    </>
  );
}

/**
 * Change le tombeur d'une élimination déjà saisie. Les joueurs proposés sont
 * ceux qui étaient en course à ce moment-là ; la place ne change pas, KO et
 * primes sont recalculés.
 */
function KillerModal({ b, r, k, reload, onClose }: TabProps & { r: Replay; k: Knockout; onClose: () => void }) {
  const { t, entries, knockouts } = b;
  const [killers, setPicked] = useState(k.killer_ids);
  const [nobody, setNobody] = useState(k.killer_ids.length === 0);
  const [run, busy] = useAction();
  const toast = useToast();
  const before = useMemo(() => beforeKnockout(participants(t, entries), knockouts, k, t.settings), [t, entries, knockouts, k]);
  // Annulée entre-temps (autre écran) : plus rien à changer.
  if (!before || !knockouts.some(x => x.id === k.id)) return null;

  const { victim } = before;
  const name = victim.entry.name;
  const place = r.byId.get(victim.entry.id)?.position;
  const unchanged = killers.length === k.killer_ids.length && killers.every(x => k.killer_ids.includes(x));
  const names = (ids: string[]) => ids.map(x => r.byId.get(x)?.entry.name).filter(Boolean).join(' et ');

  const save = async () => {
    const previous = k.killer_ids;
    const ok = await run(async () => { await setKillers(t, k.id, killers); await reload(); });
    if (!ok) return;
    onClose();
    toast(killers.length ? `KO de ${name} : ${names(killers)}.` : `KO de ${name} : sans tombeur.`, 'ok', {
      label: 'Annuler',
      run: () => void run(async () => { await setKillers(t, k.id, previous); await reload(); }, 'Tombeur rétabli.'),
    });
  };

  return (
    <Modal title={`Qui a éliminé ${name} ?`} onClose={onClose} wide>
      <div className="stack">
        <p className="muted">
          {k.rebuy ? 'Élimination suivie d\'une recave' : place ? `${f.ordinal(place)} place${isSng(t.settings) && victim.entry.table_no ? ` de la table ${victim.entry.table_no}` : ''}` : 'Élimination'}{k.level ? `, niveau ${k.level}` : ''}.
          {' '}{k.rebuy ? 'Les' : 'Sa place ne change pas ; les'} KO et primes sont recalculés. Sont proposés les joueurs encore en course à ce moment-là.
        </p>
        <KillerPicks t={t} victim={victim} others={before.killers} killers={killers} nobody={nobody} onChange={(l, n) => { setPicked(l); setNobody(n); }} />
        <div className="row end">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={busy || unchanged || (!nobody && killers.length === 0)} onClick={save}>Enregistrer</button>
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
