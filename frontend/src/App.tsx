import { useState, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { DesktopViewer } from './components/DesktopViewer';

function App() {
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop'>('desktop');

  // Generate Room ID only for mobile, desktop starts blank
  const [roomId, setRoomId] = useState(() => {
    // Initial detection - will be updated in useEffect
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    return isMobile ? Math.random().toString(36).substring(2, 8).toUpperCase() : '';
  });

  useEffect(() => {
    // Detect device type based on screen size and touch capability
    const isMobile = window.innerWidth <= 768 || ('ontouchstart' in window);
    setDeviceType(isMobile ? 'mobile' : 'desktop');

    // Update Room ID based on device type
    if (isMobile && !roomId) {
      // Generate Room ID for mobile if not already set
      setRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
    } else if (!isMobile && roomId && roomId.length === 6) {
      // Clear auto-generated Room ID for desktop (keep manual entries)
      setRoomId('');
    }
  }, []);

  if (deviceType === 'mobile') {
    return (
      <CameraCapture
        roomId={roomId}
        setRoomId={setRoomId}
      />
    );
  }

  return (
    <DesktopViewer
      roomId={roomId}
      setRoomId={setRoomId}
    />
  );
}

export default App;