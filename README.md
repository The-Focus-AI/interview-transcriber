# Audio Transcriber 🎙️

A powerful Node.js tool to download audio from YouTube or podcast URLs, transcribe using Google Gemini AI, and generate comprehensive summaries with speaker identification and tone analysis.

## Features

- 📥 **Download audio** from YouTube videos or direct MP3 URLs
- ✂️ **Smart chunking** - Splits long audio into manageable 10-minute segments
- 🎯 **Advanced transcription** using Google Gemini AI with:
  - Speaker identification
  - Tone/emotion analysis
  - Timestamp preservation
- 🔀 **Intelligent merging** of transcription chunks
- ✨ **Automatic extraction** of:
  - Key highlights and themes
  - Comprehensive summary
  - Speaker statistics
- 📊 **Multiple output formats**:
  - Structured JSON
  - Formatted text transcript
  - Detailed metadata report

## Prerequisites

1. **Node.js** (v16 or higher)
2. **yt-dlp** - For YouTube downloads
   ```bash
   # macOS
   brew install yt-dlp
   
   # Ubuntu/Debian
   sudo apt install yt-dlp
   
   # Windows
   # Download from https://github.com/yt-dlp/yt-dlp/releases
   ```

3. **ffmpeg** - For audio processing
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt install ffmpeg
   
   # Windows
   # Download from https://ffmpeg.org/download.html
   ```

4. **Google Gemini API Key**
   - Get your API key from: https://makersuite.google.com/app/apikey

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd audio-transcriber

# Install dependencies
npm install

# Copy environment file and add your API key
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

## Usage

### Basic Usage

```bash
# Transcribe a YouTube video
npm run dev "https://www.youtube.com/watch?v=VIDEO_ID"

# Transcribe a direct MP3 URL
npm run dev "https://example.com/podcast.mp3"

# With custom output path
npm run dev "https://www.youtube.com/watch?v=VIDEO_ID" -o ./my-transcript.json
```

### Command Line Options

```
audio-transcriber <url> [options]

Options:
  -o, --output <path>           Output file path (default: ./output/transcript_[timestamp].json)
  -t, --temp-dir <path>         Temporary directory for processing (default: ./temp)
  -c, --chunk-duration <secs>   Duration of each chunk in seconds (default: 600)
  -k, --keep-chunks             Keep temporary audio chunks after processing
  --no-text                     Skip generating text transcript file
  --no-report                   Skip generating metadata report file
  -h, --help                    Display help for command
```

### Additional Commands

```bash
# Display dependency information
npm run dev info

# Run a test transcription
npm run dev test

# Build the project
npm run build

# Clean temporary files
npm run clean
```

## Output Files

The tool generates three types of output files:

### 1. JSON Output (`transcript_*.json`)
```json
{
  "title": "Video/Audio Title",
  "source_url": "https://...",
  "full_transcript": [
    {
      "start": "00:00:00",
      "end": "00:00:45",
      "speaker": "Speaker 1",
      "tone": "Excited",
      "text": "Transcribed text..."
    }
  ],
  "highlights": [
    "Key point 1",
    "Key point 2"
  ],
  "summary": "Comprehensive summary..."
}
```

### 2. Text Transcript (`transcript_*.txt`)
A formatted, readable transcript with timestamps, speakers, and tone information.

### 3. Metadata Report (`transcript_*_report.txt`)
A summary report containing:
- Title and source information
- Executive summary
- Key highlights
- Speaker statistics
- Tone distribution analysis

## API Usage

You can also use the modules programmatically:

```typescript
import { AudioProcessor } from 'audio-transcriber';

const processor = new AudioProcessor();

const options = {
  url: 'https://www.youtube.com/watch?v=VIDEO_ID',
  outputPath: './output/my-transcript.json',
  chunkDuration: 600 // 10 minutes
};

const result = await processor.processAudio(options);
console.log(result);
```

## Project Structure

```
audio-transcriber/
├── src/
│   ├── modules/
│   │   ├── audioDownloader.ts    # YouTube/MP3 download logic
│   │   ├── audioChunker.ts       # Audio splitting with ffmpeg
│   │   ├── transcriber.ts        # Gemini AI transcription
│   │   ├── merger.ts             # Chunk merging logic
│   │   ├── highlights.ts         # Highlight extraction
│   │   └── outputBuilder.ts      # Output file generation
│   ├── utils/
│   │   ├── timeUtils.ts          # Timestamp utilities
│   │   └── fileUtils.ts          # File system utilities
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── processor.ts              # Main orchestrator
│   ├── cli.ts                    # CLI interface
│   └── index.ts                  # Module exports
├── tests/                        # Test files
├── temp/                         # Temporary processing files
├── output/                       # Default output directory
└── package.json
```

## Error Handling

The tool includes comprehensive error handling for:
- Network failures (with retry logic)
- Invalid URLs
- API rate limiting
- File system errors
- Corrupted audio files

## Performance Considerations

- **Chunk Duration**: Default is 10 minutes. Shorter chunks = more API calls but better accuracy
- **API Rate Limiting**: The tool includes delays between API calls to avoid rate limiting
- **Parallel Processing**: Chunks are processed sequentially by default to avoid API limits

## Troubleshooting

### Common Issues

1. **"GEMINI_API_KEY not found"**
   - Make sure you've created a `.env` file with your API key
   
2. **"yt-dlp not found"**
   - Install yt-dlp using the instructions above
   
3. **"ffmpeg not found"**
   - Install ffmpeg using the instructions above

4. **Transcription fails**
   - Check your Gemini API quota
   - Try reducing chunk duration
   - Ensure audio quality is sufficient

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Google Gemini AI for transcription capabilities
- yt-dlp for YouTube download functionality
- ffmpeg for audio processing
- The open-source community for various dependencies
