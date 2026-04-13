export enum ShopItemType {
  None = 0,
  BankAccountUnlock = 1,
  SleeveCard = 10,
  XrayCharge = 11,
  Cigarette = 12,
  Gun = 20,
  Bullet = 21,
}

export enum UseItemType {
  None = 0,
  DepositToBank = 1,
  WithdrawFromBank = 2,
  PeekNextDeckCard = 10,
  UseSleeveCardReplaceHoleA = 11,
  UseSleeveCardReplaceHoleB = 12,
  SmokeCigarette = 20,
  ShootPlayer = 30,
}

export interface PlayerPrivateState {
  hasBankAccount: boolean;
  bankBalance: number;
  hasGun: boolean;
  bullets: number;
  sleeveCards: number;
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
  };
  return prices[item];
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
