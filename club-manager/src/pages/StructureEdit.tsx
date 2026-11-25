import { useState } from 'react';
import { api, useLoad } from '../lib/club';
import { DEFAULT_CHIPS, generateLevels, PRESETS } from '../lib/structure';
import { go } from '../lib/router';
import type { Structure } from '../lib/types';
import { Field, Icon, NumberInput, State, useAction, useConfirm } from '../components/ui';
import { ChipsEditor, LevelsEditor } from '../components/LevelsEditor';

type Draft = Pick<Structure, 'name' | 'description' | 'starting_stack' | 'levels' | 'chips'>;

export function StructureEdit({ id }: { id?: string }) {
  const q = useLoad(async (): Promise<Draft> => {
    if (!id) return { name: '', description: '', starting_stack: PRESETS[1].stack, levels: generateLevels(PRESETS[1].input), chips: DEFAULT_CHIPS };
    const [s] = await api.select<Structure>('club_structures', { eq: { id } });
    if (!s) throw new Error('Structure introuvable.');
    const { name, description, starting_stack, levels, chips } = s;
    return { name, description, starting_stack, levels, chips };
  }, [id]);
  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  return <Form key={id ?? 'new'} id={id} initial={q.data} />;
}

function Form({ id, initial }: { id?: string; initial: Draft }) {
  const [d, setD] = useState(initial);
  const [players, setPlayers] = useState<number | null>(20);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }));
  const save = (copy: boolean) => run(async () => {
    const row = { ...d, name: copy ? `${d.name.trim()} (copie)`.slice(0, 80) : d.name.trim() };
    if (id && !copy) await api.update('club_structures', id, row);
    else await api.insert('club_structures', row);
    go('#/structures');
  }, 'Structure enregistrée.');
  return (
    <form onSubmit={e => { e.preventDefault(); void save(false); }}>
      <a className="crumb" href="#/structures"><Icon name="back" size={15} />Structures</a>
      <div className="pagehead"><div><h1>{id ? 'Modifier la structure' : 'Nouvelle structure'}</h1></div></div>
      <div className="stack" style={{ maxWidth: 820 }}>
        <div className="card"><div className="form">
          <Field label="Nom"><input required maxLength={80} value={d.name} placeholder="Soirée de club" onChange={e => set({ name: e.target.value })} /></Field>
          <Field label="Description"><input maxLength={200} value={d.description} onChange={e => set({ description: e.target.value })} /></Field>
          <Field label="Tapis de départ"><NumberInput value={d.starting_stack} min={100} step={100} onChange={x => set({ starting_stack: x ?? 10000 })} /></Field>
          <Field label="Joueurs (pour estimer la durée)"><NumberInput value={players} min={2} max={500} onChange={setPlayers} /></Field>
        </div></div>
        <div className="card"><h2>Niveaux</h2><LevelsEditor levels={d.levels} onChange={levels => set({ levels })} players={players ?? 20} stack={d.starting_stack} /></div>
        <div className="card"><h2>Jetons</h2><ChipsEditor chips={d.chips} onChange={chips => set({ chips })} stack={d.starting_stack} /></div>
        <div className="row between">
          {id ? <button type="button" className="btn danger" disabled={busy} onClick={async () => {
            if (await confirm({ title: 'Supprimer ce modèle ?', text: 'Les tournois qui l\'utilisent gardent leur copie.', ok: 'Supprimer', danger: true })) {
              if (await run(() => api.remove('club_structures', id), 'Modèle supprimé.')) go('#/structures');
            }
          }}><Icon name="trash" size={16} />Supprimer</button> : <span />}
          <div className="row">
            <a className="btn" href="#/structures">Annuler</a>
            {id && <button type="button" className="btn" disabled={busy || !d.name.trim()} onClick={() => save(true)}>Enregistrer une copie</button>}
            <button className="btn primary" disabled={busy || !d.name.trim() || d.levels.length === 0}>Enregistrer</button>
          </div>
        </div>
      </div>
    </form>
  );
}
