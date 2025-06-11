YouTube/Podcast Audio Downloader, Transcriber & Summarizer

Overview

The project is a tool to:
	1.	Download audio from YouTube or MP3 URLs.
	2.	Split the audio into manageable chunks (default: 10 minutes).
	3.	Use Google Gemini (or a similar API) for transcription and speaker/tone analysis.
	4.	Merge chunk transcriptions back into a single file, adjusting timestamps.
	5.	Generate a final JSON file with the full transcription, highlights, and summaries.

⸻

Key Requirements & Features

1. Audio Downloading
	•	Inputs:
	•	YouTube URL.
	•	Direct MP3 file URL.
	•	Tool: Use yt-dlp for YouTube and direct download methods for MP3s.
	•	Output: Single audio file in a standardized format (MP3 or WAV).

2. Audio Chunking
	•	Goal: Split audio into 10-minute chunks.
	•	Tool: Use ffmpeg or similar for chunking.
	•	Output: Array of audio chunk files.

3. Transcription & Analysis
	•	API: Use Google Gemini’s transcription and tone detection features.
	•	For Each Chunk:
	•	Transcribe audio.
	•	Identify speakers (if possible with Gemini API).
	•	Analyze tone (e.g., emotion, formality).
	•	Output: Array of transcription results with timestamps, speakers, and tone.

4. Merging Transcripts
	•	Goal: Merge chunk transcriptions back into one cohesive transcription.
	•	Timestamps: Adjust timestamps to reflect original audio positions.
	•	Output: Full transcription, speaker attributions, and tone insights.

5. Highlight Extraction & Summary
	•	Extract:
	•	Key themes.
	•	Notable statements.
	•	Emotional highlights.
	•	Summarize overall conversation or audio content.
	•	Output: Part of the final JSON.

6. Final Output
	•	Format: JSON file.
	•	Structure:

{
  "title": "Audio Title",
  "source_url": "Original URL",
  "full_transcript": [
    {
      "start": "00:00:00",
      "end": "00:10:00",
      "speaker": "Speaker 1",
      "tone": "Calm",
      "text": "Transcribed text for chunk 1"
    },
    ...
  ],
  "highlights": [
    "Key theme 1",
    "Key theme 2"
  ],
  "summary": "Overall summary of the audio content."
}



⸻

Architecture
	•	Language: TypeScript (Node.js environment).
	•	Package Management: NPM.
	•	Modules:
	•	audioDownloader.ts: Download logic.
	•	audioChunker.ts: Chunking logic.
	•	transcriber.ts: Gemini API interactions.
	•	merger.ts: Merging transcripts.
	•	highlights.ts: Highlight extraction.
	•	outputBuilder.ts: Final JSON file creation.
	•	CLI: Command-line interface for ease of use.

⸻

Data Handling & Storage
	•	Temporary Files: Use /tmp or a designated temp directory for chunk storage.
	•	Output: Save final JSON file to a user-specified location.
	•	Cleanup: Option to remove intermediate audio chunks after completion.

⸻

Error Handling
	•	Network Errors: Retry logic for downloads and API calls.
	•	File Handling: Validate file integrity post-download.
	•	API Errors: Graceful handling with clear error messages.

⸻

Testing Plan
	•	Unit Tests: Each module has unit tests for input validation and output structure.
	•	Integration Tests: Simulate an end-to-end flow with small audio samples.
	•	Error Tests: Test API timeouts, bad URLs, and corrupted audio chunks.
	•	Manual Tests: Validate tone detection and speaker recognition manually on diverse audio samples.
