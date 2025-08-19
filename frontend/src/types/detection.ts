export interface DetectionResult {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export interface PerformanceMetrics {
  fps: number;
  inferenceTime: number;
  frameProcessingTime: number;
  droppedFrames: number;
  totalFrames: number;
}

export interface PeerConnectionState {
  connected: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  role: 'mobile' | 'desktop';
}