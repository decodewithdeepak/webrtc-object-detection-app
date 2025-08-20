// Browser-based Benchmark Component for Real-time Performance Testing
import React, { useState, useRef } from 'react';
import { Play, Square, Download, BarChart3 } from 'lucide-react';
import { globalMetrics } from '../utils/metrics';

interface BenchmarkResult {
    duration_ms: number;
    total_frames: number;
    avg_fps: number;
    capture_to_recv: {
        median_ms: number;
        p95_ms: number;
    };
    recv_to_inference: {
        median_ms: number;
        p95_ms: number;
    };
    total_latency: {
        median_ms: number;
        p95_ms: number;
    };
}

export const BenchmarkComponent: React.FC = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [duration, setDuration] = useState(30);
    const [progress, setProgress] = useState(0);
    const [lastResult, setLastResult] = useState<BenchmarkResult | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);

    const startBenchmark = () => {
        setIsRunning(true);
        setProgress(0);
        globalMetrics.reset();
        startTimeRef.current = Date.now();

        // Progress tracker
        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const progressPercent = Math.min((elapsed / (duration * 1000)) * 100, 100);
            setProgress(progressPercent);

            if (progressPercent >= 100) {
                stopBenchmark();
            }
        }, 100);
    };

    const stopBenchmark = () => {
        setIsRunning(false);
        setProgress(100);

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Generate final results
        const metrics = globalMetrics.getMetrics();
        const result: BenchmarkResult = {
            duration_ms: duration * 1000,
            total_frames: metrics.total_frames,
            avg_fps: metrics.avg_fps,
            capture_to_recv: metrics.capture_to_recv,
            recv_to_inference: metrics.recv_to_inference,
            total_latency: metrics.total_latency
        };

        setLastResult(result);
    };

    const exportResults = () => {
        if (!lastResult) return;

        const dataStr = JSON.stringify(lastResult, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `benchmark-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-orange-400" />
                Performance Benchmark
            </h3>

            <div className="space-y-4">
                {/* Duration Selection */}
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Test Duration (seconds)
                    </label>
                    <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        disabled={isRunning}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    >
                        <option value={10}>10 seconds</option>
                        <option value={30}>30 seconds</option>
                        <option value={60}>60 seconds</option>
                        <option value={120}>2 minutes</option>
                    </select>
                </div>

                {/* Progress Bar */}
                {isRunning && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Control Buttons */}
                <div className="flex gap-2">
                    {!isRunning ? (
                        <button
                            onClick={startBenchmark}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                        >
                            <Play className="w-5 h-5 mr-2" />
                            Start {duration}s Benchmark
                        </button>
                    ) : (
                        <button
                            onClick={stopBenchmark}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                        >
                            <Square className="w-5 h-5 mr-2" />
                            Stop Benchmark
                        </button>
                    )}

                    {lastResult && (
                        <button
                            onClick={exportResults}
                            className="bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Results Display */}
                {lastResult && (
                    <div className="mt-4 p-4 bg-gray-700 rounded-md">
                        <h4 className="font-semibold mb-3 text-orange-400">
                            Benchmark Results
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-400">Total Frames:</span>
                                <div className="font-medium">{lastResult.total_frames}</div>
                            </div>
                            <div>
                                <span className="text-gray-400">Average FPS:</span>
                                <div className="font-medium">{lastResult.avg_fps}</div>
                            </div>
                            <div>
                                <span className="text-gray-400">Capture→Recv:</span>
                                <div className="font-medium">
                                    {lastResult.capture_to_recv.median_ms}ms (P95: {lastResult.capture_to_recv.p95_ms}ms)
                                </div>
                            </div>
                            <div>
                                <span className="text-gray-400">Recv→Inference:</span>
                                <div className="font-medium">
                                    {lastResult.recv_to_inference.median_ms}ms (P95: {lastResult.recv_to_inference.p95_ms}ms)
                                </div>
                            </div>
                            <div className="col-span-2">
                                <span className="text-gray-400">Total Latency:</span>
                                <div className="font-medium">
                                    {lastResult.total_latency.median_ms}ms (P95: {lastResult.total_latency.p95_ms}ms)
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-xs text-gray-400">
                    💡 Tip: Start object detection first, then run benchmark to measure real performance
                </div>
            </div>
        </div>
    );
};
