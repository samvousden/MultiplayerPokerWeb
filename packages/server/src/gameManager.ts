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
  ItemType,
  PlayerPrivateState,
  ShopItemType,
  UseItemType,
  getCardPrice,
  cardToString,
} from '@poker/shared';

/**
 * Manages the poker game state and logic.
 * In-memory for now; extend with database storage as needed.
 */
export class GameManager {
  private gameState: GameState;
  private holeCards: Map<number, [Card, Card]> = new Map();
  private playerPrivateState: Map<number, PlayerPrivateState> = new Map();
  private deck: Card[] = [];
  private rng = Math.random;
  private lastRaiserId: number = 0; // Track who last raised/bet
  private playersActedThisRound: Set<number> = new Set(); // Track who has acted
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
      xrayCharges: 0,
      luckLevel: 0,
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
      inventory: [],
    });

    this.playerPrivateState.set(playerId, {
      hasBankAccount: false,
      bankBalance: 0,
      hasGun: false,
      bullets: 0,
      hasCardSleeveUnlock: false,
      sleeveCard: null,
      xrayCharges: 0,
      luckLevel: 0,
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
        inventory: [],
      });

      this.playerPrivateState.set(botId, {
        hasBankAccount: false,
        bankBalance: 0,
        hasGun: false,
        bullets: 0,
        hasCardSleeveUnlock: false,
        sleeveCard: null,
        xrayCharges: 0,
        luckLevel: 0,
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

    // Handle sleeve card swaps
    if (useType === UseItemType.UseSleeveCardSwapHoleA || useType === UseItemType.UseSleeveCardSwapHoleB) {
      // Validate player has unlock and sleeve card
      if (!privateState.hasCardSleeveUnlock || !privateState.sleeveCard) {
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
      if (player.stack < cost) {
        return false; // Not enough chips
      }

      if (privateState.hasCardSleeveUnlock) {
        return false; // Already own this item
      }

      player.stack -= cost;
      privateState.hasCardSleeveUnlock = true;
      player.inventory.push(ShopItemType.CardSleeveUnlock);
      return true;
    }

    // Handle ExtraCard - select random card and deduct dynamic cost
    if (itemType === ShopItemType.ExtraCard) {
      // Only allow one sleeve card at a time
      if (privateState.sleeveCard !== null) {
        return false;
      }

      const randomCard = this.getRandomAvailableCard();
      if (!randomCard) {
        return false; // No cards available (shouldn't happen)
      }

      const cost = getCardPrice(randomCard);
      if (player.stack < cost) {
        return false; // Not enough chips
      }

      player.stack -= cost;
      privateState.sleeveCard = randomCard;
      return true;
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

    // Only allow one sleeve card at a time
    if (privateState.sleeveCard !== null) {
      return false;
    }

    const cost = getCardPrice(card);
    if (player.stack < cost) {
      return false; // Not enough chips
    }

    player.stack -= cost;
    privateState.sleeveCard = card;
    return true;
  }

  getPlayerSleeveCard(playerId: number): Card | null {
    const privateState = this.playerPrivateState.get(playerId);
    return privateState?.sleeveCard || null;
  }

  hasCardSleeveUnlock(playerId: number): boolean {
    const privateState = this.playerPrivateState.get(playerId);
    return privateState?.hasCardSleeveUnlock || false;
  }

  // Private helpers

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
      if (player.isSeated && player.isReady) {
        const cardA = this.deck[deckIndex++];
        const cardB = this.deck[deckIndex++];
        this.holeCards.set(player.id, [cardA, cardB]);
        player.isInHand = true;
      }
    }
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

    if (this.gameState.round === BettingRound.Preflop) {
      this.gameState.board = this.dealFlop();
      this.gameState.round = BettingRound.Flop;
    } else if (this.gameState.round === BettingRound.Flop) {
      this.gameState.board.push(this.dealCard());
      this.gameState.round = BettingRound.Turn;
    } else if (this.gameState.round === BettingRound.Turn) {
      this.gameState.board.push(this.dealCard());
      this.gameState.round = BettingRound.River;
    } else if (this.gameState.round === BettingRound.River) {
      this.gameState.phase = HandPhase.Showdown;
      this.evaluateShowdown();
      return;
    }

    // For postflop, action starts with small blind (dealer+1)
    const dealerIndex = this.gameState.players.findIndex(p => p.id === this.gameState.dealerPlayerId);
    const smallBlindIndex = (dealerIndex + 1) % this.gameState.players.length;
    const firstToAct = this.gameState.players[smallBlindIndex].id;
    this.gameState.activePlayerId = firstToAct;
    this.lastRaiserId = firstToAct; // First to act is initial "last raiser"
  }

  private dealFlop(): Card[] {
    return [this.dealCard(), this.dealCard(), this.dealCard()];
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
        const handValue = evaluateBestHand([hole[0], hole[1]], this.gameState.board);
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

    // Split pot among all winners
    const potShare = Math.floor(this.gameState.pot / winners.length);
    const remainder = this.gameState.pot % winners.length;
    
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
    // Award pot to winner
    winner.stack += this.gameState.pot;
    this.winnerId = winner.id;
    this.foldedOut = true;

    // Transition to showdown phase (will show simplified winner screen)
    this.gameState.phase = HandPhase.Showdown;
  }
}
