import React, { useRef, useEffect, useState } from 'react';
import { Monitor, Users, Play, Square, Download } from 'lucide-react';
import { io } from 'socket.io-client';
import { DetectionResult, PerformanceMetrics } from '../types/detection';
import { ObjectDetectionCanvas } from './ObjectDetectionCanvas';
import { PerformanceMetrics as PerformanceComponent } from './PerformanceMetrics';
import { BenchmarkComponent } from './BenchmarkComponent';
import { globalMetrics } from '../utils/metrics';
import { globalMetricsExporter } from '../utils/metrics-exporter';

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
  const processingRef = useRef<boolean>(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    inferenceTime: 0,
    frameProcessingTime: 0,
    droppedFrames: 0,
    totalFrames: 0
  });

  // Effect to handle remote stream updates
  useEffect(() => {
    if (remoteStream && videoRef.current) {
      console.log('🔄 Setting up remote stream on desktop video element');
      console.log('Desktop video element state:', {
        exists: !!videoRef.current,
        currentSrc: videoRef.current.src,
        currentSrcObject: !!videoRef.current.srcObject,
        paused: videoRef.current.paused,
        readyState: videoRef.current.readyState
      });

      videoRef.current.srcObject = remoteStream;

      // Add event listeners for debugging
      videoRef.current.onloadstart = () => console.log('📹 Desktop video loadstart');
      videoRef.current.onloadeddata = () => console.log('📹 Desktop video loadeddata');
      videoRef.current.oncanplay = () => console.log('📹 Desktop video canplay');
      videoRef.current.onplay = () => console.log('▶️ Desktop video play event');
      videoRef.current.onpause = () => console.log('⏸️ Desktop video pause event');

      // Force load the video
      videoRef.current.load();

      // Simple autoplay handling
      videoRef.current.play().then(() => {
        console.log('✅ Desktop video auto-playing successfully');
      }).catch((e) => {
        console.log('Desktop autoplay prevented:', e);
        // User can click the play button in the overlay
      });
    } else if (remoteStream && !videoRef.current) {
      console.warn('⚠️ Remote stream available but video element not ready yet');
    }
  }, [remoteStream]);

  // Additional effect to handle case where video element becomes available after stream
  useEffect(() => {
    if (remoteStream && videoRef.current && !videoRef.current.srcObject) {
      console.log('🔄 Desktop video element now available, assigning pending stream...');
      videoRef.current.srcObject = remoteStream;
      videoRef.current.load();
      videoRef.current.play().then(() => {
        console.log('✅ Delayed desktop video assignment successful');
      }).catch((e) => {
        console.log('Delayed desktop autoplay prevented:', e);
      });
    }
  }, [remoteStream]);

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
    // Dev: connect directly to backend:3001; Prod: same-origin (behind proxy)
    const defaultDev = `http://${window.location.hostname}:3001`;
    const configured = (import.meta as any).env?.VITE_SIGNALING_URL as string | undefined;
    const isDevPort = window.location.port === '5173';
    const baseUrl = configured ?? (isDevPort ? defaultDev : '');
    const socket = baseUrl ? io(baseUrl, { path: '/socket.io' }) : io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Desktop connected to signaling server');
    });

    socket.on('user-joined', (userId: string) => {
      console.log('Mobile device joined room:', userId);
    });

    socket.on('offer', async (offer: RTCSessionDescriptionInit) => {
      console.log('🎥 Received offer from mobile device');
      console.log('Offer details:', offer);
      setIsJoining(false); // Clear joining state
      try {
        if (!peerConnectionRef.current) {
          console.log('🔧 Initializing peer connection for incoming offer...');
          initializePeerConnection();
        }

        const peerConnection = peerConnectionRef.current!;
        console.log('📋 Setting remote description...');
        await peerConnection.setRemoteDescription(offer);
        console.log('✅ Remote description set successfully');

        console.log('📋 Creating answer...');
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('✅ Local description (answer) set successfully');

        console.log('📤 Sending answer to mobile...');
        socket.emit('answer', { roomId, answer });

        console.log('✅ WebRTC Answer sent successfully - Connection establishing...');

        // Flush any pending ICE candidates received before remote description was set
        if (pendingIceCandidatesRef.current.length > 0) {
          console.log(`🧊 Flushing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
          for (const c of pendingIceCandidatesRef.current) {
            try {
              await peerConnection.addIceCandidate(c);
              console.log('✅ Queued ICE candidate added');
            } catch (e) {
              console.error('Failed to add queued ICE candidate:', e);
            }
          }
          pendingIceCandidatesRef.current = [];
        }
      } catch (error) {
        console.error('❌ Error handling offer:', error);
        setIsJoining(false);
      }
    });

    socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      console.log('Received answer');
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(answer);
        } catch (error) {
          console.error('Error setting remote description:', error);
        }
      }
    });

    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      console.log('🧊 Received ICE candidate from mobile');
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log('✅ ICE candidate added successfully');
        } catch (error) {
          console.error('❌ Error adding ICE candidate:', error);
        }
      } else {
        console.log('⏳ Queuing ICE candidate (no remote description yet)');
        pendingIceCandidatesRef.current.push(candidate);
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

        if (type === 'model-ready') {
          console.log('✅ ONNX model loaded and ready for inference');
        } else if (type === 'model-error') {
          console.error('❌ Failed to load ONNX model:', data.error);
        } else if (type === 'detection-result') {
          const { capture_ts, recv_ts, inference_ts, detections: newDetections, frame_id } = data;

          console.log('🔍 Raw detections from worker:', JSON.stringify(newDetections, null, 2));

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

          console.log('📋 Converted display detections:', JSON.stringify(displayDetections, null, 2));
          console.log('📺 Video dimensions:', videoRef.current!.videoWidth, 'x', videoRef.current!.videoHeight);

          setDetections(displayDetections);
          setIsProcessing(false);
          processingRef.current = false;

          // Update both metrics systems
          globalMetrics.addTiming(capture_ts, recv_ts, inference_ts);
          globalMetricsExporter.addTimingRecord(frame_id, capture_ts, recv_ts, inference_ts);

          // Add detection quality metrics
          const avgConfidence = newDetections.length > 0
            ? newDetections.reduce((sum: number, det: any) => sum + det.score, 0) / newDetections.length
            : 0;
          globalMetricsExporter.addDetectionMetrics(newDetections.length, avgConfidence);

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
          processingRef.current = false;
        }
      };

      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        setIsProcessing(false);
        processingRef.current = false;
      };

      // Initialize the ONNX model
      console.log('🚀 Initializing ONNX model...');
      workerRef.current.postMessage({ type: 'init' });

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
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Ensure we negotiate a receiving video transceiver
    try {
      peerConnection.addTransceiver('video', { direction: 'recvonly' });
    } catch (e) {
      console.warn('addTransceiver not supported or failed, relying on remote offer');
    }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('🧊 Sending ICE candidate to mobile');
        socketRef.current.emit('ice-candidate', {
          roomId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('🎥 Received video track from mobile!');
      const [stream] = event.streams;
      console.log('Stream details:', {
        id: stream.id,
        tracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        active: stream.active
      });

      // Verify video tracks are active
      const videoTracks = stream.getVideoTracks();
      videoTracks.forEach((track, index) => {
        console.log(`Video track ${index}:`, {
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          label: track.label
        });
      });

      // Set the remote stream which will trigger the useEffect
      setRemoteStream(stream);
      console.log('✅ Remote stream set in state');
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Desktop connection state:', peerConnection.connectionState);
      const connected = peerConnection.connectionState === 'connected';
      setIsConnected(connected);

      if (connected) {
        console.log('🎉 WebRTC connection established! Video should be streaming now.');

        // Debug: Check what transceivers we have
        const transceivers = peerConnection.getTransceivers();
        console.log('📡 Desktop transceivers:', transceivers.length);
        transceivers.forEach((transceiver, index) => {
          console.log(`Transceiver ${index}:`, {
            mid: transceiver.mid,
            direction: transceiver.direction,
            currentDirection: transceiver.currentDirection,
            receiver: {
              track: transceiver.receiver.track,
              trackId: transceiver.receiver.track?.id,
              trackKind: transceiver.receiver.track?.kind,
              trackEnabled: transceiver.receiver.track?.enabled,
              trackReadyState: transceiver.receiver.track?.readyState
            }
          });
        });

        // Check for remote streams using getReceivers (modern API)
        const receivers = peerConnection.getReceivers();
        const remoteStreams: MediaStream[] = [];
        receivers.forEach((receiver) => {
          if (receiver.track && receiver.track.kind === 'video') {
            // Find streams from track
            const streams = (receiver as any).streams || [];
            streams.forEach((stream: MediaStream) => {
              if (!remoteStreams.find(s => s.id === stream.id)) {
                remoteStreams.push(stream);
              }
            });
          }
        });

        console.log('📺 Remote streams count:', remoteStreams.length);
        remoteStreams.forEach((stream: MediaStream, index: number) => {
          console.log(`Remote stream ${index}:`, {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length
          });
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', peerConnection.iceConnectionState);
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      alert('Please enter a room ID');
      return;
    }

    if (isJoining || isConnected) {
      console.log('Already joining or connected, ignoring request');
      return;
    }

    setIsJoining(true);

    if (socketRef.current) {
      console.log('🚪 Desktop joining room:', roomId);

      // Initialize peer connection BEFORE joining room
      if (!peerConnectionRef.current) {
        console.log('🔧 Pre-initializing peer connection...');
        initializePeerConnection();
        console.log('✅ Peer connection ready for incoming offer');
      }

      socketRef.current.emit('join-room', roomId);
      console.log('⏳ Waiting for mobile device to connect...');
    }
  };

  const startProcessing = () => {
    setIsProcessing(true);
    globalMetrics.reset(); // Reset metrics for new session

    processIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !workerRef.current) {
        return;
      }
      if (processingRef.current) {
        try { globalMetricsExporter.incrementDroppedFrames(); } catch { }
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
      processingRef.current = true;
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

        <div className="flex flex-col xl:flex-row gap-6">
          {/* Main Content Area - Video and Performance Cards */}
          <div className="flex-1">
            <div className="bg-gray-800 rounded-lg overflow-hidden relative">
              {remoteStream ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    controls
                    className="w-full h-auto cursor-pointer"
                    onLoadedMetadata={() => console.log('📹 Desktop video metadata loaded')}
                    onPlaying={() => console.log('▶️ Desktop video started playing')}
                    onError={(e) => console.error('❌ Desktop video error:', e)}
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.play().catch(e => console.log('Manual play failed:', e));
                      }
                    }}
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
                  {/* Overlay for when video stream exists but not playing */}
                  {remoteStream && videoRef.current && videoRef.current.paused && (
                    <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Monitor className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-lg mb-2">Video Stream Received</p>
                        <p className="text-sm opacity-75">Click to start playback</p>
                        <button
                          onClick={() => {
                            if (videoRef.current) {
                              videoRef.current.play().then(() => {
                                console.log('✅ Manual play successful');
                              }).catch(e => console.log('Manual play failed:', e));
                            }
                          }}
                          className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                        >
                          ▶️ Play Video
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Waiting for video stream...</p>
                    <p className="text-sm mt-2">Make sure mobile device is connected to room</p>
                  </div>
                </div>
              )}
            </div>

            {/* Performance Metrics, Benchmark, and Export - Full Width Stacked Layout */}
            {(isProcessing || processIntervalRef.current) && (
              <div className="mt-6 space-y-6">
                {/* Performance Metrics */}
                <div className="bg-gray-800 rounded-lg">
                  <PerformanceComponent metrics={metrics} />
                </div>

                {/* Performance Benchmark */}
                <div className="bg-gray-800 rounded-lg">
                  <BenchmarkComponent />
                </div>

                {/* Export Metrics */}
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
              </div>
            )}
          </div>

          {/* Sidebar - Controls */}
          <div className="xl:w-80 space-y-6">
            {/* Connection Controls */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-400" />
                Receive Video
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Enter Code from Mobile</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent text-center font-mono text-lg"
                    placeholder="6-DIGIT CODE"
                    maxLength={6}
                  />
                </div>

                {/* Connection Status */}
                <div className="bg-gray-700 rounded-md p-3">
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Connection:</span>
                      <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
                        {isConnected ? '🟢 Connected' : '🟡 Waiting'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Video Stream:</span>
                      <span className={remoteStream ? 'text-green-400' : 'text-red-400'}>
                        {remoteStream ? '🎥 Receiving' : '❌ None'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={joinRoom}
                  disabled={isConnected || isJoining || !roomId.trim()}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${isConnected
                    ? 'bg-green-600 text-white cursor-not-allowed'
                    : isJoining
                      ? 'bg-yellow-600 text-white cursor-not-allowed'
                      : !roomId.trim()
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                  {isConnected ? (
                    <>
                      <Users className="w-5 h-5 mr-2" />
                      Connected & Receiving Video
                    </>
                  ) : isJoining ? (
                    <>
                      <Users className="w-5 h-5 mr-2" />
                      Waiting for Mobile...
                    </>
                  ) : (
                    <>
                      <Users className="w-5 h-5 mr-2" />
                      Join Room
                    </>
                  )}
                </button>

                {/* Debug button for video refresh */}
                {remoteStream && (
                  <button
                    onClick={() => {
                      if (videoRef.current && remoteStream) {
                        console.log('🔄 Manual desktop video refresh triggered');
                        videoRef.current.srcObject = remoteStream;
                        videoRef.current.load();
                        videoRef.current.play().catch(console.error);
                      }
                    }}
                    className="w-full mt-2 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded-md text-sm transition-colors"
                  >
                    🔄 Refresh Video
                  </button>
                )}
              </div>
            </div>

            {/* Auto-start Detection when video is received */}
            {remoteStream && !isProcessing && !processIntervalRef.current && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Play className="w-5 h-5 mr-2 text-green-400" />
                  Object Detection
                </h3>

                <button
                  onClick={startProcessing}
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Detection
                </button>
              </div>
            )}

            {/* Stop Detection Control */}
            {isProcessing && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Play className="w-5 h-5 mr-2 text-green-400" />
                  Object Detection
                </h3>

                <button
                  onClick={stopProcessing}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                >
                  <Square className="w-5 h-5 mr-2" />
                  Stop Detection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};