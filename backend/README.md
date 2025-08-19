# Backend - WebRTC Signaling Server

Socket.IO signaling server for WebRTC peer-to-peer connections.

## Development

```bash
npm install
npm start
```

## Production Deployment

```bash
docker build -t webrtc-backend .
docker run -p 3001:3001 webrtc-backend
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode
- `CORS_ORIGIN`: Allowed CORS origins

## API Endpoints

### WebSocket Events

- `join-room`: Join a room for video streaming
- `offer`: WebRTC offer signal
- `answer`: WebRTC answer signal
- `ice-candidate`: ICE candidate exchange

## Features

- WebRTC signaling coordination
- Room-based peer connection management
- CORS configuration for cross-origin requests
- Production-ready error handling
