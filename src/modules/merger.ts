import { ChunkTranscription, TranscriptSegment } from '../types';

export class Merger {
  mergeTranscriptions(chunkTranscriptions: ChunkTranscription[]): TranscriptSegment[] {
    console.log('Merging transcriptions from all chunks...');

    // Sort chunks by index to ensure correct order
    const sortedChunks = [...chunkTranscriptions].sort((a, b) => a.chunkIndex - b.chunkIndex);

    // Flatten all segments from all chunks
    const allSegments: TranscriptSegment[] = [];
    
    for (const chunk of sortedChunks) {
      allSegments.push(...chunk.segments);
    }

    // Post-process to ensure continuity and clean up
    const mergedSegments = this.postProcessSegments(allSegments);

    console.log(`Merged ${chunkTranscriptions.length} chunks into ${mergedSegments.length} segments`);
    return mergedSegments;
  }

  private postProcessSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
    if (segments.length === 0) return [];

    const processed: TranscriptSegment[] = [];
    let currentSegment: TranscriptSegment | null = null;

    for (const segment of segments) {
      // Skip empty segments
      if (!segment.text || segment.text.trim() === '') {
        continue;
      }

      // If this is the first segment or speaker/tone changed, start a new segment
      if (!currentSegment || 
          currentSegment.speaker !== segment.speaker || 
          currentSegment.tone !== segment.tone) {
        
        if (currentSegment) {
          processed.push(currentSegment);
        }
        
        currentSegment = {
          start: segment.start,
          end: segment.end,
          speaker: segment.speaker,
          tone: segment.tone,
          text: segment.text.trim()
        };
      } else {
        // Same speaker and tone, merge the segments
        currentSegment.end = segment.end;
        currentSegment.text += ' ' + segment.text.trim();
      }
    }

    // Don't forget the last segment
    if (currentSegment) {
      processed.push(currentSegment);
    }

    return processed;
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