# Quick Start Guide 🚀

## Prerequisites Installation

### 1. Install yt-dlp
```bash
# macOS
brew install yt-dlp

# Ubuntu/Debian
sudo apt install yt-dlp

# Check installation
yt-dlp --version
```

### 2. Install ffmpeg
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Check installation
ffmpeg -version
```

### 3. Get Google Gemini API Key
1. Visit https://makersuite.google.com/app/apikey
2. Create a new API key
3. Save it for the next step

## Setup

### 1. Clone and Install
```bash
# Clone the repository
git clone <repository-url>
cd audio-transcriber

# Install dependencies
npm install

# Or use the setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 2. Configure API Key
```bash
# Copy environment file
cp .env.example .env

# Edit .env and add your API key
# GEMINI_API_KEY=your_actual_api_key_here
```

## Usage Examples

### Basic Usage
```bash
# Transcribe a YouTube video
npm run dev "https://www.youtube.com/watch?v=aqz-KE-bpKQ"

# Transcribe with custom output
npm run dev "https://www.youtube.com/watch?v=VIDEO_ID" -o ./my-transcript.json

# Transcribe with 5-minute chunks
npm run dev "https://www.youtube.com/watch?v=VIDEO_ID" -c 300
```

### Test Your Setup
```bash
# Check dependencies
npm run dev info

# Run a test transcription
npm run dev test
```

## Common Issues

### "GEMINI_API_KEY not found"
Make sure you've edited the `.env` file and added your actual API key.

### "yt-dlp not found" or "ffmpeg not found"
Install the missing dependency using the commands above.

### "API quota exceeded"
- Check your Gemini API usage at https://console.cloud.google.com
- Try using longer chunk durations (-c 900 for 15-minute chunks)

## Output Files

After successful transcription, you'll find:
- `output/transcript_*.json` - Complete transcription data
- `output/transcript_*.txt` - Readable text format
- `output/transcript_*_report.txt` - Summary and statistics

## Need Help?

- Run `npm run dev --help` for all options
- Check the full README.md for detailed documentation
- Report issues at the repository