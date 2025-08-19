#!/bin/bash
# Setup script for WebRTC Object Detection System

set -e

echo "🚀 WebRTC Object Detection Setup"
echo "================================="

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "✅ Docker found - using containerized setup"
    
    echo "📦 Building containers..."
    docker-compose build
    
    echo "🎯 Starting services..."
    docker-compose up -d
    
    echo "✅ Setup complete!"
    echo "📱 Mobile: http://$(hostname -I | awk '{print $1}'):5173"
    echo "💻 Desktop: http://localhost:5173"
    echo "📊 Logs: docker-compose logs -f"
    
else
    echo "📦 Docker not found - using local setup"
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install Node.js 18+ first."
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo "❌ Node.js 18+ required. Current version: $(node --version)"
        exit 1
    fi
    
    echo "✅ Node.js $(node --version) found"
    
    echo "📦 Installing dependencies..."
    npm run install:all
    
    echo "🎯 Starting services..."
    npm start &
    
    sleep 3
    echo "✅ Setup complete!"
    echo "📱 Mobile: http://$(hostname -I | awk '{print $1}'):5173"
    echo "💻 Desktop: http://localhost:5173"
fi

echo ""
echo "🎥 Next steps:"
echo "1. Open mobile browser and allow camera access"
echo "2. Note the Room ID generated"
echo "3. Open desktop browser and enter Room ID"
echo "4. Click 'Join Room' then 'Start Detection'"
echo "5. Point mobile camera at objects to detect"
echo "6. Use built-in benchmark tool for performance testing"
echo ""
echo "🛑 Stop services: docker-compose down (or Ctrl+C for local)"
