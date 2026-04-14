import { Card, Rank, Suit, isJokerCard } from './card.js';

export enum ShopItemType {
  None = 0,
  BankAccountUnlock = 1,
  SleeveCard = 10,
  XrayCharge = 11,
  Cigarette = 12,
  Whiskey = 13,
  LuckyCharm = 14,
  Gun = 20,
  Bullet = 21,
  CardSleeveUnlock = 30,
  ExtraCard = 31,
  Joker = 32,
  SleeveExtender = 33,
  XRayGoggles = 40,
  Rake = 41,
  HiddenCamera = 42,
  Bond = 50,
  StockOption = 51,
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
  UseSleeveCard2SwapHoleA = 23,
  UseSleeveCard2SwapHoleB = 24,
  ShootPlayer = 30,
  UseXRayGoggles = 40,
  UseHiddenCamera = 41,
  CashOutBond = 50,
  CashOutStockOption = 51,
}

export interface LuckBuff {
  amount: number;
  turnsRemaining: number;
}

export interface BondState {
  roundsHeld: number; // increments each hand
}

export interface StockOptionState {
  roundsHeld: number; // increments each hand, cashable at 3+
}

export interface PlayerPrivateState {
  hasBankAccount: boolean;
  bankBalance: number;
  hasGun: boolean;
  bullets: number;
  hasCardSleeveUnlock: boolean;
  sleeveCard: Card | null;
  hasSleeveExtender: boolean;
  sleeveCard2: Card | null;
  xrayCharges: number;
  permanentLuck: number;
  luckBuffs: LuckBuff[];
  hasRake: boolean;
  hiddenCameraCharges: number;
  cheatedThisHand: boolean;
  bonds: BondState[];
  stockOptions: StockOptionState[];
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
  Whiskey: 50,
  LuckyCharm: 100,
  Gun: 400,
  Bullet: 30,
  CardSleeveUnlock: 200,
  ExtraCard: 0,
  Joker: 100,
  SleeveExtender: 300,
  XRayGoggles: 150,
  Rake: 300,
  HiddenCamera: 150,
  Bond: 150,
  StockOption: 100,
} as const;

export function getPrice(item: ShopItemType): number {
  const prices: Record<ShopItemType, number> = {
    [ShopItemType.None]: Infinity,
    [ShopItemType.BankAccountUnlock]: 250,
    [ShopItemType.SleeveCard]: 40,
    [ShopItemType.XrayCharge]: 10,
    [ShopItemType.Cigarette]: 25,
    [ShopItemType.Whiskey]: 50,
    [ShopItemType.LuckyCharm]: 100,
    [ShopItemType.Gun]: 400,
    [ShopItemType.Bullet]: 30,
    [ShopItemType.CardSleeveUnlock]: 200,
    [ShopItemType.ExtraCard]: 0,
    [ShopItemType.Joker]: 100,
    [ShopItemType.SleeveExtender]: 300,
    [ShopItemType.XRayGoggles]: 150,
    [ShopItemType.Rake]: 300,
    [ShopItemType.HiddenCamera]: 150,
    [ShopItemType.Bond]: 150,
    [ShopItemType.StockOption]: 100,
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
    [ShopItemType.Cigarette]: { name: 'Cigarette', description: '+5 luck for 5 hands' },
    [ShopItemType.Whiskey]: { name: 'Whiskey', description: '+10 luck for 3 hands' },
    [ShopItemType.LuckyCharm]: { name: 'Lucky Charm', description: 'Permanently +7 luck' },
    [ShopItemType.Gun]: { name: 'Gun', description: 'For use on dirty cheaters' },
    [ShopItemType.Bullet]: { name: 'Bullet', description: 'You show those dirty cheaters who they\'re messing with' },
    [ShopItemType.CardSleeveUnlock]: { name: 'Card Sleeve Unlock', description: 'A spot to hide a card in your sleeve' },
    [ShopItemType.ExtraCard]: { name: 'Extra Card', description: 'A random card from the deck to put in your sleeve' },
    [ShopItemType.SleeveExtender]: { name: 'Card Sleeve Extender', description: 'Expand your sleeve to hold a second card' },
    [ShopItemType.Joker]: { name: 'Joker', description: 'A wild card that becomes the best possible card at showdown' },
    [ShopItemType.XRayGoggles]: { name: 'X-Ray Goggles', description: 'Peek at the next community card (+3 charges)' },
    [ShopItemType.Rake]: { name: 'Rake', description: 'Secretly take 5% of every pot' },
    [ShopItemType.HiddenCamera]: { name: 'Hidden Camera', description: 'See one of an opponent\'s hole cards (+3 charges)' },
    [ShopItemType.Bond]: { name: 'Bond', description: 'Invest $150. Cash out value increases by $50 each hand' },
    [ShopItemType.StockOption]: { name: 'Stock Option', description: 'Invest $100. After 3 hands: 1/3 chance for $500, 2/3 chance for $0' },
  };
  return info[type];
}

export function getEligibleShopItems(state: PlayerPrivateState): ShopItemType[] {
  const items: ShopItemType[] = [];

  // One-time unlocks
  if (!state.hasCardSleeveUnlock) items.push(ShopItemType.CardSleeveUnlock);
  if (!state.hasRake) items.push(ShopItemType.Rake);

  // Card sleeve extender (requires unlock, one-time purchase)
  if (state.hasCardSleeveUnlock && !state.hasSleeveExtender) items.push(ShopItemType.SleeveExtender);

  // Card sleeve items (requires unlock + at least one empty sleeve slot)
  if (state.hasCardSleeveUnlock) {
    const hasSlot1Empty = state.sleeveCard === null;
    const hasSlot2Empty = state.hasSleeveExtender && state.sleeveCard2 === null;
    if (hasSlot1Empty || hasSlot2Empty) {
      items.push(ShopItemType.ExtraCard);
    }
    if (hasSlot1Empty || hasSlot2Empty) {
      items.push(ShopItemType.Joker);
    }
  }

  // Gun (one-time purchase, rare)
  if (!state.hasGun) items.push(ShopItemType.Gun);

  // Bullets (requires gun, can always buy more)
  if (state.hasGun) items.push(ShopItemType.Bullet);

  // Charge-based items (can always buy more — each purchase adds charges)
  items.push(ShopItemType.XRayGoggles);
  items.push(ShopItemType.HiddenCamera);

  // Luck items (always available, stackable)
  items.push(ShopItemType.Cigarette);
  items.push(ShopItemType.Whiskey);
  items.push(ShopItemType.LuckyCharm);

  // Investment items (always available, can own multiple)
  items.push(ShopItemType.Bond);
  items.push(ShopItemType.StockOption);

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

export function getTotalLuck(state: PlayerPrivateState): number {
  const buffLuck = state.luckBuffs.reduce((sum, b) => sum + b.amount, 0);
  return state.permanentLuck + buffLuck;
}

export function getBondCashOutValue(bond: BondState): number {
  return 150 + 50 * bond.roundsHeld;
}

export function getStockOptionCashOutValue(option: StockOptionState): number | null {
  if (option.roundsHeld < 3) return null; // Not yet cashable
  // 1 in 3 chance for $500, otherwise $0 — value is resolved at cash-out time
  return null; // Resolved dynamically
}
