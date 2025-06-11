import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import { AudioChunk } from '../types';
import { ensureDir } from '../utils/fileUtils';

export class AudioChunker {
  async splitAudio(
    inputPath: string,
    outputDir: string,
    chunkDuration: number = 600 // 10 minutes in seconds
  ): Promise<AudioChunk[]> {
    console.log(`Splitting audio into ${chunkDuration}s chunks...`);
    
    // Ensure output directory exists
    await ensureDir(outputDir);

    // Get audio duration
    const duration = await this.getAudioDuration(inputPath);
    console.log(`Total audio duration: ${duration}s`);

    // Calculate number of chunks
    const numChunks = Math.ceil(duration / chunkDuration);
    console.log(`Will create ${numChunks} chunks`);

    const chunks: AudioChunk[] = [];
    const promises: Promise<void>[] = [];

    for (let i = 0; i < numChunks; i++) {
      const startTime = i * chunkDuration;
      const chunkPath = path.join(outputDir, `chunk_${i.toString().padStart(3, '0')}.mp3`);
      
      const chunk: AudioChunk = {
        path: chunkPath,
        index: i,
        startTime: startTime,
        duration: Math.min(chunkDuration, duration - startTime)
      };
      
      chunks.push(chunk);
      promises.push(this.extractChunk(inputPath, chunk));
    }

    // Process all chunks in parallel
    await Promise.all(promises);
    console.log(`Created ${chunks.length} audio chunks`);

    return chunks;
  }

  private getAudioDuration(inputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err: any, metadata: any) => {
        if (err) {
          reject(new Error(`Failed to get audio duration: ${err.message}`));
          return;
        }
        
        const duration = metadata.format.duration;
        if (!duration) {
          reject(new Error('Could not determine audio duration'));
          return;
        }
        
        resolve(duration);
      });
    });
  }

  private extractChunk(inputPath: string, chunk: AudioChunk): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`Extracting chunk ${chunk.index} (${chunk.startTime}s - ${chunk.startTime + chunk.duration}s)`);
      
      ffmpeg(inputPath)
        .setStartTime(chunk.startTime)
        .setDuration(chunk.duration)
        .output(chunk.path)
        .audioCodec('libmp3lame')
        .audioBitrate('32k')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => {
          console.log(`Chunk ${chunk.index} created successfully`);
          resolve();
        })
        .on('error', (err: any) => {
          reject(new Error(`Failed to create chunk ${chunk.index}: ${err.message}`));
        })
        .on('progress', (progress: any) => {
          // Optionally log progress
          if (progress.percent) {
            process.stdout.write(`\rChunk ${chunk.index}: ${Math.round(progress.percent)}%`);
          }
        })
        .run();
    });
  }

  async cleanupChunks(chunks: AudioChunk[]): Promise<void> {
    console.log('Cleaning up temporary chunks...');
    
    const promises = chunks.map(async (chunk) => {
      try {
        await fs.unlink(chunk.path);
      } catch (error) {
        console.warn(`Failed to delete chunk ${chunk.path}: ${(error as Error).message}`);
      }
    });

    await Promise.all(promises);
    console.log('Cleanup completed');
  }
}