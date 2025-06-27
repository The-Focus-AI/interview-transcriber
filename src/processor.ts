import * as path from 'path';
import * as dotenv from 'dotenv';
import { AudioDownloader } from './modules/audioDownloader';
import { AudioChunker } from './modules/audioChunker';
import { Transcriber } from './modules/transcriber';
import { Merger } from './modules/merger';
import { HighlightsExtractor } from './modules/highlights';
import { OutputBuilder } from './modules/outputBuilder';
import { ProcessingOptions, FinalOutput, AudioChunk, TranscriptSegment } from './types';
import { ensureDir, cleanDir, generateOutputFilename } from './utils/fileUtils';
import * as fs from 'fs/promises';

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
    
    // Track what steps succeeded for logging
    const stepStatus = {
      download: false,
      transcription: false,
      highlights: false,
      summary: false,
      merged: false
    };

    try {
      // Step 1: Setup directories
      console.log('\n📁 STEP 1: Setting up directories...');
      await ensureDir(runTempDir);
      await ensureDir(outputDir);
      console.log(`Output directory: ${outputDir}`);
      
      const chunksDir = path.join(runTempDir, 'chunks');
      await ensureDir(chunksDir);

      // Step 2: Get video/audio metadata
      console.log('\n📊 STEP 2: Getting metadata...');
      let title = 'Unknown Title';
      let description = '';
      let duration: number | undefined = undefined;
      let thumbnail: string | undefined = undefined;
      let date: string | undefined = undefined;
      let people: string[] = [];
      let topics: string[] = [];
      try {
        const metadata = await this.downloader.getVideoInfo(options.url);
        title = metadata.title || metadata.fulltitle || 'Unknown Title';
        description = metadata.description || '';
        duration = metadata.duration;
        thumbnail = metadata.thumbnail;
        date = metadata.upload_date || metadata.release_date;
        console.log(`Title: ${title}`);
      } catch (error) {
        console.warn('⚠️ Could not fetch metadata, using default title');
      }

      // Step 3: Download audio
      console.log('\n⬇️  STEP 3: Downloading audio...');
      let downloadedPath: string;
      let downsampledPath: string;
      try {
        const audioPath = path.join(runTempDir, 'audio.mp3');
        downloadedPath = await this.downloader.downloadAudio(options.url, {
          outputPath: audioPath,
          format: 'mp3',
          showProgress: false
        });
        stepStatus.download = true;
      } catch (error) {
        console.error(`❌ Download failed: ${(error as Error).message}`);
        throw new Error(`Cannot continue without audio: ${(error as Error).message}`);
      }

      // Step 3.5: Downsample audio to 16 kHz mono
      console.log('\n🎚️  STEP 3.5: Downsampling audio to 16 kHz mono...');
      try {
        downsampledPath = path.join(runTempDir, 'audio_16k_mono.mp3');
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = require('fluent-ffmpeg');
          ffmpeg(downloadedPath)
            .audioChannels(1)
            .audioFrequency(16000)
            .audioCodec('libmp3lame')
            .output(downsampledPath)
            .on('end', () => {
              console.log('✅ Downsampling complete:', downsampledPath);
              resolve();
            })
            .on('error', (err: any) => {
              reject(new Error('Failed to downsample audio: ' + err.message));
            })
            .run();
        });
      } catch (error) {
        console.error(`❌ Downsampling failed: ${(error as Error).message}`);
        console.log('⚠️ Using original audio file without downsampling');
        downsampledPath = downloadedPath; // Fallback to original
      }

      // Step 4: Split audio into chunks
      console.log('\n✂️  STEP 4: Splitting audio into chunks...');
      let chunks: AudioChunk[] = [];
      try {
        chunks = await this.chunker.splitAudio(downsampledPath, chunksDir, chunkDuration);
      } catch (error) {
        console.error(`❌ Audio chunking failed: ${(error as Error).message}`);
        throw new Error(`Cannot continue without audio chunks: ${(error as Error).message}`);
      }

      // Step 5: Transcribe all chunks
      console.log('\n🎯 STEP 5: Transcribing audio chunks...');
      const chunkTranscriptions = await this.transcriber.transcribeAllChunks(chunks);
      const successfulChunks = chunkTranscriptions.filter(chunk => 
        chunk.segments.length > 0 && 
        !(chunk.segments.length === 1 && chunk.segments[0].text.startsWith('Error transcribing'))
      );
      
      if (successfulChunks.length > 0) {
        stepStatus.transcription = true;
        console.log(`✅ Successfully transcribed ${successfulChunks.length}/${chunks.length} chunks`);
      } else {
        console.error('❌ All transcription attempts failed');
        throw new Error('Cannot continue without any successful transcriptions');
      }
      
      // Save raw chunk transcriptions if saveAllTempFiles is enabled
      if (options.saveAllTempFiles) {
        console.log('\n📝 Saving raw chunk transcriptions for debugging...');
        const chunkTranscriptionsPath = path.join(runTempDir, 'chunk_transcriptions.json');
        await fs.writeFile(
          chunkTranscriptionsPath, 
          JSON.stringify(chunkTranscriptions, null, 2),
          'utf-8'
        );
        console.log(`  - Raw chunk transcriptions: ${chunkTranscriptionsPath}`);
      }

      // Step 6: Merge transcriptions
      console.log('\n🔀 STEP 6: Merging transcriptions...');
      let mergedSegments: TranscriptSegment[] = [];
      let identifiedSegments: TranscriptSegment[] = [];
      
      try {
        mergedSegments = this.merger.mergeTranscriptions(chunkTranscriptions);
        identifiedSegments = this.merger.normalizeSpeakers(mergedSegments);
        stepStatus.merged = true;
      } catch (error) {
        console.error(`❌ Merging failed: ${(error as Error).message}`);
        // Try a fallback method - just concatenate all segments
        console.log('⚠️ Using fallback merging method');
        mergedSegments = chunkTranscriptions.flatMap(chunk => chunk.segments);
        identifiedSegments = mergedSegments;
      }

      // Save raw merged segments if saveAllTempFiles is enabled
      if (options.saveAllTempFiles) {
        console.log('\n📝 Saving merged segments for debugging...');
        const mergedSegmentsPath = path.join(runTempDir, 'merged_segments.json');
        await fs.writeFile(
          mergedSegmentsPath, 
          JSON.stringify(mergedSegments, null, 2),
          'utf-8'
        );
        console.log(`  - Merged segments: ${mergedSegmentsPath}`);
        
        const identifiedSegmentsPath = path.join(runTempDir, 'identified_segments.json');
        await fs.writeFile(
          identifiedSegmentsPath, 
          JSON.stringify(identifiedSegments, null, 2),
          'utf-8'
        );
        console.log(`  - Identified segments: ${identifiedSegmentsPath}`);
      }

      // Step 7: Extract highlights and generate summary
      console.log('\n✨ STEP 7: Extracting highlights and generating summary...');
      let highlights: string[] = [];
      let summary = '';

      try {
        highlights = await this.highlightsExtractor.extractHighlights(identifiedSegments);
        stepStatus.highlights = true;
      } catch (error) {
        console.error(`❌ Highlight extraction failed: ${(error as Error).message}`);
        highlights = ["Highlight extraction failed. See transcript for details."];
      }

      try {
        summary = await this.highlightsExtractor.generateSummary(identifiedSegments);
        stepStatus.summary = true;
      } catch (error) {
        console.error(`❌ Summary generation failed: ${(error as Error).message}`);
        summary = "Summary generation failed. See transcript for details.";
      }

      // Step 7.5: Extract people and topics using Gemini
      let peopleAndTopics: { people: string[]; topics: string[] } = { people: [], topics: [] };
      try {
        peopleAndTopics = await this.highlightsExtractor.extractPeopleAndTopics(identifiedSegments, description || summary);
        people = peopleAndTopics.people;
        topics = peopleAndTopics.topics;
      } catch (error) {
        console.error(`❌ People/topics extraction failed: ${(error as Error).message}`);
        // Fallback: leave as empty arrays
      }

      // Step 8: Build final output
      console.log('\n📦 STEP 8: Building final output...');
      const finalOutput = await this.outputBuilder.buildOutput(
        title,
        options.url,
        identifiedSegments,
        highlights,
        summary,
        {
          description: description || summary,
          duration,
          people,
          topics,
          thumbnail,
          date
        }
      );

      // Step 9: Save output files
      console.log('\n💾 STEP 9: Saving output files...');
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
      
      await this.outputBuilder.saveTranscriptAsText(identifiedSegments, textPath);
      await this.outputBuilder.saveMetadataReport(finalOutput, reportPath);

      // Step 10: Cleanup (if requested)
      console.log('\n🧹 STEP 10: Finalizing...');
      if (options.saveAllTempFiles) {
        console.log('\n💾 Saving all temporary files for debugging:');
        console.log(`  - Temp directory: ${runTempDir}`);
        console.log(`  - Raw audio: ${downloadedPath}`);
        console.log(`  - Downsampled audio: ${downsampledPath}`);
        console.log(`  - Chunks directory: ${chunksDir}`);
      } else if (!options.keepChunks) {
        console.log('\n🧹 Cleaning up temporary files...');
        await this.chunker.cleanupChunks(chunks);
        await cleanDir(chunksDir);
      }

      // Generate success/partial success message
      if (Object.values(stepStatus).every(status => status === true)) {
        console.log('\n✅ Process completed successfully!');
      } else {
        console.log('\n⚠️ Process completed with some issues.');
        console.log('Some steps encountered errors but the process was able to continue.');
      }
      
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