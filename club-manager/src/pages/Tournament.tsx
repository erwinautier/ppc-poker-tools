import { useState } from 'react';
import { api, isDemo, useClub, useTournament, type TournamentBundle } from '../lib/club';
import * as f from '../lib/format';
import { go } from '../lib/router';
import { download, icsOf } from '../lib/ics';
import { FORMAT_LABEL, HU_SYSTEM_LABEL, type TournamentStatus } from '../lib/types';
import { Empty, Icon, Modal, Qr, State, useAction, useConfirm, useToast } from '../components/ui';
import { RegisterButton, StatusTag } from '../components/cards';
import { Infos } from '../components/t/Infos';
import { Players } from '../components/t/Players';
import { Tables } from '../components/t/Tables';
import { Live } from '../components/t/Live';
import { HeadsUp } from '../components/t/HeadsUp';
import { StructureTab } from '../components/t/StructureTab';
import { Results } from '../components/t/Results';

export function shareUrl(id: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}${isDemo ? '?demo' : ''}#/t/${id}`;
}

export interface TabProps { b: TournamentBundle; reload: () => Promise<void> }

export function TournamentPage({ id, tab }: { id: string; tab: string }) {
  const { isStaff, user } = useClub();
  const q = useTournament(id, isStaff);
  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  if (q.data === 'missing') {
    return <Empty title="Tournoi introuvable">{user ? 'Il a été supprimé, ou il n\'est pas encore publié.' : 'Il est peut-être réservé aux adhérents.'}
      {user ? <a className="btn" href="#/tournois">Voir les tournois</a> : <a className="btn primary" href="#/compte">Se connecter</a>}</Empty>;
  }
  const b = q.data;
  const { t } = b;
  const hu = t.settings.format === 'hu';
  const tabs: [string, string][] = [
    ['direct', 'Direct'], ['infos', 'Infos'], ['joueurs', 'Joueurs'], ['tables', 'Tables'], ['structure', 'Structure'], ['resultats', 'Résultats'],
  ];
  const visible = tabs.filter(([k]) =>
    k === 'direct' ? isStaff ? t.status !== 'finished' && t.status !== 'cancelled' : t.status === 'running'
    : k === 'resultats' ? t.status === 'finished' || isStaff
    : k === 'tables' ? !hu && t.status !== 'finished' && t.status !== 'cancelled' && (isStaff || b.entries.some(e => e.table_no !== null))
    : true);
  const fallback = t.status === 'running' ? 'direct' : t.status === 'finished' ? 'resultats' : 'infos';
  const current = visible.some(([k]) => k === tab) ? tab : fallback;
  const props = { b, reload: q.reload };

  return (
    <>
      <a className="crumb" href={t.status === 'finished' ? '#/tournois/passes' : '#/tournois'}><Icon name="back" size={15} />Tournois</a>
      <div className="pagehead">
        <div>
          <h1>{t.name}</h1>
          <p>{f.dateTime(t.starts_at)}{t.venue && ` · ${t.venue}`}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <StatusTag status={t.status} />
            {t.settings.format !== 'mtt' && <span className="tag">{hu ? `Heads-up · ${HU_SYSTEM_LABEL[t.settings.hu.system].toLowerCase()}` : FORMAT_LABEL[t.settings.format]}</span>}
            {b.championship && <a className="tag" href={`#/c/${b.championship.id}`} style={{ textDecoration: 'none' }}>{b.championship.name}{t.settings.coefficient !== 1 && ` · coef. ${f.num(t.settings.coefficient)}`}</a>}
            {t.visibility === 'public' ? <span className="tag">Page publique</span> : isStaff && <span className="tag">Réservé aux adhérents</span>}
          </div>
        </div>
        <div className="row">
          <RegisterButton t={t} entries={b.entries} reload={q.reload} big />
          {(t.status === 'running' || isStaff && t.status !== 'finished' && t.status !== 'cancelled') && <a className="btn" href={`#/t/${t.id}/horloge`}><Icon name="clock" />Écran d'horloge</a>}
          <ShareButton b={b} />
        </div>
      </div>
      {isStaff && t.status !== 'running' && <StaffBar b={b} reload={q.reload} />}
      <div className="tabs" role="tablist">
        {visible.map(([k, label]) => <a key={k} href={`#/t/${t.id}/${k}`} role="tab" aria-selected={k === current} className={k === current ? 'on' : ''}>{label}</a>)}
      </div>
      {current === 'infos' && <Infos {...props} />}
      {current === 'joueurs' && <Players {...props} />}
      {current === 'tables' && <Tables {...props} />}
      {current === 'direct' && (hu ? <HeadsUp {...props} /> : <Live {...props} />)}
      {current === 'structure' && <StructureTab {...props} />}
      {current === 'resultats' && <Results key={t.status} {...props} />}
      {/* En direct, l'horloge et les éliminations passent avant la gestion. */}
      {isStaff && t.status === 'running' && <div style={{ marginTop: 20 }}><StaffBar b={b} reload={q.reload} /></div>}
    </>
  );
}

function ShareButton({ b }: { b: TournamentBundle }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const url = shareUrl(b.t.id);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><Icon name="share" />Partager</button>
      {open && (
        <Modal title="Partager ce tournoi" onClose={() => setOpen(false)} small>
          <div style={{ display: 'grid', gap: 14, justifyItems: 'center' }}>
            <Qr text={url} size={200} />
            <p className="muted" style={{ textAlign: 'center' }}>
              {b.t.visibility === 'public' ? 'Visible par toute personne qui a ce lien.' : 'Visible par les adhérents connectés.'}
            </p>
            <input readOnly value={url} aria-label="Lien du tournoi" onFocus={e => e.target.select()} />
            <div className="row">
              <button className="btn primary" onClick={() => navigator.clipboard.writeText(url).then(() => toast('Lien copié.'), () => toast('Copie impossible : sélectionne le lien.', 'error'))}><Icon name="copy" />Copier le lien</button>
              <button className="btn" onClick={() => download(`${b.t.name}.ics`, icsOf(b.t, url), 'text/calendar')}><Icon name="calendar" />Agenda</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Étape suivante du tournoi + gestion. */
function StaffBar({ b, reload }: TabProps) {
  const { t } = b;
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const set = (status: TournamentStatus, ok: string) => run(async () => { await api.update('club_tournaments', t.id, { status }); await reload(); }, ok);
  return (
    <div className="row no-print" style={{ marginBottom: 14 }}>
      {t.status === 'draft' && <button className="btn primary sm" disabled={busy} onClick={() => set('open', 'Inscriptions ouvertes.')}>Publier et ouvrir les inscriptions</button>}
      {t.status === 'open' && <button className="btn sm" disabled={busy} onClick={() => set('closed', 'Inscriptions fermées.')}>Fermer les inscriptions</button>}
      {t.status === 'closed' && <button className="btn sm" disabled={busy} onClick={() => set('open', 'Inscriptions rouvertes.')}>Rouvrir les inscriptions</button>}
      {t.status === 'cancelled' && <button className="btn sm" disabled={busy} onClick={() => set('draft', 'Tournoi remis en brouillon.')}>Remettre en brouillon</button>}
      <a className="btn sm" href={`#/t/${t.id}/modifier`}><Icon name="edit" size={15} />Modifier</a>
      <a className="btn sm" href={`#/tournois/nouveau?copie=${t.id}`}><Icon name="copy" size={15} />Dupliquer</a>
      {['draft', 'open', 'closed'].includes(t.status) && (
        <button className="btn sm ghost" disabled={busy} onClick={async () => {
          if (await confirm({ title: 'Annuler ce tournoi ?', text: 'Il reste visible avec la mention « Annulé ». Les inscriptions sont conservées.', ok: 'Annuler le tournoi', danger: true })) await set('cancelled', 'Tournoi annulé.');
        }}>Annuler le tournoi</button>
      )}
      {['draft', 'cancelled', 'finished'].includes(t.status) && (
        <button className="btn sm ghost" disabled={busy} onClick={async () => {
          if (!await confirm({
            title: 'Supprimer ce tournoi ?',
            text: t.status === 'finished' ? 'Ses résultats disparaîtront du championnat. Cette suppression est définitive.' : 'Cette suppression est définitive.',
            ok: 'Supprimer', danger: true,
          })) return;
          if (await run(() => api.remove('club_tournaments', t.id), 'Tournoi supprimé.')) go('#/tournois');
        }}><Icon name="trash" size={15} />Supprimer</button>
      )}
    </div>
  );
}
