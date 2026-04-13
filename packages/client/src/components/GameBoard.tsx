import React from 'react';
import { useGame } from '../context/GameContext';
import { PokerActionType } from '@poker/shared';

export const GameBoard: React.FC = () => {
  const { gameState, playerId, submitAction } = useGame();

  if (!gameState || !playerId) {
    return <div>Loading...</div>;
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId);

  return (
    <div className="game-board">
      <div className="pot-display">
        <h2>Pot: ${gameState.pot}</h2>
      </div>

      <div className="board-cards">
        <h3>Community Cards</h3>
        <div className="cards">
          {gameState.board.map((card, i) => (
            <div key={i} className="card">
              {card.rank} of {card.suit}
            </div>
          ))}
        </div>
      </div>

      <div className="players-table">
        {gameState.players.map(player => (
          <div key={player.id} className={`player-seat ${player.id === playerId ? 'is-you' : ''}`}>
            <h4>{player.name}</h4>
            <p>Stack: ${player.stack}</p>
            {player.isReady && <span className="badge ready">Ready</span>}
            {player.hasFolded && <span className="badge folded">Folded</span>}
            {player.isAllIn && <span className="badge all-in">All In</span>}
          </div>
        ))}
      </div>

      {currentPlayer && gameState.activePlayerId === playerId && (
        <div className="action-panel">
          <h3>Your Turn</h3>
          <button onClick={() => submitAction({ type: PokerActionType.Fold })}>
            Fold
          </button>
          <button onClick={() => submitAction({ type: PokerActionType.Check })}>
            Check
          </button>
          <button onClick={() => submitAction({ type: PokerActionType.Call })}>
            Call ${gameState.currentBetToMatch - currentPlayer.committedThisRound}
          </button>
          <div className="raise-input">
            <input type="number" placeholder="Raise to..." />
            <button onClick={() => submitAction({ type: PokerActionType.RaiseTo, raiseToAmount: 100 })}>
              Raise
            </button>
          </div>
        </div>
      )}

      <div className="game-info">
        <p>Phase: {gameState.phase}</p>
        <p>Betting Round: {gameState.round}</p>
        <p>Dealer: Player {gameState.dealerPlayerId}</p>
      </div>
    </div>
  );
};
