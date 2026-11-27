/**
 * Modèles de structure (table club_structures) : enregistrer celle d'un tournoi, en choisir un,
 * le renommer. Un tournoi garde toujours sa propre copie des niveaux.
 */
import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api, useLoad } from '../lib/club';
import { totalMinutes } from '../lib/structure';
import * as f from '../lib/format';
import type { Structure } from '../lib/types';
import { Field, Icon, Modal, useAction, useToast } from './ui';

/** Ce qu'un modèle copie dans un tournoi, et inversement. */
export type StructureData = Pick<Structure, 'starting_stack' | 'levels' | 'chips'>;

export const listModels = () => api.select<Structure>('club_structures', { order: ['name', 'asc'] });

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
const sameName = (a: string, b: string) => norm(a) === norm(b);

/** « 12 niveaux, 2 pauses, tapis de 20 000, 3 h 45 au total ». */
function summary(s: StructureData): string {
  const levels = s.levels.filter(l => l.kind === 'level').length;
  const breaks = s.levels.length - levels;
  return [
    f.plural(levels, 'niveau', 'niveaux'),
    breaks > 0 && f.plural(breaks, 'pause'),
    `tapis de ${f.num(s.starting_stack)}`,
    `${f.duration(totalMinutes(s.levels))} au total`,
  ].filter(Boolean).join(', ');
}

/** Liste déroulante « Partir d'un modèle ». */
export function ModelSelect({ models, current, onPick }: { models: Structure[]; current: string; onPick: (m: Structure) => void }) {
  return (
    <select value={models.find(m => m.name === current)?.id ?? ''} onChange={e => { const m = models.find(x => x.id === e.target.value); if (m) onPick(m); }}>
      <option value="">{models.length ? 'Structure propre à ce tournoi' : 'Aucun modèle enregistré'}</option>
      {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}

/** Fenêtre « nom et description ». Hors de la page : elle s'ouvre aussi dans le formulaire d'un tournoi. */
export function ModelDialog({ title, ok, initial, others, replace, children, onSubmit, onClose }: {
  title: string; ok: string; initial: { name: string; description: string };
  /** Les autres modèles, pour repérer un nom déjà pris. */
  others: Structure[] | null;
  /** Nom déjà pris : on remplace ce modèle (sinon, le nom est refusé). */
  replace: boolean;
  children?: ReactNode;
  onSubmit: (name: string, description: string, twin: Structure | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial.name);
  // Tant qu'on n'y touche pas, la description est celle du modèle remplacé : rien ne disparaît sans être vu.
  const [typed, setDescription] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const twin = others?.find(m => sameName(m.name, name)) ?? null;
  const description = typed ?? (replace && twin ? twin.description : initial.description);
  const blocked = !name.trim() || !others || (!!twin && !replace);
  const submit = async () => {
    if (blocked || busy) return;
    setBusy(true);
    try { if (await onSubmit(name.trim().replace(/\s+/g, ' '), description.trim(), twin)) onClose(); } finally { setBusy(false); }
  };
  return createPortal(
    <Modal title={title} onClose={onClose} small>
      {/* La fenêtre peut s'ouvrir dans un autre formulaire : l'envoi ne doit pas remonter jusqu'à lui. */}
      <form className="stack" onSubmit={e => { e.preventDefault(); e.stopPropagation(); void submit(); }}>
        {children}
        <Field label="Nom du modèle" hint={twin && (replace
          ? `Le modèle « ${twin.name} » existe déjà : il sera remplacé par cette structure.`
          : `Le modèle « ${twin.name} » porte déjà ce nom.`)}>
          <input required autoFocus maxLength={80} value={name} placeholder="Soirée de club" onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Description" hint="Facultative, visible dans la liste des modèles.">
          <input maxLength={200} value={description} onChange={e => setDescription(e.target.value)} />
        </Field>
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={blocked || busy}>{twin && replace ? 'Remplacer le modèle' : ok}</button>
        </div>
      </form>
    </Modal>,
    document.body,
  );
}

/** Bouton « Enregistrer comme modèle » : demande un nom, puis crée le modèle ou remplace celui du même nom. */
export function SaveAsModel({ structure, suggested, onSaved, small }: {
  structure: StructureData;
  /** Nom proposé : celui de la structure du tournoi, à défaut celui du tournoi. */
  suggested: string;
  onSaved?: (m: Structure) => void | Promise<void>;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`btn ${small ? 'sm' : ''}`} disabled={structure.levels.length === 0} onClick={() => setOpen(true)}><Icon name="copy" size={small ? 15 : 18} />Enregistrer comme modèle</button>
      {open && <SaveDialog structure={structure} suggested={suggested} onSaved={onSaved} onClose={() => setOpen(false)} />}
    </>
  );
}

function SaveDialog({ structure, suggested, onSaved, onClose }: { structure: StructureData; suggested: string; onSaved?: (m: Structure) => void | Promise<void>; onClose: () => void }) {
  const models = useLoad(listModels, []);
  const [run] = useAction();
  const toast = useToast();
  return (
    <ModelDialog title="Enregistrer comme modèle" ok="Enregistrer le modèle" replace others={models.data}
      initial={{ name: suggested.slice(0, 80), description: '' }}
      onClose={onClose}
      onSubmit={async (name, description, twin) => {
        // Copie profonde : le modèle ne doit rien partager avec le brouillon encore ouvert.
        const row = { name, description, starting_stack: structure.starting_stack, levels: structuredClone(structure.levels), chips: structuredClone(structure.chips) };
        let saved: Structure | null = null;
        const ok = await run(async () => {
          if (twin) {
            await api.update('club_structures', twin.id, row);
            saved = { ...twin, ...row };
          } else {
            [saved] = await api.insert<Structure>('club_structures', row);
          }
          await onSaved?.(saved!);
        });
        if (ok) toast(twin ? `Modèle « ${name} » remplacé.` : `Modèle « ${name} » enregistré.`);
        return ok;
      }}>
      <p className="muted" style={{ fontSize: '.9rem' }}>
        {summary(structure)}. Il servira de point de départ à d'autres manches et tournois ; ceux déjà créés gardent leur structure.
      </p>
      {models.error && <p className="muted">{models.error}</p>}
    </ModelDialog>
  );
}
