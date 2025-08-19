// Real-time Object Detection Worker using ONNX Runtime Web
// Task-compliant implementation with YOLOv5 model

// @ts-ignore - ONNX Runtime Web types issue
import * as ort from 'onnxruntime-web';

interface DetectionResult {
  label: string;
  score: number;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

interface FrameMessage {
  frame_id: string;
  capture_ts: number;
  recv_ts: number;
  inference_ts: number;
  detections: DetectionResult[];
}

// YOLOv5 COCO class names
const YOLO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck',
  'boat', 'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra',
  'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink',
  'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush'
];

// Model configuration
const MODEL_INPUT_SIZE = 640; // Model expects 640x640 input
const CONFIDENCE_THRESHOLD = 0.05; // Lowered to encourage initial detections
const NMS_THRESHOLD = 0.4;

let session: ort.InferenceSession | null = null;
let isInitialized = false;

// Initialize ONNX model
async function initializeModel(): Promise<void> {
  if (isInitialized) return;

  try {
    console.log('🤖 Loading YOLOv5 ONNX model...');

    // Configure ONNX Runtime for WebAssembly execution
    // Use CDN for WASM files to avoid path issues
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/';
    ort.env.wasm.numThreads = 1; // Low resource mode

    console.log('📦 ONNX Runtime configuration set');

    // Load the model
    console.log('📁 Loading model from /models/yolov5n.onnx');
    session = await ort.InferenceSession.create('/models/yolov5n.onnx', {
      executionProviders: ['wasm'], // Use WebAssembly for CPU execution
      graphOptimizationLevel: 'all',
    });

    isInitialized = true;
    console.log('✅ ONNX model loaded successfully');
    console.log('🔍 Model inputs:', session.inputNames);
    console.log('📤 Model outputs:', session.outputNames);

    // Send initialization status to main thread
    self.postMessage({
      type: 'model-ready',
      data: { status: 'ready' }
    });

  } catch (error) {
    console.error('❌ Failed to load ONNX model:', error);
    console.error('📋 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    self.postMessage({
      type: 'model-error',
      data: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
    throw error; // Don't continue with failed initialization
  }
}// Preprocess image for YOLOv5 input
function preprocessImage(imageData: ImageData, targetSize: number): Float32Array {
  const canvas = new OffscreenCanvas(targetSize, targetSize);
  const ctx = canvas.getContext('2d')!;

  // Create image from ImageData
  const tempCanvas = new OffscreenCanvas(imageData.width, imageData.height);
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);

  // Resize to target size
  ctx.drawImage(tempCanvas, 0, 0, targetSize, targetSize);

  // Get pixel data
  const resizedImageData = ctx.getImageData(0, 0, targetSize, targetSize);
  const { data } = resizedImageData;

  // Convert to RGB Float32Array normalized to [0, 1]
  const input = new Float32Array(3 * targetSize * targetSize);

  for (let i = 0; i < targetSize * targetSize; i++) {
    const pixelIndex = i * 4;
    const tensorIndex = i;

    // Normalize RGB values to [0, 1]
    input[tensorIndex] = data[pixelIndex] / 255.0; // R
    input[tensorIndex + targetSize * targetSize] = data[pixelIndex + 1] / 255.0; // G
    input[tensorIndex + 2 * targetSize * targetSize] = data[pixelIndex + 2] / 255.0; // B
  }

  return input;
}

// Non-maximum suppression
function nms(boxes: number[][], scores: number[], threshold: number): number[] {
  const indices = Array.from({ length: scores.length }, (_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);

  const keep: number[] = [];

  while (indices.length > 0) {
    const current = indices.shift()!;
    keep.push(current);

    const currentBox = boxes[current];

    for (let i = indices.length - 1; i >= 0; i--) {
      const index = indices[i];
      const box = boxes[index];
      const iou = calculateIoU(currentBox, box);

      if (iou > threshold) {
        indices.splice(i, 1);
      }
    }
  }

  return keep;
}

// Calculate Intersection over Union
function calculateIoU(box1: number[], box2: number[]): number {
  const [x1, y1, x2, y2] = box1;
  const [x3, y3, x4, y4] = box2;

  const intersectionX1 = Math.max(x1, x3);
  const intersectionY1 = Math.max(y1, y3);
  const intersectionX2 = Math.min(x2, x4);
  const intersectionY2 = Math.min(y2, y4);

  const intersectionArea = Math.max(0, intersectionX2 - intersectionX1) *
    Math.max(0, intersectionY2 - intersectionY1);

  const box1Area = (x2 - x1) * (y2 - y1);
  const box2Area = (x4 - x3) * (y4 - y3);

  const unionArea = box1Area + box2Area - intersectionArea;

  return intersectionArea / unionArea;
}

// Post-process YOLOv5 output
function postprocess(output: Float32Array, options?: { dims?: number[] }): DetectionResult[] {
  const detections: DetectionResult[] = [];

  // YOLOv5 output can be [1,25200,85] or [1,85,25200]
  // 85 = 4 bbox + 1 objectness + 80 classes
  let numDetections = output.length / 85;
  let transposed = false;
  if (options?.dims && options.dims.length === 3) {
    const [, d1, d2] = options.dims;
    if (d1 === 85) {
      // layout [1,85,25200]
      transposed = true;
      numDetections = d2;
    } else if (d2 === 85) {
      // layout [1,25200,85]
      transposed = false;
      numDetections = d1;
    }
  }

  console.log(`📊 Processing ${numDetections} potential detections`);

  const boxes: number[][] = [];
  const scores: number[] = [];
  const classIds: number[] = [];

  let passedConfidenceCount = 0;

  for (let i = 0; i < numDetections; i++) {
    const getVal = (j: number) => transposed
      ? output[j * numDetections + i]
      : output[i * 85 + j];

    // Extract box coordinates (center format)
    const centerX = getVal(0);
    const centerY = getVal(1);
    const width = getVal(2);
    const height = getVal(3);
  // Many YOLOv5 ONNX exports provide logits; apply sigmoid for probabilities
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
  const objectConfidence = sigmoid(getVal(4));

    // Debug first few detections
    if (i < 5) {
      console.log(`🔍 Detection ${i}: centerX=${centerX}, centerY=${centerY}, w=${width}, h=${height}, conf=${objectConfidence}`);
    }

    if (objectConfidence < CONFIDENCE_THRESHOLD) continue;
    passedConfidenceCount++;

    // Find best class (sigmoid for multi-label; equivalent to per-class prob)
    let bestClassScore = 0;
    let bestClassId = 0;

    for (let j = 0; j < 80; j++) {
      const classScore = sigmoid(getVal(5 + j));
      if (classScore > bestClassScore) {
        bestClassScore = classScore;
        bestClassId = j;
      }
    }

    const finalScore = objectConfidence * bestClassScore;
    if (finalScore < CONFIDENCE_THRESHOLD) continue;

  // Convert center format to corner format
  // Heuristic: if coordinates look already normalized (<= 1.5), skip dividing by input size
  const looksNormalized = Math.max(centerX, centerY, width, height) <= 1.5;
  const scale = looksNormalized ? 1 : MODEL_INPUT_SIZE;
  const x1 = Math.min(1, Math.max(0, (centerX - width / 2) / scale));
  const y1 = Math.min(1, Math.max(0, (centerY - height / 2) / scale));
  const x2 = Math.min(1, Math.max(0, (centerX + width / 2) / scale));
  const y2 = Math.min(1, Math.max(0, (centerY + height / 2) / scale));

    // Skip invalid boxes
    if (x2 <= x1 || y2 <= y1) continue;

    boxes.push([x1, y1, x2, y2]);
    scores.push(finalScore);
    classIds.push(bestClassId);
  }

  console.log(`✅ Passed confidence: ${passedConfidenceCount}, Final candidates: ${boxes.length}`);

  // Apply NMS
  const keepIndices = nms(boxes, scores, NMS_THRESHOLD);

  for (const idx of keepIndices) {
    const [x1, y1, x2, y2] = boxes[idx];

    detections.push({
      label: YOLO_CLASSES[classIds[idx]] || 'unknown',
      score: scores[idx],
      xmin: x1,
      ymin: y1,
      xmax: x2,
      ymax: y2,
    });
  }

  return detections.slice(0, 10); // Limit to top 10 detections
}

// Convert Float32Array to Uint16Array (IEEE 754 half precision) for float16 ONNX input
function float32ToFloat16(src: Float32Array): Uint16Array {
  const dst = new Uint16Array(src.length);
  const f32 = new Float32Array(1);
  const i32 = new Int32Array(f32.buffer);
  for (let i = 0; i < src.length; i++) {
    f32[0] = src[i];
    const x = i32[0];
    const sign = (x >>> 16) & 0x8000;
    let mant = x & 0x007fffff;
    let exp = (x >>> 23) & 0xff;

    if (exp === 255) {
      // Inf/NaN
      dst[i] = sign | 0x7c00 | (mant ? 1 : 0);
      continue;
    }

    if (exp > 112) { // exp - 127 + 15 > 0
      exp = exp - 112; // = exp - 127 + 15
      if (exp >= 31) {
        // Overflow to Inf
        dst[i] = sign | 0x7c00;
      } else {
        // Normalized
        dst[i] = sign | (exp << 10) | (mant >> 13);
      }
      continue;
    }

    if (exp < 113) { // May be subnormal or zero
      if (exp < 103) {
        // Too small becomes signed zero
        dst[i] = sign;
      } else {
        // Subnormal
        mant = mant | 0x00800000; // add implicit leading 1
        const shift = 114 - exp; // 1 + (127-15) - exp
        let halfMant = mant >> shift;
        // Round to nearest
        const roundBit = (mant >> (shift - 1)) & 1;
        halfMant += roundBit;
        dst[i] = sign | (halfMant >> 13);
      }
      continue;
    }
  }
  return dst;
}

// Convert Float16 (Uint16Array) to Float32Array for post-processing
function float16ToFloat32(src: Uint16Array): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const h = src[i];
    const s = (h & 0x8000) >> 15;
    const e = (h & 0x7C00) >> 10;
    const f = h & 0x03FF;
    let val: number;
    if (e === 0) {
      // subnormal
      val = (s ? -1 : 1) * Math.pow(2, -14) * (f / Math.pow(2, 10));
    } else if (e === 0x1F) {
      // NaN or Inf
      val = f ? NaN : ((s ? -1 : 1) * Infinity);
    } else {
      // normal
      val = (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / Math.pow(2, 10));
    }
    out[i] = val;
  }
  return out;
}

// Run real ONNX inference
async function runRealInference(imageData: ImageData): Promise<DetectionResult[]> {
  if (!session || !isInitialized) {
    throw new Error('ONNX model not initialized');
  }

  try {
    console.log('🔍 Starting inference...');

  // Preprocess image
  const inputTensorF32 = preprocessImage(imageData, MODEL_INPUT_SIZE);
  console.log('✅ Image preprocessed, tensor shape:', [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);

  // Some exported models (your yolov5n.onnx) expect float16 input; convert
  const f16 = float32ToFloat16(inputTensorF32);
  const tensor = new ort.Tensor('float16', f16, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  console.log('✅ Input tensor created with float16 type');

    // Use the actual input name from the model
    const inputName = session.inputNames[0]; // Get the first input name
    const feeds = { [inputName]: tensor };
    console.log('🚀 Running inference with input name:', inputName);

    const results = await session.run(feeds);
    console.log('✅ Inference completed, outputs:', Object.keys(results));

    // Get output using the actual output name
    const outputName = session.outputNames[0]; // Get the first output name
    const outputTensor = results[outputName];
    const rawData: any = (outputTensor as any).data;
    let output: Float32Array;
    if (rawData instanceof Float32Array) {
      output = rawData as Float32Array;
      console.log('📦 Output dtype: float32');
    } else if (rawData instanceof Uint16Array) {
      console.log('📦 Output dtype: float16 (decoding to float32)');
      output = float16ToFloat32(rawData as Uint16Array);
    } else if (Array.isArray(rawData)) {
      output = new Float32Array(rawData as number[]);
      console.log('📦 Output dtype: array -> float32');
    } else {
      // Fallback
      output = Float32Array.from(rawData as Iterable<number>);
      console.log('📦 Output dtype: unknown, coerced to float32');
    }
    // Optional: log dims if available for debugging
    // @ts-ignore
    if ((outputTensor as any).dims) {
      // @ts-ignore
      console.log('📏 Output dims:', (outputTensor as any).dims);
    }
    console.log('📊 Output tensor size:', output.length);

    // Post-process results
    // @ts-ignore
    const dims = (outputTensor as any).dims as number[] | undefined;
    const detections = postprocess(output, { dims });
    console.log('🎯 Detections found:', detections.length);

    // Log detection details for debugging
    if (detections.length > 0) {
      console.log('📋 Detection details:', detections.map(d => ({
        label: d.label,
        score: d.score.toFixed(2),
        bbox: `(${d.xmin.toFixed(2)}, ${d.ymin.toFixed(2)}) to (${d.xmax.toFixed(2)}, ${d.ymax.toFixed(2)})`
      })));
    }

    return detections;

  } catch (error) {
    console.error('❌ Inference error:', error);
    return [];
  }
}// Process frame with real ONNX inference
async function processFrame(data: any): Promise<FrameMessage> {
  const { frame_id, capture_ts, recv_ts, imageData } = data;

  try {
    // Run real ONNX inference
    const detections = await runRealInference(imageData);
    const inference_ts = Date.now();

    return {
      frame_id,
      capture_ts,
      recv_ts,
      inference_ts,
      detections
    };

  } catch (error) {
    console.error('Frame processing error:', error);

    return {
      frame_id,
      capture_ts,
      recv_ts,
      inference_ts: Date.now(),
      detections: []
    };
  }
}

// Worker message handler
self.onmessage = async (event) => {
  const { type, data } = event.data;

  if (type === 'init') {
    await initializeModel();
    return;
  }

  if (type === 'process-frame') {
    try {
      if (!isInitialized) {
        self.postMessage({
          type: 'error',
          data: {
            error: 'Model not initialized. Call init first.',
            frame_id: data.frame_id
          }
        });
        return;
      }

      const result = await processFrame(data);

      self.postMessage({
        type: 'detection-result',
        data: result
      });

    } catch (error) {
      self.postMessage({
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          frame_id: data.frame_id
        }
      });
    }
  }
};

export { };