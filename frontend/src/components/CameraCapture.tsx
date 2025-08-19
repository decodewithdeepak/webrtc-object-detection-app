import React, { useEffect, useRef, useState } from 'react';
import { Camera, Phone, PhoneCall, Wifi, WifiOff } from 'lucide-react';
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

  // Effect to handle local stream updates
  useEffect(() => {
    if (localStream && videoRef.current) {
      console.log('🔄 Updating mobile video element with local stream');
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(e => {
        console.log('Mobile autoplay prevented:', e);
      });
    }
  }, [localStream]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    // Initialize Socket.IO connection
    // Use window.location.hostname to automatically detect the correct server address
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
      console.log('Received answer from desktop');
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(answer);
          console.log('Answer set successfully');
          // Flush queued ICE candidates
          if (pendingIceCandidatesRef.current.length) {
            for (const c of pendingIceCandidatesRef.current) {
              try { await peerConnectionRef.current.addIceCandidate(c); } catch (e) { console.error(e); }
            }
            pendingIceCandidatesRef.current = [];
          }
        } catch (error) {
          console.error('Error setting remote description:', error);
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
      } else { pendingIceCandidatesRef.current.push(candidate); }
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

    try {
      peerConnection.addTransceiver('video', { direction: 'sendonly' });
    } catch { }

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('Sending ICE candidate to desktop');
        socketRef.current.emit('ice-candidate', {
          roomId,
          candidate: event.candidate
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log('Mobile connection state:', peerConnection.connectionState);
      const connected = peerConnection.connectionState === 'connected';
      setIsConnected(connected);

      if (connected) {
        console.log('✅ WebRTC connection established successfully!');
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const startCamera = async () => {
    try {
      // Try with different camera constraints for better compatibility
      let stream;
      try {
        // First try with ideal settings
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: false
        });
      } catch (error) {
        console.log('Trying with basic camera settings...');
        // Fallback to basic settings
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      setLocalStream(stream);
      console.log('✅ Local stream set in state');

      if (videoRef.current) {
        console.log('📱 Attaching stream to mobile video element');
        videoRef.current.srcObject = stream;

        // Add event listeners for debugging
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Mobile video metadata loaded');
          console.log('Video dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
        };

        videoRef.current.onplay = () => console.log('▶️ Mobile video started playing');
        videoRef.current.onpause = () => console.log('⏸️ Mobile video paused');

        videoRef.current.play().catch(e => {
          console.log('Mobile autoplay prevented:', e);
        });
      } else {
        console.error('❌ Video ref is null!');
      }

      const peerConnection = initializePeerConnection();

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        console.log('📤 Adding track to peer connection:', track.kind, track.label);
        peerConnection.addTrack(track, stream);
      });

      console.log('Stream details:', {
        id: stream.id,
        tracks: stream.getTracks().length,
        videoTracks: stream.getVideoTracks().length,
        active: stream.active
      });

      setIsStreaming(true);
      console.log('✅ Camera started successfully!');
    } catch (error) {
      console.error('Error accessing camera:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown camera error';
      alert(`Camera error: ${errorMessage}. Please allow camera access and try again.`);
    }
  };

  const startConnection = async () => {
    console.log('🚀 Starting WebRTC connection...');

    if (!roomId.trim()) {
      alert('Please enter a room ID first!');
      return;
    }

    if (!peerConnectionRef.current || !socketRef.current) {
      console.error('❌ Missing peer connection or socket');
      alert('Please start the camera first!');
      return;
    }

    if (!localStream) {
      console.error('❌ No local stream available');
      alert('Please start the camera first!');
      return;
    }

    try {
      console.log('📱 Joining room:', roomId);
      socketRef.current.emit('join-room', roomId);

      // Wait a moment for the room join to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('📋 Creating offer...');
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveVideo: false,
        offerToReceiveAudio: false
      });

      await peerConnectionRef.current.setLocalDescription(offer);
      console.log('📤 Sending offer to desktop...');
      socketRef.current.emit('offer', { roomId, offer });

      console.log('⏳ Waiting for desktop to accept...');
    } catch (error) {
      console.error('❌ Error in startConnection:', error);
      alert('Failed to start connection. Please try again.');
    }
  };

  const stopStreaming = () => {
    console.log('🛑 Stopping camera stream...');

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

    console.log('✅ Camera stream stopped');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <Camera className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Mobile Camera</h1>
          <p className="text-gray-300">Stream your camera to desktop</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-green-400 focus:border-transparent"
              placeholder="Enter room ID"
            />
          </div>

          {/* Connection Status */}
          <div className="bg-gray-700 rounded-md p-3 mb-4">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Camera:</span>
                <span className={isStreaming ? 'text-green-400' : 'text-red-400'}>
                  {isStreaming ? '🎥 Active' : '❌ Inactive'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Socket:</span>
                <span className={isSocketConnected ? 'text-green-400' : 'text-red-400'}>
                  {isSocketConnected ? '🟢 Connected' : '❌ Disconnected'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>WebRTC:</span>
                <span className={isConnected ? 'text-green-400' : 'text-yellow-400'}>
                  {isConnected ? '🟢 Connected' : '🟡 Waiting'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Peer Connection:</span>
                <span className={peerConnectionRef.current ? 'text-green-400' : 'text-gray-400'}>
                  {peerConnectionRef.current ? '✅ Ready' : '⚪ None'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center mb-4">
            {isConnected ? (
              <div className="flex items-center text-green-400">
                <Wifi className="w-5 h-5 mr-2" />
                WebRTC Connected
              </div>
            ) : (
              <div className="flex items-center text-gray-400">
                <WifiOff className="w-5 h-5 mr-2" />
                Not Connected
              </div>
            )}
          </div>

          <div className="space-y-3">
            {!isStreaming ? (
              <button
                onClick={startCamera}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
              >
                <Camera className="w-5 h-5 mr-2" />
                Start Camera
              </button>
            ) : (
              <>
                {!isConnected ? (
                  <button
                    onClick={startConnection}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                  >
                    <PhoneCall className="w-5 h-5 mr-2" />
                    Connect to Room
                  </button>
                ) : null}

                <button
                  onClick={stopStreaming}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Stop Streaming
                </button>
              </>
            )}
          </div>
        </div>

        {isStreaming && (
          <div className="bg-gray-800 rounded-lg overflow-hidden relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls
              className="w-full h-auto cursor-pointer"
              onLoadedMetadata={() => console.log('📹 Mobile camera metadata loaded')}
              onPlaying={() => console.log('▶️ Mobile camera playing')}
              onError={(e) => console.error('❌ Mobile camera error:', e)}
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.play().catch(e => console.log('Manual mobile play failed:', e));
                }
              }}
            />
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              📱 Your Camera
            </div>
          </div>
        )}
      </div>
    </div>
  );
};