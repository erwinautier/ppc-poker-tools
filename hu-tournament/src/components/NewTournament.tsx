import { useState } from 'react';

interface Props {
  onCreate: (name: string, players: string[]) => void;
  onCancel: () => void;
}

export function NewTournament({ onCreate, onCancel }: Props) {
  const [name, setName] = useState(`Tournoi HU du ${new Date().toLocaleDateString('fr-FR')}`);
  const [text, setText] = useState('');

  const players = [...new Set(text.split(/\n|,|;/).map(s => s.trim()).filter(Boolean))];
  const dupes = text.split(/\n|,|;/).map(s => s.trim()).filter(Boolean).length - players.length;

  return (
    <div className="card">
      <h2>Nouveau tournoi</h2>
      <label>Nom</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} />
      <label>Joueurs — un par ligne ({players.length}{dupes > 0 ? `, ${dupes} doublon${dupes > 1 ? 's' : ''} ignoré${dupes > 1 ? 's' : ''}` : ''})</label>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'Erwin\nMarie\nJulien\n…'}
        autoFocus
      />
      {players.length > 0 && players.length % 2 === 1 && (
        <p className="muted" style={{ marginTop: 6 }}>Nombre impair : un joueur tiré au sort sera exempté au premier tour.</p>
      )}
      <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onCancel}>Annuler</button>
        <button className="btn primary" disabled={players.length < 2 || !name.trim()} onClick={() => onCreate(name.trim(), players)}>
          Créer et tirer le 1er tour
        </button>
      </div>
    </div>
  );
}
