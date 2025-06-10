#!/bin/bash

echo "🎙️  Audio Transcriber Setup Script"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi
echo "✅ npm found: $(npm --version)"

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
    echo "⚠️  yt-dlp is not installed!"
    echo ""
    echo "To install yt-dlp:"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  brew install yt-dlp"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  sudo apt install yt-dlp  # For Debian/Ubuntu"
        echo "  sudo yum install yt-dlp  # For RHEL/CentOS"
    else
        echo "  Download from: https://github.com/yt-dlp/yt-dlp/releases"
    fi
    echo ""
else
    echo "✅ yt-dlp found: $(yt-dlp --version | head -n1)"
fi

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg is not installed!"
    echo ""
    echo "To install ffmpeg:"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  brew install ffmpeg"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  sudo apt install ffmpeg  # For Debian/Ubuntu"
        echo "  sudo yum install ffmpeg  # For RHEL/CentOS"
    else
        echo "  Download from: https://ffmpeg.org/download.html"
    fi
    echo ""
else
    echo "✅ ffmpeg found: $(ffmpeg -version | head -n1)"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your GEMINI_API_KEY"
    echo "   Get your API key from: https://makersuite.google.com/app/apikey"
else
    # Check if API key is set
    if grep -q "your_gemini_api_key_here" .env; then
        echo ""
        echo "⚠️  Please edit .env and add your GEMINI_API_KEY"
        echo "   Get your API key from: https://makersuite.google.com/app/apikey"
    else
        echo "✅ .env file found with API key"
    fi
fi

echo ""
echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "🔨 Building the project..."
npm run build

echo ""
echo "✨ Setup complete!"
echo ""
echo "To test the installation, run:"
echo "  npm run dev info"
echo ""
echo "To transcribe a video, run:"
echo "  npm run dev 'https://www.youtube.com/watch?v=VIDEO_ID'"