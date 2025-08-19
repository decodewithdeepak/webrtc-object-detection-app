#!/usr/bin/env node

// Download script for ONNX models
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const models = [
    {
        name: 'yolov5n.onnx',
        url: 'https://github.com/ultralytics/yolov5/releases/download/v7.0/yolov5n.onnx',
        path: './frontend/public/models/yolov5n.onnx',
        description: 'YOLOv5 Nano - Ultra lightweight object detection model (~4MB)'
    }
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${path.basename(dest)}...`);

        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            const total = parseInt(response.headers['content-length'], 10);
            let downloaded = 0;

            response.on('data', (chunk) => {
                downloaded += chunk.length;
                const percent = ((downloaded / total) * 100).toFixed(1);
                process.stdout.write(`\r${percent}% downloaded`);
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\n✅ Download complete!');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { }); // Delete file on error
            reject(err);
        });
    });
}

async function downloadModels() {
    console.log('🤖 Downloading ONNX models for real object detection...\n');

    // Create models directory if it doesn't exist
    const modelsDir = path.dirname(models[0].path);
    if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
    }

    for (const model of models) {
        try {
            if (fs.existsSync(model.path)) {
                console.log(`✅ ${model.name} already exists, skipping...`);
                continue;
            }

            console.log(`📦 ${model.description}`);
            await downloadFile(model.url, model.path);
            console.log(`✅ ${model.name} downloaded to ${model.path}\n`);
        } catch (error) {
            console.error(`❌ Failed to download ${model.name}:`, error.message);
        }
    }

    console.log('🎉 Model download complete! You can now run real object detection.');
}

downloadModels().catch(console.error);
