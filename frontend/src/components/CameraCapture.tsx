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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);

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
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit('answer', { roomId, answer });
      }
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
    };
  }, [roomId]);

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

    peerConnection.onconnectionstatechange = () => {
      const connected = peerConnection.connectionState === 'connected';
      setIsConnected(connected);
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const peerConnection = initializePeerConnection();
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      setIsStreaming(true);
      console.log('Camera started successfully!');
    } catch (error) {
      console.error('Error accessing camera:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown camera error';
      alert(`Camera error: ${errorMessage}. Please allow camera access and try again.`);
    }
  };

  const startConnection = async () => {
    console.log('Starting connection...');
    if (!peerConnectionRef.current || !socketRef.current) {
      console.error('Missing peer connection or socket');
      return;
    }

    console.log('Joining room:', roomId);
    socketRef.current.emit('join-room', roomId);

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);
    socketRef.current.emit('offer', { roomId, offer });
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

          <div className="flex items-center justify-center mb-4">
            {isConnected ? (
              <div className="flex items-center text-green-400">
                <Wifi className="w-5 h-5 mr-2" />
                Connected
              </div>
            ) : (
              <div className="flex items-center text-gray-400">
                <WifiOff className="w-5 h-5 mr-2" />
                Disconnected
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
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
            />
          </div>
        )}
      </div>
    </div>
  );
};