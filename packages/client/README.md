# Client

React frontend for multiplayer poker with Amplify support.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Frontend runs on `http://localhost:5173` by default.

## Environment Variables

Create a `.env.local` file:

```
VITE_SOCKET_URL=http://localhost:5000
```

## AWS Amplify Deployment

### Initial Setup

```bash
npm install -g @aws-amplify/cli
amplify init
```

### Amplify Configuration

The `amplify.yml` file configures:
- Build environment
- Build commands
- Deploy target

### Deploy Frontend Only

```bash
amplify publish
```

### Deploy with Backend

Set up an Amplify API to proxy WebSocket requests, or deploy server to EC2/ECS separately.

## Features

- Real-time game updates via WebSocket
- Join/ready/fold/check/call/raise actions
- Player list and game state display
- Responsive design for desktop and mobile

## File Structure

```
src/
  ├── components/      # React components
  │   ├── GameBoard.tsx
  │   └── LobbyScreen.tsx
  ├── context/         # Global state (GameContext)
  ├── App.tsx
  ├── main.tsx
  └── index.css
```
