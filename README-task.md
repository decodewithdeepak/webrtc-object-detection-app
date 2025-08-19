# Real-time WebRTC VLM Multi-Object Detection

**Interview Task Implementation** - Phone → Browser → Inference → Overlay

This project implements a real-time object detection system that streams camera feed from a mobile device to a desktop browser via WebRTC, performs object detection, and overlays the results with precise timing metrics.

## 🎯 Task Requirements Implemented

### ✅ Core Functionality

- **WebRTC Video Streaming**: Mobile camera → Desktop browser
- **Real-time Object Detection**: WASM-based inference (mock implementation)
- **Overlay Visualization**: Bounding boxes with labels and confidence scores
- **Frame Alignment**: Proper timestamp tracking for accurate overlay positioning

### ✅ JSON Message Format Compliance

```json
{
	"frame_id": "frame_1703123456789_abc123def",
	"capture_ts": 1703123456789,
	"recv_ts": 1703123456812,
	"inference_ts": 1703123456867,
	"detections": [
		{
			"label": "person",
			"score": 0.85,
			"xmin": 0.1,
			"ymin": 0.2,
			"xmax": 0.4,
			"ymax": 0.8
		}
	]
}
```

### ✅ Performance Metrics Collection

- **Latency Tracking**: Capture→Recv and Recv→Inference timing
- **Statistical Analysis**: Median and P95 latency measurements
- **FPS Monitoring**: Real-time frame rate tracking
- **Metrics Export**: JSON output for analysis

### ✅ Benchmarking System

- **30-second Test Runs**: Automated performance measurement
- **metrics.json Output**: Structured performance data
- **CLI Interface**: Easy benchmark execution

# Real-time WebRTC VLM Multi-Object Detection

**Interview Task Implementation** - Phone → Browser → Inference → Overlay

This project implements a real-time object detection system that streams camera feed from a mobile device to a desktop browser via WebRTC, performs object detection, and overlays the results with precise timing metrics.

## 🏗️ Deployment-Ready Structure

```
project/
├── frontend/          # React + TypeScript (Deploy to Vercel/Netlify)
│   ├── src/           # Source code with integrated benchmarking
│   ├── package.json   # Frontend dependencies
│   ├── Dockerfile     # Production container
│   └── README.md      # Frontend documentation
├── backend/           # Node.js signaling server (Deploy to Railway/Render)
│   ├── signaling.js   # WebRTC coordination
│   ├── package.json   # Backend dependencies
│   ├── Dockerfile     # Production container
│   └── README.md      # Backend documentation
├── docker-compose.yml # Full-stack container orchestration
└── package.json       # Local development orchestration
```

## 🚢 Deployment Options

### Frontend → Vercel/Netlify

```bash
cd frontend
npm run build
# Deploy dist/ folder to Vercel/Netlify
```

### Backend → Railway/Render/Heroku

```bash
cd backend
# Push to Git - platform auto-detects Node.js
# Set environment: PORT=3001
```

### Full Stack → Docker (VPS/Cloud)

```bash
docker-compose up -d
```

## 📊 Integrated Benchmarking

**Built into the web app - no separate tools needed!**

- Real browser-based performance testing
- Works with any deployment setup
- JSON export for analysis
- 10s/30s/60s/2min test durations

## 🚀 Quick Start

### Option 1: Docker Deployment (Recommended)

```bash
# Build and run all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:5173
# Backend: http://localhost:3001
```

### Option 2: Development Setup

```bash
# Install all dependencies
npm run install:all

# Start all services
npm start

# Or run individually:
npm run dev:frontend  # Frontend only
npm run dev:backend   # Backend only
```

### Option 3: Production Deployment

```bash
# Build frontend for production
npm run build

# Deploy with Docker Compose
docker-compose -f docker-compose.yml up -d
```

### 3. Test the System

#### On Mobile Device:

1. Open `http://[YOUR_IP]:5173` in mobile browser
2. Allow camera permissions
3. Note the generated Room ID
4. Point camera at objects for detection

#### On Desktop:

1. Open `http://[YOUR_IP]:5173` in desktop browser
2. Enter the Room ID from mobile
3. Click "Join Room" → "Start Detection"
4. View real-time object detection overlay

### 4. Performance Analysis

```bash
# Run 30-second benchmark
npm run benchmark

# Export metrics from UI
# Click "Download metrics.json" button during detection session
```

## 📊 Benchmarking

### Automated Benchmarking

```bash
# Standard 30-second test
npm run benchmark:30s

# Extended 60-second test
npm run benchmark:60s

# Docker-based benchmarking
docker-compose --profile tools run scripts npm run benchmark
```

### Manual Testing

1. Start the application: `npm start`
2. Open mobile and desktop interfaces
3. Start detection session
4. Export metrics from UI

## 🔧 Component Architecture

### Frontend (`/frontend`)

- **React + TypeScript**: Modern UI framework
- **Vite**: Fast development and build tool
- **Tailwind CSS**: Utility-first styling
- **Socket.IO Client**: WebRTC signaling
- **Web Workers**: Object detection processing

### Backend (`/backend`)

- **Node.js**: Runtime environment
- **Socket.IO**: WebRTC signaling server
- **CORS**: Cross-origin resource sharing
- **Express**: Web framework (minimal)

### Scripts (`/scripts`)

- **Benchmark Tool**: Performance measurement
- **Metrics Analysis**: Statistical processing
- **CLI Interface**: Command-line testing tools

## � Deployment Options

### Docker Compose (Recommended)

```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Include benchmarking tools
docker-compose --profile tools up
```

### Individual Container Deployment

```bash
# Frontend
cd frontend && docker build -t webrtc-frontend .
docker run -p 80:80 webrtc-frontend

# Backend
cd backend && docker build -t webrtc-backend .
docker run -p 3001:3001 webrtc-backend

# Scripts
cd scripts && docker build -t webrtc-scripts .
docker run -v $(pwd)/metrics:/app/output webrtc-scripts
```

### Cloud Deployment

- **Frontend**: Deploy to Netlify, Vercel, or AWS S3+CloudFront
- **Backend**: Deploy to Heroku, Railway, or AWS ECS
- **Container Registry**: Push to Docker Hub or AWS ECR

## �📱 Device Compatibility

### Mobile Requirements

- Modern browser with WebRTC support
- Camera permissions
- Network connectivity to desktop

### Desktop Requirements

- Modern browser (Chrome/Firefox/Edge recommended)
- Same network as mobile device
- JavaScript enabled

## 🎥 Demo Recording

For Loom video recording, demonstrate:

1. Mobile camera setup and Room ID generation
2. Desktop connection and detection start
3. Object detection in action with overlay
4. Metrics export and analysis
5. Benchmark script execution

## ⚡ Performance Targets

- **FPS**: 12-18 fps sustained
- **Latency**: <100ms total (capture→overlay)
- **Accuracy**: Mock detections with 50-90% confidence
- **Stability**: 30+ second continuous operation

## 🔮 Production Upgrades

To enhance for production:

1. Replace mock inference with real ONNX Runtime Web
2. Implement actual YOLO/MobileNet model loading
3. Add WebRTC optimization (bandwidth adaptation)
4. Include error recovery and reconnection logic
5. Optimize frame processing pipeline

## 📋 Task Deliverables

### ✅ Completed

- [x] Working WebRTC video streaming
- [x] Real-time object detection system
- [x] JSON message format compliance
- [x] Performance metrics collection
- [x] Benchmarking script with metrics.json output
- [x] Frame alignment and overlay accuracy
- [x] Documentation and setup instructions

### 🎬 Remaining

- [ ] Loom video demonstration
- [ ] Final testing and validation

---

**Note**: This implementation uses mock WASM inference for demonstration. The architecture supports drop-in replacement with real ONNX Runtime Web and pre-trained models for production deployment.
