import React, { useRef, useEffect, useState } from 'react';
import { Monitor, Users, Play, Square, Download } from 'lucide-react';
import { io } from 'socket.io-client';
import { DetectionResult, PerformanceMetrics } from '../types/detection';
import { ObjectDetectionCanvas } from './ObjectDetectionCanvas';
import { PerformanceMetrics as PerformanceComponent } from './PerformanceMetrics';
import { BenchmarkComponent } from './BenchmarkComponent';
import { globalMetrics } from '../utils/metrics';

interface DesktopViewerProps {
  roomId: string;
  setRoomId: (id: string) => void;
}

export const DesktopViewer: React.FC<DesktopViewerProps> = ({
  roomId,
  setRoomId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const processIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    inferenceTime: 0,
    frameProcessingTime: 0,
    droppedFrames: 0,
    totalFrames: 0
  });

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Export metrics to JSON file
  const exportMetrics = () => {
    const metricsJson = globalMetrics.exportMetricsJson();
    const blob = new Blob([metricsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metrics.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    // Initialize Socket.IO connection
    // Use window.location.hostname to automatically detect the correct server address
    const serverUrl = `ws://${window.location.hostname}:3001`;
    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    socket.on('offer', async (offer: RTCSessionDescriptionInit) => {
      const peerConnection = initializePeerConnection();
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    });

    socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    });

    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      }
    });

    return () => {
      socket.disconnect();
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
      }
    };
  }, [roomId]);

  useEffect(() => {
    // Initialize object detection worker
    try {
      // Use Vite's worker import syntax
      workerRef.current = new Worker(new URL('../workers/detection-worker.ts', import.meta.url), {
        type: 'module'
      });

      workerRef.current.onmessage = (event) => {
        const { type, data } = event.data;

        if (type === 'detection-result') {
          const { capture_ts, recv_ts, inference_ts, detections: newDetections } = data;

          // Convert task format to display format
          const displayDetections: DetectionResult[] = newDetections.map((det: any) => ({
            bbox: [
              det.xmin * videoRef.current!.videoWidth,
              det.ymin * videoRef.current!.videoHeight,
              (det.xmax - det.xmin) * videoRef.current!.videoWidth,
              (det.ymax - det.ymin) * videoRef.current!.videoHeight
            ],
            class: det.label,
            score: det.score
          }));

          setDetections(displayDetections);
          setIsProcessing(false);

          // Update task-compliant metrics
          globalMetrics.addTiming(capture_ts, recv_ts, inference_ts);
          const realTimeStats = globalMetrics.getRealTimeStats();

          setMetrics(prev => ({
            fps: realTimeStats.fps,
            inferenceTime: inference_ts - recv_ts,
            frameProcessingTime: recv_ts - capture_ts,
            droppedFrames: prev.droppedFrames,
            totalFrames: realTimeStats.frames
          }));
        } else if (type === 'error') {
          console.error('Worker error:', data);
          setIsProcessing(false);
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        setIsProcessing(false);
      };

      console.log('Object detection worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize worker:', error);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const initializePeerConnection = () => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          roomId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const connected = peerConnection.connectionState === 'connected';
      setIsConnected(connected);
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const joinRoom = () => {
    if (socketRef.current) {
      socketRef.current.emit('join-room', roomId);
      initializePeerConnection();
    }
  };

  const startProcessing = () => {
    setIsProcessing(true);
    globalMetrics.reset(); // Reset metrics for new session

    processIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !workerRef.current || isProcessing) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video.readyState !== 4) return;

      // Capture frame with timestamp
      const capture_ts = Date.now();
      const frame_id = `frame_${capture_ts}_${Math.random().toString(36).substr(2, 9)}`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const recv_ts = Date.now(); // Simulate receive time

      // Send frame to worker with task-compliant format
      setIsProcessing(true);
      workerRef.current.postMessage({
        type: 'process-frame',
        data: {
          frame_id,
          capture_ts,
          recv_ts,
          imageData,
          width: canvas.width,
          height: canvas.height
        }
      });

    }, 1000 / 15); // Target 15 FPS
  };

  const stopProcessing = () => {
    if (processIntervalRef.current) {
      clearInterval(processIntervalRef.current);
      processIntervalRef.current = null;
    }
    setIsProcessing(false);
    setDetections([]);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6">
        <div className="text-center mb-6">
          <Monitor className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Object Detection Viewer</h1>
          <p className="text-gray-300">Real-time object detection from mobile camera stream</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Stream */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg overflow-hidden relative">
              {remoteStream ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-auto"
                  />
                  <ObjectDetectionCanvas
                    videoRef={videoRef}
                    detections={detections}
                    isProcessing={isProcessing}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Waiting for video stream...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls and Metrics */}
          <div className="space-y-6">
            {/* Connection Controls */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-400" />
                Connection
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Room ID</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    placeholder="Enter Room ID from mobile camera"
                  />
                </div>

                <button
                  onClick={joinRoom}
                  disabled={isConnected}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${isConnected
                    ? 'bg-green-600 text-white cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                  {isConnected ? (
                    <>
                      <Users className="w-5 h-5 mr-2" />
                      Connected
                    </>
                  ) : (
                    <>
                      <Users className="w-5 h-5 mr-2" />
                      Join Room
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Detection Controls */}
            {remoteStream && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Play className="w-5 h-5 mr-2 text-green-400" />
                  Detection
                </h3>

                <div className="space-y-3">
                  {!isProcessing && !processIntervalRef.current ? (
                    <button
                      onClick={startProcessing}
                      className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start Detection
                    </button>
                  ) : (
                    <button
                      onClick={stopProcessing}
                      className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                    >
                      <Square className="w-5 h-5 mr-2" />
                      Stop Detection
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Performance Metrics */}
            {(isProcessing || processIntervalRef.current) && (
              <>
                <PerformanceComponent metrics={metrics} />

                {/* Metrics Export */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Download className="w-5 h-5 mr-2 text-purple-400" />
                    Export Metrics
                  </h3>
                  <button
                    onClick={exportMetrics}
                    className="w-full bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download metrics.json
                  </button>
                </div>
              </>
            )}

            {/* Benchmark Component */}
            {(isProcessing || processIntervalRef.current) && (
              <BenchmarkComponent />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};