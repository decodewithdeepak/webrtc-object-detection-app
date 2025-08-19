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
const CONFIDENCE_THRESHOLD = 0.5;
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
function postprocess(output: Float32Array): DetectionResult[] {
  const detections: DetectionResult[] = [];
  const numDetections = output.length / 85; // 85 = 4 bbox + 1 confidence + 80 classes

  const boxes: number[][] = [];
  const scores: number[] = [];
  const classIds: number[] = [];

  for (let i = 0; i < numDetections; i++) {
    const offset = i * 85;

    // Extract box coordinates (center format)
    const centerX = output[offset];
    const centerY = output[offset + 1];
    const width = output[offset + 2];
    const height = output[offset + 3];
    const confidence = output[offset + 4];

    if (confidence < CONFIDENCE_THRESHOLD) continue;

    // Find best class
    let bestClassScore = 0;
    let bestClassId = 0;

    for (let j = 0; j < 80; j++) {
      const classScore = output[offset + 5 + j];
      if (classScore > bestClassScore) {
        bestClassScore = classScore;
        bestClassId = j;
      }
    }

    const finalScore = confidence * bestClassScore;
    if (finalScore < CONFIDENCE_THRESHOLD) continue;

    // Convert center format to corner format
    const x1 = (centerX - width / 2) / MODEL_INPUT_SIZE;
    const y1 = (centerY - height / 2) / MODEL_INPUT_SIZE;
    const x2 = (centerX + width / 2) / MODEL_INPUT_SIZE;
    const y2 = (centerY + height / 2) / MODEL_INPUT_SIZE;

    boxes.push([x1, y1, x2, y2]);
    scores.push(finalScore);
    classIds.push(bestClassId);
  }

  // Apply NMS
  const keepIndices = nms(boxes, scores, NMS_THRESHOLD);

  for (const idx of keepIndices) {
    const [x1, y1, x2, y2] = boxes[idx];

    detections.push({
      label: YOLO_CLASSES[classIds[idx]] || 'unknown',
      score: scores[idx],
      xmin: Math.max(0, x1),
      ymin: Math.max(0, y1),
      xmax: Math.min(1, x2),
      ymax: Math.min(1, y2),
    });
  }

  return detections.slice(0, 10); // Limit to top 10 detections
}

// Convert Float32Array to Uint16Array for float16 tensors
function float32ToFloat16(float32Array: Float32Array): Uint16Array {
  const uint16Array = new Uint16Array(float32Array.length);

  for (let i = 0; i < float32Array.length; i++) {
    // Convert float32 to float16 (IEEE 754 half precision)
    const float32 = float32Array[i];

    // Handle special cases
    if (float32 === 0) {
      uint16Array[i] = 0;
      continue;
    }

    // Get the IEEE 754 representation
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setFloat32(0, float32, true);
    const bits = view.getUint32(0, true);

    // Extract components
    const sign = (bits >>> 31) & 0x1;
    const exponent = (bits >>> 23) & 0xff;
    const mantissa = bits & 0x7fffff;

    // Convert to float16
    let float16Exp = exponent - 127 + 15; // Rebias exponent
    let float16Mantissa = mantissa >>> 13; // Keep top 10 bits

    // Handle special cases
    if (exponent === 0) {
      // Zero or denormalized
      float16Exp = 0;
      float16Mantissa = 0;
    } else if (exponent === 255) {
      // Infinity or NaN
      float16Exp = 31;
      float16Mantissa = mantissa ? 1 : 0;
    } else if (float16Exp <= 0) {
      // Underflow to zero
      float16Exp = 0;
      float16Mantissa = 0;
    } else if (float16Exp >= 31) {
      // Overflow to infinity
      float16Exp = 31;
      float16Mantissa = 0;
    }

    // Combine components
    uint16Array[i] = (sign << 15) | (float16Exp << 10) | float16Mantissa;
  }

  return uint16Array;
}

// Run real ONNX inference
async function runRealInference(imageData: ImageData): Promise<DetectionResult[]> {
  if (!session || !isInitialized) {
    throw new Error('ONNX model not initialized');
  }

  try {
    console.log('🔍 Starting inference...');

    // Preprocess image
    const inputTensor = preprocessImage(imageData, MODEL_INPUT_SIZE);
    console.log('✅ Image preprocessed, tensor shape:', [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);

    // Convert to Uint16Array for float16 tensor
    const float16Data = float32ToFloat16(inputTensor);
    console.log('✅ Converted to float16 format');

    // Create input tensor with float16 data type and Uint16Array
    const tensor = new ort.Tensor('float16', float16Data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
    console.log('✅ Input tensor created with float16 type');

    // Use the actual input name from the model
    const inputName = session.inputNames[0]; // Get the first input name
    const feeds = { [inputName]: tensor };
    console.log('🚀 Running inference with input name:', inputName);

    const results = await session.run(feeds);
    console.log('✅ Inference completed, outputs:', Object.keys(results));

    // Get output using the actual output name
    const outputName = session.outputNames[0]; // Get the first output name
    const output = results[outputName].data as Float32Array;
    console.log('📊 Output tensor size:', output.length);

    // Post-process results
    const detections = postprocess(output);
    console.log('🎯 Detections found:', detections.length);

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