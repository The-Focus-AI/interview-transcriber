import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs/promises';
import { AudioChunk, ChunkTranscription, TranscriptSegment, TranscriptionOptions } from '../types';
import { secondsToTimestamp } from '../utils/timeUtils';

export class Transcriber {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(options: TranscriptionOptions) {
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    // Using Gemini 2.5 Flash for audio transcription
    this.model = this.genAI.getGenerativeModel({ 
      model: options.model || 'models/gemini-2.5-flash-preview-05-20' 
    });
  }

  async transcribeChunk(chunk: AudioChunk): Promise<ChunkTranscription> {
    console.log(`\nTranscribing chunk ${chunk.index}...`);

    try {
      // Read audio file as base64
      const audioData = await fs.readFile(chunk.path);
      const base64Audio = audioData.toString('base64');

      // Create the prompt for transcription with speaker detection and tone analysis
      const prompt = `Please transcribe this audio file with the following requirements:
1. Provide accurate transcription of all spoken words.
2. Identify different speakers if possible (label as "Speaker 1", "Speaker 2", etc.).
3. Analyze the tone/emotion of each segment (e.g., calm, excited, serious, humorous, etc.).
4. Break the transcription into meaningful segments based on speaker changes or topic shifts.
5. Include timestamps for each segment.

Format the response as a **JSON array**. Each element must be an object with the following fields and types:
- "start": number (timestamp in seconds from the beginning of this chunk, required)
- "end": number (timestamp in seconds from the beginning of this chunk, required)
- "speaker": string (identified speaker label, required)
- "tone": string (analyzed tone/emotion, required)
- "text": string (transcribed text for this segment, required)

**Do not include any text or explanation before or after the JSON array. Only output valid JSON.**

Example:
[
  {
    "start": 0,
    "end": 12.5,
    "speaker": "Speaker 1",
    "tone": "calm",
    "text": "Welcome to the podcast. Today we have a special guest."
  },
  {
    "start": 12.5,
    "end": 18.0,
    "speaker": "Speaker 2",
    "tone": "excited",
    "text": "Thank you for having me! I'm excited to be here."
  }
]`;

      // Generate content with audio
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
      const text = response.text();

      // Parse the JSON response
      let segments: TranscriptSegment[];
      try {
        const jsonText = text.match(/\[[\s\S]*\]/)?.[0] || text;
        const parsedSegments = JSON.parse(jsonText);
        
        // Convert segment timestamps to HH:MM:SS format and adjust for chunk offset
        segments = parsedSegments.map((seg: any) => ({
          start: secondsToTimestamp(chunk.startTime + (seg.start || 0)),
          end: secondsToTimestamp(chunk.startTime + (seg.end || chunk.duration)),
          speaker: seg.speaker || 'Unknown',
          tone: seg.tone || 'Neutral',
          text: seg.text || ''
        }));
      } catch (parseError) {
        console.warn(`Failed to parse JSON response for chunk ${chunk.index}, using fallback`);
        // Fallback: create a single segment with the entire text
        segments = [{
          start: secondsToTimestamp(chunk.startTime),
          end: secondsToTimestamp(chunk.startTime + chunk.duration),
          speaker: 'Unknown',
          tone: 'Unknown',
          text: text.trim()
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
      throw new Error(`Transcription failed for chunk ${chunk.index}: ${(error as Error).message}`);
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