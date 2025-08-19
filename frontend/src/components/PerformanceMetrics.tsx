import React from 'react';
import { Activity, Clock, Zap, AlertTriangle } from 'lucide-react';
import { PerformanceMetrics as MetricsType } from '../types/detection';

interface PerformanceMetricsProps {
  metrics: MetricsType;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ metrics }) => {
  const dropRate = metrics.totalFrames > 0 ? (metrics.droppedFrames / metrics.totalFrames) * 100 : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-green-400" />
        Performance Metrics
      </h3>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">FPS</span>
            <Zap className="w-4 h-4 text-green-400" />
          </div>
          <div className={`text-xl font-bold ${metrics.fps >= 10 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.fps.toFixed(1)}
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">Inference</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className={`text-xl font-bold ${metrics.inferenceTime < 100 ? 'text-green-400' : 'text-yellow-400'}`}>
            {metrics.inferenceTime.toFixed(0)}ms
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">Processing</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`text-xl font-bold ${metrics.frameProcessingTime < 50 ? 'text-green-400' : 'text-yellow-400'}`}>
            {metrics.frameProcessingTime.toFixed(0)}ms
          </div>
        </div>

        <div className="bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm">Drop Rate</span>
            <AlertTriangle className="w-4 h-4 text-red-400" />
          </div>
          <div className={`text-xl font-bold ${dropRate < 5 ? 'text-green-400' : 'text-red-400'}`}>
            {dropRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-600">
        Total: {metrics.totalFrames} frames | Dropped: {metrics.droppedFrames} frames
      </div>
    </div>
  );
};