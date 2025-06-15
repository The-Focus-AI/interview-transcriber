#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { AudioProcessor } from './processor';
import { ProcessingOptions } from './types';

const program = new Command();

program
  .name('audio-transcriber')
  .description('YouTube/Podcast Audio Downloader, Transcriber & Summarizer')
  .version('1.0.0');

// Redirect all logs to stderr except for final output
const origLog = console.log;
const origWarn = console.warn;
console.log = (...args: any[]) => { process.stderr.write(args.map(String).join(' ') + '\n'); };
console.warn = (...args: any[]) => { process.stderr.write(args.map(String).join(' ') + '\n'); };

program
  .argument('<url>', 'YouTube URL or direct MP3 URL to process')
  .option('-o, --output <path>', 'Output file path (default: ./output/transcript_[timestamp].json)')
  .option('-t, --temp-dir <path>', 'Temporary directory for processing (default: ./temp)')
  .option('-c, --chunk-duration <seconds>', 'Duration of each chunk in seconds (default: 600)', parseInt)
  .option('-k, --keep-chunks', 'Keep temporary audio chunks after processing')
  .option('-s, --save-temp-files', 'Keep all temporary files including raw audio, downsampled audio, chunks, and intermediate files')
  .option('--no-text', 'Skip generating text transcript file')
  .option('--no-report', 'Skip generating metadata report file')
  .action(async (url: string, options: any) => {
    try {
      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.error('❌ Error: Please provide a valid URL');
        process.exit(1);
      }

      // Check for API key
      if (!process.env.GEMINI_API_KEY) {
        console.error('❌ Error: GEMINI_API_KEY environment variable is not set');
        console.error('Please set it in your .env file or environment');
        process.exit(1);
      }

      // Prepare processing options
      const processingOptions: ProcessingOptions = {
        url: url,
        outputPath: options.output,
        tempDir: options.tempDir,
        chunkDuration: options.chunkDuration,
        keepChunks: options.keepChunks || false,
        saveAllTempFiles: options.saveTempFiles || false
      };

      // Create processor and run
      const processor = new AudioProcessor();
      const result = await processor.processAudio(processingOptions);

      // Print the final JSON to stdout
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      origLog('\n🎉 Success! Transcription completed.');
      
    } catch (error) {
      console.error('\n❌ Error:', (error as Error).message);
      if (process.env.DEBUG) {
        console.error(error);
      }
      process.exit(1);
    }
  });

// Add info command to check dependencies
program
  .command('info')
  .description('Display information about required dependencies')
  .action(() => {
    console.log('\n📋 Audio Transcriber - Dependency Information\n');
    console.log('Required dependencies:');
    console.log('  ✓ Node.js (you have this!)');
    console.log('  ✓ pnpm (package manager)');
    console.log('  ⚠️  yt-dlp (required for YouTube downloads)');
    console.log('  ⚠️  ffmpeg (required for audio processing)');
    console.log('  ⚠️  Google Gemini API key (required for transcription)');
    console.log('\nTo install pnpm:');
    console.log('  npm install -g pnpm');
    console.log('\nTo install yt-dlp:');
    console.log('  - macOS: brew install yt-dlp');
    console.log('  - Ubuntu/Debian: sudo apt install yt-dlp');
    console.log('  - Windows: Download from https://github.com/yt-dlp/yt-dlp/releases');
    console.log('\nTo install ffmpeg:');
    console.log('  - macOS: brew install ffmpeg');
    console.log('  - Ubuntu/Debian: sudo apt install ffmpeg');
    console.log('  - Windows: Download from https://ffmpeg.org/download.html');
    console.log('\nTo get a Google Gemini API key:');
    console.log('  Visit: https://makersuite.google.com/app/apikey');
  });

// Add test command
program
  .command('test')
  .description('Test the setup with a sample audio file')
  .action(async () => {
    console.log('\n🧪 Testing Audio Transcriber Setup...\n');
    
    try {
      // Check API key
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not found in environment');
      }
      console.log('✅ Google Gemini API key found');

      // Test with a short public domain audio
      const testUrl = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Big Buck Bunny trailer
      console.log(`\n🎬 Testing with: ${testUrl}`);
      console.log('This is a short test video...\n');

      const processor = new AudioProcessor();
      const testOptions: ProcessingOptions = {
        url: testUrl,
        outputPath: './test_output.json',
        chunkDuration: 60 // 1 minute chunks for testing
      };

      await processor.processAudio(testOptions);
      console.log('\n✅ Test completed successfully!');

    } catch (error) {
      console.error('\n❌ Test failed:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}