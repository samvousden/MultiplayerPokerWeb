// Card Enums & Types
export enum Suit {
  Clubs = 0,
  Diamonds = 1,
  Hearts = 2,
  Spades = 3,
}

export enum Rank {
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Ace = 14,
}

export interface Card {
  suit: Suit;
  rank: Rank;
}

export function cardToString(card: Card): string {
  const rankNames: Record<Rank, string> = {
    [Rank.Two]: '2',
    [Rank.Three]: '3',
    [Rank.Four]: '4',
    [Rank.Five]: '5',
    [Rank.Six]: '6',
    [Rank.Seven]: '7',
    [Rank.Eight]: '8',
    [Rank.Nine]: '9',
    [Rank.Ten]: '10',
    [Rank.Jack]: 'J',
    [Rank.Queen]: 'Q',
    [Rank.King]: 'K',
    [Rank.Ace]: 'A',
  };

  const suitSymbols: Record<Suit, string> = {
    [Suit.Clubs]: '♣',
    [Suit.Diamonds]: '♦',
    [Suit.Hearts]: '♥',
    [Suit.Spades]: '♠',
  };

  return `${rankNames[card.rank]}${suitSymbols[card.suit]}`;
}

export const JOKER_CARD: Card = { suit: -1 as unknown as Suit, rank: -1 as unknown as Rank };

export function isJokerCard(card: Card): boolean {
  return (card.suit as number) === -1 && (card.rank as number) === -1;
}

export function cardToDisplayString(card: Card): string {
  if (isJokerCard(card)) return '🃏 Joker';
  return cardToString(card);
}
