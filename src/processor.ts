import * as path from 'path';
import * as dotenv from 'dotenv';
import { AudioDownloader } from './modules/audioDownloader';
import { AudioChunker } from './modules/audioChunker';
import { Transcriber } from './modules/transcriber';
import { Merger } from './modules/merger';
import { HighlightsExtractor } from './modules/highlights';
import { OutputBuilder } from './modules/outputBuilder';
import { ProcessingOptions, FinalOutput } from './types';
import { ensureDir, cleanDir, generateOutputFilename } from './utils/fileUtils';

dotenv.config();

export class AudioProcessor {
  private downloader: AudioDownloader;
  private chunker: AudioChunker;
  private transcriber: Transcriber;
  private merger: Merger;
  private highlightsExtractor: HighlightsExtractor;
  private outputBuilder: OutputBuilder;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    this.downloader = new AudioDownloader();
    this.chunker = new AudioChunker();
    this.transcriber = new Transcriber({ apiKey });
    this.merger = new Merger();
    this.highlightsExtractor = new HighlightsExtractor(apiKey);
    this.outputBuilder = new OutputBuilder();
  }

  async processAudio(options: ProcessingOptions): Promise<FinalOutput> {
    console.log('\n🎙️  Audio Transcription Process Started\n');
    console.log(`URL: ${options.url}`);
    
    const tempDir = options.tempDir || process.env.TEMP_DIR || './temp';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, ''); // HHMMSS
    const runFolder = `${dateStr}_${timeStr}`;
    const runTempDir = path.join(tempDir, runFolder);
    const outputBase = process.env.OUTPUT_DIR || './output';
    const outputDir = outputBase; // No timestamped subdirectory
    const chunkDuration = options.chunkDuration || 600; // 10 minutes default

    try {
      // Step 1: Setup directories
      console.log('\n📁 Setting up directories...');
      await ensureDir(runTempDir);
      await ensureDir(outputDir);
      console.log(`Output directory: ${outputDir}`);
      
      const chunksDir = path.join(runTempDir, 'chunks');
      await ensureDir(chunksDir);

      // Step 2: Get video/audio metadata
      console.log('\n📊 Getting metadata...');
      let title = 'Unknown Title';
      try {
        const metadata = await this.downloader.getVideoInfo(options.url);
        title = metadata.title || metadata.fulltitle || 'Unknown Title';
        console.log(`Title: ${title}`);
      } catch (error) {
        console.warn('Could not fetch metadata, using default title');
      }

      // Step 3: Download audio
      console.log('\n⬇️  Downloading audio...');
      const audioPath = path.join(runTempDir, 'audio.mp3');
      const downloadedPath = await this.downloader.downloadAudio(options.url, {
        outputPath: audioPath,
        format: 'mp3'
      });

      // Step 3.5: Downsample audio to 16 kHz mono
      console.log('\n🎚️  Downsampling audio to 16 kHz mono...');
      const downsampledPath = path.join(runTempDir, 'audio_16k_mono.mp3');
      await new Promise<void>((resolve, reject) => {
        const ffmpeg = require('fluent-ffmpeg');
        ffmpeg(downloadedPath)
          .audioChannels(1)
          .audioFrequency(16000)
          .audioCodec('libmp3lame')
          .output(downsampledPath)
          .on('end', () => {
            console.log('Downsampling complete:', downsampledPath);
            resolve();
          })
          .on('error', (err: any) => {
            reject(new Error('Failed to downsample audio: ' + err.message));
          })
          .run();
      });

      // Step 4: Split audio into chunks
      console.log('\n✂️  Splitting audio into chunks...');
      const chunks = await this.chunker.splitAudio(downsampledPath, chunksDir, chunkDuration);

      // Step 5: Transcribe all chunks
      console.log('\n🎯 Transcribing audio chunks...');
      const chunkTranscriptions = await this.transcriber.transcribeAllChunks(chunks);

      // Step 6: Merge transcriptions
      console.log('\n🔀 Merging transcriptions...');
      const mergedSegments = this.merger.mergeTranscriptions(chunkTranscriptions);
      const identifiedSegments = this.merger.identifySpeakers(mergedSegments);

      // Step 7: Extract highlights and generate summary
      console.log('\n✨ Extracting highlights and generating summary...');
      const highlights = await this.highlightsExtractor.extractHighlights(identifiedSegments);
      const summary = await this.highlightsExtractor.generateSummary(identifiedSegments);

      // Step 8: Build final output
      console.log('\n📝 Building final output...');
      const finalOutput = await this.outputBuilder.buildOutput(
        title,
        options.url,
        identifiedSegments,
        highlights,
        summary
      );

      // Step 9: Save output files
      let outputPath: string = '';
      if (options.outputPath && typeof options.outputPath === 'string') {
        // Use the custom file name, directly in outputDir
        outputPath = path.join(outputDir, path.basename(options.outputPath || ''));
      } else {
        outputPath = path.join(outputDir, generateOutputFilename(options.url, 'json'));
      }
      
      await this.outputBuilder.saveToFile(finalOutput, outputPath);
      
      // Also save as text and report
      const baseName = path.basename(outputPath, '.json');
      const textPath = path.join(outputDir, `${baseName}.txt`);
      const reportPath = path.join(outputDir, `${baseName}_report.txt`);

      console.log(`Text path: ${textPath}`);
      
      await this.outputBuilder.saveTranscriptAsText(identifiedSegments, textPath);
      await this.outputBuilder.saveMetadataReport(finalOutput, reportPath);

      // Step 10: Cleanup (if requested)
      if (!options.keepChunks) {
        console.log('\n🧹 Cleaning up temporary files...');
        await this.chunker.cleanupChunks(chunks);
        await cleanDir(chunksDir);
      }

      console.log('\n✅ Process completed successfully!');
      console.log(`\nOutput files:`);
      console.log(`  - JSON: ${outputPath}`);
      console.log(`  - Text: ${textPath}`);
      console.log(`  - Report: ${reportPath}`);

      return finalOutput;

    } catch (error) {
      console.error('\n❌ Process failed:', error);
      throw error;
    }
  }
}