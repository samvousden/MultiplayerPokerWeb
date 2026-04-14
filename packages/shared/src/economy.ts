import { Card, Rank } from './card.js';

export enum ShopItemType {
  None = 0,
  BankAccountUnlock = 1,
  SleeveCard = 10,
  XrayCharge = 11,
  Cigarette = 12,
  Gun = 20,
  Bullet = 21,
  CardSleeveUnlock = 30,
  ExtraCard = 31,
}

export enum UseItemType {
  None = 0,
  DepositToBank = 1,
  WithdrawFromBank = 2,
  PeekNextDeckCard = 10,
  UseSleeveCardReplaceHoleA = 11,
  UseSleeveCardReplaceHoleB = 12,
  SmokeCigarette = 20,
  UseSleeveCardSwapHoleA = 21,
  UseSleeveCardSwapHoleB = 22,
  ShootPlayer = 30,
}

export interface PlayerPrivateState {
  hasBankAccount: boolean;
  bankBalance: number;
  hasGun: boolean;
  bullets: number;
  hasCardSleeveUnlock: boolean;
  sleeveCard: Card | null;
  xrayCharges: number;
  luckLevel: number; // from cigarettes
}

export const ShopCatalog = {
  BankAccountUnlock: 250,
  SleeveCard: 40,
  XrayCharge: 10,
  Cigarette: 25,
  Gun: 400,
  Bullet: 30,
  CardSleeveUnlock: 200,
  ExtraCard: 0, // Dynamic pricing applied at purchase time based on card rank
} as const;

export function getPrice(item: ShopItemType): number {
  const prices: Record<ShopItemType, number> = {
    [ShopItemType.None]: Infinity,
    [ShopItemType.BankAccountUnlock]: 250,
    [ShopItemType.SleeveCard]: 40,
    [ShopItemType.XrayCharge]: 10,
    [ShopItemType.Cigarette]: 25,
    [ShopItemType.Gun]: 400,
    [ShopItemType.Bullet]: 30,
    [ShopItemType.CardSleeveUnlock]: 200,
    [ShopItemType.ExtraCard]: 0, // Dynamic; use getCardPrice() instead
  };
  return prices[item];
}

export function getCardPrice(card: Card): number {
  // Number cards (2-10): $30, Face cards (J/Q/K): $40, Ace: $50
  if (card.rank >= Rank.Two && card.rank <= Rank.Ten) {
    return 30;
  } else if (card.rank >= Rank.Jack && card.rank <= Rank.King) {
    return 40;
  } else if (card.rank === Rank.Ace) {
    return 50;
  }
  return 0; // Fallback
}

export function isStackable(item: ShopItemType): boolean {
  const stackableItems = [
    ShopItemType.SleeveCard,
    ShopItemType.XrayCharge,
    ShopItemType.Cigarette,
    ShopItemType.Bullet,
  ];
  return stackableItems.includes(item);
}

export function requiresGunForBullets(item: ShopItemType): boolean {
  return item === ShopItemType.Bullet;
}
