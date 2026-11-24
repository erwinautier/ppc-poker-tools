import { useEffect, useState } from 'react';
import { NewTournament } from './components/NewTournament';
import { TournamentView } from './components/TournamentView';
import { type Tournament, createTournament, loadTournaments, saveTournaments, champion, finished, FORMAT_LABEL } from './lib/tournament';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'show'; id: string };

export default function App() {
  const [list, setList] = useState<Tournament[]>(loadTournaments);
  const [view, setView] = useState<View>(() => (loadTournaments().length ? { kind: 'list' } : { kind: 'new' }));

  useEffect(() => { saveTournaments(list); }, [list]);

  function update(t: Tournament) {
    setList(l => l.map(x => (x.id === t.id ? t : x)));
  }

  const current = view.kind === 'show' ? list.find(t => t.id === view.id) : undefined;

  return (
    <div className="page">
      <div className="header">
        <a href="/" title="Accueil"><img src={`${import.meta.env.BASE_URL}logo-ppc.png`} alt="PPC" /></a>
        <div>
          <h1>{current ? current.name : 'Tournoi HU'}</h1>
          <div className="sub">{current ? FORMAT_LABEL[current.format] : 'Organisation de tournois heads-up'}</div>
        </div>
      </div>

      {view.kind === 'new' && (
        <NewTournament
          onCancel={() => setView({ kind: 'list' })}
          onCreate={(name, players, format, rounds) => {
            const t = createTournament(name, players, format, rounds);
            setList(l => [t, ...l]);
            setView({ kind: 'show', id: t.id });
          }}
        />
      )}

      {view.kind === 'list' && (
        <>
          <button className="btn primary block" style={{ marginBottom: 14 }} onClick={() => setView({ kind: 'new' })}>
            + Nouveau tournoi
          </button>
          {list.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center' }}>Aucun tournoi pour l'instant.</p>
          ) : (
            <div className="tlist">
              {list.map(t => {
                const c = champion(t);
                const done = finished(t);
                return (
                  <div className="titem" key={t.id} onClick={() => setView({ kind: 'show', id: t.id })}>
                    <div style={{ flex: 1 }}>
                      <div className="name">{t.name}</div>
                      <div className="muted">
                        {FORMAT_LABEL[t.format]} · {t.players.length} joueurs · {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                        {c && ` · 🏆 ${t.players.find(p => p.id === c)?.name}`}
                      </div>
                    </div>
                    <span className={`status ${done ? 'done' : 'live'}`}>{done ? 'Terminé' : `Tour ${t.rounds.length}`}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="muted" style={{ marginTop: 20, textAlign: 'center' }}>
            Les tournois sont enregistrés sur cet appareil uniquement.
          </p>
        </>
      )}

      {view.kind === 'show' && current && (
        <TournamentView
          t={current}
          onChange={update}
          onBack={() => setView({ kind: 'list' })}
          onDelete={() => { setList(l => l.filter(x => x.id !== current.id)); setView({ kind: 'list' }); }}
        />
      )}
      {view.kind === 'show' && !current && (
        <button className="btn" onClick={() => setView({ kind: 'list' })}>← Retour</button>
      )}
    </div>
  );
}
