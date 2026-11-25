import { useState, type FormEvent } from 'react';
import { api, useClub } from '../lib/club';
import { ROLE_LABEL } from '../lib/types';
import { Field, Icon, useAction, useToast } from '../components/ui';

export function Account() {
  const { user, me, request, refresh } = useClub();
  const [run, busy] = useAction();
  if (!user) return <Login />;
  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <div className="pagehead" style={{ marginBottom: 0 }}><div><h1>Mon compte</h1><p>{user.email}</p></div></div>
      {me ? (
        <div className="card">
          <dl className="deflist" style={{ marginBottom: 16 }}>
            <div><dt>Adhérent</dt><dd>{me.name}</dd></div>
            <div><dt>Rôle</dt><dd>{ROLE_LABEL[me.role]}</dd></div>
          </dl>
          <a className="btn" href={`#/j/${me.id}`}><Icon name="user" />Mes résultats</a>
        </div>
      ) : <JoinForm pending={request?.name ?? null} />}
      <div><button className="btn" disabled={busy} onClick={() => run(async () => { await api.signOut(); await refresh(); })}>Se déconnecter</button></div>
    </div>
  );
}

function JoinForm({ pending }: { pending: string | null }) {
  const { refresh } = useClub();
  const [name, setName] = useState(pending ?? '');
  const [run, busy] = useAction();
  return (
    <form className="card" onSubmit={e => { e.preventDefault(); void run(async () => { await api.rpc('club_request_join', { p_name: name }); await refresh(); }, 'Demande envoyée au bureau.'); }}>
      <h2>{pending ? 'Demande envoyée' : 'Rattacher mon compte au club'}</h2>
      <p className="muted" style={{ marginBottom: 14 }}>
        {pending
          ? 'Un organisateur va valider ta demande. Tu pourras ensuite t\'inscrire aux tournois.'
          : 'Indique ton nom tel que le club le connaît. Un organisateur reliera ton compte à ta fiche d\'adhérent.'}
      </p>
      <Field label="Prénom et nom (ou pseudo au club)">
        <input value={name} maxLength={60} required onChange={e => setName(e.target.value)} />
      </Field>
      <button className="btn primary" style={{ marginTop: 14 }} disabled={busy || !name.trim()}>{pending ? 'Modifier ma demande' : 'Envoyer ma demande'}</button>
    </form>
  );
}

function Login() {
  const { refresh } = useClub();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [info, setInfo] = useState('');
  const [run, busy] = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setInfo('');
    void run(async () => {
      if (mode === 'login') {
        await api.signIn(email, password);
        await refresh();
        location.hash = '#/';
      } else if (mode === 'signup') {
        await api.signUp(email, password, username.trim());
        setInfo('Compte créé. Ouvre le lien reçu par e-mail pour le confirmer, puis connecte-toi.');
        setMode('login');
      } else {
        await api.resetPassword(email);
        setInfo('E-mail envoyé : suis le lien pour choisir un nouveau mot de passe.');
      }
    });
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div className="pagehead"><div>
        <h1>{mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié'}</h1>
        <p>Le même compte que pour le Range Editor et le Poker Trainer.</p>
      </div></div>
      <form className="card stack" onSubmit={submit}>
        {info && <div className="card note" style={{ padding: 12 }}>{info}</div>}
        {mode === 'signup' && <Field label="Pseudo"><input value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" /></Field>}
        <Field label="Adresse e-mail"><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></Field>
        {mode !== 'reset' && <Field label="Mot de passe"><input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></Field>}
        <button className="btn primary block" disabled={busy}>{mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}</button>
      </form>
      <div className="stack" style={{ gap: 4, marginTop: 12, justifyItems: 'center' }}>
        {mode === 'login' ? (
          <>
            <button className="btn ghost sm" onClick={() => setMode('signup')}>Pas encore de compte ? En créer un</button>
            <button className="btn ghost sm" onClick={() => setMode('reset')}>Mot de passe oublié</button>
          </>
        ) : <button className="btn ghost sm" onClick={() => setMode('login')}>Retour à la connexion</button>}
      </div>
    </div>
  );
}

export function NewPassword() {
  const { doneRecovering } = useClub();
  const [password, setPassword] = useState('');
  const [run, busy] = useAction();
  const toast = useToast();
  return (
    <form className="card stack" style={{ maxWidth: 420, margin: '0 auto' }} onSubmit={e => {
      e.preventDefault();
      void run(() => api.updatePassword(password)).then(ok => { if (ok) { toast('Mot de passe modifié.'); doneRecovering(); location.hash = '#/'; } });
    }}>
      <h2>Nouveau mot de passe</h2>
      <Field label="Mot de passe" hint="Six caractères au minimum"><input type="password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></Field>
      <button className="btn primary block" disabled={busy}>Enregistrer</button>
    </form>
  );
}
