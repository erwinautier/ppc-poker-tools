import { useState } from 'react';
import { api, useClub, useLoad, useNow } from '../../lib/club';
import { durationField } from '../../lib/engine';
import * as f from '../../lib/format';
import type { Tournament } from '../../lib/types';
import type { TabProps } from '../../pages/Tournament';
import { LevelsEditor } from '../LevelsEditor';
import { listModels, ModelSelect, SaveAsModel } from '../StructureModels';
import { useClockCommands, viewOf } from '../clockui';
import { Empty, Field, Icon, NumberInput, useAction, useConfirm } from '../ui';

type Draft = Pick<Tournament, 'structure_name' | 'starting_stack' | 'levels' | 'chips'>;

export function StructureTab({ b, reload }: TabProps) {
  const { t, entries } = b;
  const { isStaff } = useClub();
  const [draft, setDraft] = useState<Draft | null>(null);
  const confirm = useConfirm();
  const now = useNow(1000);
  const v = viewOf(t, now);
  const c = useClockCommands(t, v, reload);
  const live = t.status === 'running';
  const players = durationField(t, Math.max(2, entries.filter(e => e.status === 'registered').length || t.max_players || 16));

  if (draft) return <Editor t={t} initial={draft} players={players} live={live} reload={reload} onClose={() => setDraft(null)} />;

  let n = 0;
  let minutes = 0;
  const start = Date.parse(t.starts_at);
  const open = t.status !== 'finished' && t.status !== 'cancelled';
  return (
    <div className="stack">
      {isStaff && (
        <div className="row">
          {t.status !== 'finished' && <button className="btn" onClick={() => setDraft({ structure_name: t.structure_name, starting_stack: t.starting_stack, levels: t.levels, chips: t.chips })}><Icon name="edit" />Modifier la structure de ce tournoi</button>}
          {t.levels.length > 0 && <SaveAsModel structure={t} suggested={t.structure_name || t.name} onSaved={async m => {
            // Le tournoi suit désormais ce modèle (fiche Infos, choix du modèle dans « Modifier »).
            if (open && t.structure_name !== m.name) { await api.update('club_tournaments', t.id, { structure_name: m.name }); await reload(); }
          }} />}
        </div>
      )}
      <div className="card flush">
        {t.levels.length === 0 ? <Empty title="Aucun niveau">{isStaff && 'Choisis un modèle ou crée les niveaux dans « Modifier la structure ».'}</Empty> : (
          <div className="scroll">
            <table className="table">
              <thead><tr><th className="mid">Niveau</th><th>Blindes</th><th className="num">Ante</th><th className="num">Durée</th>{!live && <th className="num">Horaire</th>}{isStaff && live && <th />}</tr></thead>
              <tbody>
                {t.levels.map((l, i) => {
                  if (l.kind === 'level') n++;
                  const at = new Date(start + minutes * 60_000).toISOString();
                  minutes += l.minutes;
                  const cls = [l.kind === 'break' && 'break', live && i === v.index && 'current', live && i < v.index && 'past'].filter(Boolean).join(' ');
                  return (
                    <tr key={i} className={cls}>
                      <td className="mid"><b>{l.kind === 'level' ? n : ''}</b></td>
                      <td><b>{f.blinds(l)}</b></td>
                      <td className="num">{l.ante > 0 ? f.num(l.ante) : ''}</td>
                      <td className="num">{l.minutes} min</td>
                      {!live && <td className="num">{f.time(at)}</td>}
                      {isStaff && live && <td className="num">{i !== v.index && <button className="btn sm" disabled={c.busy} onClick={async () => {
                        if (await confirm({ title: `Passer à ${l.kind === 'break' ? 'cette pause' : f.blinds(l)} ?`, text: 'L\'horloge repart au début de ce niveau.', ok: 'Y aller' })) c.jump(i);
                      }}>Y aller</button>}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Editor({ t, initial, players, live, reload, onClose }: { t: Tournament; initial: Draft; players: number; live: boolean; reload: () => Promise<void>; onClose: () => void }) {
  const [d, setD] = useState(initial);
  const [run, busy] = useAction();
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }));
  // Changer de modèle en cours de partie fausserait l'horloge : seulement avant le début.
  const models = useLoad(() => live ? Promise.resolve([]) : listModels(), [live]);
  return (
    <div className="card stack">
      {live ? <p className="muted">L'horloge tourne : modifie plutôt les niveaux à venir.</p> : (
        <div className="form">
          <Field label="Partir d'un modèle" hint={models.error ?? 'Remplace les niveaux, les jetons et le tapis de départ.'}>
            <ModelSelect models={models.data ?? []} current={d.structure_name} onPick={m => set({ structure_name: m.name, starting_stack: m.starting_stack, levels: m.levels, chips: m.chips })} />
          </Field>
          <Field label="Tapis de départ"><NumberInput value={d.starting_stack} min={100} step={100} onChange={x => set({ starting_stack: x ?? 10000 })} /></Field>
        </div>
      )}
      <LevelsEditor levels={d.levels} onChange={levels => set({ levels })} players={players} stack={d.starting_stack} />
      <div className="row between">
        <SaveAsModel structure={d} suggested={d.structure_name || t.name} onSaved={m => set({ structure_name: m.name })} />
        <div className="row">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={busy} onClick={async () => {
            if (await run(async () => { await api.update('club_tournaments', t.id, live ? { levels: d.levels } : d); await reload(); }, 'Structure enregistrée.')) onClose();
          }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
