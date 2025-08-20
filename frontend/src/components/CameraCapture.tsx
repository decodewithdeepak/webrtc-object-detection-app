import React, { useEffect, useRef, useState } from 'react';
import { Camera, Copy, Check, Wifi, WifiOff, Phone } from 'lucide-react';
import { io } from 'socket.io-client';

interface CameraCaptureProps {
  roomId: string;
  setRoomId: (id: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  roomId,
  setRoomId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Generate room ID when component mounts
  useEffect(() => {
    if (!roomId) {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      setRoomId(newRoomId);
    }
  }, [roomId, setRoomId]);

  // Effect to handle local stream updates
  useEffect(() => {
    if (localStream && videoRef.current) {
      console.log('🔄 Updating mobile video element with local stream');
      console.log('Video element state:', {
        exists: !!videoRef.current,
        currentSrc: videoRef.current.src,
        currentSrcObject: !!videoRef.current.srcObject,
        paused: videoRef.current.paused,
        readyState: videoRef.current.readyState
      });

      videoRef.current.srcObject = localStream;

      // Add event listeners for debugging
      videoRef.current.onloadstart = () => console.log('📹 Mobile video loadstart');
      videoRef.current.onloadeddata = () => console.log('📹 Mobile video loadeddata');
      videoRef.current.oncanplay = () => console.log('📹 Mobile video canplay');
      videoRef.current.onplay = () => console.log('▶️ Mobile video play event');
      videoRef.current.onpause = () => console.log('⏸️ Mobile video pause event');

      // Force load the video
      videoRef.current.load();

      // Simple autoplay with fallback
      videoRef.current.play().then(() => {
        console.log('✅ Mobile video playing successfully');
      }).catch((e) => {
        console.log('Mobile autoplay prevented:', e);
        // Video will show "Camera Active" overlay for user to tap
      });
    } else if (localStream && !videoRef.current) {
      console.warn('⚠️ Local stream available but video element not ready yet');
    }
  }, [localStream]);

  // Additional effect to handle case where video element becomes available after stream
  useEffect(() => {
    if (isStreaming && localStream && videoRef.current && !videoRef.current.srcObject) {
      console.log('🔄 Video element now available, assigning pending stream...');
      videoRef.current.srcObject = localStream;
      videoRef.current.load();
      videoRef.current.play().then(() => {
        console.log('✅ Delayed mobile video assignment successful');
      }).catch((e) => {
        console.log('Delayed mobile autoplay prevented:', e);
      });
    }
  }, [isStreaming, localStream]);

  useEffect(() => {
    // Initialize Socket.IO connection
    const defaultDev = `http://${window.location.hostname}:3001`;
    const configured = (import.meta as any).env?.VITE_SIGNALING_URL as string | undefined;
    const isDevPort = window.location.port === '5173';
    const baseUrl = configured ?? (isDevPort ? defaultDev : '');
    const socket = baseUrl ? io(baseUrl, { path: '/socket.io' }) : io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Mobile camera connected to signaling server');
      setIsSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Mobile camera disconnected from signaling server');
      setIsSocketConnected(false);
      setIsConnected(false);
    });

    socket.on('user-joined', (userId: string) => {
      console.log('Desktop viewer joined room:', userId);
    });

    socket.on('answer', async (answer: RTCSessionDescriptionInit) => {
      console.log('📤 Received answer from desktop');
      console.log('Answer details:', answer);
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(answer);
          console.log('✅ Mobile: Answer set successfully - WebRTC should be connected');
          setIsConnected(true);

          // Flush queued ICE candidates
          if (pendingIceCandidatesRef.current.length) {
            console.log(`🧊 Mobile: Flushing ${pendingIceCandidatesRef.current.length} queued ICE candidates`);
            for (const c of pendingIceCandidatesRef.current) {
              try {
                await peerConnectionRef.current.addIceCandidate(c);
                console.log('✅ Mobile: Queued ICE candidate added');
              } catch (e) {
                console.error('Mobile ICE candidate error:', e);
              }
            }
            pendingIceCandidatesRef.current = [];
          }

          // Check connection state
          console.log('🔗 Mobile connection state after answer:', peerConnectionRef.current.connectionState);
          console.log('🧊 Mobile ICE connection state:', peerConnectionRef.current.iceConnectionState);
        } catch (error) {
          console.error('❌ Mobile: Error setting remote description:', error);
        }
      }
    });

    socket.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      console.log('Received ICE candidate from desktop');
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        try {
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log('ICE candidate added successfully');
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      } else {
        pendingIceCandidatesRef.current.push(candidate);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId]);

  const initializePeerConnection = () => {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('Sending ICE candidate to desktop');
        socketRef.current.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Mobile connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setIsConnected(true);
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const startVideoSharing = async () => {
    setIsStarting(true);
    try {
      console.log('🎥 Starting camera...');

      let stream: MediaStream;
      try {
        // Try to get high-quality video for object detection
        console.log('📹 Requesting camera access...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 },
            facingMode: 'environment' // Use back camera for object detection
          },
          audio: false
        });
        console.log('✅ High-quality camera access granted');
      } catch (error) {
        console.log('High-quality settings failed, trying basic settings...', error);
        // Fallback to basic settings
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        console.log('✅ Basic camera access granted');
      }

      // Log stream details
      const videoTracks = stream.getVideoTracks();
      console.log('📹 Camera stream details:', {
        id: stream.id,
        active: stream.active,
        videoTracks: videoTracks.length
      });

      videoTracks.forEach((track, index) => {
        console.log(`Video track ${index}:`, {
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label,
          settings: track.getSettings()
        });
      });

      setLocalStream(stream);
      console.log('✅ Local stream set in state');

      // Note: Video element assignment will be handled by useEffect when component re-renders

      // Just join the room, don't create offer yet
      if (socketRef.current) {
        console.log('🚪 Mobile joining room:', roomId);
        socketRef.current.emit('join-room', roomId);
      }

      setIsStreaming(true);
      console.log('✅ Video sharing started! Waiting for desktop to connect...');
    } catch (error) {
      console.error('Error starting video sharing:', error);
      alert('Failed to access camera. Please check permissions.');
    } finally {
      setIsStarting(false);
    }
  };

  const connectToDesktop = async () => {
    if (!localStream) {
      console.error('No local stream available');
      return;
    }

    try {
      console.log('🔗 Connecting to desktop...');
      const peerConnection = initializePeerConnection();

      // Add tracks to peer connection
      localStream.getTracks().forEach(track => {
        console.log('� Adding track to peer connection:', track.kind, track.label);
        peerConnection.addTrack(track, localStream);
      });

      // Create and send offer
      console.log('📋 Creating WebRTC offer...');
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit('offer', { roomId, offer });
        console.log('📤 WebRTC offer sent to desktop');
      }
    } catch (error) {
      console.error('Error connecting to desktop:', error);
    }
  };

  const stopStreaming = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsStreaming(false);
    setIsConnected(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto p-6 max-w-md">
        <div className="text-center mb-6">
          <Camera className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Share Camera</h1>
          <p className="text-gray-300">Share your camera feed for object detection</p>
        </div>

        {/* Room Code Display */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4 text-center">Share this code with desktop</h3>

          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-blue-400 mb-2">
                {roomId}
              </div>
              <button
                onClick={copyRoomId}
                className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Code
                  </>
                )}
              </button>
              {/* Debug button for video refresh */}
              {isStreaming && localStream && (
                <button
                  onClick={() => {
                    if (videoRef.current && localStream) {
                      console.log('🔄 Manual video refresh triggered');
                      videoRef.current.srcObject = localStream;
                      videoRef.current.load();
                      videoRef.current.play().catch(console.error);
                    }
                  }}
                  className="ml-2 inline-flex items-center px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm"
                >
                  🔄 Refresh Video
                </button>
              )}
            </div>
          </div>

          {/* Connection Status */}
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span>Server:</span>
              <span className={isSocketConnected ? 'text-green-400' : 'text-red-400'}>
                {isSocketConnected ? '🟢 Connected' : '❌ Disconnected'}
              </span>
            </div>
            {isStreaming && (
              <div className="flex justify-between">
                <span>Desktop:</span>
                <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
                  {isConnected ? '🟢 Connected' : '🟡 Waiting...'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {!isStreaming ? (
            <button
              onClick={startVideoSharing}
              disabled={isStarting}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-4 px-6 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              <Camera className="w-6 h-6 mr-3" />
              {isStarting ? 'Starting Camera...' : 'Start Camera'}
            </button>
          ) : (
            <div className="space-y-3">
              {!isConnected ? (
                <button
                  onClick={connectToDesktop}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 px-6 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  <Wifi className="w-6 h-6 mr-3" />
                  Connect to Desktop
                </button>
              ) : (
                <div className="flex justify-center text-green-400 py-4">
                  <div className="inline-flex items-center">
                    <Wifi className="w-6 h-6 mr-3" />
                    Connected to Desktop
                  </div>
                </div>
              )}

              <button
                onClick={stopStreaming}
                className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <Phone className="w-5 h-5 mr-2" />
                Stop Camera
              </button>
            </div>
          )}
        </div>

        {/* Connection Status Indicator - Only show when not connected */}
        {isStreaming && !isConnected && (
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center text-yellow-400">
              <WifiOff className="w-5 h-5 mr-2" />
              Ready - Waiting for Desktop to Join Room
            </div>
          </div>
        )}

        {/* Video Preview */}
        {isStreaming && (
          <div className="mt-6 bg-gray-800 rounded-lg overflow-hidden relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
              onLoadedMetadata={() => console.log('📹 Mobile camera metadata loaded')}
              onPlaying={() => console.log('▶️ Mobile camera playing')}
              onError={(e) => console.error('❌ Mobile camera error:', e)}
              onClick={() => {
                // Allow manual play if autoplay failed
                if (videoRef.current) {
                  videoRef.current.play().then(() => {
                    console.log('✅ Manual play successful');
                  }).catch(e => console.log('Manual play failed:', e));
                }
              }}
              style={{ minHeight: '200px' }}
            />
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              📱 Your Camera
            </div>
            {localStream && videoRef.current && videoRef.current.paused && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                <div className="text-center text-white">
                  <Camera className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Camera Active</p>
                  <p className="text-xs opacity-75">Tap to play video</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};