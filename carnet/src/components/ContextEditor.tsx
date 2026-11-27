/** Le tournoi en cours : un tournoi du Club (blindes lues sur l'horloge) ou un autre, saisi à la main. */
import { useEffect, useState } from 'react';
import { club } from '../lib/club';
import { MAX_PLAYERS, MIN_PLAYERS, type Blinds } from '../lib/engine';
import { ctxText, type Ctx } from '../lib/hand';
import { clubLevel, nextLevel, prevLevel, type ClubTournament } from '../lib/levels';
import { useUser } from '../lib/session';
import { useCarnet } from '../lib/store';
import { AmountInput, Chips, Field, Icon, Modal, Stepper } from './ui';

export function CtxBar({ ctx, onEdit }: { ctx: Ctx; onEdit: () => void }) {
  return (
    <button type="button" className="ctxbar" onClick={onEdit}>
      <Icon name="clock" size={16} />
      <span className="ctxbar-text">
        <b>{ctxText(ctx)}</b>
        <small>{ctx.table} joueurs à la table · {ctx.kind === 'club' && !ctx.manual ? 'blindes de l\'horloge du club' : 'blindes saisies'}</small>
      </span>
      <span className="ctxbar-edit">Changer</span>
    </button>
  );
}

function BlindsFields({ b, onChange }: { b: Blinds; onChange: (b: Blinds) => void }) {
  return (
    <>
      <div className="form three">
        <Field label="Petite blinde"><AmountInput value={b.sb} min={0} onChange={v => v !== null && onChange({ ...b, sb: v })} label="Petite blinde" /></Field>
        <Field label="Grosse blinde"><AmountInput value={b.bb} min={1} onChange={v => v !== null && onChange({ ...b, bb: v })} label="Grosse blinde" /></Field>
        <Field label="Ante"><AmountInput value={b.ante} min={0} onChange={v => onChange({ ...b, ante: v ?? 0 })} label="Ante" placeholder="0" /></Field>
      </div>
      {b.ante > 0 && (
        <Chips label="Qui paie l'ante" value={b.anteMode} onChange={m => onChange({ ...b, anteMode: m })}
          items={[{ value: 'bb', label: 'Payée par la grosse blinde' }, { value: 'each', label: 'Chaque joueur' }]} />
      )}
      <div className="row">
        <button type="button" className="btn sm" onClick={() => onChange(prevLevel(b))}><Icon name="prev" size={15} />Niveau précédent</button>
        <button type="button" className="btn sm" onClick={() => onChange(nextLevel(b))}>Niveau suivant<Icon name="next" size={15} /></button>
      </div>
    </>
  );
}

export function ContextEditor({ ctx, onSave, onClose }: { ctx: Ctx; onSave: (c: Ctx) => void; onClose: () => void }) {
  const [d, setD] = useState<Ctx>(ctx);
  const { recent } = useCarnet();
  const user = useUser();
  const [list, setList] = useState<ClubTournament[] | null>(null);
  useEffect(() => {
    if (user === undefined) return;
    if (!user) { setList([]); return; }
    let live = true;
    void club.running().then(l => { if (live) setList(l); });
    return () => { live = false; };
  }, [user]);

  const pickClub = (t: ClubTournament) => {
    const l = clubLevel(t);
    setD({
      kind: 'club', name: t.name, tournamentId: t.id, manual: false,
      level: l?.level ?? null, blinds: l ? { ...l.blinds, anteMode: d.blinds.anteMode } : d.blinds,
      table: Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, t.seats_per_table || 9)),
    });
  };
  const toOther = () => setD({ ...d, kind: 'other', tournamentId: undefined, manual: false, name: d.kind === 'club' ? '' : d.name });

  return (
    <Modal title="Où joues-tu ?" onClose={onClose}>
      <div className="stack">
        <Chips label="Type de tournoi" value={d.kind} onChange={k => (k === 'club' ? setD({ ...d, kind: 'club' }) : toOther())}
          items={[{ value: 'club', label: 'Tournoi du club' }, { value: 'other', label: 'Autre tournoi' }]} />

        {d.kind === 'club' && (
          <div className="stack sm">
            {user === null && <p className="note">Connecte-toi (onglet Compte) pour lire l'horloge des tournois du club. Tu peux aussi saisir les blindes toi-même dans « Autre tournoi ».</p>}
            {user && list === null && <p className="muted">Recherche des tournois en cours…</p>}
            {user && list?.length === 0 && <p className="note">Aucun tournoi du club n'est en cours en ce moment.</p>}
            {list && list.length > 0 && (
              <div className="picks">
                {list.map(t => {
                  const l = clubLevel(t);
                  return (
                    <button key={t.id} type="button" className={`pick ${d.tournamentId === t.id ? 'on' : ''}`} onClick={() => pickClub(t)}>
                      {t.name}
                      <small>{l ? `Niveau ${l.level} · ${l.blinds.sb}/${l.blinds.bb}${l.blinds.ante ? `, ante ${l.blinds.ante}` : ''}` : 'Structure inconnue'}</small>
                    </button>
                  );
                })}
              </div>
            )}
            {d.kind === 'club' && d.tournamentId && (
              <details className="more" open={d.manual}>
                <summary>Les blindes ne correspondent pas ?</summary>
                <div className="stack sm">
                  <BlindsFields b={d.blinds} onChange={b => setD({ ...d, blinds: b, manual: true })} />
                  {d.manual && <button type="button" className="btn sm ghost" onClick={() => { const t = list?.find(x => x.id === d.tournamentId); if (t) pickClub(t); else setD({ ...d, manual: false }); }}><Icon name="undo" size={15} />Reprendre l'horloge du club</button>}
                </div>
              </details>
            )}
          </div>
        )}

        {d.kind === 'other' && (
          <div className="stack sm">
            <Field label="Nom du tournoi" hint="Facultatif. Il apparaît sur les mains notées et partagées.">
              <input value={d.name} maxLength={80} placeholder="Open de Lamballe" onChange={e => setD({ ...d, name: e.target.value })} />
            </Field>
            {recent.length > 0 && (
              <div className="chips" aria-label="Tournois récents">
                {recent.map(r => <button key={r.name} type="button" className="chip" onClick={() => setD({ ...r, kind: 'other' })}>{r.name}</button>)}
              </div>
            )}
            <BlindsFields b={d.blinds} onChange={b => setD({ ...d, blinds: b, level: d.level && b.bb !== d.blinds.bb ? d.level + (b.bb > d.blinds.bb ? 1 : -1) : d.level })} />
            <div className="row between">
              <span className="field-label">Niveau (facultatif)</span>
              <Stepper label="Niveau" value={d.level ?? 0} min={0} max={99} onChange={v => setD({ ...d, level: v || null })} />
            </div>
          </div>
        )}

        <div className="row between">
          <span className="field-label">Joueurs à la table</span>
          <Stepper label="Joueurs à la table" value={d.table} min={MIN_PLAYERS} max={MAX_PLAYERS} onChange={v => setD({ ...d, table: v })} />
        </div>
        <p className="muted">{ctxText(d)}</p>
        <div className="row end">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={d.blinds.bb <= 0 || (d.kind === 'club' && !d.tournamentId)} onClick={() => { onSave({ ...d, name: d.name.trim() }); onClose(); }}>Valider</button>
        </div>
      </div>
    </Modal>
  );
}
