import React, { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Card, cardToDisplayString, ShopItemType, ShopItemRarity, ShopSlotItem } from '@poker/shared';

export const ItemShop: React.FC = () => {
  const { gameState, socket, playerId, setReady } = useGame();
  const [shopSlots, setShopSlots] = useState<ShopSlotItem[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  if (!gameState) {
    return <div>Loading...</div>;
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const allReady = gameState.players.length >= 2 && gameState.players.every(p => p.isReady);

  // Load shop slots when entering shop
  useEffect(() => {
    if (!socket || !playerId) return;
    setIsLoadingSlots(true);
    socket.emit('get-shop-slots', playerId, (response: any) => {
      setIsLoadingSlots(false);
      if (response.success) {
        setShopSlots(response.slots);
      }
    });
  }, [socket, playerId]);

  const handleContinue = () => {
    setReady(true);
  };

  const handleBuyItem = useCallback((slotType: ShopItemType, previewCard?: Card, slotIndex?: number) => {
    if (!socket || !playerId) return;

    if (slotType === ShopItemType.ExtraCard && previewCard) {
      socket.emit('buy-extra-card', playerId, previewCard, (response: any) => {
        if (response.success) {
          // Remove only the specific slot that was bought (by index if provided, else by card match)
          setShopSlots(prev => {
            if (slotIndex !== undefined) {
              return prev.filter((_, i) => i !== slotIndex);
            }
            const idx = prev.findIndex(s =>
              s.type === ShopItemType.ExtraCard &&
              s.previewCard?.rank === previewCard.rank &&
              s.previewCard?.suit === previewCard.suit
            );
            return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
          });
        } else {
          alert(`Failed to purchase: ${response.error}`);
        }
      });
    } else {
      socket.emit('buy-item', playerId, slotType, (response: any) => {
        if (response.success) {
          // Remove the bought slot, and regenerate slots for dependency items
          setShopSlots(prev => prev.filter(s => s.type !== slotType));
          // If bought Card Sleeve Unlock or Sleeve Extender, refresh slots to potentially unlock new items
          if (slotType === ShopItemType.CardSleeveUnlock || slotType === ShopItemType.SleeveExtender) {
            socket.emit('get-shop-slots', playerId, (resp: any) => {
              if (resp.success) setShopSlots(resp.slots);
            });
          }
        } else {
          alert(`Failed to purchase: ${response.error}`);
        }
      });
    }
  }, [socket, playerId]);

  const renderSlot = (slot: ShopSlotItem, index: number) => {
    const canAfford = (currentPlayer?.stack || 0) >= slot.price;
    const rarityLabel = slot.rarity === ShopItemRarity.Rare ? 'Rare'
      : slot.rarity === ShopItemRarity.Uncommon ? 'Uncommon'
      : 'Common';

    return (
      <div key={index} className="item-slot">
        <div className="item-card">
          <div className="item-card-header">
            <h3>{slot.name}</h3>
            <span className={`rarity-badge rarity-${slot.rarity}`}>{rarityLabel}</span>
          </div>
          <p className="item-description">{slot.description}</p>

          {slot.type === ShopItemType.ExtraCard ? (
            // Extra Card - show directly, no preview mechanic
            slot.previewCard ? (
              <>
                <div className="card-preview">
                  <div className="card-display">
                    <span className="card-name">{cardToDisplayString(slot.previewCard)}</span>
                  </div>
                  <p className="item-price">${slot.price}</p>
                </div>
                <button
                  className="buy-btn"
                  onClick={() => handleBuyItem(slot.type, slot.previewCard!, index)}
                  disabled={!canAfford}
                >
                  {canAfford ? 'Buy This Card' : 'Insufficient Funds'}
                </button>
              </>
            ) : (
              <p className="item-price">$30-$50</p>
            )
          ) : slot.type === ShopItemType.Joker ? (
            // Joker card
            <>
              <div className="card-preview joker-preview">
                <div className="card-display joker-display">
                  <span className="card-name">🃏</span>
                </div>
                <p className="item-price">${slot.price}</p>
              </div>
              <button
                className="buy-btn"
                onClick={() => handleBuyItem(slot.type)}
                disabled={!canAfford}
              >
                {canAfford ? 'Buy' : 'Insufficient Funds'}
              </button>
            </>
          ) : (
            // Standard item
            <>
              <p className="item-price">${slot.price}</p>
              <button
                className="buy-btn"
                onClick={() => handleBuyItem(slot.type)}
                disabled={!canAfford}
              >
                {canAfford ? 'Buy' : 'Insufficient Funds'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="item-shop">
      <div className="shop-header">
        <h1>Item Shop</h1>
        <p className="player-info">
          {currentPlayer?.name} - Stack: ${currentPlayer?.stack}
        </p>
      </div>

      <div className="items-grid">
        {isLoadingSlots ? (
          <div className="shop-loading">Loading shop...</div>
        ) : shopSlots.length === 0 ? (
          <div className="shop-empty">No items available</div>
        ) : (
          shopSlots.map((slot, i) => renderSlot(slot, i))
        )}
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
