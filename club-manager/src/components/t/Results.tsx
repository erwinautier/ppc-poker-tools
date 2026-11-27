import { useMemo, useState } from 'react';
import { api, useClub } from '../../lib/club';
import { finalRows, isSng, outcomes, participants, prizeFor, prizeGroups, rankingKey, replay, type Outcome, type ResultRow } from '../../lib/engine';
import { points } from '../../lib/scoring';
import * as f from '../../lib/format';
import { download } from '../../lib/ics';
import { go } from '../../lib/router';
import type { Entry } from '../../lib/types';
import type { TabProps } from '../../pages/Tournament';
import { Empty, Icon, NumberInput, useAction, useConfirm } from '../ui';
import { bountyValue } from './Live';
import { huBoard, huRecordText } from './HeadsUp';
import { fmtPoints, knownPlaces, standings } from '../../lib/hu';

export function csv(rows: (string | number)[][]): string {
  const cell = (x: string | number) => {
    const s = typeof x === 'number' ? String(x).replace('.', ',') : x;
    // Un tableur exécuterait une cellule commençant par l'un de ces signes.
    const safe = typeof x === 'string' && /^[=+\-@\t]/.test(s) ? `'${s}` : s;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}

export function Results({ b, reload }: TabProps) {
  const { t, entries, knockouts, championship } = b;
  const { isStaff, me } = useClub();
  const [editing, setEditing] = useState(t.status !== 'finished');
  const [run, busy] = useAction();
  const confirm = useConfirm();

  if (t.status !== 'finished' || editing) {
    if (!isStaff) return <Empty title="Pas encore de résultats" />;
    return <ResultsEditor b={b} reload={reload} onDone={() => setEditing(false)} onCancel={t.status === 'finished' ? () => setEditing(false) : undefined} />;
  }

  const list = outcomes(t, entries, knockouts);
  const prizes = prizeGroups(t, participants(t, entries));
  const hasPrizes = prizes.some(g => g.list.length > 0);
  // Heads-up : le bilan des matchs (et les points de ronde suisse) à la place des KO.
  const hu = t.settings.format === 'hu' ? huBoard(b) : null;
  const huPts = hu?.system === 'swiss' ? new Map(standings(hu).map(s => [s.id, s.points])) : null;
  const bounty = !hu && t.settings.bounty.mode !== 'none' && list.some(o => o.bounty > 0);
  const pts = (o: Outcome) => championship && points(championship.scoring, {
    position: o.position, players: o.field, kos: o.kos,
    bountyPts: t.settings.bounty.mode !== 'none' && t.settings.bounty.unit === 'pts' ? o.bounty : 0,
    adjust: o.entry.points_adjust, coefficient: t.settings.coefficient,
  });
  // Sit'N Go : un classement par table.
  const sng = isSng(t.settings);
  const sections = [...new Set(list.map(o => o.table))].sort((a, z) => (a ?? 0) - (z ?? 0))
    .map(table => ({ table, rows: list.filter(o => o.table === table) }));
  const podium = [1, 2, 3].map(p => list.filter(o => o.position === p)).filter(x => x.length > 0);

  return (
    <div className="stack">
      {list.length === 0 ? <div className="card"><Empty title="Aucun résultat saisi" /></div> : (
        <>
          {sections.length === 1 && list.length >= 3 && podium.length === 3 && (
            <div className="podium">
              {podium.map((os, i) => (
                <div key={i} className={`p${i + 1}`}>
                  <b>{os.map(o => o.entry.name).join(', ')}</b>
                  {championship && <small>{f.num(pts(os[0]) || 0)} pts</small>}
                  <div className="step">{i + 1}</div>
                </div>
              ))}
            </div>
          )}
          {sng && sections.length > 1 && (
            <div className="card">
              <h2>Vainqueurs</h2>
              <p>{sections.map(x => `${x.rows.filter(o => o.position === 1).map(o => o.entry.name).join(', ')}${x.table ? ` (table ${x.table})` : ''}`).join(' · ')}</p>
            </div>
          )}
          {sections.map(({ table, rows }) => (
          <div className="stack" style={{ gap: 6 }} key={table ?? 'x'}>
          {sections.length > 1 && <p className="muted" style={{ fontWeight: 700 }}>{table ? `Table ${table}` : 'Sans table'} · {f.plural(rows.length, 'joueur')}</p>}
          <div className="card flush"><div className="scroll">
            <table className="table">
              <thead><tr><th className="mid">Place</th><th>Joueur</th>{hu ? <><th className="num" title="Victoires et défaites">V-D</th>{huPts && <th className="num">Pts</th>}</> : <th className="num">KO</th>}{bounty && <th className="num">Primes</th>}{hasPrizes && <th className="num">Dotation</th>}{championship && <th className="num">Points</th>}</tr></thead>
              <tbody>
                {rows.map(o => {
                  const prize = prizeFor(prizes, o);
                  return (
                    <tr key={o.entry.id} className={`p${o.position} ${me && o.entry.member_id === me.id ? 'me' : ''}`}>
                      <td className="pos">{o.position}</td>
                      <td>{o.entry.member_id && me ? <a href={`#/j/${o.entry.member_id}`}>{o.entry.name}</a> : <b>{o.entry.name}</b>}{!o.entry.member_id && <span className="muted"> invité</span>}</td>
                      {hu ? <><td className="num">{huRecordText(hu, o.entry)}</td>{huPts && <td className="num">{fmtPoints(huPts.get(o.entry.id) ?? 0)}</td>}</> : <td className="num">{o.kos > 0 ? f.num(o.kos) : ''}</td>}
                      {bounty && <td className="num">{o.bounty > 0 ? bountyValue(t, o.bounty) : ''}</td>}
                      {hasPrizes && <td className="num">{prize ? prize.label || f.eur(prize.amount!) : ''}</td>}
                      {championship && <td className="num total">{f.num(pts(o) || 0)}{o.entry.points_adjust !== 0 && <span className="cellpos">dont {o.entry.points_adjust > 0 ? '+' : ''}{f.num(o.entry.points_adjust)}</span>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></div>
          </div>
          ))}
        </>
      )}
      <div className="row no-print">
        <button className="btn sm" onClick={() => download(`${t.name}.csv`, csv(sng ? [
          ['Table', 'Place', 'Joueur', 'KO', 'Primes', 'Points'],
          ...sections.flatMap(x => x.rows).map(o => [o.table ?? '', o.position, o.entry.name, o.kos, o.bounty, pts(o) || 0]),
        ] : [
          ['Place', 'Joueur', 'KO', 'Primes', 'Points'],
          ...list.map(o => [o.position, o.entry.name, o.kos, o.bounty, pts(o) || 0]),
        ]), 'text/csv')}><Icon name="download" size={15} />Exporter (CSV)</button>
        {isStaff && <button className="btn sm" onClick={() => setEditing(true)}><Icon name="edit" size={15} />Corriger les résultats</button>}
        {isStaff && (knockouts.length > 0 || b.matches.length > 0) && (
          <button className="btn sm ghost" disabled={busy} onClick={async () => {
            if (await confirm({ title: 'Rouvrir ce tournoi ?', text: 'Le classement est retiré et le tournoi repasse en direct, horloge arrêtée. Les corrections faites à la main seront perdues.', ok: 'Rouvrir', danger: true })) {
              await run(async () => { await api.rpc('club_reopen', { p_tournament: t.id }); await reload(); go(`#/t/${t.id}/direct`); }, 'Tournoi rouvert.');
            }
          }}><Icon name="undo" size={15} />Rouvrir le tournoi</button>
        )}
      </div>
    </div>
  );
}

interface Line { entry: Entry; position: number | null; kos: number; bounty: number }

/** Saisie ou correction à la main : tournoi joué sans l'application, arrêt anticipé, erreur. */
function ResultsEditor({ b, reload, onDone, onCancel }: TabProps & { onDone: () => void; onCancel?: () => void }) {
  const { t, entries, knockouts } = b;
  const initial = useMemo<Line[]>(() => {
    const list = entries.filter(e => e.status === 'registered');
    if (t.status === 'finished') {
      return list.map(e => ({ entry: e, position: e.final_position, kos: e.final_kos ?? 0, bounty: e.final_bounty ?? 0 }));
    }
    if (t.settings.format === 'hu') {
      const places = knownPlaces(huBoard(b));
      return list.map(e => ({ entry: e, position: places.get(e.id) ?? null, kos: 0, bounty: 0 }));
    }
    const r = replay(participants(t, entries), knockouts, t.settings);
    const known = new Map(finalRows(r, t.settings).map(x => [x.entry_id, x]));
    return list.map(e => {
      const x = known.get(e.id);
      const p = r.byId.get(e.id);
      return { entry: e, position: p?.alive && r.rankingOf(e.id).alive.length > 1 ? null : x?.position ?? null, kos: x?.kos ?? 0, bounty: x?.bounty ?? 0 };
    });
    // Saisie en cours : une mise à jour en direct ne doit pas l'écraser.
  }, [t.id, t.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const [lines, setLines] = useState(initial);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const set = (id: string, p: Partial<Line>) => setLines(l => l.map(x => x.entry.id === id ? { ...x, ...p } : x));
  // Heads-up : des ex æquo à chaque tour d'élimination, et pas de KO à saisir.
  const hu = t.settings.format === 'hu';
  const bounty = !hu && t.settings.bounty.mode !== 'none';

  const placed = lines.filter(l => l.position !== null);
  // Sit'N Go : chaque table a son classement, avec ses propres places.
  const sng = isSng(t.settings);
  const keyOf = (l: Line) => rankingKey(t.settings, l.entry);
  const keys = [...new Set(lines.map(keyOf))].sort((a, z) => (a ?? 0) - (z ?? 0));
  const issues: string[] = [];
  const firstFree = new Map<number | null, number>();
  for (const key of keys) {
    const mine = placed.filter(l => keyOf(l) === key);
    const counts = new Map<number, number>();
    mine.forEach(l => counts.set(l.position!, (counts.get(l.position!) ?? 0) + 1));
    const dup = [...counts].filter(([, n]) => n > 1).map(([p]) => f.ordinal(p));
    const missing = Array.from({ length: mine.length }, (_, i) => i + 1).filter(p => !counts.has(p));
    const where = sng && keys.length > 1 ? `${key ? `Table ${key}` : 'Sans table'}, ` : '';
    if (dup.length && !hu) issues.push(`${where}${where ? 'ex' : 'Ex'} æquo : ${dup.join(', ')}.`);
    if (missing.length && !dup.length && !hu) issues.push(`${where}${where ? 'places' : 'Places'} sans joueur : ${missing.map(f.ordinal).join(', ')}.`);
    const used = new Set(mine.map(l => l.position));
    firstFree.set(key, Array.from({ length: lines.length + 1 }, (_, i) => i + 1).find(p => !used.has(p))!);
  }
  const none = lines.filter(l => l.position === null);

  if (lines.length === 0) {
    return <Empty title="Aucun joueur inscrit">Ajoute d'abord les joueurs. <a className="btn" href={`#/t/${t.id}/joueurs`}>Joueurs</a></Empty>;
  }
  const save = async () => {
    const text = [none.length > 0 && `${f.plural(none.length, 'joueur')} sans place ne compter${none.length > 1 ? 'ont' : 'a'} pas comme participant${none.length > 1 ? 's' : ''}.`, ...issues].filter(Boolean).join(' ');
    if ((text || t.status !== 'finished') && !await confirm({ title: t.status === 'finished' ? 'Enregistrer ces résultats ?' : 'Terminer le tournoi avec ce classement ?', text: text || 'Tu pourras encore corriger ensuite.', ok: 'Enregistrer' })) return;
    const rows: ResultRow[] = placed.map(l => ({ entry_id: l.entry.id, position: l.position!, kos: l.kos, bounty: l.bounty }));
    if (await run(async () => { await api.rpc('club_finish', { p_tournament: t.id, p_results: rows }); await reload(); }, 'Résultats enregistrés.')) onDone();
  };

  return (
    <div className="stack">
      <p className="muted">{t.status === 'finished' ? 'Corrige les places, KO et primes.' : 'Saisis le classement final, par exemple pour un tournoi joué sans l\'horloge ou arrêté avant la fin.'} Une place vide : joueur absent.{sng && ' Sit\'N Go : chaque table a son propre classement.'}</p>
      <div className="card flush"><div className="scroll">
        <table className="table">
          <thead><tr>{sng && <th>Table</th>}<th>Place</th><th>Joueur</th>{!hu && <th>KO</th>}{bounty && <th>Primes</th>}</tr></thead>
          <tbody>
            {[...lines].sort((x, y) => (keyOf(x) ?? 0) - (keyOf(y) ?? 0) || (initial.find(l => l.entry.id === x.entry.id)?.position ?? 0) - (initial.find(l => l.entry.id === y.entry.id)?.position ?? 0) || x.entry.name.localeCompare(y.entry.name, 'fr')).map(l => {
              const free = firstFree.get(keyOf(l))!;
              return (
              <tr key={l.entry.id}>
                {sng && <td className="tnum">{l.entry.table_no ?? ''}</td>}
                <td><span className="row" style={{ flexWrap: 'nowrap' }}>
                  <NumberInput label={`Place de ${l.entry.name}`} value={l.position} min={1} max={999} width={72} onChange={x => set(l.entry.id, { position: x })} />
                  {l.position === null && <button className="btn sm" onClick={() => set(l.entry.id, { position: free })}>{f.ordinal(free)}</button>}
                </span></td>
                <td><b>{l.entry.name}</b></td>
                {!hu && <td><NumberInput label={`KO de ${l.entry.name}`} value={l.kos} step={0.5} max={99} width={72} onChange={x => set(l.entry.id, { kos: x ?? 0 })} /></td>}
                {bounty && <td><NumberInput label={`Primes de ${l.entry.name}`} value={l.bounty} step={0.5} width={84} onChange={x => set(l.entry.id, { bounty: x ?? 0 })} /></td>}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>
      {issues.length > 0 && <div className="card warn" style={{ padding: 12 }}>{issues.join(' ')}</div>}
      <div className="row end">
        {onCancel && <button className="btn" onClick={onCancel}>Annuler</button>}
        <button className="btn primary" disabled={busy || placed.length === 0} onClick={save}>{t.status === 'finished' ? 'Enregistrer' : 'Terminer le tournoi'}</button>
      </div>
    </div>
  );
}
