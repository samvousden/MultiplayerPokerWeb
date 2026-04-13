import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, PokerAction, PlayerPublicState } from '@poker/shared';

interface GameContextType {
  gameState: GameState | null;
  socket: Socket | null;
  playerId: number | null;
  isConnected: boolean;
  
  // Actions
  joinTable: (playerName: string) => Promise<number | false>;
  setReady: (isReady: boolean) => void;
  startHand: () => void;
  submitAction: (action: PokerAction) => Promise<boolean>;
  useItem: (itemType: number, targetPlayerId?: number) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

  useEffect(() => {
    const newSocket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('game-state-updated', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('hand-started', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('player-ready', ({ playerId: pid, isReady }) => {
      setGameState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p =>
            p.id === pid ? { ...p, isReady } : p
          ),
        };
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [serverUrl]);

  const joinTable = useCallback(
    async (playerName: string): Promise<number | false> => {
      if (!socket) return false;

      return new Promise(resolve => {
        socket.emit('join-table', playerName, ({ playerId: pid, success }) => {
          if (success) {
            setPlayerId(pid);
            resolve(pid);
          } else {
            resolve(false);
          }
        });
      });
    },
    [socket]
  );

  const setReady = useCallback(
    (isReady: boolean) => {
      if (!socket || !playerId) return;
      socket.emit('set-ready', playerId, isReady);
    },
    [socket, playerId]
  );

  const startHand = useCallback(() => {
    if (!socket || !playerId) return;
    socket.emit('start-hand', playerId);
  }, [socket, playerId]);

  const submitAction = useCallback(
    async (action: PokerAction): Promise<boolean> => {
      if (!socket || !playerId) return false;

      return new Promise(resolve => {
        socket.emit('submit-action', playerId, action, ({ success }) => {
          resolve(success || false);
        });
      });
    },
    [socket, playerId]
  );

  const useItem = useCallback(
    (itemType: number, targetPlayerId?: number) => {
      if (!socket || !playerId) return;
      socket.emit('use-item', playerId, itemType, targetPlayerId);
    },
    [socket, playerId]
  );

  return (
    <GameContext.Provider
      value={{
        gameState,
        socket,
        playerId,
        isConnected,
        joinTable,
        setReady,
        startHand,
        submitAction,
        useItem,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};
