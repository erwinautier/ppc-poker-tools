import { useSyncExternalStore } from 'react';
import { Icon, UiProvider, useConfirm, type IconName } from './components/ui';
import { club, isDemo } from './lib/club';
import type { DemoClub, DemoRole } from './lib/demoClub';
import { useRoute } from './lib/router';
import { logoFile, getDA, subscribeDA, toggleDA } from '../../shared/ppc-da.js';
import { Account } from './pages/Account';
import { ClubFeed } from './pages/ClubFeed';
import { ClubPost } from './pages/ClubPost';
import { Entry } from './pages/Entry';
import { Express } from './pages/Express';
import { HandPage } from './pages/HandPage';
import { Home } from './pages/Home';
import { Shared } from './pages/Shared';

function Page() {
  const { parts } = useRoute();
  const [a, b, c] = parts;
  if (a === 'noter') return <Express key={b ?? 'new'} id={b} />;
  if (a === 'main' && b && c === 'deroule') return <Entry key={b} id={b} />;
  if (a === 'main' && b) return <HandPage id={b} />;
  if (a === 'voir' && b) return <Shared key={b} code={b} />;
  if (a === 'club' && b) return <ClubPost key={b} id={b} />;
  if (a === 'club') return <ClubFeed />;
  if (a === 'compte') return <Account />;
  return <Home />;
}

function Nav() {
  const { parts } = useRoute();
  const da = useSyncExternalStore(subscribeDA, getDA);
  const s = parts[0] ?? '';
  const items: { href: string; label: string; icon: IconName; on: boolean }[] = [
    { href: '#/', label: 'Carnet', icon: 'book', on: s === '' || s === 'main' || s === 'voir' },
    { href: '#/noter', label: 'Noter', icon: 'pen', on: s === 'noter' },
    { href: '#/club', label: 'Club', icon: 'vote', on: s === 'club' },
    { href: '#/compte', label: 'Compte', icon: 'user', on: s === 'compte' },
  ];
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="/" title="Retour à PPC Poker Tools">
            <img src={`${import.meta.env.BASE_URL}${logoFile(da)}`} alt="" />
            <div><span>Penthièvre Poker Club</span><b>Carnet de mains</b></div>
          </a>
          <span className="spacer" />
          <nav className="nav" aria-label="Navigation principale">
            {items.map(i => <a key={i.href} href={i.href} className={i.on ? 'on' : ''} aria-current={i.on ? 'page' : undefined}><Icon name={i.icon} size={17} />{i.label}</a>)}
          </nav>
          <button type="button" className="ppc-da-switch" onClick={toggleDA} title="Changer de direction artistique" aria-label="Changer de direction artistique" />
        </div>
      </header>
      <nav className="bottomnav" aria-label="Navigation principale">
        {items.map(i => <a key={i.href} href={i.href} className={i.on ? 'on' : ''} aria-current={i.on ? 'page' : undefined}><Icon name={i.icon} size={21} />{i.label}</a>)}
      </nav>
    </>
  );
}

function DemoBar() {
  const confirm = useConfirm();
  const demo = club as DemoClub;
  return (
    <div className="demobar">
      <div className="demobar-in">
        <span>Démo : club fictif, rien n'est envoyé.</span>
        <label>Voir en tant que{' '}
          <select className="demorole" defaultValue={demo.role()} onChange={e => demo.setRole(e.target.value as DemoRole)}>
            <option value="member">adhérent</option>
            <option value="staff">gestionnaire</option>
            <option value="anon">visiteur</option>
          </select>
        </label>
        <button onClick={async () => { if (await confirm({ title: 'Réinitialiser la démo ?', text: 'Les votes et publications d\'essai seront effacés. Ton carnet n\'est pas touché.', ok: 'Réinitialiser' })) { demo.reset(); location.reload(); } }}>Réinitialiser</button>
        <a href={import.meta.env.BASE_URL} style={{ color: 'inherit' }}>Quitter la démo</a>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <UiProvider>
      {isDemo && <DemoBar />}
      <Nav />
      <main className="main"><Page /></main>
    </UiProvider>
  );
}
