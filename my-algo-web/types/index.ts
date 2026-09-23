export type Card = {
  color: "black" | "white";
  number: number | null;
  isOpen: boolean;
  id: string;
  allowedGuesses?: number[];
};

export type Player = {
  id: string;
  name?: string;
  hand: Card[];
  isCpu?: boolean;
};

export type RatingUpdate = {
  old: number;
  new: number;
  diff: number;
};

export type GameState = {
  phase: string;
  turnPlayerId: string | null;
  me: Player;
  players: Player[];
  opponentHand: Card[];
  drawnCard: Card | null;
  winner: string | null;
  deckCount: number;
  canStay?: boolean;
  ratingUpdates?: Record<string, RatingUpdate> | null;
};

export type LogItem = {
  text: string;
  type: "attack" | "defense" | "system" | "reveal";
  timestamp: number;
};

export type Lang = "ja" | "en";

export type User = {
  id: string;
  google_id: string;
  name: string;
  rate: number;
  wins: number;
  matches: number;
  created_at: string;
};

export type RankingItem = {
  name: string;
  rate: number;
  wins: number;
};
