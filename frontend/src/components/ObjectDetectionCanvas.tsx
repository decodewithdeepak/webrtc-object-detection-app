import React, { useRef, useEffect } from 'react';
import { DetectionResult } from '../types/detection';

interface ObjectDetectionCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  detections: DetectionResult[];
  isProcessing: boolean;
}

const COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
  '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
];

const CLASS_COLORS: Record<string, string> = {
  'person': '#ff6b6b',
  'car': '#4ecdc4',
  'truck': '#45b7d1',
  'bottle': '#96ceb4',
  'cup': '#feca57',
  'phone': '#ff9ff3',
  'laptop': '#54a0ff',
  'chair': '#5f27cd',
  'dog': '#00d2d3',
  'cat': '#ff9f43'
};

export const ObjectDetectionCanvas: React.FC<ObjectDetectionCanvasProps> = ({
  videoRef,
  detections,
  isProcessing
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawDetections = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw processing indicator
      if (isProcessing) {
        ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
        ctx.fillRect(0, 0, canvas.width, 4);
      }

      // Draw detection boxes
      detections.forEach((detection) => {
        const [x, y, width, height] = detection.bbox;
        const color = CLASS_COLORS[detection.class] || COLORS[Math.floor(Math.random() * COLORS.length)];

        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, width, height);

        // Draw label background
        const label = `${detection.class} ${Math.round(detection.score * 100)}%`;
        ctx.font = 'bold 14px Arial';
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = 20;

        ctx.fillStyle = color;
        ctx.fillRect(x, y - textHeight - 4, textWidth + 12, textHeight + 4);

        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.fillText(label, x + 6, y - 8);
      });

      requestAnimationFrame(drawDetections);
    };

    drawDetections();
  }, [detections, isProcessing, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const updateCanvasSize = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };

    video.addEventListener('loadedmetadata', updateCanvasSize);
    video.addEventListener('resize', updateCanvasSize);

    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasSize);
      video.removeEventListener('resize', updateCanvasSize);
    };
  }, [videoRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
};