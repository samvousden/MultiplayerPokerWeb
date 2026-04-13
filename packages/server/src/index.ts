import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { GameManager } from './gameManager.js';
import { GameState, PokerAction } from '@poker/shared';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager();
const playerSessions = new Map<string, number>(); // socketId -> playerId

// REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/game-state', (req, res) => {
  const gameState = gameManager.getGameState();
  res.json(gameState);
});

// Socket.io events
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join-table', (playerName: string, callback) => {
    const playerId = gameManager.joinTable(playerName);
    playerSessions.set(socket.id, playerId);

    console.log(`Player ${playerName} (ID: ${playerId}) joined the table`);

    // Notify all players of the updated game state
    io.emit('game-state-updated', gameManager.getGameState());

    callback({ playerId, success: true });
  });

  socket.on('set-ready', (playerId: number, isReady: boolean) => {
    gameManager.setReady(playerId, isReady);
    io.emit('player-ready', { playerId, isReady });
  });

  socket.on('start-hand', (playerId: number) => {
    if (gameManager.canStartHand(playerId)) {
      gameManager.startHand();
      io.emit('hand-started', gameManager.getGameState());
    }
  });

  socket.on('submit-action', (playerId: number, action: PokerAction, callback) => {
    const success = gameManager.submitAction(playerId, action);
    
    if (success) {
      io.emit('game-state-updated', gameManager.getGameState());
      callback({ success: true });
    } else {
      callback({ success: false, error: 'Invalid action' });
    }
  });

  socket.on('use-item', (playerId: number, useType: number, targetPlayerId?: number) => {
    const success = gameManager.useItem(playerId, useType, targetPlayerId);
    
    if (success) {
      io.emit('game-state-updated', gameManager.getGameState());
    }
  });

  socket.on('disconnect', () => {
    const playerId = playerSessions.get(socket.id);
    if (playerId !== undefined) {
      gameManager.playerDisconnected(playerId);
      playerSessions.delete(socket.id);
      io.emit('player-disconnected', { playerId });
      console.log(`Player ${playerId} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Poker server running on port ${PORT}`);
});
