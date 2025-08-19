# Frontend - Real-time WebRTC Object Detection

React + TypeScript frontend for the WebRTC object detection system.

## Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Docker Deployment

```bash
docker build -t webrtc-frontend .
docker run -p 80:80 webrtc-frontend
```

## Environment Variables

- `VITE_BACKEND_URL`: Backend server URL (default: auto-detected)

## Features

- Mobile camera interface
- Desktop viewer with object detection overlay
- Real-time performance metrics
- WebRTC peer-to-peer streaming
- Responsive design optimized for mobile and desktop
