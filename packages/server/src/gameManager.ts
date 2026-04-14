import {
  GameState,
  HandPhase,
  BettingRound,
  PokerAction,
  PokerActionType,
  PlayerPublicState,
  Card,
  Suit,
  Rank,
  evaluateBestHand,
  evaluateBestHandWithJokers,
  ItemType,
  PlayerPrivateState,
  ShopItemType,
  ShopItemRarity,
  ShopSlotItem,
  UseItemType,
  getCardPrice,
  getPrice,
  getShopItemInfo,
  getEligibleShopItems,
  cardToString,
  isJokerCard,
  JOKER_CARD,
  getTotalLuck,
  getBondCashOutValue,
} from '@poker/shared';

/**
 * Manages the poker game state and logic.
 * In-memory for now; extend with database storage as needed.
 */
export class GameManager {
  private gameState: GameState;
  private holeCards: Map<number, [Card, Card]> = new Map();
  private playerPrivateState: Map<number, PlayerPrivateState> = new Map();
  private playerShopSlots: Map<number, ShopSlotItem[]> = new Map();
  private deck: Card[] = [];
  private rng = Math.random;
  private lastRaiserId: number = 0; // Track who last raised/bet
  private playersActedThisRound: Set<number> = new Set(); // Track who has acted
  private sleeveSwappedThisRound: Set<number> = new Set(); // Track sleeve swaps per round
  private winnerId: number = 0; // Track the current hand winner
  private winnerIds: number[] = []; // Track all tied winners
  private foldedOut: boolean = false; // Track if winner folded out (vs showdown)

  constructor() {
    this.gameState = {
      phase: HandPhase.Lobby,
      round: BettingRound.None,
      dealerPlayerId: 0,
      activePlayerId: 0,
      pot: 0,
      currentBetToMatch: 0,
      players: [],
      board: [],
      caughtCheaterPlayerId: null,
    };
  }

  getGameState(): GameState {
    return this.gameState;
  }

  getHoleCards(playerId: number): Card[] | undefined {
    const cards = this.holeCards.get(playerId);
    return cards ? [...cards] : undefined;
  }

  getAllHoleCards(): Map<number, Card[]> {
    return new Map(this.holeCards);
  }

  getWinnerId(): number {
    return this.winnerId;
  }

  getWinnerIds(): number[] {
    return this.winnerIds;
  }

  isFoldedOut(): boolean {
    return this.foldedOut;
  }

  getBotAction(botId: number): PokerAction {
    const bot = this.gameState.players.find(p => p.id === botId);
    if (!bot || !bot.isBot) {
      throw new Error('Player is not a bot');
    }

    // For now, bots always call or check
    const currentBet = this.gameState.currentBetToMatch;
    const playerCommitted = bot.committedThisRound;

    if (currentBet === playerCommitted) {
      // Can check
      return { type: PokerActionType.Check };
    } else {
      // Must call
      return { type: PokerActionType.Call };
    }
  }

  returnToLobby(): void {
    this.gameState.phase = HandPhase.Lobby;
    this.gameState.round = BettingRound.None;
    
    this.winnerId = 0;
    this.winnerIds = [];
    this.foldedOut = false;

    // Reset all players' ready status when returning to Lobby
    // Each hand requires fresh ready-up
    for (const player of this.gameState.players) {
      player.isReady = false;
    }
    
    // In bot mode, auto-ready the bots so they're ready for the next hand
    for (const player of this.gameState.players) {
      if (player.isBot) {
        player.isReady = true;
      }
    }
  }

  joinTable(playerName: string): number {
    const playerId = this.gameState.players.length + 1;

    this.gameState.players.push({
      id: playerId,
      name: playerName,
      stack: 1000, // Default starting stack
      committedThisRound: 0,
      contributedThisHand: 0,
      isSeated: true,
      isReady: false,
      isInHand: false,
      hasFolded: false,
      isAllIn: false,
      isBot: false,
      isEliminated: false,
      inventory: [],
    });

    // Initialize private state for this player
    this.playerPrivateState.set(playerId, {
      hasBankAccount: false,
      bankBalance: 0,
      hasGun: false,
      bullets: 0,
      hasCardSleeveUnlock: false,
      sleeveCard: null,
      hasSleeveExtender: false,
      sleeveCard2: null,
      xrayCharges: 0,
      permanentLuck: 0,
      luckBuffs: [],
      hasRake: false,
      hiddenCameraCharges: 0,
      cheatedThisHand: false,
      bonds: [],
      stockOptions: [],
    });

    return playerId;
  }

  playVsBots(playerName: string): number {
    // Clear any existing players
    this.gameState.players = [];
    this.playerPrivateState.clear();

    // Add human player
    const playerId = 1;
    this.gameState.players.push({
      id: playerId,
      name: playerName,
      stack: 1000,
      committedThisRound: 0,
      contributedThisHand: 0,
      isSeated: true,
      isReady: false,
      isInHand: false,
      hasFolded: false,
      isAllIn: false,
      isBot: false,
      isEliminated: false,
      inventory: [],
    });

    this.playerPrivateState.set(playerId, {
      hasBankAccount: false,
      bankBalance: 0,
      hasGun: false,
      bullets: 0,
      hasCardSleeveUnlock: false,
      sleeveCard: null,
      hasSleeveExtender: false,
      sleeveCard2: null,
      xrayCharges: 0,
      permanentLuck: 0,
      luckBuffs: [],
      hasRake: false,
      hiddenCameraCharges: 0,
      cheatedThisHand: false,
      bonds: [],
      stockOptions: [],
    });

    // Add 3 bots with auto-ready
    for (let i = 1; i <= 3; i++) {
      const botId = i + 1;
      this.gameState.players.push({
        id: botId,
        name: `bot ${i}`,
        stack: 1000,
        committedThisRound: 0,
        contributedThisHand: 0,
        isSeated: true,
        isReady: true, // Bots auto-ready
        isInHand: false,
        hasFolded: false,
        isAllIn: false,
        isBot: true,
        isEliminated: false,
        inventory: [],
      });

      this.playerPrivateState.set(botId, {
        hasBankAccount: false,
        bankBalance: 0,
        hasGun: false,
        bullets: 0,
        hasCardSleeveUnlock: false,
        sleeveCard: null,
        hasSleeveExtender: false,
        sleeveCard2: null,
        xrayCharges: 0,
        permanentLuck: 0,
        luckBuffs: [],
        hasRake: false,
        hiddenCameraCharges: 0,
        cheatedThisHand: false,
        bonds: [],
        stockOptions: [],
      });
    }

    return playerId;
  }

  setReady(playerId: number, isReady: boolean): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = isReady;
    }
  }

  canStartHand(playerId: number): boolean {
    // Only allow if enough players are ready
    const readyCount = this.gameState.players.filter(p => p.isReady).length;
    return readyCount >= 2; // Minimum 2 players
  }

  startHand(): void {
    // Reset player states for new hand
    for (const player of this.gameState.players) {
      player.committedThisRound = 0;
      player.contributedThisHand = 0;
      player.hasFolded = false;
      player.isInHand = false;
      player.isAllIn = false;
      player.lastAction = undefined; // Clear last action
    }

    // Reset cheat tracking for each player + tick investments + tick luck buffs
    for (const [_, ps] of this.playerPrivateState) {
      ps.cheatedThisHand = false;

      // Age bonds and stock options
      for (const bond of ps.bonds) bond.roundsHeld++;
      for (const opt of ps.stockOptions) opt.roundsHeld++;

      // Tick down luck buffs and remove expired ones
      ps.luckBuffs = ps.luckBuffs
        .map(b => ({ ...b, turnsRemaining: b.turnsRemaining - 1 }))
        .filter(b => b.turnsRemaining > 0);
    }

    // Rotate dealer button
    if (this.gameState.dealerPlayerId === 0) {
      this.gameState.dealerPlayerId = this.gameState.players[0]?.id || 1;
    } else {
      const dealerIndex = this.gameState.players.findIndex(p => p.id === this.gameState.dealerPlayerId);
      const nextIndex = (dealerIndex + 1) % this.gameState.players.length;
      this.gameState.dealerPlayerId = this.gameState.players[nextIndex].id;
    }

    this.gameState.phase = HandPhase.Dealing;
    this.gameState.round = BettingRound.Preflop;
    this.gameState.pot = 0;
    this.gameState.currentBetToMatch = 0;
    this.gameState.board = [];
    this.holeCards.clear();
    this.playersActedThisRound.clear(); // Reset action tracking for new hand
    this.sleeveSwappedThisRound.clear(); // Reset sleeve swap tracking for new hand
    this.lastRaiserId = 0;

    // Shuffle deck and deal
    this.shuffleDeck();
    this.dealHoleCards();

    // Post blinds
    this.postBlinds();

    // Transition to betting
    this.gameState.phase = HandPhase.Betting;
    // First to act in preflop is UTG (2 players after dealer): dealer+2
    const dealerIndex = this.gameState.players.findIndex(p => p.id === this.gameState.dealerPlayerId);
    const utg = (dealerIndex + 2) % this.gameState.players.length;
    this.gameState.activePlayerId = this.gameState.players[utg].id;
    
    // Big blind is last to act preflop (for initial raise opportunity)
    this.lastRaiserId = this.gameState.players
      .filter(p => p.isInHand)
      .sort((a, b) => b.committedThisRound - a.committedThisRound)[0]?.id || 0;
  }

  submitAction(playerId: number, action: PokerAction): boolean {
    if (this.gameState.activePlayerId !== playerId) {
      return false; // Not this player's turn
    }

    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player || player.hasFolded || player.isAllIn) {
      return false;
    }

    switch (action.type) {
      case PokerActionType.Fold:
        player.hasFolded = true;
        player.lastAction = { type: PokerActionType.Fold };
        break;

      case PokerActionType.Check:
        // Can only check if player has matched the current bet
        const betToMatch = this.gameState.currentBetToMatch - player.committedThisRound;
        if (betToMatch > 0) {
          return false; // Can't check if there's unmatched bet
        }
        player.lastAction = { type: PokerActionType.Check };
        break;

      case PokerActionType.Call:
        const amountToCall = this.gameState.currentBetToMatch - player.committedThisRound;
        if (amountToCall > 0) {
          const actualAmount = Math.min(amountToCall, player.stack);
          player.stack -= actualAmount;
          player.committedThisRound += actualAmount;
          this.gameState.pot += actualAmount;
          player.lastAction = { type: PokerActionType.Call, amount: actualAmount };

          if (player.stack === 0) {
            player.isAllIn = true;
          }
        } else {
          player.lastAction = { type: PokerActionType.Check };
        }
        break;

      case PokerActionType.RaiseTo:
        const raiseAmount = (action.raiseToAmount || 0) - player.committedThisRound;
        if (raiseAmount > 0 && raiseAmount <= player.stack) {
          player.stack -= raiseAmount;
          player.committedThisRound += raiseAmount;
          this.gameState.pot += raiseAmount;
          this.gameState.currentBetToMatch = action.raiseToAmount || 0;
          this.lastRaiserId = playerId; // Track last raiser
          this.playersActedThisRound.clear(); // Reset action tracking on raise
          player.lastAction = { type: PokerActionType.RaiseTo, amount: action.raiseToAmount };

          if (player.stack === 0) {
            player.isAllIn = true;
          }
        } else {
          return false;
        }
        break;

      default:
        return false;
    }

    // Track that this player has acted
    this.playersActedThisRound.add(playerId);

    // Check if only 1 active player remains (all others folded)
    const activePlayersCount = this.gameState.players.filter(
      p => p.isInHand && !p.hasFolded
    ).length;

    if (activePlayersCount === 1) {
      // One player remains - they win immediately
      this.handleFoldOutWinner();
      return true;
    }

    // Move to next active player
    this.gameState.activePlayerId = this.getNextActivePlayer(playerId);

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      this.advanceBettingRound();
    }

    return true;
  }

  useItem(playerId: number, useType: number, targetPlayerId?: number): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    const privateState = this.playerPrivateState.get(playerId);
    if (!privateState) return false;

    // Only allow swaps before showdown phase
    if (this.gameState.phase === HandPhase.Showdown) {
      return false;
    }

    // Handle sleeve card swaps (slot 1)
    if (useType === UseItemType.UseSleeveCardSwapHoleA || useType === UseItemType.UseSleeveCardSwapHoleB) {
      // Validate player has unlock and sleeve card
      if (!privateState.hasCardSleeveUnlock || !privateState.sleeveCard) {
        return false;
      }

      // Only 1 swap allowed per betting round
      if (this.sleeveSwappedThisRound.has(playerId)) {
        return false;
      }

      // Can't swap if all-in
      if (player.isAllIn) {
        return false;
      }

      const holeCards = this.holeCards.get(playerId);
      if (!holeCards) return false;

      // Determine which hole card to swap
      const swapIndex = useType === UseItemType.UseSleeveCardSwapHoleA ? 0 : 1;
      const swappedCard = holeCards[swapIndex];

      // Perform the swap
      holeCards[swapIndex] = privateState.sleeveCard;
      privateState.sleeveCard = swappedCard;

      this.sleeveSwappedThisRound.add(playerId);
      privateState.cheatedThisHand = true;
      return true;
    }

    // Handle sleeve card swaps (slot 2)
    if (useType === UseItemType.UseSleeveCard2SwapHoleA || useType === UseItemType.UseSleeveCard2SwapHoleB) {
      if (!privateState.hasCardSleeveUnlock || !privateState.hasSleeveExtender || !privateState.sleeveCard2) {
        return false;
      }

      // Only 1 swap allowed per betting round (shared limit with slot 1)
      if (this.sleeveSwappedThisRound.has(playerId)) {
        return false;
      }

      if (player.isAllIn) {
        return false;
      }

      const holeCards = this.holeCards.get(playerId);
      if (!holeCards) return false;

      const swapIndex = useType === UseItemType.UseSleeveCard2SwapHoleA ? 0 : 1;
      const swappedCard = holeCards[swapIndex];

      holeCards[swapIndex] = privateState.sleeveCard2;
      privateState.sleeveCard2 = swappedCard;

      this.sleeveSwappedThisRound.add(playerId);
      privateState.cheatedThisHand = true;
      return true;
    }

    // Default: other item usages (banking, etc.)
    return true;
  }

  buyItem(playerId: number, itemType: number): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    const privateState = this.playerPrivateState.get(playerId);
    if (!privateState) return false;

    // Handle CardSleeveUnlock
    if (itemType === ShopItemType.CardSleeveUnlock) {
      const cost = 200;
      if (player.stack < cost) return false;
      if (privateState.hasCardSleeveUnlock) return false;
      player.stack -= cost;
      privateState.hasCardSleeveUnlock = true;
      player.inventory.push(ShopItemType.CardSleeveUnlock);
      return true;
    }

    // Handle Joker - put joker card in sleeve
    if (itemType === ShopItemType.Joker) {
      if (!privateState.hasCardSleeveUnlock) return false;
      // Fill slot 1 first, then slot 2 if extender owned
      if (privateState.sleeveCard !== null) {
        if (!privateState.hasSleeveExtender || privateState.sleeveCard2 !== null) return false;
        const cost = getPrice(ShopItemType.Joker);
        if (player.stack < cost) return false;
        player.stack -= cost;
        privateState.sleeveCard2 = JOKER_CARD;
        return true;
      }
      const cost = getPrice(ShopItemType.Joker);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.sleeveCard = JOKER_CARD;
      return true;
    }

    // Handle SleeveExtender
    if (itemType === ShopItemType.SleeveExtender) {
      if (!privateState.hasCardSleeveUnlock) return false;
      if (privateState.hasSleeveExtender) return false;
      const cost = getPrice(ShopItemType.SleeveExtender);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.hasSleeveExtender = true;
      player.inventory.push(ShopItemType.SleeveExtender);
      return true;
    }

    // Handle XRayGoggles — adds 3 charges to existing
    if (itemType === ShopItemType.XRayGoggles) {
      const cost = getPrice(ShopItemType.XRayGoggles);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.xrayCharges += 3;
      player.inventory.push(ShopItemType.XRayGoggles);
      return true;
    }

    // Handle Rake
    if (itemType === ShopItemType.Rake) {
      if (privateState.hasRake) return false;
      const cost = getPrice(ShopItemType.Rake);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.hasRake = true;
      player.inventory.push(ShopItemType.Rake);
      return true;
    }

    // Handle HiddenCamera — adds 3 charges to existing
    if (itemType === ShopItemType.HiddenCamera) {
      const cost = getPrice(ShopItemType.HiddenCamera);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.hiddenCameraCharges += 3;
      player.inventory.push(ShopItemType.HiddenCamera);
      return true;
    }

    // Handle Gun
    if (itemType === ShopItemType.Gun) {
      if (privateState.hasGun) return false;
      const cost = getPrice(ShopItemType.Gun);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.hasGun = true;
      player.inventory.push(ShopItemType.Gun);
      return true;
    }

    // Handle Bullet
    if (itemType === ShopItemType.Bullet) {
      if (!privateState.hasGun) return false;
      const cost = getPrice(ShopItemType.Bullet);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.bullets++;
      return true;
    }

    // Handle Cigarette — +5 luck for 5 hands
    if (itemType === ShopItemType.Cigarette) {
      const cost = getPrice(ShopItemType.Cigarette);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.luckBuffs.push({ amount: 5, turnsRemaining: 5 });
      return true;
    }

    // Handle Whiskey — +10 luck for 3 hands
    if (itemType === ShopItemType.Whiskey) {
      const cost = getPrice(ShopItemType.Whiskey);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.luckBuffs.push({ amount: 10, turnsRemaining: 3 });
      return true;
    }

    // Handle Lucky Charm — permanently +7 luck
    if (itemType === ShopItemType.LuckyCharm) {
      const cost = getPrice(ShopItemType.LuckyCharm);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.permanentLuck += 7;
      return true;
    }

    // Handle Bond — $150 investment, value increases $50/hand
    if (itemType === ShopItemType.Bond) {
      const cost = getPrice(ShopItemType.Bond);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.bonds.push({ roundsHeld: 0 });
      return true;
    }

    // Handle Stock Option — $100 investment, cashable after 3 hands
    if (itemType === ShopItemType.StockOption) {
      const cost = getPrice(ShopItemType.StockOption);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.stockOptions.push({ roundsHeld: 0 });
      return true;
    }

    // Handle ExtraCard - select random card and deduct dynamic cost (fallback; normally use buy-extra-card)
    if (itemType === ShopItemType.ExtraCard) {
      const randomCard = this.getRandomAvailableCard();
      if (!randomCard) return false;

      const cost = getCardPrice(randomCard);
      if (player.stack < cost) return false;

      if (privateState.sleeveCard === null) {
        player.stack -= cost;
        privateState.sleeveCard = randomCard;
        return true;
      }
      if (privateState.hasSleeveExtender && privateState.sleeveCard2 === null) {
        player.stack -= cost;
        privateState.sleeveCard2 = randomCard;
        return true;
      }
      return false;
    }

    // Default existing items (Item1, Item2, Item3)
    const itemCosts: { [key: number]: number } = {
      [ItemType.Item1]: 50,
      [ItemType.Item2]: 75,
      [ItemType.Item3]: 100,
    };

    const cost = itemCosts[itemType];
    if (!cost || player.stack < cost) {
      return false; // Not enough chips
    }

    player.stack -= cost;
    player.inventory.push(itemType);
    return true;
  }

  cashOutBond(playerId: number, bondIndex: number): { success: boolean; amount: number; error?: string } {
    const player = this.gameState.players.find(p => p.id === playerId);
    const ps = this.playerPrivateState.get(playerId);
    if (!player || !ps) return { success: false, amount: 0, error: 'Player not found' };
    if (bondIndex < 0 || bondIndex >= ps.bonds.length) return { success: false, amount: 0, error: 'Invalid bond' };

    const bond = ps.bonds[bondIndex];
    const value = getBondCashOutValue(bond);
    player.stack += value;
    ps.bonds.splice(bondIndex, 1);
    return { success: true, amount: value };
  }

  cashOutStockOption(playerId: number, optionIndex: number): { success: boolean; amount: number; error?: string } {
    const player = this.gameState.players.find(p => p.id === playerId);
    const ps = this.playerPrivateState.get(playerId);
    if (!player || !ps) return { success: false, amount: 0, error: 'Player not found' };
    if (optionIndex < 0 || optionIndex >= ps.stockOptions.length) return { success: false, amount: 0, error: 'Invalid stock option' };

    const option = ps.stockOptions[optionIndex];
    if (option.roundsHeld < 3) return { success: false, amount: 0, error: 'Must wait 3 hands before cashing out' };

    // 1 in 3 chance for $500, otherwise $0
    const value = Math.random() < (1 / 3) ? 500 : 0;
    player.stack += value;
    ps.stockOptions.splice(optionIndex, 1);
    return { success: true, amount: value };
  }

  playerDisconnected(playerId: number): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      player.isSeated = false;
    }
  }

  getRandomAvailableCardFor(playerId: number): Card | null {
    return this.getRandomAvailableCard();
  }

  buyExtraCard(playerId: number, card: Card): boolean {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    const privateState = this.playerPrivateState.get(playerId);
    if (!privateState) return false;

    // Try slot 1 first, then slot 2 if extender owned
    if (privateState.sleeveCard === null) {
      const cost = getCardPrice(card);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.sleeveCard = card;
      return true;
    }

    if (privateState.hasSleeveExtender && privateState.sleeveCard2 === null) {
      const cost = getCardPrice(card);
      if (player.stack < cost) return false;
      player.stack -= cost;
      privateState.sleeveCard2 = card;
      return true;
    }

    return false; // Both slots full
  }

  getPlayerSleeveCard(playerId: number): Card | null {
    const privateState = this.playerPrivateState.get(playerId);
    return privateState?.sleeveCard || null;
  }

  getPlayerSleeveCards(playerId: number): { sleeveCard: Card | null; sleeveCard2: Card | null } {
    const privateState = this.playerPrivateState.get(playerId);
    return {
      sleeveCard: privateState?.sleeveCard || null,
      sleeveCard2: privateState?.sleeveCard2 || null,
    };
  }

  hasCardSleeveUnlock(playerId: number): boolean {
    const privateState = this.playerPrivateState.get(playerId);
    return privateState?.hasCardSleeveUnlock || false;
  }

  hasUsedSleeveThisHand(playerId: number): boolean {
    return this.sleeveSwappedThisRound.has(playerId);
  }

  shootPlayer(shooterId: number, targetId: number): { success: boolean; backfired: boolean; error?: string } {
    if (this.gameState.phase !== HandPhase.Showdown) {
      return { success: false, backfired: false, error: 'Can only shoot during showdown' };
    }

    const shooter = this.gameState.players.find(p => p.id === shooterId);
    const target = this.gameState.players.find(p => p.id === targetId);
    if (!shooter || !target) return { success: false, backfired: false, error: 'Player not found' };
    if (shooter.isEliminated) return { success: false, backfired: false, error: 'You are eliminated' };
    if (target.isEliminated) return { success: false, backfired: false, error: 'Target is already eliminated' };
    if (shooterId === targetId) return { success: false, backfired: false, error: 'Cannot shoot yourself' };

    const shooterState = this.playerPrivateState.get(shooterId);
    if (!shooterState || !shooterState.hasGun || shooterState.bullets <= 0) {
      return { success: false, backfired: false, error: 'No gun or bullets' };
    }

    shooterState.bullets--;

    const targetState = this.playerPrivateState.get(targetId);
    const targetCheated = targetState?.cheatedThisHand || false;

    if (targetCheated) {
      // Target cheated — shooter takes all their money
      const stolen = target.stack;
      target.stack = 0;
      target.isEliminated = true;
      shooter.stack += stolen;
      return { success: true, backfired: false };
    } else {
      // Target was innocent — backfire: shooter gives all money to target
      const lost = shooter.stack;
      shooter.stack = 0;
      shooter.isEliminated = true;
      target.stack += lost;
      return { success: true, backfired: true };
    }
  }

  generateShopSlots(playerId: number): ShopSlotItem[] {
    const privateState = this.playerPrivateState.get(playerId);
    if (!privateState) return [];

    const eligible = getEligibleShopItems(privateState);

    // Rarity weights for each item type
    const itemWeights: Partial<Record<ShopItemType, number>> = {
      [ShopItemType.CardSleeveUnlock]: 4,   // Uncommon
      [ShopItemType.ExtraCard]: 6,          // Common
      [ShopItemType.Joker]: 1,              // Rare
      [ShopItemType.SleeveExtender]: 1,     // Rare
      [ShopItemType.XRayGoggles]: 4,        // Uncommon
      [ShopItemType.Rake]: 4,              // Uncommon
      [ShopItemType.HiddenCamera]: 4,       // Uncommon
      [ShopItemType.Gun]: 1,               // Rare
      [ShopItemType.Bullet]: 6,            // Common
      [ShopItemType.Cigarette]: 6,         // Common
      [ShopItemType.Whiskey]: 6,           // Common
      [ShopItemType.LuckyCharm]: 4,        // Uncommon
      [ShopItemType.Bond]: 6,             // Common
      [ShopItemType.StockOption]: 4,       // Uncommon
    };

    // Build weighted pool
    let pool: ShopItemType[] = [];
    for (const type of eligible) {
      const weight = itemWeights[type] ?? 4;
      for (let i = 0; i < weight; i++) pool.push(type);
    }

    // Weighted random selection: ExtraCard can appear multiple times, others are unique
    const selected: ShopItemType[] = [];
    const usedTypes = new Set<ShopItemType>();

    while (selected.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      const type = pool[idx];
      if (type === ShopItemType.ExtraCard || type === ShopItemType.Bullet || type === ShopItemType.Cigarette || type === ShopItemType.Whiskey) {
        // These can appear in multiple slots
        selected.push(type);
        pool.splice(idx, 1); // Remove only this one ticket
      } else if (!usedTypes.has(type)) {
        selected.push(type);
        usedTypes.add(type);
        pool = pool.filter(t => t !== type);
      } else {
        pool = pool.filter(t => t !== type);
      }
    }

    const slots: ShopSlotItem[] = selected.map((type: ShopItemType) => {
      const info = getShopItemInfo(type);
      const slot: ShopSlotItem = {
        type,
        price: getPrice(type),
        name: info.name,
        description: info.description,
        rarity: ShopItemRarity.Common,
      };

      if (type === ShopItemType.ExtraCard) {
        const card = this.getWeightedRandomCardForShop();
        if (card) {
          slot.previewCard = card;
          slot.price = getCardPrice(card);
          slot.rarity = ShopItemRarity.Common;
        }
      } else if (type === ShopItemType.CardSleeveUnlock) {
        slot.rarity = ShopItemRarity.Uncommon;
      } else if (type === ShopItemType.Joker) {
        slot.rarity = ShopItemRarity.Rare;
      } else if (type === ShopItemType.Rake) {
        slot.rarity = ShopItemRarity.Uncommon;
      } else if (type === ShopItemType.SleeveExtender) {
        slot.rarity = ShopItemRarity.Rare;
      } else if (type === ShopItemType.Gun) {
        slot.rarity = ShopItemRarity.Rare;
      } else if (type === ShopItemType.XRayGoggles) {
        slot.rarity = ShopItemRarity.Uncommon;
      } else if (type === ShopItemType.HiddenCamera) {
        slot.rarity = ShopItemRarity.Uncommon;
      } else if (type === ShopItemType.LuckyCharm) {
        slot.rarity = ShopItemRarity.Uncommon;
      } else if (type === ShopItemType.StockOption) {
        slot.rarity = ShopItemRarity.Uncommon;
      } else if (type === ShopItemType.Bullet || type === ShopItemType.Cigarette || type === ShopItemType.Whiskey || type === ShopItemType.Bond) {
        slot.rarity = ShopItemRarity.Common;
      }

      return slot;
    });

    this.playerShopSlots.set(playerId, slots);
    return slots;
  }

  getShopSlots(playerId: number): ShopSlotItem[] {
    return this.playerShopSlots.get(playerId) || [];
  }

  refreshExtraCardPreview(playerId: number): ShopSlotItem | null {
    const slots = this.playerShopSlots.get(playerId);
    if (!slots) return null;

    const extraCardSlot = slots.find(s => s.type === ShopItemType.ExtraCard);
    if (!extraCardSlot) return null;

    const card = this.getWeightedRandomCardForShop();
    if (!card) return null;

    extraCardSlot.previewCard = card;
    extraCardSlot.price = getCardPrice(card);
    extraCardSlot.rarity = card.rank === Rank.Ace ? ShopItemRarity.Uncommon : ShopItemRarity.Common;
    return extraCardSlot;
  }

  useXRayGoggles(playerId: number): Card | null {
    const privateState = this.playerPrivateState.get(playerId);
    if (!privateState || privateState.xrayCharges <= 0) return null;
    if (this.gameState.phase !== HandPhase.Betting) return null;
    // All 5 community cards already on board at river — nothing left to peek at
    if (this.gameState.round === BettingRound.River) return null;

    if (this.deck.length === 0) return null;
    privateState.xrayCharges--;
    privateState.cheatedThisHand = true;
    return this.deck[this.deck.length - 1];
  }

  useHiddenCamera(playerId: number, targetPlayerId: number): Card | null {
    const privateState = this.playerPrivateState.get(playerId);
    if (!privateState || privateState.hiddenCameraCharges <= 0) return null;
    if (this.gameState.phase !== HandPhase.Betting) return null;

    // Target must be in hand and not folded
    const target = this.gameState.players.find(p => p.id === targetPlayerId);
    if (!target || !target.isInHand || target.hasFolded) return null;

    // Can't target yourself
    if (targetPlayerId === playerId) return null;

    const targetCards = this.holeCards.get(targetPlayerId);
    if (!targetCards) return null;

    privateState.hiddenCameraCharges--;
    privateState.cheatedThisHand = true;
    // Return a random one of their two hole cards
    const idx = Math.floor(Math.random() * 2);
    return targetCards[idx];
  }

  getPlayerPrivateState(playerId: number): PlayerPrivateState | undefined {
    return this.playerPrivateState.get(playerId);
  }

  // Private helpers

  private getWeightedRandomCardForShop(): Card | null {
    // Build available cards (excluding dealt hole cards + board)
    const consumedCards = new Set<string>();
    this.holeCards.forEach(([cardA, cardB]) => {
      consumedCards.add(cardToString(cardA));
      consumedCards.add(cardToString(cardB));
    });
    for (const card of this.gameState.board) {
      consumedCards.add(cardToString(card));
    }

    // Weight: aces are uncommon (1 ticket), all other ranks are common (3 tickets)
    const weightedPool: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) {
        const card: Card = { suit: suit as Suit, rank: rank as Rank };
        if (consumedCards.has(cardToString(card))) continue;
        const weight = rank === Rank.Ace ? 1 : 3;
        for (let i = 0; i < weight; i++) weightedPool.push(card);
      }
    }

    if (weightedPool.length === 0) return null;
    return weightedPool[Math.floor(Math.random() * weightedPool.length)];
  }

  private getRandomAvailableCard(): Card | null {
    // Create a set of all consumed cards (dealt hole cards + board cards)
    const consumedCards = new Set<string>();

    // Add dealt hole cards
    this.holeCards.forEach(([cardA, cardB]) => {
      consumedCards.add(cardToString(cardA));
      consumedCards.add(cardToString(cardB));
    });

    // Add board cards
    for (const card of this.gameState.board) {
      consumedCards.add(cardToString(card));
    }

    // Generate all 52 cards
    const allCards: Card[] = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) {
        allCards.push({ suit: suit as Suit, rank: rank as Rank });
      }
    }

    // Filter out consumed cards
    const availableCards = allCards.filter(card => !consumedCards.has(cardToString(card)));

    if (availableCards.length === 0) {
      return null;
    }

    // Return random available card
    return availableCards[Math.floor(Math.random() * availableCards.length)];
  }

  private shuffleDeck(): void {
    this.deck = [];
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 2; rank <= 14; rank++) {
        this.deck.push({ suit: suit as Suit, rank: rank as Rank });
      }
    }

    // Fisher-Yates shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  private dealHoleCards(): void {
    let deckIndex = 0;
    for (const player of this.gameState.players) {
      if (player.isSeated && player.isReady && !player.isEliminated) {
        let cardA = this.deck[deckIndex++];
        let cardB = this.deck[deckIndex++];

        const ps = this.playerPrivateState.get(player.id);
        const luck = ps ? getTotalLuck(ps) : 0;
        if (luck > 0) {
          cardA = this.applyLuckToHoleCard(cardA, cardB, luck);
          cardB = this.applyLuckToHoleCard(cardB, cardA, luck);
        }

        this.holeCards.set(player.id, [cardA, cardB]);
        player.isInHand = true;
      }
    }
  }

  /** Apply luck to a single hole card. otherCard is the partner hole card for duplication. */
  private applyLuckToHoleCard(card: Card, otherCard: Card, luck: number): Card {
    if (isJokerCard(card)) return card;
    const chance = luck / 100; // each point = 1%
    if (Math.random() >= chance) return card; // no improvement

    const roll = Math.random();
    if (roll < 0.5) {
      // 50%: increase rank by 1 (no change for Aces)
      if (card.rank >= Rank.Ace) return { ...card, improved: true };
      return { suit: card.suit, rank: (card.rank + 1) as Rank, improved: true };
    } else if (roll < 0.6) {
      return { suit: card.suit, rank: Rank.Jack, improved: true };
    } else if (roll < 0.7) {
      return { suit: card.suit, rank: Rank.Queen, improved: true };
    } else if (roll < 0.8) {
      return { suit: card.suit, rank: Rank.King, improved: true };
    } else if (roll < 0.9) {
      return { suit: card.suit, rank: Rank.Ace, improved: true };
    } else {
      // 10%: exact duplicate of the other card
      return { suit: otherCard.suit, rank: otherCard.rank, improved: true };
    }
  }

  /** Apply luck to a community card for all players with luck > 0. */
  private applyLuckToCommunityCard(card: Card): Card {
    if (isJokerCard(card)) return card;
    for (const player of this.gameState.players) {
      if (!player.isInHand || player.hasFolded) continue;
      const ps = this.playerPrivateState.get(player.id);
      if (!ps) continue;
      const luck = getTotalLuck(ps);
      if (luck <= 0) continue;

      const chance = luck * 0.0001; // 0.01% per luck point
      if (Math.random() < chance) {
        const holeCards = this.holeCards.get(player.id);
        if (holeCards && holeCards.length > 0) {
          const pick = holeCards[Math.floor(Math.random() * holeCards.length)];
          return { suit: pick.suit, rank: pick.rank, improved: true };
        }
      }
    }
    return card;
  }

  private postBlinds(): void {
    const smallBlind = 5;
    const bigBlind = 10;

    const smallBlindPlayer = this.getNextActivePlayer(this.gameState.dealerPlayerId);
    const bigBlindPlayer = this.getNextActivePlayer(smallBlindPlayer);

    const sbPlayer = this.gameState.players.find(p => p.id === smallBlindPlayer);
    const bbPlayer = this.gameState.players.find(p => p.id === bigBlindPlayer);

    if (sbPlayer) {
      sbPlayer.stack -= smallBlind;
      sbPlayer.committedThisRound = smallBlind;
      this.gameState.pot += smallBlind;
    }

    if (bbPlayer) {
      bbPlayer.stack -= bigBlind;
      bbPlayer.committedThisRound = bigBlind;
      this.gameState.pot += bigBlind;
    }

    this.gameState.currentBetToMatch = bigBlind;
  }

  private isBettingRoundComplete(): boolean {
    const activePlayers = this.gameState.players.filter(
      p => p.isSeated && p.isInHand && !p.hasFolded && !p.isAllIn
    );

    if (activePlayers.length <= 1) {
      return true; // Only one player left
    }

    // All active players must have acted at least once
    const allActed = activePlayers.every(p => this.playersActedThisRound.has(p.id));
    if (!allActed) {
      return false;
    }

    // All active players have matched the current bet
    const allMatched = activePlayers.every(
      p => p.committedThisRound === this.gameState.currentBetToMatch
    );

    if (!allMatched) {
      return false;
    }

    // If all have acted and matched, round is complete
    return true;
  }

  private advanceBettingRound(): void {
    // Reset committed amounts for next round and clear last actions
    for (const player of this.gameState.players) {
      if (player.isInHand && !player.hasFolded) {
        player.committedThisRound = 0;
      }
      player.lastAction = undefined; // Clear last action for new round
    }

    this.gameState.currentBetToMatch = 0;
    this.lastRaiserId = 0; // Reset for new round
    this.playersActedThisRound.clear(); // Reset action tracking for new round
    // NOTE: sleeveSwappedThisRound is intentionally NOT cleared here — once per hand

    if (this.gameState.round === BettingRound.Preflop) {
      this.gameState.board = this.dealFlop();
      this.gameState.round = BettingRound.Flop;
    } else if (this.gameState.round === BettingRound.Flop) {
      this.gameState.board.push(this.dealCommunityCard());
      this.gameState.round = BettingRound.Turn;
    } else if (this.gameState.round === BettingRound.Turn) {
      this.gameState.board.push(this.dealCommunityCard());
      this.gameState.round = BettingRound.River;
    } else if (this.gameState.round === BettingRound.River) {
      this.gameState.phase = HandPhase.Showdown;
      this.evaluateShowdown();
      return;
    }

    // Find first non-folded, non-all-in player to act (starting from small blind = dealer+1)
    const dealerIndex = this.gameState.players.findIndex(p => p.id === this.gameState.dealerPlayerId);
    const playerCount = this.gameState.players.length;
    let firstToActId = 0;
    for (let i = 1; i <= playerCount; i++) {
      const candidate = this.gameState.players[(dealerIndex + i) % playerCount];
      if (candidate.isInHand && !candidate.hasFolded && !candidate.isAllIn) {
        firstToActId = candidate.id;
        break;
      }
    }

    if (firstToActId === 0) {
      // All remaining players are all-in — run out the board automatically without betting
      this.advanceBettingRound();
      return;
    }

    this.gameState.activePlayerId = firstToActId;
    this.lastRaiserId = firstToActId; // First to act is initial "last raiser"
  }

  private dealFlop(): Card[] {
    return [this.dealCommunityCard(), this.dealCommunityCard(), this.dealCommunityCard()];
  }

  private dealCommunityCard(): Card {
    const raw = this.deck.pop() || { suit: Suit.Clubs, rank: Rank.Two };
    return this.applyLuckToCommunityCard(raw);
  }

  private dealCard(): Card {
    return this.deck.pop() || { suit: Suit.Clubs, rank: Rank.Two };
  }

  private getNextActivePlayer(fromPlayerId: number): number {
    const activePlayers = this.gameState.players
      .filter(p => p.isSeated && p.isInHand && !p.hasFolded)
      .map(p => p.id);

    if (activePlayers.length === 0) return 0;

    const currentIndex = activePlayers.indexOf(fromPlayerId);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    return activePlayers[nextIndex];
  }

  private evaluateShowdown(): void {
    const activePlayers = this.gameState.players.filter(
      p => p.isInHand && !p.hasFolded
    );

    if (activePlayers.length === 0) return;

    // Find best hand(s) - track all players with the same best score
    let bestScore = -1;
    const playerScores: { player: PlayerPublicState; score: number }[] = [];

    for (const player of activePlayers) {
      const hole = this.holeCards.get(player.id);
      if (hole) {
        // Use joker-aware evaluation if any hole card is a joker
        const hasJoker = hole.some(c => isJokerCard(c));
        const handValue = hasJoker
          ? evaluateBestHandWithJokers([hole[0], hole[1]], this.gameState.board)
          : evaluateBestHand([hole[0], hole[1]], this.gameState.board);
        playerScores.push({ player, score: handValue.score });
        if (handValue.score > bestScore) {
          bestScore = handValue.score;
        }
      }
    }

    // Find all winners (handles ties)
    const winners = playerScores.filter(ps => ps.score === bestScore).map(ps => ps.player);
    this.winnerIds = winners.map(w => w.id);
    this.winnerId = winners[0].id; // Display first winner

    // Apply rake before pot distribution
    let remainingPot = this.gameState.pot;
    for (const player of this.gameState.players) {
      const ps = this.playerPrivateState.get(player.id);
      if (ps?.hasRake && player.isInHand) {
        const rakeAmount = Math.floor(this.gameState.pot * 0.05);
        if (rakeAmount > 0) {
          player.stack += rakeAmount;
          remainingPot -= rakeAmount;
        }
      }
    }

    // Split remaining pot among all winners
    const potShare = Math.floor(remainingPot / winners.length);
    const remainder = remainingPot % winners.length;
    
    for (let i = 0; i < winners.length; i++) {
      // Give remainder to first winner if pot doesn't divide evenly
      winners[i].stack += potShare + (i === 0 ? remainder : 0);
    }

    // Transition to showdown phase
    this.gameState.phase = HandPhase.Showdown;
  }

  private handleFoldOutWinner(): void {
    // Find the last remaining active player
    const activePlayers = this.gameState.players.filter(
      p => p.isInHand && !p.hasFolded
    );

    if (activePlayers.length !== 1) return;

    const winner = activePlayers[0];

    // Apply rake before pot distribution
    let remainingPot = this.gameState.pot;
    for (const player of this.gameState.players) {
      const ps = this.playerPrivateState.get(player.id);
      if (ps?.hasRake && player.isInHand) {
        const rakeAmount = Math.floor(this.gameState.pot * 0.05);
        if (rakeAmount > 0) {
          player.stack += rakeAmount;
          remainingPot -= rakeAmount;
        }
      }
    }

    // Award remaining pot to winner
    winner.stack += remainingPot;
    this.winnerId = winner.id;
    this.foldedOut = true;

    // Transition to showdown phase (will show simplified winner screen)
    this.gameState.phase = HandPhase.Showdown;
  }
}
