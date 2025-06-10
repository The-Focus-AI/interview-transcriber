export interface TranscriptSegment {
  start: string;
  end: string;
  speaker?: string;
  tone?: string;
  text: string;
}

export interface FinalOutput {
  title: string;
  source_url: string;
  full_transcript: TranscriptSegment[];
  highlights: string[];
  summary: string;
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
  format?: 'mp3' | 'wav';
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
  chunkDuration?: number; // in seconds, default 600 (10 minutes)
}