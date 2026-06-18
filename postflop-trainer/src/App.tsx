import { useState, useCallback } from 'react';
import type { GameState, Range } from './types';
import { isHeroIP } from './lib/game';
import { pickHandFromRange } from './lib/handPicker';
import { dealCards } from './lib/cards';
import { getNextActor } from './lib/game';
import SetupPage from './pages/SetupPage';
import GamePage from './pages/GamePage';
import type { Card } from './types';

type AppPhase = 'setup' | 'game';

interface Session {
  apiKey: string;
  heroRange: Range;
  villainRange: Range;
}

function buildNewGame(session: Session): GameState | null {
  const { heroRange, villainRange } = session;

  const heroIsIP = isHeroIP(heroRange.position, villainRange.position);

  // Pick hero's hand
  const picked = pickHandFromRange(heroRange);
  if (!picked) return null;

  const { handType, cards: heroHand } = picked;

  // Deal flop (avoid hero's cards)
  const flop = dealCards(3, [...heroHand]) as Card[];

  // Determine starting phase: OOP acts first
  const initialStreetActions = [] as GameState['streetActions'];
  const next = getNextActor(initialStreetActions, heroIsIP);

  let phase: GameState['phase'];
  if (next.who === 'hero') phase = 'hero_turn';
  else if (next.who === 'villain') phase = 'villain_turn';
  else phase = 'hero_turn';

  // SRP pot: approx 6bb (open 2.5 + call 2.5 + blinds); effective stack ~94bb
  const pot = 6.5;
  const stack = (heroRange.stackBB ?? 100) - 3; // subtract hero's preflop investment

  return {
    heroRange,
    villainRange,
    heroHand,
    heroHandType: handType,
    board: flop,
    street: 'flop',
    pot,
    heroStack: stack,
    villainStack: stack,
    heroIsIP,
    allActions: [],
    streetActions: [],
    phase,
    lastComment: null,
    lastVillainAction: null,
    handReview: null,
    error: null,
  };
}

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>('setup');
  const [session, setSession] = useState<Session | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const handleStart = useCallback((params: { apiKey: string; heroRange: Range; villainRange: Range }) => {
    const newGame = buildNewGame(params);
    if (!newGame) {
      alert('Impossible de piocher une main depuis cette range. Vérifiez qu\'elle contient des mains jouables.');
      return;
    }
    setSession(params);
    setGame(newGame);
    setAppPhase('game');
  }, []);

  const handleNewHand = useCallback(() => {
    if (!session) { setAppPhase('setup'); return; }
    const newGame = buildNewGame(session);
    if (!newGame) {
      alert('Impossible de piocher une main depuis cette range.');
      setAppPhase('setup');
      return;
    }
    setGame(newGame);
    setGameKey(k => k + 1);
  }, [session]);

  if (appPhase === 'game' && game && session) {
    return <GamePage key={gameKey} game={game} apiKey={session.apiKey} onNewHand={handleNewHand} />;
  }

  return <SetupPage onStart={handleStart} />;
}
