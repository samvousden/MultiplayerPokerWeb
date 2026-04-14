import React, { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Card, cardToString, ShopItemType } from '@poker/shared';

export const ItemShop: React.FC = () => {
  const { gameState, socket, playerId, setReady } = useGame();
  const [previewedCard, setPreviewedCard] = useState<Card | null>(null);
  const [previewPrice, setPreviewPrice] = useState<number>(0);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  if (!gameState) {
    return <div>Loading...</div>;
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const allReady = gameState.players.length >= 2 && gameState.players.every(p => p.isReady);
  
  // Check if player owns the card sleeve unlock
  const hasCardSleeveUnlock = currentPlayer?.inventory.includes(ShopItemType.CardSleeveUnlock) || false;

  // Reset preview when player gets the unlock
  useEffect(() => {
    if (!hasCardSleeveUnlock) {
      setPreviewedCard(null);
      setPreviewPrice(0);
    }
  }, [hasCardSleeveUnlock]);

  const handleContinue = () => {
    setReady(true);
  };

  const handlePreviewExtraCard = useCallback(() => {
    if (!socket || !playerId) return;
    
    setIsLoadingPreview(true);
    socket.emit('get-extra-card-preview', playerId, (response: any) => {
      setIsLoadingPreview(false);
      if (response.success) {
        setPreviewedCard(response.card);
        setPreviewPrice(response.price);
      } else {
        console.error('Failed to get card preview:', response.error);
      }
    });
  }, [socket, playerId]);

  const handleBuyCardSleeveUnlock = useCallback(() => {
    if (!socket || !playerId) return;
    
    socket.emit('buy-item', playerId, ShopItemType.CardSleeveUnlock, (response: any) => {
      if (!response.success) {
        alert(`Failed to purchase: ${response.error}`);
      }
    });
  }, [socket, playerId]);

  const handleBuyExtraCard = useCallback(() => {
    if (!socket || !playerId || !previewedCard) return;
    
    socket.emit('buy-extra-card', playerId, previewedCard, (response: any) => {
      if (response.success) {
        setPreviewedCard(null);
        setPreviewPrice(0);
      } else {
        alert(`Failed to purchase: ${response.error}`);
      }
    });
  }, [socket, playerId, previewedCard]);

  const totalSpending = (previewPrice || 0) + (hasCardSleeveUnlock ? 0 : 200);
  const canAffordUnlock = (currentPlayer?.stack || 0) >= 200;
  const canAffordCard = (currentPlayer?.stack || 0) >= previewPrice;
  const canAffordBoth = (currentPlayer?.stack || 0) >= totalSpending;

  return (
    <div className="item-shop">
      <div className="shop-header">
        <h1>Item Shop</h1>
        <p className="player-info">
          {currentPlayer?.name} - Stack: ${currentPlayer?.stack}
        </p>
      </div>

      <div className="items-grid">
        {/* Card Sleeve Unlock Item */}
        <div className="item-slot">
          <div className="item-card">
            <h3>Card Sleeve Unlock</h3>
            <p className="item-description">Hold a card in your sleeve to swap with a hole card before showdown</p>
            {hasCardSleeveUnlock ? (
              <div className="item-owned">✓ Owned</div>
            ) : (
              <>
                <p className="item-price">$200</p>
                <button
                  className="buy-btn"
                  onClick={handleBuyCardSleeveUnlock}
                  disabled={!canAffordUnlock}
                >
                  {canAffordUnlock ? 'Buy' : 'Insufficient Funds'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Extra Card Item */}
        <div className="item-slot">
          <div className="item-card">
            <h3>Extra Card</h3>
            <p className="item-description">A random card from the deck that you can swap with a hole card</p>
            
            {!hasCardSleeveUnlock ? (
              <div className="item-locked">
                <p className="locked-message">🔒 Requires Card Sleeve Unlock</p>
              </div>
            ) : previewedCard ? (
              <>
                <div className="card-preview">
                  <div className="card-display">
                    <span className="card-name">{cardToString(previewedCard)}</span>
                  </div>
                  <p className="item-price">${previewPrice}</p>
                </div>
                <div className="preview-buttons">
                  <button
                    className="buy-btn"
                    onClick={handleBuyExtraCard}
                    disabled={!canAffordCard}
                  >
                    {canAffordCard ? 'Buy This Card' : 'Insufficient Funds'}
                  </button>
                  <button
                    className="preview-btn"
                    onClick={handlePreviewExtraCard}
                    disabled={isLoadingPreview}
                  >
                    {isLoadingPreview ? 'Loading...' : 'Different Card'}
                  </button>
                </div>
              </>
            ) : hasCardSleeveUnlock ? (
              <button
                className="preview-btn"
                onClick={handlePreviewExtraCard}
                disabled={isLoadingPreview}
              >
                {isLoadingPreview ? 'Loading...' : 'Preview Card'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="players-status">
        <h3>Players Ready:</h3>
        {gameState.players.map(p => (
          <div key={p.id} className="player-ready-status">
            {p.name} {p.isReady && '✓'} - Stack: ${p.stack}
          </div>
        ))}
      </div>

      <div className="shop-footer">
        {!allReady ? (
          <button onClick={handleContinue} className="continue-btn">
            Continue to Next Hand
          </button>
        ) : (
          <p className="waiting-message">All players ready - starting next hand...</p>
        )}
      </div>
    </div>
  );
};
