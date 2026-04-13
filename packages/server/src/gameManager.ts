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
  UseItemType,
} from '@poker/shared';

/**
 * Manages the poker game state and logic.
 * In-memory for now; extend with database storage as needed.
 */
export class GameManager {
  private gameState: GameState;
  private holeCards: Map<number, [Card, Card]> = new Map();
  private deck: Card[] = [];
  private rng = Math.random;

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
    });

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
    }

    this.gameState.phase = HandPhase.Dealing;
    this.gameState.round = BettingRound.Preflop;
    this.gameState.pot = 0;
    this.gameState.currentBetToMatch = 0;
    this.gameState.board = [];
    this.holeCards.clear();

    // Shuffle deck and deal
    this.shuffleDeck();
    this.dealHoleCards();

    // Post blinds
    this.postBlinds();

    // Transition to betting
    this.gameState.phase = HandPhase.Betting;
    this.gameState.activePlayerId = this.getNextActivePlayer(this.gameState.dealerPlayerId);
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
        break;

      case PokerActionType.Check:
        if (this.gameState.currentBetToMatch > 0) {
          return false; // Can't check if there's a bet to match
        }
        break;

      case PokerActionType.Call:
        const amountToCall = this.gameState.currentBetToMatch - player.committedThisRound;
        if (amountToCall > 0) {
          const actualAmount = Math.min(amountToCall, player.stack);
          player.stack -= actualAmount;
          player.committedThisRound += actualAmount;
          this.gameState.pot += actualAmount;

          if (player.stack === 0) {
            player.isAllIn = true;
          }
        }
        break;

      case PokerActionType.RaiseTo:
        const raiseAmount = (action.raiseToAmount || 0) - player.committedThisRound;
        if (raiseAmount > 0 && raiseAmount <= player.stack) {
          player.stack -= raiseAmount;
          player.committedThisRound += raiseAmount;
          this.gameState.pot += raiseAmount;
          this.gameState.currentBetToMatch = action.raiseToAmount || 0;

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

    // Move to next active player
    this.gameState.activePlayerId = this.getNextActivePlayer(playerId);

    // Check if betting round is complete
    if (this.isBettingRoundComplete()) {
      this.advanceBettingRound();
    }

    return true;
  }

  useItem(playerId: number, useType: number, targetPlayerId?: number): boolean {
    // Stub for item usage (cheating, violence, banking)
    // Extend with actual business logic
    return true;
  }

  playerDisconnected(playerId: number): void {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      player.isSeated = false;
    }
  }

  // Private helpers

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

    // All active players have matched the current bet or are all-in
    return activePlayers.every(
      p => p.committedThisRound === this.gameState.currentBetToMatch || p.isAllIn
    );
  }

  private advanceBettingRound(): void {
    // Reset committed amounts for next round
    for (const player of this.gameState.players) {
      if (player.isInHand && !player.hasFolded) {
        player.committedThisRound = 0;
      }
    }

    this.gameState.currentBetToMatch = 0;

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
    }

    if (this.gameState.phase !== HandPhase.Showdown) {
      this.gameState.activePlayerId = this.getNextActivePlayer(this.gameState.dealerPlayerId);
    }
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

    // Find best hand
    let bestPlayer = activePlayers[0];
    let bestScore = -1;

    for (const player of activePlayers) {
      const hole = this.holeCards.get(player.id);
      if (hole) {
        const handValue = evaluateBestHand([hole[0], hole[1]], this.gameState.board);
        if (handValue.score > bestScore) {
          bestScore = handValue.score;
          bestPlayer = player;
        }
      }
    }

    // Award pot to winner
    bestPlayer.stack += this.gameState.pot;

    this.gameState.phase = HandPhase.Payout;
  }
}
