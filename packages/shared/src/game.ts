export enum BettingRound {
  None = 0,
  Preflop = 1,
  Flop = 2,
  Turn = 3,
  River = 4,
}

export enum HandPhase {
  Lobby = 0,
  Dealing = 1,
  Betting = 2,
  Showdown = 3,
  Payout = 4,
}

export enum PokerActionType {
  Fold = 0,
  Check = 1,
  Call = 2,
  RaiseTo = 3,
}

export interface PokerAction {
  type: PokerActionType;
  raiseToAmount?: number;
}

export interface PlayerPublicState {
  id: number;
  name: string;
  stack: number;
  committedThisRound: number;
  contributedThisHand: number;
  isSeated: boolean;
  isReady: boolean;
  isInHand: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
}

export interface GameState {
  phase: HandPhase;
  round: BettingRound;
  dealerPlayerId: number;
  activePlayerId: number;
  pot: number;
  currentBetToMatch: number;
  players: PlayerPublicState[];
  board: Card[];
  caughtCheaterPlayerId: number | null;
}

import { Card } from './card';
