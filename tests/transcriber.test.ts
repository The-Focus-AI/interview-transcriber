import { Transcriber } from "../src/modules/transcriber";
import { AudioChunk } from "../src/types";

// Mock the GoogleGenerativeAI to avoid actual API calls
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue(
            JSON.stringify([
              {
                timestamp: "00:00",
                ad: false,
                speaker: "Test Speaker",
                text: "Test transcription",
                tone: "neutral",
              },
            ])
          ),
        },
      }),
    }),
  })),
}));

describe("Transcriber", () => {
  let transcriber: Transcriber;
  let mockChunks: AudioChunk[];

  beforeEach(() => {
    transcriber = new Transcriber({ apiKey: "test-key" });

    // Create mock chunks
    mockChunks = [
      {
        path: "/tmp/chunk_000.mp3",
        index: 0,
        startTime: 0,
        duration: 600,
      },
      {
        path: "/tmp/chunk_001.mp3",
        index: 1,
        startTime: 600,
        duration: 600,
      },
      {
        path: "/tmp/chunk_002.mp3",
        index: 2,
        startTime: 1200,
        duration: 600,
      },
    ];
  });

  describe("transcribeAllChunks", () => {
    it("should process chunks with default concurrency of 5", async () => {
      const startTime = Date.now();
      const result = await transcriber.transcribeAllChunks(mockChunks);
      const endTime = Date.now();

      expect(result).toHaveLength(3);
      expect(result[0].chunkIndex).toBe(0);
      expect(result[1].chunkIndex).toBe(1);
      expect(result[2].chunkIndex).toBe(2);

      // Should complete faster than sequential processing
      // (3 chunks * 500ms delay = 1.5s minimum for sequential)
      // Parallel should be much faster
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
    });

    it("should process chunks with custom concurrency", async () => {
      const startTime = Date.now();
      const result = await transcriber.transcribeAllChunks(mockChunks, 2);
      const endTime = Date.now();

      expect(result).toHaveLength(3);

      // With concurrency of 2, should still be faster than sequential
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(3000); // Should complete in under 3 seconds
    });

    it("should handle errors gracefully and continue processing other chunks", async () => {
      // Mock one chunk to fail
      const mockModel = transcriber["model"];
      let callCount = 0;
      mockModel.generateContent = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error("API Error");
        }
        return {
          response: {
            text: jest.fn().mockReturnValue(
              JSON.stringify([
                {
                  timestamp: "00:00",
                  ad: false,
                  speaker: "Test Speaker",
                  text: "Test transcription",
                  tone: "neutral",
                },
              ])
            ),
          },
        };
      });

      const result = await transcriber.transcribeAllChunks(mockChunks);

      // Should still return results for successful chunks
      expect(result).toHaveLength(3);
      expect(result[1].segments[0].text).toContain("Error transcribing");
    });
  });
});
