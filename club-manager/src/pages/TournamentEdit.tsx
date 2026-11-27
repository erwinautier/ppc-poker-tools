import { useEffect, useState } from 'react';
import { api, fixTournament, listChampionships, useLoad } from '../lib/club';
import { estimateMinutes } from '../lib/structure';
import { DEFAULT_SETTINGS, type Championship, type Settings, type Structure, type Tournament, type Visibility } from '../lib/types';
import * as f from '../lib/format';
import { go, useRoute } from '../lib/router';
import { Choice, Field, Icon, NumberInput, State, Switch, useAction } from '../components/ui';
import { ChipsEditor, LevelsEditor } from '../components/LevelsEditor';
import { listModels, ModelSelect, SaveAsModel } from '../components/StructureModels';

type Draft = Pick<Tournament, 'championship_id' | 'name' | 'description' | 'venue' | 'starts_at' | 'visibility' | 'max_players' | 'seats_per_table' | 'starting_stack' | 'structure_name' | 'levels' | 'chips' | 'settings'>;

const FIELDS = ['championship_id', 'name', 'description', 'venue', 'starts_at', 'visibility', 'max_players', 'seats_per_table', 'starting_stack', 'structure_name', 'levels', 'chips', 'settings'] as const;
const pickDraft = (t: Tournament): Draft => Object.fromEntries(FIELDS.map(k => [k, t[k]])) as unknown as Draft;

function defaultDate(): string {
  const d = new Date(Date.now() + 7 * 86_400_000);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}

export function TournamentEdit({ id }: { id?: string }) {
  const route = useRoute();
  const copyOf = route.query.get('copie');
  const champParam = route.query.get('championnat');
  const q = useLoad(async () => {
    const [structures, championships, source] = await Promise.all([
      listModels(),
      listChampionships(),
      id || copyOf ? api.select<Tournament>('club_tournaments', { eq: { id: (id ?? copyOf)! } }) : Promise.resolve([]),
    ]);
    return { structures, championships, source: source[0] ? fixTournament(source[0]) : null };
  }, [id, copyOf]);

  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  const { structures, championships, source } = q.data;
  let initial: Draft;
  if (source) {
    initial = pickDraft(source);
    if (!id) initial = { ...initial, starts_at: defaultDate(), name: nextName(source.name) };
  } else {
    const c = championships.find(x => x.id === champParam) ?? championships.find(x => x.status === 'active');
    const s = structures.find(x => /soir/i.test(x.name)) ?? structures[0];
    initial = {
      championship_id: c?.id ?? null, name: '', description: '', venue: '', starts_at: defaultDate(), visibility: c?.visibility ?? 'members',
      max_players: null, seats_per_table: 8, starting_stack: s?.starting_stack ?? 20000, structure_name: s?.name ?? '', levels: s?.levels ?? [], chips: s?.chips ?? [],
      settings: DEFAULT_SETTINGS,
    };
  }
  return <Form key={id ?? copyOf ?? 'new'} id={id} initial={initial} structures={structures} championships={championships} started={!!id && !!source && ['running', 'finished'].includes(source.status)} />;
}

/** « Manche 4 » devient « Manche 5 ». */
export function nextName(name: string): string {
  const m = name.match(/^(.*?)(\d+)(\D*)$/);
  return m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : `${name} (copie)`;
}

function Form({ id, initial, structures, championships, started }: { id?: string; initial: Draft; structures: Structure[]; championships: Championship[]; started: boolean }) {
  const [d, setD] = useState(initial);
  const [models, setModels] = useState(structures);
  const [publish, setPublish] = useState(true);
  const [showLevels, setShowLevels] = useState(false);
  const [run, busy] = useAction();
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }));
  const s = d.settings;
  const setS = (p: Partial<Settings>) => setD(x => ({ ...x, settings: { ...x.settings, ...p } }));
  const champ = championships.find(c => c.id === d.championship_id);
  const est = estimateMinutes(d.levels, d.max_players ?? 20, d.starting_stack);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (d !== initial) setDirty(true); }, [d, initial]);
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  const choose = (st: Structure) => set({ structure_name: st.name, levels: st.levels, chips: st.chips, starting_stack: st.starting_stack });
  const saved = (m: Structure) => {
    setModels(l => [...l.filter(x => x.id !== m.id), m].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    set({ structure_name: m.name });
  };

  const save = () => run(async () => {
    const row = { ...d, name: d.name.trim() };
    if (id) {
      await api.update('club_tournaments', id, row);
      go(`#/t/${id}`);
    } else {
      const [t] = await api.insert<Tournament>('club_tournaments', { ...row, status: publish ? 'open' : 'draft' });
      go(`#/t/${t.id}`);
    }
  }, id ? 'Modifications enregistrées.' : publish ? 'Tournoi publié, inscriptions ouvertes.' : 'Brouillon enregistré.');

  return (
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <a className="crumb" href={id ? `#/t/${id}` : '#/tournois'}><Icon name="back" size={15} />{id ? 'Tournoi' : 'Tournois'}</a>
      <div className="pagehead"><div><h1>{id ? 'Modifier le tournoi' : 'Nouveau tournoi'}</h1></div></div>
      <div className="stack" style={{ maxWidth: 820 }}>
        <div className="card">
          <h2>La soirée</h2>
          <div className="form">
            <Field label="Nom" wide><input required maxLength={80} value={d.name} placeholder="Manche 1" onChange={e => set({ name: e.target.value })} /></Field>
            <Field label="Date et heure"><input type="datetime-local" required value={f.toLocalInput(d.starts_at)} onChange={e => { if (e.target.value) set({ starts_at: new Date(e.target.value).toISOString() }); }} /></Field>
            <Field label="Lieu"><input value={d.venue} maxLength={120} placeholder="Salle des associations" onChange={e => set({ venue: e.target.value })} /></Field>
            <Field label="Championnat">
              <select value={d.championship_id ?? ''} onChange={e => { const c = championships.find(x => x.id === e.target.value); set({ championship_id: c?.id ?? null, ...(c ? { visibility: c.visibility } : {}) }); }}>
                <option value="">Hors championnat</option>
                {championships.filter(c => c.status === 'active' || c.id === d.championship_id).map(c => <option key={c.id} value={c.id}>{c.name}{c.season && ` (${c.season})`}</option>)}
              </select>
            </Field>
            {champ && <Field label="Coefficient" hint="Multiplie les points de place (1,5 pour une finale)"><NumberInput value={s.coefficient} min={0.1} max={10} step={0.1} onChange={x => setS({ coefficient: x ?? 1 })} /></Field>}
            <Field label="Infos pour les joueurs" wide><textarea value={d.description} maxLength={2000} onChange={e => set({ description: e.target.value })} /></Field>
          </div>
        </div>

        <div className="card">
          <h2>Inscriptions</h2>
          <div className="form three">
            <Field label="Places" hint="Vide : sans limite. Au-delà, liste d'attente."><NumberInput value={d.max_players} min={2} max={1000} onChange={x => set({ max_players: x })} placeholder="Sans limite" /></Field>
            <Field label="Joueurs par table"><NumberInput value={d.seats_per_table} min={2} max={10} onChange={x => set({ seats_per_table: x ?? 8 })} /></Field>
            <Field label="Arrivée tardive jusqu'au niveau" hint="0 : pas d'arrivée tardive"><NumberInput value={s.lateRegLevel} max={30} onChange={x => setS({ lateRegLevel: x ?? 0 })} /></Field>
          </div>
          <div style={{ marginTop: 14 }}><VisibilityChoice value={d.visibility} onChange={visibility => set({ visibility })} /></div>
        </div>

        <div className="card">
          <h2>Structure</h2>
          <div className="form">
            <Field label="Partir d'un modèle"><ModelSelect models={models} current={d.structure_name} onPick={choose} /></Field>
            <Field label="Tapis de départ"><NumberInput value={d.starting_stack} min={100} step={100} onChange={x => set({ starting_stack: x ?? 10000 })} /></Field>
          </div>
          {started && <p className="muted" style={{ marginTop: 10 }}>Ce tournoi a déjà commencé : change plutôt les niveaux à venir.</p>}
          <div className="row between" style={{ marginTop: 14 }}>
            <span className="muted">{d.levels.length === 0 ? 'Aucun niveau.' : `${f.plural(d.levels.filter(l => l.kind === 'level').length, 'niveau', 'niveaux')}${est ? `, fin probable après ${f.duration(est)} à ${d.max_players ?? 20} joueurs` : ''}.`}</span>
            <div className="row">
              {d.levels.length > 0 && <SaveAsModel small structure={d} suggested={d.structure_name || d.name} onSaved={saved} />}
              <button type="button" className="btn sm" onClick={() => setShowLevels(!showLevels)}>{showLevels ? 'Masquer' : 'Voir et modifier les niveaux'}</button>
            </div>
          </div>
          {(showLevels || d.levels.length === 0) && (
            <div className="stack" style={{ marginTop: 14 }}>
              <LevelsEditor levels={d.levels} onChange={levels => set({ levels })} players={d.max_players ?? 20} stack={d.starting_stack} />
              <div><h2 style={{ fontSize: '.92rem', marginBottom: 10 }}>Jetons</h2><ChipsEditor chips={d.chips} onChange={chips => set({ chips })} stack={d.starting_stack} /></div>
            </div>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ marginBottom: 0 }}>Recaves et add-on</h2>
          <Switch label="Recaves" hint="Un joueur éliminé peut reprendre un tapis" checked={s.rebuy.enabled} onChange={enabled => setS({ rebuy: { ...s.rebuy, enabled } })} />
          {s.rebuy.enabled && (
            <div className="form four">
              <Field label="Jetons" hint="Vide : tapis de départ"><NumberInput value={s.rebuy.stack || null} step={100} onChange={x => setS({ rebuy: { ...s.rebuy, stack: x ?? 0 } })} placeholder={String(d.starting_stack)} /></Field>
              <Field label="Par joueur" hint="0 : illimité"><NumberInput value={s.rebuy.max} max={50} onChange={x => setS({ rebuy: { ...s.rebuy, max: x ?? 0 } })} /></Field>
              <Field label="Jusqu'au niveau"><NumberInput value={s.rebuy.untilLevel} min={1} max={30} onChange={x => setS({ rebuy: { ...s.rebuy, untilLevel: x ?? 1 } })} /></Field>
              <Field label="Prix (€)"><NumberInput value={s.rebuy.price} step={0.5} onChange={x => setS({ rebuy: { ...s.rebuy, price: x ?? 0 } })} /></Field>
            </div>
          )}
          <Switch label="Add-on" hint="Un complément de jetons, en général à la première pause" checked={s.addon.enabled} onChange={enabled => setS({ addon: { ...s.addon, enabled } })} />
          {s.addon.enabled && (
            <div className="form four">
              <Field label="Jetons"><NumberInput value={s.addon.stack} step={100} onChange={x => setS({ addon: { ...s.addon, stack: x ?? 0 } })} /></Field>
              <Field label="Prix (€)"><NumberInput value={s.addon.price} step={0.5} onChange={x => setS({ addon: { ...s.addon, price: x ?? 0 } })} /></Field>
            </div>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ marginBottom: 0 }}>Primes (bounties)</h2>
          <Choice label="Primes" value={s.bounty.mode} onChange={mode => setS({ bounty: {
            mode,
            unit: mode === 'progressive' && s.bounty.unit === 'lot' ? 'pts' : s.bounty.unit,
            // Première activation : une valeur de départ, pour ne pas créer des primes à zéro sans le voir.
            amount: s.bounty.mode === 'none' && s.bounty.amount === 0 ? 5 : s.bounty.amount,
          } })} options={[
            { value: 'none', label: 'Sans prime', hint: 'Les KO restent comptés' },
            { value: 'fixed', label: 'Fixes', hint: 'Même prime sur chaque tête' },
            { value: 'progressive', label: 'Progressives', hint: 'Moitié gagnée, moitié ajoutée à la tête du tombeur' },
          ]} />
          {s.bounty.mode !== 'none' && (
            <div className="form">
              <Field label="Valeur par joueur" hint="0 avec des primes spéciales sur certains joueurs (onglet Joueurs)"><NumberInput value={s.bounty.amount} step={0.5} onChange={x => setS({ bounty: { ...s.bounty, amount: x ?? 0 } })} /></Field>
              <Field label="En">
                <select value={s.bounty.unit} onChange={e => setS({ bounty: { ...s.bounty, unit: e.target.value as Settings['bounty']['unit'] } })}>
                  <option value="pts">points de championnat</option>
                  <option value="eur">euros</option>
                  {s.bounty.mode === 'fixed' && <option value="lot">lots</option>}
                </select>
              </Field>
            </div>
          )}
        </div>

        <div className="card stack">
          <h2 style={{ marginBottom: 0 }}>Participation et dotation</h2>
          <div className="form">
            <Field label="Participation redistribuée (€)" hint="0 pour un tournoi gratuit"><NumberInput value={s.buyIn} step={0.5} onChange={x => setS({ buyIn: x ?? 0 })} /></Field>
            <Field label="Frais d'organisation (€)"><NumberInput value={s.fee} step={0.5} onChange={x => setS({ fee: x ?? 0 })} /></Field>
          </div>
          <Choice label="Dotation" value={s.payouts.mode} onChange={mode => setS({ payouts: { ...s.payouts, mode } })} options={[
            { value: 'none', label: 'Aucune' },
            { value: 'lots', label: 'Lots', hint: 'Un libellé par place' },
            { value: 'auto', label: 'Cagnotte, automatique', hint: 'Environ 15 % de places payées' },
            { value: 'percent', label: 'Cagnotte, au choix', hint: 'Pourcentage par place' },
          ]} />
          {s.payouts.mode === 'lots' && <PlaceList values={s.payouts.lots} empty="" onChange={lots => setS({ payouts: { ...s.payouts, lots } })}
            render={(x, on, i) => <input value={x} maxLength={80} placeholder={i === 0 ? 'Trophée' : 'Lot'} aria-label={`Lot de la place ${i + 1}`} onChange={e => on(e.target.value)} />} />}
          {s.payouts.mode === 'percent' && (
            <>
              <PlaceList values={s.payouts.percents} empty={10} onChange={percents => setS({ payouts: { ...s.payouts, percents } })}
                render={(x, on, i) => <NumberInput label={`Pourcentage de la place ${i + 1}`} value={x} max={100} step={0.5} onChange={y => on(y ?? 0)} />} />
              <p className="muted">Total : {f.num(s.payouts.percents.reduce((a, b) => a + b, 0))} %. La répartition est ramenée à 100 %.</p>
            </>
          )}
          {(s.payouts.mode === 'auto' || s.payouts.mode === 'percent') && (
            <Field label="Arrondi des montants"><select style={{ maxWidth: 200 }} value={s.payouts.rounding} onChange={e => setS({ payouts: { ...s.payouts, rounding: Number(e.target.value) } })}>
              <option value={0.01}>au centime</option><option value={1}>à 1 €</option><option value={5}>à 5 €</option><option value={10}>à 10 €</option>
            </select></Field>
          )}
        </div>

        {!id && <div className="card"><Switch label="Ouvrir les inscriptions tout de suite" hint="Sinon, le tournoi reste un brouillon visible des seuls gestionnaires" checked={publish} onChange={setPublish} /></div>}
        <div className="row end">
          <a className="btn" href={id ? `#/t/${id}` : '#/tournois'}>Annuler</a>
          <button className="btn primary" disabled={busy || !d.name.trim()}>{id ? 'Enregistrer' : publish ? 'Créer et publier' : 'Créer le brouillon'}</button>
        </div>
      </div>
    </form>
  );
}

function PlaceList<T>({ values, empty, onChange, render }: { values: T[]; empty: T; onChange: (v: T[]) => void; render: (v: T, on: (v: T) => void, i: number) => React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {values.map((x, i) => (
        <div className="row" key={i} style={{ flexWrap: 'nowrap' }}>
          <b style={{ width: 38, flex: 'none' }}>{f.ordinal(i + 1)}</b>
          {render(x, v => onChange(values.map((y, j) => j === i ? v : y)), i)}
          <button type="button" className="iconbtn danger" onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={`Retirer la place ${i + 1}`}><Icon name="trash" size={15} /></button>
        </div>
      ))}
      <div><button type="button" className="btn sm" onClick={() => onChange([...values, empty])}><Icon name="plus" size={15} />Place</button></div>
    </div>
  );
}

export function VisibilityChoice({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <Choice label="Visibilité" value={value} onChange={onChange} options={[
      { value: 'members', label: 'Adhérents', hint: 'Visible une fois connecté, compte rattaché au club' },
      { value: 'public', label: 'Public', hint: 'Visible par tous, noms des joueurs compris' },
    ]} />
  );
}
