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
  ranges: Range[]; // pool of ranges to draw from each hand
}

function pickTwoRanges(ranges: Range[]): [Range, Range] | null {
  // Build all valid pairs with different positions
  const pairs: [Range, Range][] = [];
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (ranges[i].position !== ranges[j].position) {
        pairs.push([ranges[i], ranges[j]]);
      }
    }
  }
  if (pairs.length === 0) return null;
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
  // Randomly assign hero/villain
  return Math.random() < 0.5 ? [a, b] : [b, a];
}

function buildNewGame(session: Session): GameState | null {
  const pair = pickTwoRanges(session.ranges);
  if (!pair) return null;
  const [heroRange, villainRange] = pair;

  const heroIsIP = isHeroIP(heroRange.position, villainRange.position);

  // Pick hero's hand
  const picked = pickHandFromRange(heroRange);
  if (!picked) return null;
  const { handType, cards: heroHand } = picked;

  // Pick villain's hand (avoid hero cards) — kept hidden during play, used for consistent AI simulation
  const villainPicked = pickHandFromRange(villainRange, [...heroHand]);
  if (!villainPicked) return null;
  const { handType: villainHandType, cards: villainPickedHand } = villainPicked;

  // Deal flop (avoid both hands)
  const flop = dealCards(3, [...heroHand, ...villainPickedHand]) as Card[];

  // Determine starting phase: OOP acts first
  const initialStreetActions = [] as GameState['streetActions'];
  const next = getNextActor(initialStreetActions, heroIsIP);

  let phase: GameState['phase'];
  if (next.who === 'hero') phase = 'hero_turn';
  else if (next.who === 'villain') phase = 'villain_turn';
  else phase = 'hero_turn';

  // SRP pot: approx 6.5bb (open 2.5 + call 2.5 + blinds)
  const pot = 6.5;
  const stack = (heroRange.stackBB ?? 100) - 3;

  return {
    heroRange,
    villainRange,
    heroHand,
    heroHandType: handType,
    villainPickedHand,
    villainPickedHandType: villainHandType,
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

  const handleStart = useCallback((params: { apiKey: string; ranges: Range[] }) => {
    const newGame = buildNewGame(params);
    if (!newGame) {
      alert('Impossible de piocher une main depuis ces ranges. Vérifiez qu\'elles contiennent des mains jouables.');
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
