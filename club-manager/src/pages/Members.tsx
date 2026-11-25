import { useState } from 'react';
import { accountName, key, nameScore, waitingAccounts } from '../lib/accounts';
import { api, listAccounts, listMembers, useClub, useLoad } from '../lib/club';
import * as f from '../lib/format';
import { ROLE_HINT, ROLE_LABEL, clubTeam, isLastAdmin, type Account, type JoinRequest, type Member, type Role } from '../lib/types';
import { Choice, Empty, Field, Icon, Modal, State, Switch, useAction, useConfirm } from '../components/ui';

const roleOptions = (...roles: Role[]) => roles.map(r => ({ value: r, label: ROLE_LABEL[r], hint: ROLE_HINT[r] }));
const makeAdmin = (name: string) => ({
  title: `Donner à ${name} le rôle d'administrateur ?`,
  text: 'Cette personne aura les mêmes droits que toi, y compris celui de nommer d\'autres administrateurs et de changer ton rôle.',
  ok: 'Donner le rôle',
});
const NoAccount = ({ name }: { name: string }) => (
  <p className="muted">{name} n'a pas encore de compte relié. Le rôle est enregistré et prendra effet quand son compte sera validé avec cette fiche.</p>
);

/** Compte à valider. Sans le script 002, seules les demandes sont connues. */
interface Pending { user_id: string; name: string; email: string | null }

export function Members() {
  const { isAdmin, me, refresh } = useClub();
  const q = useLoad(async () => {
    const [members, requests, accounts] = await Promise.all([listMembers(), api.select<JoinRequest>('club_join_requests', { order: ['created_at', 'asc'] }), listAccounts()]);
    return { members, requests, accounts };
  }, []);
  const [adding, setAdding] = useState(false);
  const [naming, setNaming] = useState(false);
  const [edit, setEdit] = useState<Member | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);

  if (!q.data) return <State loading={q.loading} error={q.error} onRetry={q.reload} />;
  const { members, requests, accounts } = q.data;
  const byMember = new Map((accounts ?? []).filter(a => a.member_id).map(a => [a.member_id!, a]));
  const list = members.filter(m => {
    const a = byMember.get(m.id);
    return m.active !== archived && (!search || key(`${m.name} ${a?.username ?? ''} ${a?.email ?? ''}`).includes(key(search)));
  });
  const gone = members.filter(m => !m.active).length;
  const team = clubTeam(members);
  const changed = async () => { await q.reload(); await refresh(); };

  return (
    <>
      <div className="pagehead">
        <div><h1>Adhérents</h1><p>{f.plural(members.filter(m => m.active).length, 'adhérent')}, dont {members.filter(m => m.active && m.user_id).length} avec un compte en ligne.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" />Ajouter</button>
      </div>
      <div className="stack">
        {accounts ? <Waiting accounts={accounts} reload={changed} onValidate={a => setPending({ user_id: a.user_id, name: accountName(a), email: a.email })} /> : (
          <>
            {isAdmin && <div className="card warn"><p className="muted">Pour valider les nouveaux comptes ici, exécute <code>club-manager/supabase/002_club_accounts.sql</code> dans Supabase (SETUP.md).</p></div>}
            {requests.length > 0 && (
              <div className="card note">
                <h2>{f.plural(requests.length, 'demande')} de rattachement</h2>
                <div className="plist">
                  {requests.map(r => (
                    <div className="prow" key={r.user_id}>
                      <span className="pname">{r.name}<small>{r.email}</small></span>
                      <button className="btn primary sm" onClick={() => setPending(r)}>Traiter</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <section className="card">
          <div className="sechead" style={{ flexWrap: 'wrap' }}>
            <h2>Gestion du club</h2>
            {isAdmin && <button className="btn sm" onClick={() => setNaming(true)}><Icon name="plus" size={15} />Nommer un gestionnaire</button>}
          </div>
          <p className="muted">
            Un gestionnaire s'occupe des tournois, championnats, structures, horloge et adhérents. Un administrateur nomme en plus les gestionnaires.
            {!isAdmin && ' Pour changer un rôle, adresse-toi à un administrateur.'}
          </p>
          <div className="plist" style={{ marginTop: 8 }}>
            {team.map(m => (
              <div className="prow" key={m.id}>
                <span className="pname"><a href={`#/j/${m.id}`}>{m.name}</a>{m.id === me?.id ? <small>C'est toi</small> : !m.user_id && <small>Compte pas encore relié</small>}</span>
                <span className="acts">
                  <span className="tag done">{ROLE_LABEL[m.role]}</span>
                  {isAdmin && <button className="btn sm" onClick={() => setEdit(m)} aria-label={`Changer le rôle de ${m.name}`}>Changer</button>}
                </span>
              </div>
            ))}
          </div>
        </section>
        <div className="row">
          <input style={{ maxWidth: 280 }} placeholder="Rechercher" aria-label="Rechercher un adhérent" value={search} onChange={e => setSearch(e.target.value)} />
          {gone > 0 && <button className={`toggle ${archived ? 'on' : ''}`} aria-pressed={archived} onClick={() => setArchived(!archived)}>Anciens adhérents ({gone})</button>}
        </div>
        <div className="card" style={{ paddingBlock: 6 }}>
          {list.length === 0 ? <Empty title={members.length === 0 ? 'Aucun adhérent' : 'Personne à ce nom'} /> : (
            <div className="plist">
              {list.map(m => {
                const a = byMember.get(m.id);
                return (
                  <div className="prow" key={m.id}>
                    <span className="pname"><a href={`#/j/${m.id}`}>{m.name}</a>{a && <small>{accountName(a)}{a.email && `, ${a.email}`}</small>}</span>
                    {m.role !== 'member' && <span className="tag done">{ROLE_LABEL[m.role]}</span>}
                    <span className={`tag ${m.user_id ? 'open' : ''}`}>{m.user_id ? 'Compte relié' : 'Sans compte'}</span>
                    <button className="iconbtn" disabled={!isAdmin && m.role !== 'member'} title={!isAdmin && m.role !== 'member' ? 'Réservé aux administrateurs' : 'Modifier'} onClick={() => setEdit(m)} aria-label={`Modifier ${m.name}`}><Icon name="edit" size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {adding && <AddMembers members={members} reload={q.reload} onClose={() => setAdding(false)} />}
      {naming && <AppointMember members={members} reload={q.reload} onClose={() => setNaming(false)} />}
      {edit && <EditMember m={edit} members={members} isAdmin={isAdmin} isMe={edit.id === me?.id} onClose={() => setEdit(null)} done={async () => { await q.reload(); if (edit.id === me?.id) await refresh(); }} />}
      {pending && <ValidateAccount r={pending} members={members} isAdmin={isAdmin} full={!!accounts} reload={changed} onClose={() => setPending(null)} />}
    </>
  );
}

function Waiting({ accounts, reload, onValidate }: { accounts: Account[]; reload: () => Promise<void>; onValidate: (a: Account) => void }) {
  const [showRefused, setShowRefused] = useState(false);
  const [run, busy] = useAction();
  const waiting = waitingAccounts(accounts);
  const ready = waiting.filter(a => a.confirmed).length;
  const refused = accounts.filter(a => a.refused && !a.member_id);
  const old = showRefused && refused.length > 0;
  if (waiting.length === 0 && refused.length === 0) return null;
  const refuse = (a: Account, p_refuse: boolean) => run(async () => { await api.rpc('club_refuse_account', { p_user: a.user_id, p_refuse }); await reload(); }, p_refuse ? `Compte de ${accountName(a)} refusé.` : undefined);
  return (
    <section className={`card ${!old && ready > 0 ? 'note' : ''}`}>
      <div className="sechead" style={{ flexWrap: 'wrap' }}>
        <h2>{old ? f.plural(refused.length, 'compte refusé', 'comptes refusés') : ready > 0 ? `${f.plural(ready, 'compte')} à valider` : 'Aucun compte à valider'}</h2>
        {refused.length > 0 && <button className={`toggle ${old ? 'on' : ''}`} aria-pressed={old} onClick={() => setShowRefused(!showRefused)}>Refusés ({refused.length})</button>}
      </div>
      {(old || waiting.length > 0) && <p className="muted">
        {old ? 'Ces comptes n\'ouvrent ni Le Club, ni le Range Editor, ni le Trainer.'
          : ready > 0 ? 'Une fois validé, un compte devient adhérent et ouvre tous les outils. Vérifie que tu connais la personne.'
          : 'Un compte peut être validé une fois son adresse confirmée par la personne.'}
      </p>}
      <div className="plist" style={{ marginTop: 8 }}>
        {(old ? refused : waiting).map(a => (
          <div className="prow" key={a.user_id}>
            <span className="pname">{accountName(a)}<small>{[a.asked && a.username && `pseudo ${a.username}`, a.email, `créé le ${f.shortDate(a.created_at)}`].filter(Boolean).join(', ')}</small></span>
            <span className="acts">
              {!a.confirmed && <span className="tag">Adresse non confirmée</span>}
              {old
                ? <button className="btn sm" disabled={busy} onClick={() => refuse(a, false)}>Reprendre</button>
                : <>
                  <button className="btn ghost sm" disabled={busy} onClick={() => refuse(a, true)} aria-label={`Refuser ${accountName(a)}`}>Refuser</button>
                  <button className="btn primary sm" disabled={busy || !a.confirmed} title={a.confirmed ? undefined : 'La personne doit d\'abord confirmer son adresse'} onClick={() => onValidate(a)} aria-label={`Valider ${accountName(a)}`}>Valider</button>
                </>}
            </span>
          </div>
        ))}
      </div>
    </section>
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

function AppointMember({ members, reload, onClose }: { members: Member[]; reload: () => Promise<void>; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('director');
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const list = members.filter(m => m.active && m.role === 'member' && key(m.name).includes(key(search)))
    .sort((a, b) => Number(!a.user_id) - Number(!b.user_id) || a.name.localeCompare(b.name, 'fr'));
  const who = members.find(m => m.id === picked) ?? null;
  const save = async () => {
    if (!who || (role === 'admin' && !await confirm(makeAdmin(who.name)))) return;
    const ok = await run(async () => { await api.update('club_members', who.id, { role }); await reload(); }, `Rôle de ${who.name} : ${ROLE_LABEL[role].toLowerCase()}.`);
    if (ok) onClose();
  };
  return (
    <Modal title="Nommer un gestionnaire" onClose={onClose} wide>
      <form className="stack" onSubmit={e => { e.preventDefault(); void save(); }}>
        <input placeholder="Rechercher un adhérent" aria-label="Rechercher un adhérent" value={search} onChange={e => setSearch(e.target.value)} />
        {list.length === 0 ? <Empty title={search ? 'Personne à ce nom' : 'Personne à nommer'} /> : (
          <div className="picks" style={{ maxHeight: '32dvh' }}>
            {list.map(m => (
              <button key={m.id} type="button" className={`pick ${picked === m.id ? 'on' : ''}`} aria-pressed={picked === m.id} onClick={() => setPicked(m.id)}>
                {m.name}<small>{m.user_id ? 'Compte relié' : 'Sans compte'}</small>
              </button>
            ))}
          </div>
        )}
        <Choice label="Rôle" value={role} onChange={setRole} options={roleOptions('director', 'admin')} />
        {who && !who.user_id && <NoAccount name={who.name} />}
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={busy || !who}>{who ? `Nommer ${who.name}` : 'Choisis une personne'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditMember({ m, members, isAdmin, isMe, onClose, done }: { m: Member; members: Member[]; isAdmin: boolean; isMe: boolean; onClose: () => void; done: () => Promise<void> }) {
  const [name, setName] = useState(m.name);
  const [role, setRole] = useState<Role>(m.role);
  const [active, setActive] = useState(m.active);
  const [run, busy] = useAction();
  const confirm = useConfirm();
  const last = isLastAdmin(members, m);
  const save = async () => {
    if (role === 'admin' && m.role !== 'admin' && !await confirm(makeAdmin(m.name))) return;
    const ok = await run(async () => { await api.update('club_members', m.id, { name: name.trim(), active, ...(isAdmin ? { role } : {}) }); await done(); }, 'Enregistré.');
    if (ok) onClose();
  };
  return (
    <Modal title={m.name} onClose={onClose}>
      <form className="stack" onSubmit={e => { e.preventDefault(); void save(); }}>
        <Field label="Nom affiché" hint="Mis à jour dans tous ses tournois."><input value={name} required maxLength={60} onChange={e => setName(e.target.value)} /></Field>
        {isAdmin && <Choice label="Rôle" value={role} onChange={setRole} options={roleOptions('member', 'director', 'admin')} />}
        {isAdmin && role !== 'member' && !m.user_id && <NoAccount name={m.name} />}
        {isMe && role !== m.role && !last && <p className="muted">Attention : tu changes ton propre rôle.</p>}
        {last && role !== 'admin' && <p className="muted">Le club doit garder au moins un administrateur : nommes-en un autre d'abord.</p>}
        <Switch label="Adhérent actif" hint="Un ancien adhérent garde ses résultats et les outils, mais n'entre plus dans l'espace du club" checked={active} onChange={setActive} />
        {isAdmin && m.user_id && <div><button type="button" className="btn sm" disabled={busy} onClick={async () => {
          if (await confirm({ title: 'Détacher le compte ?', text: 'Son compte repassera à valider : la personne n\'ouvrira plus Le Club, le Range Editor ni le Trainer avant une nouvelle validation. Ses ranges sont conservées.', ok: 'Détacher', danger: true })) {
            if (await run(async () => { await api.update('club_members', m.id, { user_id: null }); await done(); }, 'Compte détaché.')) onClose();
          }
        }}>Détacher le compte en ligne</button></div>}
        <div className="row between">
          <button type="button" className="btn danger" disabled={busy} onClick={async () => {
            if (await confirm({ title: `Supprimer ${m.name} ?`, text: 'Ses résultats restent, mais comme ceux d\'un invité : il quitte les classements. Pour un départ du club, préfère « ancien adhérent ».' + (m.user_id ? ' Son compte repassera à valider : d\'ici là, il n\'ouvrira plus les outils.' : ''), ok: 'Supprimer', danger: true })) {
              if (await run(async () => { await api.remove('club_members', m.id); await done(); }, 'Adhérent supprimé.')) onClose();
            }
          }}>Supprimer</button>
          <div className="row"><button type="button" className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={busy || !name.trim() || (last && role !== 'admin')}>Enregistrer</button></div>
        </div>
      </form>
    </Modal>
  );
}

function ValidateAccount({ r, members, isAdmin, full, reload, onClose }: { r: Pending; members: Member[]; isAdmin: boolean; full: boolean; reload: () => Promise<void>; onClose: () => void }) {
  const [run, busy] = useAction();
  const [role, setRole] = useState<Role>('member');
  const [name, setName] = useState(r.name);
  const confirm = useConfirm();
  const score = (m: Member) => nameScore(r.name, m.name);
  // Une fiche qui porte déjà un rôle ne peut être reliée que par un administrateur.
  const free = members.filter(m => !m.user_id && (isAdmin || m.role === 'member')).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, 'fr'));
  const validate = async (m: Member | null) => {
    // Le rôle choisi ne remplace jamais celui que la fiche porte déjà.
    const given = !m || m.role === 'member' ? role : 'member';
    if (given === 'admin' && !await confirm(makeAdmin(m?.name ?? name))) return;
    const args = { p_user: r.user_id, p_member: m?.id ?? null };
    const ok = await run(async () => {
      if (full) await api.rpc('club_validate_account', { ...args, p_name: name.trim(), p_role: given });
      else await api.rpc('club_approve_request', args);
      await reload();
    }, `${m ? `Compte relié à ${m.name}` : `${full ? name.trim() : r.name} rejoint le club`}.${given === 'member' ? '' : ` Rôle : ${ROLE_LABEL[given].toLowerCase()}.`}`);
    if (ok) onClose();
  };
  return (
    <Modal title={`Valider ${r.name}`} onClose={onClose} wide>
      <form className="stack" onSubmit={e => { e.preventDefault(); void validate(null); }}>
        <p className="muted">{r.email && `${r.email}. `}Vérifie que cette personne est bien du club.{free.length > 0 && ' Si elle a déjà une fiche, choisis-la : elle retrouvera ses résultats.'}</p>
        {isAdmin && full && <Choice label="Rôle" value={role} onChange={setRole} options={roleOptions('member', 'director', 'admin')} />}
        {free.length > 0 && <div className="picks" style={{ maxHeight: '32dvh' }}>{free.map(m => (
          <button key={m.id} type="button" className={`pick ${score(m) > 0 ? 'on' : ''}`} disabled={busy} onClick={() => validate(m)}>
            {m.name}{(score(m) > 0 || m.role !== 'member') && <small>{[score(m) > 0 && 'nom proche', m.role !== 'member' && ROLE_LABEL[m.role].toLowerCase()].filter(Boolean).join(', ')}</small>}
          </button>
        ))}</div>}
        {full && <Field label={free.length > 0 ? 'Sinon, nom de sa nouvelle fiche' : 'Nom de sa fiche'}><input value={name} maxLength={60} onChange={e => setName(e.target.value)} /></Field>}
        <div className="row end">
          {!full && <button type="button" className="btn danger" disabled={busy} onClick={() => run(async () => { await api.remove('club_join_requests', r.user_id); await reload(); }, 'Demande refusée.').then(x => { if (x) onClose(); })}>Refuser</button>}
          <button type="button" className="btn" onClick={onClose}>Annuler</button>
          <button className="btn primary" disabled={busy || (full && !name.trim())}>{free.length > 0 ? 'Valider avec une nouvelle fiche' : 'Valider'}</button>
        </div>
      </form>
    </Modal>
  );
}
