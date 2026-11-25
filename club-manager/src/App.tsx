import { useEffect } from 'react';
import { ClubProvider, api, demo, isDemo, useClub } from './lib/club';
import type { DemoRole } from './lib/demoApi';
import { useRoute } from './lib/router';
import { Icon, Loading, UiProvider, useConfirm, type IconName } from './components/ui';
import { Home } from './pages/Home';
import { Tournaments } from './pages/Tournaments';
import { TournamentPage } from './pages/Tournament';
import { TournamentEdit } from './pages/TournamentEdit';
import { ClockScreen } from './pages/ClockScreen';
import { Championships } from './pages/Championships';
import { ChampionshipPage } from './pages/Championship';
import { ChampionshipEdit } from './pages/ChampionshipEdit';
import { Structures } from './pages/Structures';
import { StructureEdit } from './pages/StructureEdit';
import { Members } from './pages/Members';
import { PlayerPage } from './pages/Player';
import { Account, NewPassword } from './pages/Account';

export default function App() {
  return (
    <UiProvider>
      <ClubProvider>
        <Shell />
      </ClubProvider>
    </UiProvider>
  );
}

function Shell() {
  const club = useClub();
  const route = useRoute();
  const [a = '', b = '', c = ''] = route.parts;

  useEffect(() => { document.title = 'Championnats et tournois · PPC'; }, [a, b]);

  if (!club.ready) return <Loading />;
  if (!club.installed) return <NotInstalledPage />;
  if (a === 't' && b && c === 'horloge') return <ClockScreen key={b} id={b} />;

  return (
    <>
      <div className="ppc-stripe" aria-hidden="true" />
      {isDemo && <DemoBar />}
      <TopBar section={a} />
      <main className="main">{club.recovering ? <NewPassword /> : page()}</main>
    </>
  );

  function page() {
    const staffOnly = (node: React.ReactNode) => club.isStaff ? node : <Forbidden />;
    switch (a) {
      case '': return <Home />;
      case 'tournois': return b === 'nouveau' ? staffOnly(<TournamentEdit key="new" />) : <Tournaments />;
      case 't': return c === 'modifier' ? staffOnly(<TournamentEdit key={b} id={b} />) : <TournamentPage key={b} id={b} tab={c} />;
      case 'championnats': return b === 'nouveau' ? staffOnly(<ChampionshipEdit key="new" />) : <Championships />;
      case 'c': return c === 'modifier' ? staffOnly(<ChampionshipEdit key={b} id={b} />) : <ChampionshipPage key={b} id={b} tab={c} />;
      case 'structures': return b ? staffOnly(<StructureEdit key={b} id={b === 'nouveau' ? undefined : b} />) : staffOnly(<Structures />);
      case 'adherents': return staffOnly(<Members />);
      case 'j': return <PlayerPage key={b} id={b} />;
      case 'compte': return <Account />;
      default: return <Home />;
    }
  }
}

function Forbidden() {
  return (
    <div className="empty">
      <b>Page réservée aux gestionnaires</b>
      <a className="btn" href="#/">Retour à l'accueil</a>
    </div>
  );
}

const Badge = ({ n = 0 }: { n?: number }) => n > 0 ? <span className="badge"><span aria-hidden="true">{n}</span><span className="sr-only">, {n > 1 ? `${n} comptes` : '1 compte'} à valider</span></span> : null;

function TopBar({ section }: { section: string }) {
  const { isStaff, me, user, pending } = useClub();
  const items: { href: string; label: string; short?: string; icon: IconName; on: boolean; count?: number }[] = [
    { href: '#/', label: 'Accueil', icon: 'home', on: section === '' },
    { href: '#/tournois', label: 'Tournois', icon: 'calendar', on: section === 'tournois' || section === 't' },
    { href: '#/championnats', label: 'Championnats', short: 'Classement', icon: 'trophy', on: section === 'championnats' || section === 'c' },
    ...(isStaff ? [
      { href: '#/structures', label: 'Structures', short: 'Blindes', icon: 'layers' as const, on: section === 'structures' },
      { href: '#/adherents', label: 'Adhérents', icon: 'users' as const, on: section === 'adherents', count: pending },
    ] : []),
    { href: '#/compte', label: me ? me.name.split(' ')[0] : user ? 'Mon compte' : 'Connexion', short: user ? 'Compte' : 'Connexion', icon: 'user', on: section === 'compte' },
  ];
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <a className="brand" href="/" title="Retour à PPC Poker Tools">
            <img src={`${import.meta.env.BASE_URL}logo-ppc.png`} alt="" />
            <div><span>Penthièvre Poker Club</span><b>Le Club</b></div>
          </a>
          <span className="spacer" />
          <nav className="nav" aria-label="Navigation principale">
            {items.map(i => <a key={i.href} href={i.href} className={i.on ? 'on' : ''} aria-current={i.on ? 'page' : undefined}><Icon name={i.icon} size={17} />{i.label}<Badge n={i.count} /></a>)}
          </nav>
        </div>
      </header>
      <nav className="bottomnav" aria-label="Navigation principale">
        {items.map(i => <a key={i.href} href={i.href} className={i.on ? 'on' : ''} aria-current={i.on ? 'page' : undefined}><Icon name={i.icon} size={21} />{i.short ?? i.label}<Badge n={i.count} /></a>)}
      </nav>
    </>
  );
}

function DemoBar() {
  const confirm = useConfirm();
  const { refresh } = useClub();
  return (
    <div className="demobar">
      <div className="demobar-in">
        <span>Démo : club fictif, rien n'est publié.</span>
        <label>Voir en tant que{' '}
          <select className="demorole" value={demo!.role()} onChange={e => { demo!.setRole(e.target.value as DemoRole); void refresh(); }}>
            <option value="admin">administrateur</option>
            <option value="director">gestionnaire</option>
            <option value="member">adhérent</option>
            <option value="pending">nouveau compte</option>
            <option value="anon">visiteur</option>
          </select>
        </label>
        <button onClick={async () => { if (await confirm({ title: 'Réinitialiser la démo ?', text: 'Toutes tes modifications d\'essai seront perdues.', ok: 'Réinitialiser' })) { demo!.reset(); location.hash = '#/'; } }}>Réinitialiser</button>
        <a href={import.meta.env.BASE_URL} style={{ color: 'inherit' }}>Quitter la démo</a>
      </div>
    </div>
  );
}

function NotInstalledPage() {
  return (
    <>
      <div className="ppc-stripe" aria-hidden="true" />
      <main className="main" style={{ maxWidth: 640 }}>
        <div className="pagehead"><div>
          <h1>Bientôt ouvert</h1>
          <p>L'espace championnats et tournois du club n'est pas encore activé.</p>
        </div></div>
        <div className="card">
          <p style={{ marginBottom: 14 }}>Tu peux déjà découvrir toutes les fonctions avec un club fictif.</p>
          <div className="row">
            <a className="btn primary" href={`${import.meta.env.BASE_URL}?demo`}>Essayer la démo</a>
            <a className="btn" href="/">Retour à PPC Poker Tools</a>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          Pour l'administrateur : exécuter <code>club-manager/supabase/001_club.sql</code> dans Supabase (voir SETUP.md).
          {api.kind === 'cloud' && <> <button className="btn sm" onClick={() => location.reload()}>Vérifier à nouveau</button></>}
        </p>
      </main>
    </>
  );
}
