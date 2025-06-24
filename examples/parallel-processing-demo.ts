import { AudioProcessor } from "../src";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  try {
    // Create processor instance
    const processor = new AudioProcessor();

    console.log("🚀 Parallel Processing Demo\n");

    // Example: Process with different concurrency levels
    const testUrl = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"; // Short test video

    // Test with sequential processing (concurrency = 1)
    console.log("📊 Test 1: Sequential Processing (concurrency = 1)");
    const startTime1 = Date.now();
    const result1 = await processor.processAudio({
      url: testUrl,
      outputPath: "./output/sequential_test.json",
      chunkDuration: 60, // 1 minute chunks
      concurrency: 1,
    });
    const duration1 = Date.now() - startTime1;
    console.log(`✅ Completed in ${duration1}ms\n`);

    // Test with parallel processing (concurrency = 5)
    console.log("📊 Test 2: Parallel Processing (concurrency = 5)");
    const startTime2 = Date.now();
    const result2 = await processor.processAudio({
      url: testUrl,
      outputPath: "./output/parallel_test.json",
      chunkDuration: 60, // 1 minute chunks
      concurrency: 5,
    });
    const duration2 = Date.now() - startTime2;
    console.log(`✅ Completed in ${duration2}ms\n`);

    // Test with high concurrency (concurrency = 8)
    console.log("📊 Test 3: High Concurrency (concurrency = 8)");
    const startTime3 = Date.now();
    const result3 = await processor.processAudio({
      url: testUrl,
      outputPath: "./output/high_concurrency_test.json",
      chunkDuration: 60, // 1 minute chunks
      concurrency: 8,
    });
    const duration3 = Date.now() - startTime3;
    console.log(`✅ Completed in ${duration3}ms\n`);

    // Summary
    console.log("📈 Performance Summary:");
    console.log(`Sequential (1): ${duration1}ms`);
    console.log(`Parallel (5):   ${duration2}ms`);
    console.log(`High (8):       ${duration3}ms`);

    const speedup1 = (((duration1 - duration2) / duration1) * 100).toFixed(1);
    const speedup2 = (((duration1 - duration3) / duration1) * 100).toFixed(1);

    console.log(`\n🚀 Speedup with concurrency=5: ${speedup1}% faster`);
    console.log(`🚀 Speedup with concurrency=8: ${speedup2}% faster`);

    console.log("\n💡 Tips:");
    console.log(
      "- Higher concurrency = faster processing but may hit API rate limits"
    );
    console.log("- Start with concurrency=5 for most use cases");
    console.log("- Use concurrency=1 if you experience API errors");
    console.log("- Monitor your API usage when using high concurrency");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the demo
main();
