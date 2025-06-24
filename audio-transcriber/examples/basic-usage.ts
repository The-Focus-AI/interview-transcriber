import { AudioProcessor } from "../src";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Create processor instance
    const processor = new AudioProcessor();

    // Example 1: Process a YouTube video
    console.log("Example 1: Processing a YouTube video...\n");

    const youtubeOptions = {
      url: "https://www.youtube.com/watch?v=aqz-KE-bpKQ", // Big Buck Bunny trailer
      outputPath: "./output/youtube_example.json",
      chunkDuration: 300, // 5 minutes chunks
      concurrency: 5, // Process 5 chunks in parallel
    };

    const youtubeResult = await processor.processAudio(youtubeOptions);
    console.log("\nTitle:", youtubeResult.title);
    console.log("Number of segments:", youtubeResult.full_transcript.length);
    console.log("Number of highlights:", youtubeResult.highlights.length);

    // Example 2: Process a direct MP3 URL (commented out - replace with actual URL)
    /*
    console.log('\n\nExample 2: Processing a direct MP3 URL...\n');
    
    const mp3Options = {
      url: 'https://example.com/podcast.mp3',
      outputPath: './output/mp3_example.json',
      chunkDuration: 600, // 10 minutes chunks
      concurrency: 5, // Process 5 chunks in parallel for faster processing
      keepChunks: true // Keep audio chunks for inspection
    };

    const mp3Result = await processor.processAudio(mp3Options);
    console.log('\nTitle:', mp3Result.title);
    console.log('Summary:', mp3Result.summary);
    */
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the examples
main();
