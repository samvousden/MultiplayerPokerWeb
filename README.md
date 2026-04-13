# MultiplayerPokerWeb

A full-stack Texas Hold'em poker game built with:
- **Frontend**: React + TypeScript (AWS Amplify ready)
- **Backend**: Node.js + Express + Socket.io
- **Deployment**: AWS Amplify (frontend + backend via Lambda)

## Project Structure

```
packages/
  ├── shared/      # Common types, poker logic, utilities
  ├── server/      # Express server with WebSocket (Socket.io)
  └── client/      # React app with Amplify config
```

## Quick Start

### Install Dependencies
```bash
npm install
```

### Development
```bash
# Run both server and client in parallel
npm run dev

# Or individually:
npm run server
npm run client
```

### Build
```bash
npm run build
```

## Features

- Real-time multiplayer poker using WebSocket
- Texas Hold'em hand evaluation
- Player authentication & stacks
- Shop system (cheating items, violence, banking)
- AWS Amplify integration for React frontend
- TypeScript for type safety

## AWS Amplify Deployment

The React frontend is configured to deploy to AWS Amplify. The backend can be deployed via:
- AWS Lambda (Amplify API)
- EC2 / ECS for persistent WebSocket connections

See `packages/client/amplify.yml` and `packages/server/README.md` for deployment details.
