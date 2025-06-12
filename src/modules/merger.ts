import { ChunkTranscription, TranscriptSegment } from '../types';
import { adjustTimestamp, timestampToSeconds, secondsToTimestamp } from '../utils/timeUtils';

export class Merger {
  mergeTranscriptions(chunkTranscriptions: ChunkTranscription[]): TranscriptSegment[] {
    console.log('Merging transcriptions from all chunks...');

    // Sort chunks by index to ensure correct order
    const sortedChunks = [...chunkTranscriptions].sort((a, b) => a.chunkIndex - b.chunkIndex);

    // Adjust timestamps and flatten all segments
    const allSegments: TranscriptSegment[] = [];
    for (const chunk of sortedChunks) {
      for (const segment of chunk.segments) {
        // Convert timestamp (MM:SS) to seconds, add chunk.startTime, then back to timestamp format
        // timestampToSeconds handles both MM:SS and HH:MM:SS formats
        const absSeconds = timestampToSeconds(segment.timestamp) + chunk.startTime;
        
        // Format as MM:SS or HH:MM:SS based on the total duration
        // For simplicity, we use HH:MM:SS for consistency
        allSegments.push({
          ...segment,
          timestamp: secondsToTimestamp(absSeconds)
        });
      }
    }

    // Sort by absolute timestamp
    allSegments.sort((a, b) => timestampToSeconds(a.timestamp) - timestampToSeconds(b.timestamp));

    console.log(`Merged ${chunkTranscriptions.length} chunks into ${allSegments.length} utterances`);
    return allSegments;
  }

  identifySpeakers(segments: TranscriptSegment[]): TranscriptSegment[] {
    console.log('Attempting to identify consistent speakers across segments...');

    // This is a simple implementation that tries to maintain speaker consistency
    // In a real-world scenario, you might use voice fingerprinting or more advanced techniques

    const speakerMap = new Map<string, string>();
    let speakerCounter = 1;

    return segments.map(segment => {
      // If speaker is already identified with a number, keep it
      if (segment.speaker && /^Speaker \d+$/.test(segment.speaker)) {
        return segment;
      }

      // If speaker is unknown or generic, assign a consistent label
      if (!segment.speaker || segment.speaker === 'Unknown') {
        if (!speakerMap.has('default')) {
          speakerMap.set('default', `Speaker ${speakerCounter++}`);
        }
        return {
          ...segment,
          speaker: speakerMap.get('default')!
        };
      }

      // For other speaker labels, maintain consistency
      if (!speakerMap.has(segment.speaker)) {
        speakerMap.set(segment.speaker, `Speaker ${speakerCounter++}`);
      }

      return {
        ...segment,
        speaker: speakerMap.get(segment.speaker)!
      };
    });
  }
}