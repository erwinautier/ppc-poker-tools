import { useState } from 'react';
import { api, fixChampionship, useLoad } from '../lib/club';
import { placePoints } from '../lib/scoring';
import * as f from '../lib/format';
import { go } from '../lib/router';
import { DEFAULT_SCORING, type Championship, type Scoring } from '../lib/types';
import { Choice, Field, Icon, NumberInput, State, Switch, useAction, useConfirm } from '../components/ui';
import { VisibilityChoice } from './TournamentEdit';

type Draft = Pick<Championship, 'name' | 'season' | 'description' | 'status' | 'visibility' | 'scoring'>;

function currentSeason(): string {
  const d = new Date();
  const y = d.getFullYear() - (d.getMonth() < 7 ? 1 : 0);
  return `${y}-${y + 1}`;
}

export function ChampionshipEdit({ id }: { id?: string }) {
  const q = useLoad(async () => {
    if (!id) return { name: '', season: currentSeason(), description: '', status: 'active', visibility: 'members', scoring: DEFAULT_SCORING } as Draft;
    const [c] = await api.select<Championship>('club_championships', { eq: { id } });
    if (!c) throw new Error('Championnat introuvable.');
    const { name, season, description, status, visibility, scoring } = fixChampionship(c);
    return { name, season, description, status, visibility, scoring } as Draft;
  }, [id]);
  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  return <Form key={id ?? 'new'} id={id} initial={q.data} />;
}

function Form({ id, initial }: { id?: string; initial: Draft }) {
  const [d, setD] = useState(initial);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }));
  const s = d.scoring;
  const setS = (p: Partial<Scoring>) => setD(x => ({ ...x, scoring: { ...x.scoring, ...p } }));

  const save = () => run(async () => {
    const row = { ...d, name: d.name.trim(), scoring: { ...s, brackets: [...s.brackets].sort((a, b) => a.minPlayers - b.minPlayers) } };
    if (id) { await api.update('club_championships', id, row); go(`#/c/${id}`); }
    else { const [c] = await api.insert<Championship>('club_championships', row); go(`#/c/${c.id}`); }
  }, 'Championnat enregistré.');

  return (
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <a className="crumb" href={id ? `#/c/${id}` : '#/championnats'}><Icon name="back" size={15} />{id ? 'Championnat' : 'Championnats'}</a>
      <div className="pagehead"><div><h1>{id ? 'Modifier le championnat' : 'Nouveau championnat'}</h1></div></div>
      <div className="stack" style={{ maxWidth: 820 }}>
        <div className="card">
          <div className="form">
            <Field label="Nom"><input required maxLength={80} value={d.name} placeholder="Championnat du club" onChange={e => set({ name: e.target.value })} /></Field>
            <Field label="Saison"><input maxLength={40} value={d.season} onChange={e => set({ season: e.target.value })} /></Field>
            <Field label="Présentation" wide><textarea maxLength={1000} value={d.description} onChange={e => set({ description: e.target.value })} /></Field>
          </div>
          <div style={{ marginTop: 14 }}><VisibilityChoice value={d.visibility} onChange={visibility => set({ visibility })} /></div>
          <p className="muted" style={{ marginTop: 8 }}>Chaque nouvelle manche reprend ce réglage ; tu peux le changer manche par manche.</p>
        </div>

        <div className="card stack">
          <h2 style={{ marginBottom: 0 }}>Points de place</h2>
          <Choice label="Calcul des points" value={s.method} onChange={method => setS({ method })} options={[
            { value: 'table', label: 'Tableau', hint: 'Tu fixes les points de chaque place' },
            { value: 'linear', label: 'Par joueur battu', hint: '(joueurs − place + 1) × coefficient' },
            { value: 'sqrt', label: 'Selon l\'affluence', hint: 'coefficient × √(joueurs ÷ place)' },
          ]} />
          {s.method !== 'table' && <Field label="Coefficient"><NumberInput value={s.factor} min={0.1} max={1000} step={0.1} width={140} onChange={x => setS({ factor: x ?? 1 })} /></Field>}
          {s.method === 'table' && <Brackets s={s} setS={setS} />}
          <Preview s={s} />
        </div>

        <div className="card stack">
          <h2 style={{ marginBottom: 0 }}>Bonus et décompte</h2>
          <div className="form three">
            <Field label="Points de participation"><NumberInput value={s.participation} step={0.5} max={1000} onChange={x => setS({ participation: x ?? 0 })} /></Field>
            <Field label="Points par KO"><NumberInput value={s.koPoints} step={0.5} max={1000} onChange={x => setS({ koPoints: x ?? 0 })} /></Field>
            <Field label="Résultats retenus" hint="Vide : tous les résultats comptent"><NumberInput value={s.bestOf} min={1} max={100} placeholder="Tous" onChange={x => setS({ bestOf: x })} /></Field>
          </div>
          <Switch label="Classer aussi les invités" hint="Sinon, ils comptent dans le nombre de joueurs sans figurer au classement" checked={s.rankGuests} onChange={rankGuests => setS({ rankGuests })} />
        </div>

        {id && <div className="card"><Switch label="Championnat archivé" hint="Il reste consultable, mais quitte l'accueil et la création de manches" checked={d.status === 'archived'} onChange={v => set({ status: v ? 'archived' : 'active' })} /></div>}

        <div className="row between">
          {id ? <button type="button" className="btn danger" disabled={busy} onClick={async () => {
            if (await confirm({ title: 'Supprimer ce championnat ?', text: 'Les manches et leurs résultats sont conservés, hors championnat. Le classement et le barème sont perdus.', ok: 'Supprimer', danger: true })) {
              if (await run(() => api.remove('club_championships', id), 'Championnat supprimé.')) go('#/championnats');
            }
          }}><Icon name="trash" size={16} />Supprimer</button> : <span />}
          <div className="row">
            <a className="btn" href={id ? `#/c/${id}` : '#/championnats'}>Annuler</a>
            <button className="btn primary" disabled={busy || !d.name.trim()}>Enregistrer</button>
          </div>
        </div>
        {id && <p className="muted">Changer le barème recalcule tout le championnat, manches déjà jouées comprises.</p>}
      </div>
    </form>
  );
}

function Brackets({ s, setS }: { s: Scoring; setS: (p: Partial<Scoring>) => void }) {
  const set = (i: number, p: Partial<Scoring['brackets'][number]>) => setS({ brackets: s.brackets.map((b, j) => j === i ? { ...b, ...p } : b) });
  return (
    <div className="stack" style={{ gap: 12 }}>
      {s.brackets.map((b, i) => (
        <div key={i} className="card" style={{ background: 'var(--bg)' }}>
          <div className="row" style={{ marginBottom: 10 }}>
            {i === 0 && s.brackets.length === 1 ? <b>Barème unique</b> : (
              <><span>À partir de</span><NumberInput label="Nombre de joueurs minimum" value={b.minPlayers} max={999} width={76} onChange={x => set(i, { minPlayers: x ?? 0 })} /><span>joueurs</span></>
            )}
            <span className="spacer" />
            {s.brackets.length > 1 && <button type="button" className="iconbtn danger" aria-label="Retirer ce barème" onClick={() => setS({ brackets: s.brackets.filter((_, j) => j !== i) })}><Icon name="trash" size={15} /></button>}
          </div>
          <PointsField points={b.points} onChange={points => set(i, { points })} />
        </div>
      ))}
      <div><button type="button" className="btn sm" onClick={() => setS({ brackets: [...s.brackets, { minPlayers: (s.brackets.at(-1)?.minPlayers ?? 0) + 10, points: s.brackets.at(-1)?.points ?? [] }] })}><Icon name="plus" size={15} />Barème pour plus de joueurs</button></div>
    </div>
  );
}

/** Saisie rapide : « 100 75 55 40 », du premier au dernier payé. */
function PointsField({ points, onChange }: { points: number[]; onChange: (p: number[]) => void }) {
  const [text, setText] = useState(points.join('  '));
  return (
    <Field label="Points, du 1er au dernier classé payant" hint="Sépare les valeurs par des espaces. Les places suivantes ne marquent que les points de participation.">
      <input value={text} onChange={e => {
        setText(e.target.value);
        onChange(e.target.value.split(/[\s;]+/).filter(Boolean).map(x => Number(x.replace(',', '.'))).filter(x => Number.isFinite(x) && x >= 0));
      }} inputMode="decimal" />
    </Field>
  );
}

function Preview({ s }: { s: Scoring }) {
  const [n, setN] = useState<number | null>(20);
  const players = n ?? 20;
  return (
    <div className="muted">
      <div className="row"><span>Exemple à</span><NumberInput label="Joueurs de l'exemple" value={n} min={2} max={200} width={70} onChange={setN} /><span>joueurs :</span></div>
      <p className="tnum" style={{ marginTop: 6 }}>{Array.from({ length: Math.min(10, players) }, (_, i) => `${f.ordinal(i + 1)} ${f.num(placePoints(s, i + 1, players))}`).join(' · ')}</p>
    </div>
  );
}
