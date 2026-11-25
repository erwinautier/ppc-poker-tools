import { useState } from 'react';
import { api, useClub, useNow } from '../../lib/club';
import * as f from '../../lib/format';
import type { Level } from '../../lib/types';
import type { TabProps } from '../../pages/Tournament';
import { LevelsEditor } from '../LevelsEditor';
import { useClockCommands, viewOf } from '../clockui';
import { Empty, Icon, useAction, useConfirm } from '../ui';

export function StructureTab({ b, reload }: TabProps) {
  const { t, entries } = b;
  const { isStaff } = useClub();
  const [draft, setDraft] = useState<Level[] | null>(null);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const now = useNow(1000);
  const v = viewOf(t, now);
  const c = useClockCommands(t, v, reload);
  const live = t.status === 'running';
  const players = Math.max(2, entries.filter(e => e.status === 'registered').length || t.max_players || 16);

  if (draft) {
    return (
      <div className="card stack">
        {live && <p className="muted">L'horloge tourne : modifie plutôt les niveaux à venir.</p>}
        <LevelsEditor levels={draft} onChange={setDraft} players={players} stack={t.starting_stack} />
        <div className="row end">
          <button className="btn" onClick={() => setDraft(null)}>Annuler</button>
          <button className="btn primary" disabled={busy} onClick={async () => {
            if (await run(async () => { await api.update('club_tournaments', t.id, { levels: draft }); await reload(); }, 'Structure enregistrée.')) setDraft(null);
          }}>Enregistrer</button>
        </div>
      </div>
    );
  }

  let n = 0;
  let minutes = 0;
  const start = Date.parse(t.starts_at);
  return (
    <div className="stack">
      {isStaff && t.status !== 'finished' && <div><button className="btn" onClick={() => setDraft(t.levels)}><Icon name="edit" />Modifier la structure de ce tournoi</button></div>}
      <div className="card flush">
        {t.levels.length === 0 ? <Empty title="Aucun niveau">{isStaff && 'Génère une structure ou choisis un modèle dans « Modifier ».'}</Empty> : (
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
