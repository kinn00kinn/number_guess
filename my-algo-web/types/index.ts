export type Card = {
  color: "black" | "white";
  number: number | null;
  isOpen: boolean;
  id: string;
};

export type Player = {
  id: string;
  hand: Card[];
};

export type GameState = {
  phase: string;
  turnPlayerId: string | null;
  me: Player;
  opponentHand: Card[];
  drawnCard: Card | null;
  winner: string | null;
  deckCount: number;
};

export type LogItem = {
  text: string;
  type: "attack" | "defense" | "system" | "reveal";
  timestamp: number;
};

export type Lang = "ja" | "en";
