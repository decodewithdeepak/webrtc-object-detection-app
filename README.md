# Real-time WebRTC VLM Multi-Object Detection

**Microservices Architecture** - Phone → Browser → Inference → Overlay

A production-ready real-time object detection system that streams camera feed from mobile devices to desktop browsers via WebRTC, performs AI-powered object detection, and overlays results with performance metrics.

## 🏗️ Architecture

```
project/
├── frontend/          # React + TypeScript UI with integrated benchmarking
├── backend/           # Node.js signaling server
├── docker-compose.yml # Container orchestration
└── package.json       # Root orchestration
```

## 🚀 Quick Start

### Development

```bash
# Install all dependencies
npm run install:all

# Start frontend + backend
npm start
```

### Production (Docker)

```bash
# Start all services
docker-compose up -d
```

## 📱 Usage

1. **Mobile**: Open `http://[SERVER_IP]:5173` → Allow camera → Note Room ID
2. **Desktop**: Open `http://[SERVER_IP]:5173` → Enter Room ID → Join → Start Detection
3. **Benchmark**: Use the built-in benchmark tool in the desktop interface for performance testing

## 🔧 Components

### Frontend (`/frontend`)

- React + TypeScript + Vite
- Mobile camera interface
- Desktop viewer with detection overlay
- **Integrated benchmark tool** for real-time performance testing
- Real-time performance metrics
- WebRTC peer-to-peer streaming

### Backend (`/backend`)

- Node.js + Socket.IO signaling server
- WebRTC coordination
- Room-based peer management
- CORS configuration

## 📊 Performance Testing

The benchmark functionality is now integrated directly into the web application:

1. Start object detection on desktop viewer
2. Use the **Performance Benchmark** panel
3. Select test duration (10s, 30s, 60s, 2min)
4. Click "Start Benchmark"
5. Export results as JSON for analysis

### Benefits of Web-Based Benchmarking:

- ✅ **Works with separated deployments** (Vercel + Railway/Render)
- ✅ **Real browser environment** testing
- ✅ **Live performance monitoring** during tests
- ✅ **Easy access** - no separate tools needed
- ✅ **JSON export** for further analysis

## 🚢 Deployment

### Individual Services

```bash
# Frontend only
cd frontend && npm run build

# Backend only
cd backend && npm start

# Benchmarking
cd scripts && npm run benchmark
```

### Container Deployment

```bash
# Production stack
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

## 🎯 Key Features

- **WebRTC Streaming**: Direct peer-to-peer video
- **Real-time Detection**: WASM-based object detection
- **Performance Monitoring**: Live FPS and latency metrics
- **Statistical Analysis**: Median and P95 measurements
- **Export Functionality**: JSON metrics for analysis
- **Mobile Optimized**: Responsive design for all devices
- **Production Ready**: Docker containers and microservices

## 🔮 Production Upgrades

- Replace mock inference with ONNX Runtime Web
- Add real YOLO/MobileNet model loading
- Implement bandwidth adaptation
- Add error recovery and reconnection
- Scale with load balancers and CDN

---

**Note**: Currently uses mock WASM inference for demonstration. Architecture supports drop-in replacement with real ML models.

- **Object Detection**: WASM-based inference worker (mock implementation included)
- **Performance**: Frame rate control and backpressure handling

### Usage

1. **Mobile Device (Camera)**:

   - Access the app on your mobile device
   - Grant camera permissions
   - Enter a room ID and start streaming

2. **Desktop (Viewer)**:
   - Access the app on your desktop browser
   - Enter the same room ID to connect
   - Start object detection processing

### Performance Features

- **Adaptive Frame Rate**: Automatically adjusts processing rate based on system performance
- **Frame Dropping**: Skips frames when processing falls behind to maintain real-time performance
- **Backpressure Handling**: Prevents memory buildup during high-load scenarios
- **Performance Metrics**: Real-time monitoring of FPS, inference time, and system health

## Technical Implementation

### WebRTC Connection Flow

1. Mobile device creates room and starts camera
2. Desktop joins room through signaling server
3. WebRTC peer connection established with STUN servers
4. Direct P2P video streaming begins

### Object Detection Pipeline

1. Video frames captured from WebRTC stream
2. Frames sent to WASM worker for processing
3. Mock MobileNet-SSD inference (replace with real ONNX Runtime)
4. Detection results rendered as canvas overlays

### Performance Optimization

- **Target 15 FPS**: Balanced performance for modest hardware
- **Frame Queue Management**: Prevents processing bottlenecks
- **Dynamic Quality Adjustment**: Adapts to system capabilities
- **Memory Management**: Efficient cleanup and garbage collection

## Production Considerations

### Real ONNX Runtime Integration

Replace the mock worker (`src/workers/detection-worker.ts`) with actual ONNX Runtime Web implementation:

```typescript
import * as ort from 'onnxruntime-web';

// Load MobileNet-SSD model
const session = await ort.InferenceSession.create('/models/mobilenet-ssd.onnx');
```

### Security

- Implement HTTPS/WSS for production
- Add authentication for room access
- Use TURN servers for firewall traversal

### Scalability

- Deploy signaling server to cloud infrastructure
- Use Redis for multi-instance room management
- Implement connection pooling and load balancing

## Browser Compatibility

- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: WebRTC support with polyfills
- **Mobile Browsers**: Native camera access required

## Hardware Requirements

- **Mobile**: Modern smartphone with camera
- **Desktop**: Modest hardware capable of 15 FPS processing
- **Network**: Stable internet connection (recommend 5+ Mbps)

## Development

### Project Structure

```
src/
├── components/          # React components
├── types/              # TypeScript definitions
├── utils/              # Utility functions
├── workers/            # WASM inference workers
server/                 # WebRTC signaling server
```

### Adding New Features

1. Extend detection types in `src/types/detection.ts`
2. Update worker implementation for new models
3. Modify canvas rendering for visualization changes
4. Add performance metrics as needed

## License

MIT License - see LICENSE file for details.
