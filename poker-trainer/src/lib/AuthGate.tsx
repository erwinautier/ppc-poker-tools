import { useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';

type Mode = 'login' | 'signup' | 'reset';

function AuthForm({ onSuccess }: { onSuccess?: () => void }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'login') {
        const err = await signIn(email, password);
        if (err) setError(err.message);
        else onSuccess?.();
      } else if (mode === 'signup') {
        if (!username.trim()) { setError('Choisis un pseudo'); return; }
        const err = await signUp(email, password, username.trim());
        if (err) setError(err.message);
        else setInfo('Inscription réussie ! Vérifie ton email pour confirmer ton compte. Le club le validera ensuite.');
      } else {
        const err = await resetPassword(email);
        if (err) setError(err.message);
        else setInfo('Email de réinitialisation envoyé.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12, padding: '2rem',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <img
            src={`${import.meta.env.BASE_URL}logo-ppc.png`}
            alt="PPC"
            style={{ height: 48, borderRadius: 8, marginBottom: '0.75rem' }}
          />
          <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem' }}>
            PPC Poker Tools
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
            {mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié'}
          </div>
        </div>

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {mode === 'signup' && (
            <input
              type="text" placeholder="Pseudo" value={username}
              onChange={e => setUsername(e.target.value)}
              required style={inputStyle}
            />
          )}
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            required style={inputStyle}
          />
          {mode !== 'reset' && (
            <input
              type="password" placeholder="Mot de passe" value={password}
              onChange={e => setPassword(e.target.value)}
              required minLength={6} style={inputStyle}
            />
          )}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', background: 'var(--danger-bg)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
              {error}
            </div>
          )}
          {info && (
            <div style={{ color: 'var(--success)', fontSize: '0.8rem', background: 'var(--success-bg)', borderRadius: 6, padding: '0.5rem 0.75rem' }}>
              {info}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: '0.25rem', padding: '0.65rem', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              fontSize: '0.9rem',
            }}
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? "S'inscrire" : 'Envoyer'}
          </button>
        </form>

        {/* Toggle links */}
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('signup'); setError(''); setInfo(''); }} style={linkStyle}>
                Pas encore de compte ? S'inscrire
              </button>
              <button onClick={() => { setMode('reset'); setError(''); setInfo(''); }} style={linkStyle}>
                Mot de passe oublié
              </button>
            </>
          )}
          {mode !== 'login' && (
            <button onClick={() => { setMode('login'); setError(''); setInfo(''); }} style={linkStyle}>
              ← Retour à la connexion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem', borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const linkStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--accent)', fontSize: '0.8rem', textDecoration: 'underline',
};

function WaitingScreen({ refused, signOut }: { refused: boolean; signOut: () => void }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 380, textAlign: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '2rem',
      }}>
        <img
          src={`${import.meta.env.BASE_URL}logo-ppc.png`}
          alt="PPC"
          style={{ display: 'block', height: 48, borderRadius: 8, margin: '0 auto 0.75rem' }}
        />
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.1rem', margin: 0 }}>
          {refused ? 'Compte non validé' : 'Compte en attente de validation'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: '0.75rem 0 1.25rem' }}>
          {refused
            ? "Le Penthièvre Poker Club n'a pas validé ce compte. Si c'est une erreur, contacte le bureau du club."
            : 'Un administrateur ou un gestionnaire du Penthièvre Poker Club doit valider ton compte. Tu pourras ensuite utiliser tous les outils.'}
        </p>
        {!refused && (
          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%', padding: '0.65rem', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 600,
              cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Vérifier à nouveau
          </button>
        )}
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
          {!refused && <a href="/club/#/compte" style={linkStyle}>Indiquer mon nom au club</a>}
          <button onClick={signOut} style={linkStyle}>Se déconnecter</button>
        </div>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();

  if (state.status === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Chargement…</div>
      </div>
    );
  }

  if (state.status === 'unauthenticated') {
    return <AuthForm />;
  }

  if (state.status === 'pending' || state.status === 'refused') {
    return <WaitingScreen refused={state.status === 'refused'} signOut={signOut} />;
  }

  // Inject signOut + username into children via context
  return (
    <AuthContext.Provider value={{ username: state.profile.username, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Context for username / signOut accessible anywhere in the app
import { createContext, useContext } from 'react';

type AuthCtx = { username: string; signOut: () => void };
const AuthContext = createContext<AuthCtx>({ username: '', signOut: () => {} });
export const useAuthContext = () => useContext(AuthContext);
