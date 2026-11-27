/** Compte PPC Poker Tools : seulement pour le vote du club et l'horloge des tournois. */
import { useState } from 'react';
import { Field, Icon, useAction } from '../components/ui';
import { club } from '../lib/club';
import { useUser } from '../lib/session';

export function Account() {
  const user = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [run, busy] = useAction();
  return (
    <div className="stack">
      <div className="pagehead">
        <div>
          <h1>Compte</h1>
          <p>Le carnet marche sans compte. Il en faut un pour voter au club et lire l'horloge des tournois.</p>
        </div>
      </div>
      {user === undefined ? <p className="muted">Chargement…</p> : user ? (
        <section className="card stack sm">
          <p>Connecté avec <b>{user.email}</b>.</p>
          <p className="muted">C'est le même compte que dans Le Club, le Range Editor et le Trainer.</p>
          <button className="btn" disabled={busy} onClick={() => run(() => club.signOut(), 'Déconnecté')}>Se déconnecter de cet appareil</button>
        </section>
      ) : (
        <form className="card stack sm" onSubmit={e => { e.preventDefault(); void run(() => club.signIn(email.trim(), password), 'Connecté'); }}>
          <Field label="Adresse e-mail"><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></Field>
          <Field label="Mot de passe"><input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></Field>
          <button className="btn primary block" disabled={busy}><Icon name="user" />Se connecter</button>
          <p className="muted">Pas encore de compte, ou mot de passe oublié ? Tout se fait dans <a href="/club/#/compte">Le Club</a>, avec le même compte.</p>
        </form>
      )}
      <section className="card stack sm">
        <h2>Tes mains</h2>
        <p className="muted">Les mains de ton carnet sont gardées dans ce navigateur, sur ce téléphone. Elles ne partent que si tu les envoies, ou si tu les soumets au vote du club (sans ta note personnelle).</p>
      </section>
    </div>
  );
}
