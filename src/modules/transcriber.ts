import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import { AudioChunk, ChunkTranscription, TranscriptSegment, TranscriptionOptions } from '../types';
import { secondsToTimestamp } from '../utils/timeUtils';

export class Transcriber {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private maxRetries = 3;

  constructor(options: TranscriptionOptions) {
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    // Using Gemini 2.5 Flash for audio transcription
    this.model = this.genAI.getGenerativeModel({ 
      model: options.model || 'models/gemini-2.5-flash-preview-05-20' 
    });
  }

  private async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    errorMessage: string,
    chunkIndex: number
  ): Promise<T> {
    let retries = 0;
    
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        retries++;
        
        if (retries > this.maxRetries) {
          console.error(`${errorMessage} for chunk ${chunkIndex}: ${error.message}`);
          throw error;
        }
        
        // Calculate delay: 1s, 2s, 4s, etc.
        const delay = Math.pow(2, retries - 1) * 1000;
        console.log(`Retry attempt ${retries}/${this.maxRetries} for chunk ${chunkIndex} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async transcribeChunk(chunk: AudioChunk): Promise<ChunkTranscription> {
    console.log(`\nTranscribing chunk ${chunk.index}...`);

    try {
      // Read audio file as base64
      const audioData = await fs.readFile(chunk.path);
      const base64Audio = audioData.toString('base64');

      // Create the prompt for transcription
      const prompt = `Please transcribe this audio file as a flat list of utterances. For each utterance, provide:
- "timestamp": string, in mm:ss format, relative to the start of this chunk
- "ad": boolean, true if this is an ad section, otherwise false
- "speaker": string, the speaker's real name if mentioned, or a consistent role label (e.g., Host, Guest, Interviewer, Interviewee). If the name is not clear, use a consistent label across all chunks (e.g., Speaker A, Speaker B). Do NOT use generic labels like 'Speaker 1' or 'Speaker 2'.
- "text": string, the transcribed text
- "tone": string, the conversation tone

If a speaker's name is mentioned at any point, use that name for all their utterances in this chunk. If not, use a consistent role or label. Format your response as a JSON array, with no text before or after the array. Example:
[
  {
    "timestamp": "00:00",
    "ad": false,
    "speaker": "Host",
    "text": "Welcome to the show.",
    "tone": "neutral"
  },
  {
    "timestamp": "00:12",
    "ad": false,
    "speaker": "Jane Doe",
    "text": "Thank you for having me.",
    "tone": "happy"
  }
]`;

      // Generate content with audio (with retry)
      const operation = async () => {
        const result = await this.model.generateContent([
          {
            inlineData: {
              mimeType: 'audio/mp3',
              data: base64Audio
            }
          },
          prompt
        ]);

        const response = await result.response;
        return response.text();
      };

      const text = await this.retryWithExponentialBackoff(
        operation,
        "Transcription failed",
        chunk.index
      );

      // Parse the JSON response
      let segments: TranscriptSegment[];
      try {
        const jsonText = text.match(/\[[\s\S]*\]/)?.[0] || text;
        const parsedSegments = JSON.parse(jsonText);
        // Directly map to TranscriptSegment[]
        segments = parsedSegments.map((seg: any) => ({
          timestamp: seg.timestamp || '00:00',
          ad: typeof seg.ad === 'boolean' ? seg.ad : false,
          speaker: seg.speaker || 'Unknown',
          text: seg.text || '',
          tone: seg.tone || 'Neutral'
        }));
      } catch (parseError) {
        console.warn(`Failed to parse JSON response for chunk ${chunk.index}, using fallback`);
        // Fallback: create a single segment with the entire text
        segments = [{
          timestamp: '00:00',
          ad: false,
          speaker: 'Unknown',
          text: text.trim(),
          tone: 'Unknown'
        }];
      }

      console.log(`Chunk ${chunk.index} transcribed successfully with ${segments.length} segments`);

      return {
        chunkIndex: chunk.index,
        startTime: chunk.startTime,
        endTime: chunk.startTime + chunk.duration,
        segments: segments
      };

    } catch (error) {
      console.error(`Failed to transcribe chunk ${chunk.index}:`, error);
      
      // Return fallback with error message
      return {
        chunkIndex: chunk.index,
        startTime: chunk.startTime,
        endTime: chunk.startTime + chunk.duration,
        segments: [{
          timestamp: '00:00',
          ad: false,
          speaker: 'System',
          text: `Error transcribing audio: ${(error as Error).message}`,
          tone: 'Neutral'
        }]
      };
    }
  }

  async transcribeAllChunks(chunks: AudioChunk[]): Promise<ChunkTranscription[]> {
    console.log(`Starting transcription of ${chunks.length} chunks...`);

    // Process chunks sequentially to avoid rate limiting
    // You can adjust this to parallel processing if your API allows
    const transcriptions: ChunkTranscription[] = [];
    
    for (const chunk of chunks) {
      try {
        const transcription = await this.transcribeChunk(chunk);
        transcriptions.push(transcription);
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error transcribing chunk ${chunk.index}:`, error);
        // Continue with other chunks even if one fails
      }
    }

    console.log(`Transcription completed. Successfully transcribed ${transcriptions.length}/${chunks.length} chunks`);
    return transcriptions;
  }
}

// Add a normalization function to ensure speaker name consistency across all segments
export function normalizeSpeakerNames(segments: TranscriptSegment[]): TranscriptSegment[] {
  // Collect all unique speaker labels
  const speakerCounts: Record<string, number> = {};
  for (const seg of segments) {
    const label = seg.speaker.trim();
    if (!speakerCounts[label]) speakerCounts[label] = 0;
    speakerCounts[label]++;
  }
  // Sort speakers by frequency (most common first)
  const sortedSpeakers = Object.entries(speakerCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  // Map similar/variant labels to canonical names (simple heuristic: exact match, case-insensitive, or role-based)
  const canonicalMap: Record<string, string> = {};
  let canonicalLabels: string[] = [];
  for (const name of sortedSpeakers) {
    // Try to find a canonical label already present (case-insensitive match)
    const existing = canonicalLabels.find(
      c => c.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      canonicalMap[name] = existing;
    } else {
      canonicalMap[name] = name;
      canonicalLabels.push(name);
    }
  }

  // Optionally, map generic labels to roles if possible (e.g., Speaker A -> Guest)
  // This can be extended with more advanced heuristics if needed

  // Replace all speaker labels in segments with their canonical name
  return segments.map(seg => ({
    ...seg,
    speaker: canonicalMap[seg.speaker.trim()] || seg.speaker
  }));
}