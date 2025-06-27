import { ChunkTranscription, TranscriptSegment } from '../types';
import { adjustTimestamp, timestampToSeconds, secondsToTimestamp } from '../utils/timeUtils';
import { normalizeSpeakerNames } from './transcriber';

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

  normalizeSpeakers(segments: TranscriptSegment[]): TranscriptSegment[] {
    console.log('Normalizing speaker names across all segments...');
    return normalizeSpeakerNames(segments);
  }
}