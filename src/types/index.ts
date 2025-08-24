export interface TranscriptSegment {
  timestamp: string; // mm:ss, relative to chunk start
  ad: boolean;
  speaker: string;
  text: string;
  tone: string;
}

export interface FinalOutput {
  title: string;
  source_url: string;
  full_transcript: TranscriptSegment[];
  highlights: string[];
  summary: string;
  description: string;
  duration?: number;
  people?: string[];
  topics?: string[];
  thumbnail?: string;
  date?: string;
  spotify_info?: any;
  youtube_url?: string;
  youtube_metadata?: any;
}

export interface ChunkTranscription {
  chunkIndex: number;
  startTime: number;
  endTime: number;
  segments: TranscriptSegment[];
}

export interface AudioChunk {
  path: string;
  index: number;
  startTime: number;
  duration: number;
}

export interface DownloadOptions {
  outputPath: string;
  format?: "mp3" | "wav";
  cookiesPath?: string; // Optional path to cookies.txt for yt-dlp
}

export interface TranscriptionOptions {
  apiKey: string;
  model?: string;
  language?: string;
}

export interface ProcessingOptions {
  url: string;
  outputPath?: string;
  tempDir?: string;
  keepChunks?: boolean;
  saveAllTempFiles?: boolean; // Save all temporary files, including raw audio, downsampled audio, etc.
  chunkDuration?: number; // in seconds, default 600 (10 minutes)
  concurrency?: number; // number of chunks to process in parallel during transcription, default 3
}
