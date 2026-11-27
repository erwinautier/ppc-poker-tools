import { useState } from 'react';
import { api, useLoad } from '../lib/club';
import { estimateMinutes, generateLevels, PRESETS, DEFAULT_CHIPS } from '../lib/structure';
import * as f from '../lib/format';
import type { Structure } from '../lib/types';
import { listModels, ModelDialog } from '../components/StructureModels';
import { Empty, Icon, State, useAction, useConfirm } from '../components/ui';

export function Structures() {
  const q = useLoad(listModels, []);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const [renaming, setRenaming] = useState<Structure | null>(null);
  const addPresets = () => run(async () => {
    await api.insert('club_structures', PRESETS.map(p => ({ name: p.name, description: p.description, starting_stack: p.stack, levels: generateLevels(p.input), chips: DEFAULT_CHIPS })));
    await q.reload();
  }, 'Trois modèles ajoutés.');
  const remove = async (s: Structure) => {
    if (!await confirm({ title: `Supprimer le modèle « ${s.name} » ?`, text: 'Les manches et tournois qui en sont partis gardent leur structure.', ok: 'Supprimer', danger: true })) return;
    await run(async () => { await api.remove('club_structures', s.id); await q.reload(); }, 'Modèle supprimé.');
  };
  return (
    <>
      <div className="pagehead">
        <div><h1>Structures</h1><p>Des modèles réutilisables. Chaque tournoi en garde sa propre copie. Pour en ajouter un depuis une manche : onglet Structure, « Enregistrer comme modèle ».</p></div>
        <a className="btn primary" href="#/structures/nouveau"><Icon name="plus" />Nouvelle structure</a>
      </div>
      {!q.data ? <State loading={q.loading} error={q.error} onRetry={q.reload} /> : q.data.length === 0 ? (
        <div className="card"><Empty title="Aucun modèle enregistré">
          Pars de trois modèles prêts à jouer (Turbo, Soirée de club, Deep stack), crée le tien, ou enregistre la structure d'une manche.
          <div className="row"><button className="btn primary" disabled={busy} onClick={addPresets}>Ajouter les trois modèles</button><a className="btn" href="#/structures/nouveau">Créer une structure</a></div>
        </Empty></div>
      ) : (
        <div className="card" style={{ paddingBlock: 4 }}>
          <div className="plist">
            {q.data.map(s => {
              const est = estimateMinutes(s.levels, 20, s.starting_stack);
              return (
                <div className="prow" key={s.id} style={{ paddingBlock: 14 }}>
                  <span className="pname"><a href={`#/structures/${s.id}`}>{s.name}</a>
                    <small>{[`${f.num(s.starting_stack)} jetons`, f.plural(s.levels.filter(l => l.kind === 'level').length, 'niveau', 'niveaux'), est && `environ ${f.duration(est)} à 20 joueurs`].filter(Boolean).join(' · ')}</small>
                    {s.description && <small>{s.description}</small>}</span>
                  <span className="acts">
                    <button className="btn sm" disabled={busy} onClick={() => setRenaming(s)}>Renommer</button>
                    <a className="btn sm" href={`#/structures/${s.id}`}><Icon name="edit" size={15} />Modifier</a>
                    <button className="iconbtn danger" disabled={busy} onClick={() => remove(s)} aria-label={`Supprimer le modèle ${s.name}`} title="Supprimer"><Icon name="trash" size={16} /></button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {renaming && (
        <ModelDialog title="Renommer le modèle" ok="Renommer" replace={false} initial={renaming}
          others={q.data?.filter(s => s.id !== renaming.id) ?? null}
          onClose={() => setRenaming(null)}
          onSubmit={(name, description) => run(async () => {
            await api.update('club_structures', renaming.id, { name, description });
            await q.reload();
          }, 'Modèle renommé.')} />
      )}
    </>
  );
}
