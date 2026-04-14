import React, { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Card, cardToDisplayString, ShopItemType, ShopItemRarity, ShopSlotItem } from '@poker/shared';

const REFRESH_SHOP_COST = 50;

export const ItemShop: React.FC = () => {
  const { gameState, socket, playerId, setReady } = useGame();
  const [shopSlots, setShopSlots] = useState<ShopSlotItem[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [boughtIndices, setBoughtIndices] = useState<Set<number>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!gameState) {
    return <div>Loading...</div>;
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const allReady = gameState.players.length >= 2 && gameState.players.every(p => p.isReady);

  // Load shop slots when entering shop
  useEffect(() => {
    if (!socket || !playerId) return;
    setIsLoadingSlots(true);
    setBoughtIndices(new Set());
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

  const handleRefreshShop = useCallback(() => {
    if (!socket || !playerId) return;
    setIsRefreshing(true);
    socket.emit('refresh-shop', playerId, (response: any) => {
      setIsRefreshing(false);
      if (response.success) {
        setShopSlots(response.slots);
        setBoughtIndices(new Set());
      } else {
        alert(response.error || 'Cannot refresh shop');
      }
    });
  }, [socket, playerId]);

  const handleBuyItem = useCallback((slotType: ShopItemType, slotIndex: number, previewCard?: Card) => {
    if (!socket || !playerId) return;

    if (slotType === ShopItemType.ExtraCard && previewCard) {
      socket.emit('buy-extra-card', playerId, previewCard, (response: any) => {
        if (response.success) {
          setBoughtIndices(prev => new Set(prev).add(slotIndex));
        } else {
          alert(`Failed to purchase: ${response.error}`);
        }
      });
    } else {
      socket.emit('buy-item', playerId, slotType, (response: any) => {
        if (response.success) {
          setBoughtIndices(prev => new Set(prev).add(slotIndex));
        } else {
          alert(`Failed to purchase: ${response.error}`);
        }
      });
    }
  }, [socket, playerId]);

  const renderSlot = (slot: ShopSlotItem, index: number) => {
    const bought = boughtIndices.has(index);
    const canAfford = (currentPlayer?.stack || 0) >= slot.price;
    const rarityLabel = slot.rarity === ShopItemRarity.Rare ? 'Rare'
      : slot.rarity === ShopItemRarity.Uncommon ? 'Uncommon'
      : 'Common';

    return (
      <div key={index} className={`item-slot${bought ? ' item-slot-bought' : ''}`}>
        <div className="item-card">
          <div className="item-card-header">
            <h3>{slot.name}</h3>
            <span className={`rarity-badge rarity-${slot.rarity}`}>{rarityLabel}</span>
          </div>
          <p className="item-description">{slot.description}</p>

          {slot.type === ShopItemType.ExtraCard ? (
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
                  onClick={() => handleBuyItem(slot.type, index, slot.previewCard!)}
                  disabled={bought || !canAfford}
                >
                  {bought ? 'Purchased' : canAfford ? 'Buy This Card' : 'Insufficient Funds'}
                </button>
              </>
            ) : (
              <p className="item-price">$30-$50</p>
            )
          ) : slot.type === ShopItemType.Joker ? (
            <>
              <div className="card-preview joker-preview">
                <div className="card-display joker-display">
                  <span className="card-name">🃏</span>
                </div>
                <p className="item-price">${slot.price}</p>
              </div>
              <button
                className="buy-btn"
                onClick={() => handleBuyItem(slot.type, index)}
                disabled={bought || !canAfford}
              >
                {bought ? 'Purchased' : canAfford ? 'Buy' : 'Insufficient Funds'}
              </button>
            </>
          ) : (
            <>
              <p className="item-price">${slot.price}</p>
              <button
                className="buy-btn"
                onClick={() => handleBuyItem(slot.type, index)}
                disabled={bought || !canAfford}
              >
                {bought ? 'Purchased' : canAfford ? 'Buy' : 'Insufficient Funds'}
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

      <div className="shop-refresh">
        <button
          className="refresh-shop-btn"
          onClick={handleRefreshShop}
          disabled={isRefreshing || (currentPlayer?.stack ?? 0) < REFRESH_SHOP_COST}
        >
          {isRefreshing ? 'Refreshing...' : `Refresh Shop ($${REFRESH_SHOP_COST})`}
        </button>
      </div>

      <div className="players-status">
        <h3>Players Ready:</h3>
        {gameState.players.map(p => (
          <div key={p.id} className="player-ready-status">
            {p.name} {p.isReady && '✓'}
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
