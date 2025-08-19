// Performance Metrics Collection for Interview Task
// Tracks latency metrics: median/P95 for capture→recv and recv→inference

interface TimingData {
  capture_to_recv: number;
  recv_to_inference: number;
  total_latency: number;
  fps: number;
}

export class MetricsCollector {
  private timings: TimingData[] = [];
  private frameCount = 0;
  private startTime = Date.now();
  private lastFrameTime = Date.now();

  // Add timing measurement for a processed frame
  addTiming(capture_ts: number, recv_ts: number, inference_ts: number): void {
    const capture_to_recv = recv_ts - capture_ts;
    const recv_to_inference = inference_ts - recv_ts;
    const total_latency = inference_ts - capture_ts;
    
    // Calculate instantaneous FPS
    const now = Date.now();
    const fps = 1000 / (now - this.lastFrameTime);
    this.lastFrameTime = now;
    
    this.timings.push({
      capture_to_recv,
      recv_to_inference,
      total_latency,
      fps
    });
    
    this.frameCount++;
  }

  // Calculate percentile (0-100)
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  // Calculate median
  private calculateMedian(values: number[]): number {
    return this.calculatePercentile(values, 50);
  }

  // Get current metrics summary
  getMetrics(): any {
    if (this.timings.length === 0) {
      return {
        total_frames: 0,
        duration_ms: 0,
        avg_fps: 0,
        capture_to_recv: { median_ms: 0, p95_ms: 0 },
        recv_to_inference: { median_ms: 0, p95_ms: 0 },
        total_latency: { median_ms: 0, p95_ms: 0 }
      };
    }

    const duration = Date.now() - this.startTime;
    const avgFps = (this.frameCount / duration) * 1000;

    const captureToRecv = this.timings.map(t => t.capture_to_recv);
    const recvToInference = this.timings.map(t => t.recv_to_inference);
    const totalLatency = this.timings.map(t => t.total_latency);

    return {
      total_frames: this.frameCount,
      duration_ms: duration,
      avg_fps: Number(avgFps.toFixed(2)),
      capture_to_recv: {
        median_ms: Number(this.calculateMedian(captureToRecv).toFixed(2)),
        p95_ms: Number(this.calculatePercentile(captureToRecv, 95).toFixed(2))
      },
      recv_to_inference: {
        median_ms: Number(this.calculateMedian(recvToInference).toFixed(2)),
        p95_ms: Number(this.calculatePercentile(recvToInference, 95).toFixed(2))
      },
      total_latency: {
        median_ms: Number(this.calculateMedian(totalLatency).toFixed(2)),
        p95_ms: Number(this.calculatePercentile(totalLatency, 95).toFixed(2))
      }
    };
  }

  // Export metrics to JSON for the task requirement
  exportMetricsJson(): string {
    const metrics = this.getMetrics();
    return JSON.stringify(metrics, null, 2);
  }

  // Reset metrics (for new test runs)
  reset(): void {
    this.timings = [];
    this.frameCount = 0;
    this.startTime = Date.now();
    this.lastFrameTime = Date.now();
  }

  // Get real-time stats for display
  getRealTimeStats(): { fps: number; latency: number; frames: number } {
    const recentTimings = this.timings.slice(-10); // Last 10 frames
    const avgLatency = recentTimings.length > 0 
      ? recentTimings.reduce((sum, t) => sum + t.total_latency, 0) / recentTimings.length
      : 0;
    
    const recentFps = recentTimings.length > 0
      ? recentTimings.reduce((sum, t) => sum + t.fps, 0) / recentTimings.length
      : 0;

    return {
      fps: Number(recentFps.toFixed(1)),
      latency: Number(avgLatency.toFixed(1)),
      frames: this.frameCount
    };
  }
}

// Global metrics instance for the app
export const globalMetrics = new MetricsCollector();
