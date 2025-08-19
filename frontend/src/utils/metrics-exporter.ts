// Performance Metrics Collection and Export for Interview Task
// Outputs task-compliant metrics.json format

interface TimingRecord {
    frame_id: string;
    capture_ts: number;
    recv_ts: number;
    inference_ts: number;
    processing_latency: number; // recv_ts - capture_ts
    inference_latency: number;  // inference_ts - recv_ts
    total_latency: number;      // inference_ts - capture_ts
}

interface SystemMetrics {
    fps: number;
    frame_processing_time: number;
    inference_time: number;
    total_frames: number;
    dropped_frames: number;
    model_load_time?: number;
}

interface TaskMetrics {
    experiment_id: string;
    timestamp: string;
    configuration: {
        model: string;
        input_resolution: string;
        backend: string;
        device: string;
        threads: number;
    };
    performance: {
        fps: {
            median: number;
            p95: number;
            mean: number;
            std: number;
        };
        latency_ms: {
            processing: {
                median: number;
                p95: number;
                mean: number;
                std: number;
            };
            inference: {
                median: number;
                p95: number;
                mean: number;
                std: number;
            };
            total: {
                median: number;
                p95: number;
                mean: number;
                std: number;
            };
        };
        frames: {
            total: number;
            dropped: number;
            drop_rate: number;
        };
    };
    quality: {
        detections_per_frame: {
            median: number;
            p95: number;
            mean: number;
        };
        confidence_scores: {
            median: number;
            p95: number;
            mean: number;
        };
    };
    raw_data: TimingRecord[];
}

class MetricsExporter {
    private timingRecords: TimingRecord[] = [];
    private detectionsPerFrame: number[] = [];
    private confidenceScores: number[] = [];
    private modelLoadTime: number = 0;
    private totalFrames: number = 0;
    private droppedFrames: number = 0;

    public setModelLoadTime(loadTime: number): void {
        this.modelLoadTime = loadTime;
    }

    public addTimingRecord(
        frameId: string,
        captureTs: number,
        recvTs: number,
        inferenceTs: number
    ): void {
        const record: TimingRecord = {
            frame_id: frameId,
            capture_ts: captureTs,
            recv_ts: recvTs,
            inference_ts: inferenceTs,
            processing_latency: recvTs - captureTs,
            inference_latency: inferenceTs - recvTs,
            total_latency: inferenceTs - captureTs
        };

        this.timingRecords.push(record);
        this.totalFrames++;
    }

    public addDetectionMetrics(detectionCount: number, avgConfidence: number): void {
        this.detectionsPerFrame.push(detectionCount);
        if (avgConfidence > 0) {
            this.confidenceScores.push(avgConfidence);
        }
    }

    public incrementDroppedFrames(): void {
        this.droppedFrames++;
    }

    private calculateStats(values: number[]): { median: number; p95: number; mean: number; std: number } {
        if (values.length === 0) {
            return { median: 0, p95: 0, mean: 0, std: 0 };
        }

        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);

        const median = sorted[Math.floor(sorted.length / 2)];
        const p95Index = Math.floor(sorted.length * 0.95);
        const p95 = sorted[p95Index];

        return { median, p95, mean, std };
    }

    private calculateFPSStats(): { median: number; p95: number; mean: number; std: number } {
        if (this.timingRecords.length < 2) {
            return { median: 0, p95: 0, mean: 0, std: 0 };
        }

        // Calculate FPS based on frame intervals
        const intervals: number[] = [];
        for (let i = 1; i < this.timingRecords.length; i++) {
            const interval = this.timingRecords[i].recv_ts - this.timingRecords[i - 1].recv_ts;
            if (interval > 0) {
                intervals.push(1000 / interval); // Convert to FPS
            }
        }

        return this.calculateStats(intervals);
    }

    public generateMetrics(): TaskMetrics {
        const experimentId = `webrtc-vlm-detection-${Date.now()}`;
        const timestamp = new Date().toISOString();

        // Calculate performance statistics
        const processingLatencies = this.timingRecords.map(r => r.processing_latency);
        const inferenceLatencies = this.timingRecords.map(r => r.inference_latency);
        const totalLatencies = this.timingRecords.map(r => r.total_latency);

        const fpsStats = this.calculateFPSStats();
        const processingStats = this.calculateStats(processingLatencies);
        const inferenceStats = this.calculateStats(inferenceLatencies);
        const totalLatencyStats = this.calculateStats(totalLatencies);

        const detectionStats = this.calculateStats(this.detectionsPerFrame);
        const confidenceStats = this.calculateStats(this.confidenceScores);

        const dropRate = this.totalFrames > 0 ? this.droppedFrames / this.totalFrames : 0;

        return {
            experiment_id: experimentId,
            timestamp,
            configuration: {
                model: 'YOLOv5n',
                input_resolution: '640x640',
                backend: 'ONNX Runtime Web (WASM)',
                device: 'CPU',
                threads: 1
            },
            performance: {
                fps: fpsStats,
                latency_ms: {
                    processing: processingStats,
                    inference: inferenceStats,
                    total: totalLatencyStats
                },
                frames: {
                    total: this.totalFrames,
                    dropped: this.droppedFrames,
                    drop_rate: dropRate
                }
            },
            quality: {
                detections_per_frame: detectionStats,
                confidence_scores: confidenceStats
            },
            raw_data: this.timingRecords
        };
    }

    public exportMetrics(): void {
        const metrics = this.generateMetrics();

        // Create downloadable JSON file
        const jsonString = JSON.stringify(metrics, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `metrics-${metrics.experiment_id}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        console.log('📊 Metrics exported:', metrics);
    }

    public getRealTimeStats(): SystemMetrics {
        const recentRecords = this.timingRecords.slice(-30); // Last 30 frames

        if (recentRecords.length === 0) {
            return {
                fps: 0,
                frame_processing_time: 0,
                inference_time: 0,
                total_frames: this.totalFrames,
                dropped_frames: this.droppedFrames,
                model_load_time: this.modelLoadTime
            };
        }

        const avgProcessingTime = recentRecords.reduce((sum, r) => sum + r.processing_latency, 0) / recentRecords.length;
        const avgInferenceTime = recentRecords.reduce((sum, r) => sum + r.inference_latency, 0) / recentRecords.length;

        // Calculate FPS from recent intervals
        let fps = 0;
        if (recentRecords.length > 1) {
            const timeSpan = recentRecords[recentRecords.length - 1].recv_ts - recentRecords[0].recv_ts;
            fps = timeSpan > 0 ? (recentRecords.length - 1) * 1000 / timeSpan : 0;
        }

        return {
            fps: Math.round(fps * 10) / 10,
            frame_processing_time: Math.round(avgProcessingTime * 10) / 10,
            inference_time: Math.round(avgInferenceTime * 10) / 10,
            total_frames: this.totalFrames,
            dropped_frames: this.droppedFrames,
            model_load_time: this.modelLoadTime
        };
    }

    public reset(): void {
        this.timingRecords = [];
        this.detectionsPerFrame = [];
        this.confidenceScores = [];
        this.totalFrames = 0;
        this.droppedFrames = 0;
    }
}

// Global metrics instance for easy access
export const globalMetricsExporter = new MetricsExporter();

export default MetricsExporter;
