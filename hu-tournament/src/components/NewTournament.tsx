import { useState } from 'react';
import { type Format, FORMAT_LABEL, suggestedRounds } from '../lib/tournament';

interface Props {
  onCreate: (name: string, players: string[], format: Format, rounds: number) => void;
  onCancel: () => void;
}

export function NewTournament({ onCreate, onCancel }: Props) {
  const [name, setName] = useState(`Tournoi HU du ${new Date().toLocaleDateString('fr-FR')}`);
  const [text, setText] = useState('');
  const [format, setFormat] = useState<Format>('swiss');
  const [roundsOverride, setRoundsOverride] = useState<number | null>(null);

  const players = [...new Set(text.split(/\n|,|;/).map(s => s.trim()).filter(Boolean))];
  const dupes = text.split(/\n|,|;/).map(s => s.trim()).filter(Boolean).length - players.length;
  const suggested = suggestedRounds(players.length);
  const rounds = roundsOverride ?? suggested;

  return (
    <div className="card">
      <h2>Nouveau tournoi</h2>
      <label>Nom</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} />

      <label>Format</label>
      <div className="fmt">
        {(['swiss', 'elimination'] as Format[]).map(f => (
          <button key={f} className={`fmt-btn${format === f ? ' on' : ''}`} onClick={() => setFormat(f)}>
            <b>{FORMAT_LABEL[f]}</b>
            <span>{f === 'swiss'
              ? 'Personne n\'est éliminé : gagnants contre gagnants, perdants contre perdants. Classement global de la soirée.'
              : 'Le perdant de chaque HU est éliminé, jusqu\'au vainqueur.'}</span>
          </button>
        ))}
      </div>

      <label>Joueurs — un par ligne ({players.length}{dupes > 0 ? `, ${dupes} doublon${dupes > 1 ? 's' : ''} ignoré${dupes > 1 ? 's' : ''}` : ''})</label>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={'Erwin\nMarie\nJulien\n…'} autoFocus />

      {format === 'swiss' && players.length >= 2 && (
        <div className="row" style={{ marginTop: 10 }}>
          <label style={{ margin: 0 }}>Nombre de tours</label>
          <button className="btn sm" disabled={rounds <= 1} onClick={() => setRoundsOverride(rounds - 1)}>−</button>
          <b style={{ minWidth: 20, textAlign: 'center' }}>{rounds}</b>
          <button className="btn sm" onClick={() => setRoundsOverride(rounds + 1)}>+</button>
          <span className="muted">
            {rounds === suggested ? `conseillé pour ${players.length} joueurs` : `conseillé : ${suggested}`}
            {' · '}tu pourras en ajouter en cours de soirée
          </span>
        </div>
      )}
      {players.length > 0 && players.length % 2 === 1 && (
        <p className="muted" style={{ marginTop: 6 }}>
          Nombre impair : à chaque tour, un joueur est exempté{format === 'swiss' ? ' (compte comme une victoire)' : ''}.
        </p>
      )}

      <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>Annuler</button>
        <button className="btn primary" disabled={players.length < 2 || !name.trim()} onClick={() => onCreate(name.trim(), players, format, rounds)}>
          Créer et tirer le 1er tour
        </button>
      </div>
    </div>
  );
}
