import { useState } from 'react';
import { api, listMembers, useClub, useLoad } from '../lib/club';
import * as f from '../lib/format';
import { ROLE_LABEL, type JoinRequest, type Member, type Role } from '../lib/types';
import { Choice, Empty, Field, Icon, Modal, State, Switch, useAction, useConfirm } from '../components/ui';

const key = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function Members() {
  const { isAdmin, me, refresh } = useClub();
  const q = useLoad(async () => {
    const [members, requests] = await Promise.all([listMembers(), api.select<JoinRequest>('club_join_requests', { order: ['created_at', 'asc'] })]);
    return { members, requests };
  }, []);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Member | null>(null);
  const [link, setLink] = useState<JoinRequest | null>(null);
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);

  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  const { members, requests } = q.data;
  const list = members.filter(m => m.active !== archived && key(m.name).includes(key(search)));
  const gone = members.filter(m => !m.active).length;

  return (
    <>
      <div className="pagehead">
        <div><h1>Adhérents</h1><p>{f.plural(members.filter(m => m.active).length, 'adhérent')}, dont {members.filter(m => m.active && m.user_id).length} avec un compte en ligne.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter</button>
      </div>
      <div className="stack">
        {requests.length > 0 && (
          <div className="card note">
            <h2>{f.plural(requests.length, 'demande')} de rattachement</h2>
            <div className="plist">
              {requests.map(r => (
                <div className="prow" key={r.user_id}>
                  <span className="pname">{r.name}<small>{r.email}</small></span>
                  <button className="btn primary sm" onClick={() => setLink(r)}>Traiter</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="row">
          <input style={{ maxWidth: 280 }} placeholder="Rechercher" aria-label="Rechercher un adhérent" value={search} onChange={e => setSearch(e.target.value)} />
          {gone > 0 && <button className={`toggle ${archived ? 'on' : ''}`} aria-pressed={archived} onClick={() => setArchived(!archived)}>Anciens adhérents ({gone})</button>}
        </div>
        <div className="card" style={{ paddingBlock: 6 }}>
          {list.length === 0 ? <Empty title={members.length === 0 ? 'Aucun adhérent' : 'Personne à ce nom'} /> : (
            <div className="plist">
              {list.map(m => (
                <div className="prow" key={m.id}>
                  <span className="pname"><a href={`#/j/${m.id}`}>{m.name}</a></span>
                  {m.role !== 'member' && <span className="tag done">{ROLE_LABEL[m.role]}</span>}
                  <span className={`tag ${m.user_id ? 'open' : ''}`}>{m.user_id ? 'Compte relié' : 'Sans compte'}</span>
                  <button className="iconbtn" disabled={!isAdmin && m.role !== 'member'} onClick={() => setEdit(m)} aria-label={`Modifier ${m.name}`}><Icon name="edit" size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {adding && <AddMembers members={members} reload={q.reload} onClose={() => setAdding(false)} />}
      {edit && <EditMember m={edit} isAdmin={isAdmin} isMe={edit.id === me?.id} onClose={() => setEdit(null)} done={async () => { await q.reload(); if (edit.id === me?.id) await refresh(); }} />}
      {link && <LinkRequest r={link} members={members} reload={q.reload} onClose={() => setLink(null)} />}
    </>
  );
}

function AddMembers({ members, reload, onClose }: { members: Member[]; reload: () => Promise<void>; onClose: () => void }) {
  const [text, setText] = useState('');
  const [run, busy] = useAction();
  const seen = new Set(members.map(m => key(m.name)));
  const names: string[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\n/)) {
    const n = raw.replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!n) continue;
    if (seen.has(key(n))) skipped.push(n); else { seen.add(key(n)); names.push(n); }
  }
  return (
    <Modal title="Ajouter des adhérents" onClose={onClose}>
      <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { await api.insert('club_members', names.map(name => ({ name }))); await reload(); }, `${f.plural(names.length, 'adhérent')} ajouté${names.length > 1 ? 's' : ''}.`).then(ok => { if (ok) onClose(); }); }}>
        <Field label="Un nom par ligne" hint="Tu peux coller une colonne de tableur."><textarea rows={8} value={text} onChange={e => setText(e.target.value)} /></Field>
        {skipped.length > 0 && <p className="muted">Déjà présents, ignorés : {skipped.join(', ')}.</p>}
        <div className="row end"><button type="button" className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy || names.length === 0}>Ajouter{names.length > 0 ? ` (${names.length})` : ''}</button></div>
      </form>
    </Modal>
  );
}

function EditMember({ m, isAdmin, isMe, onClose, done }: { m: Member; isAdmin: boolean; isMe: boolean; onClose: () => void; done: () => Promise<void> }) {
  const [name, setName] = useState(m.name);
  const [role, setRole] = useState<Role>(m.role);
  const [active, setActive] = useState(m.active);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  return (
    <Modal title={m.name} onClose={onClose}>
      <form className="stack" onSubmit={e => { e.preventDefault(); void run(async () => { await api.update('club_members', m.id, { name: name.trim(), active, ...(isAdmin ? { role } : {}) }); await done(); }, 'Enregistré.').then(ok => { if (ok) onClose(); }); }}>
        <Field label="Nom affiché" hint="Mis à jour dans tous ses tournois."><input value={name} required maxLength={60} onChange={e => setName(e.target.value)} /></Field>
        {isAdmin && <Choice label="Rôle" value={role} onChange={setRole} options={[
          { value: 'member', label: 'Adhérent', hint: 'Consulte et s\'inscrit' },
          { value: 'director', label: 'Organisateur', hint: 'Gère tournois, horloge et adhérents' },
          { value: 'admin', label: 'Administrateur', hint: 'En plus, attribue les rôles' },
        ]} />}
        {isMe && role !== m.role && <p className="muted">Attention : tu changes ton propre rôle.</p>}
        <Switch label="Adhérent actif" hint="Un ancien adhérent garde ses résultats mais ne peut plus se connecter à l'espace du club" checked={active} onChange={setActive} />
        {isAdmin && m.user_id && <div><button type="button" className="btn sm" disabled={busy} onClick={async () => {
          if (await confirm({ title: 'Détacher le compte ?', text: 'La personne devra refaire une demande de rattachement.', ok: 'Détacher', danger: true })) {
            if (await run(async () => { await api.update('club_members', m.id, { user_id: null }); await done(); }, 'Compte détaché.')) onClose();
          }
        }}>Détacher le compte en ligne</button></div>}
        <div className="row between">
          <button type="button" className="btn danger" disabled={busy} onClick={async () => {
            if (await confirm({ title: `Supprimer ${m.name} ?`, text: 'Ses résultats restent, mais comme ceux d\'un invité : il quitte les classements. Pour un départ du club, préfère « ancien adhérent ».', ok: 'Supprimer', danger: true })) {
              if (await run(async () => { await api.remove('club_members', m.id); await done(); }, 'Adhérent supprimé.')) onClose();
            }
          }}>Supprimer</button>
          <div className="row"><button type="button" className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy || !name.trim()}>Enregistrer</button></div>
        </div>
      </form>
    </Modal>
  );
}

function LinkRequest({ r, members, reload, onClose }: { r: JoinRequest; members: Member[]; reload: () => Promise<void>; onClose: () => void }) {
  const [run, busy] = useAction();
  const words = key(r.name).split(' ');
  const score = (m: Member) => key(m.name).split(' ').filter(w => words.includes(w)).length;
  const free = members.filter(m => !m.user_id).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'fr'));
  const approve = (member: string | null, ok: string) => run(async () => { await api.rpc('club_approve_request', { p_user: r.user_id, p_member: member }); await reload(); }, ok).then(x => { if (x) onClose(); });
  return (
    <Modal title={`Demande de ${r.name}`} onClose={onClose} wide>
      <div className="stack">
        <p className="muted">{r.email}. Vérifie que cette personne est bien adhérente, puis choisis sa fiche pour qu'elle retrouve ses résultats.</p>
        {free.length > 0 && <div className="picks">{free.map(m => <button key={m.id} className={`pick ${score(m) > 0 ? 'on' : ''}`} disabled={busy} onClick={() => approve(m.id, `Compte relié à ${m.name}.`)}>{m.name}{score(m) > 0 && <small>nom proche</small>}</button>)}</div>}
        <div className="row between">
          <button className="btn danger" disabled={busy} onClick={() => run(async () => { await api.remove('club_join_requests', r.user_id); await reload(); }, 'Demande refusée.').then(x => { if (x) onClose(); })}>Refuser</button>
          <button className="btn primary" disabled={busy} onClick={() => approve(null, `${r.name} rejoint le club.`)}>Créer une nouvelle fiche</button>
        </div>
      </div>
    </Modal>
  );
}
