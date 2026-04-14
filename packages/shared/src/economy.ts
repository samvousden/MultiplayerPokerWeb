import { Card, Rank, Suit, isJokerCard } from './card.js';

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
  Joker = 32,
  XRayGoggles = 40,
  Rake = 41,
  HiddenCamera = 42,
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
  UseXRayGoggles = 40,
  UseHiddenCamera = 41,
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
  hasRake: boolean;
  hiddenCameraCharges: number;
}

export enum ShopItemRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
}

export interface ShopSlotItem {
  type: ShopItemType;
  price: number;
  name: string;
  description: string;
  rarity: ShopItemRarity;
  previewCard?: Card; // For ExtraCard only
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
  Joker: 100,
  XRayGoggles: 150,
  Rake: 300,
  HiddenCamera: 150,
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
    [ShopItemType.Joker]: 100,
    [ShopItemType.XRayGoggles]: 150,
    [ShopItemType.Rake]: 300,
    [ShopItemType.HiddenCamera]: 150,
  };
  return prices[item];
}

export function getCardPrice(card: Card): number {
  if (isJokerCard(card)) return 100;
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

export function getShopItemInfo(type: ShopItemType): { name: string; description: string } {
  const info: Record<ShopItemType, { name: string; description: string }> = {
    [ShopItemType.None]: { name: '', description: '' },
    [ShopItemType.BankAccountUnlock]: { name: 'Bank Account', description: 'Unlock a bank account' },
    [ShopItemType.SleeveCard]: { name: 'Sleeve Card', description: 'A card for your sleeve' },
    [ShopItemType.XrayCharge]: { name: 'X-Ray Charge', description: 'Peek at the next deck card' },
    [ShopItemType.Cigarette]: { name: 'Cigarette', description: 'Increases luck' },
    [ShopItemType.Gun]: { name: 'Gun', description: 'A weapon' },
    [ShopItemType.Bullet]: { name: 'Bullet', description: 'Ammo for the gun' },
    [ShopItemType.CardSleeveUnlock]: { name: 'Card Sleeve Unlock', description: 'Hold a card in your sleeve to swap with a hole card before showdown' },
    [ShopItemType.ExtraCard]: { name: 'Extra Card', description: 'A random card from the deck to put in your sleeve' },
    [ShopItemType.Joker]: { name: 'Joker', description: 'A wild card that becomes the best possible card at showdown' },
    [ShopItemType.XRayGoggles]: { name: 'X-Ray Goggles', description: 'Peek at the next community card (3 charges)' },
    [ShopItemType.Rake]: { name: 'Rake', description: 'Secretly take 5% of every pot' },
    [ShopItemType.HiddenCamera]: { name: 'Hidden Camera', description: 'See one of an opponent\'s hole cards at random (3 charges)' },
  };
  return info[type];
}

export function getEligibleShopItems(state: PlayerPrivateState): ShopItemType[] {
  const items: ShopItemType[] = [];

  // One-time unlocks
  if (!state.hasCardSleeveUnlock) items.push(ShopItemType.CardSleeveUnlock);
  if (!state.hasRake) items.push(ShopItemType.Rake);

  // Card sleeve items (requires unlock + empty sleeve)
  if (state.hasCardSleeveUnlock && state.sleeveCard === null) {
    items.push(ShopItemType.ExtraCard);
    items.push(ShopItemType.Joker);
  }

  // Charge-based items (can rebuy when charges are 0)
  if (state.xrayCharges === 0) items.push(ShopItemType.XRayGoggles);
  if (state.hiddenCameraCharges === 0) items.push(ShopItemType.HiddenCamera);

  return items;
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
