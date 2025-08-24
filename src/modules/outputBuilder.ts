import * as fs from 'fs/promises';
import * as path from 'path';
import { FinalOutput, TranscriptSegment } from '../types';
import { ensureDir } from '../utils/fileUtils';

function extractNamesFromText(text: string): string[] {
  // Simple regex for capitalized names (First Last)
  const nameRegex = /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
  const matches = text.match(nameRegex) || [];
  // Remove duplicates
  return Array.from(new Set(matches));
}

function limitTopics(topics: string[], max: number = 5): string[] {
  return topics.slice(0, max);
}

export class OutputBuilder {
  async buildOutput(
    title: string,
    sourceUrl: string,
    segments: TranscriptSegment[],
    highlights: string[],
    summary: string,
    {
      description,
      duration,
      people,
      topics,
      thumbnail,
      date,
      spotifyInfo,
      youtubeUrl,
      youtubeMetadata
    }: {
      description?: string;
      duration?: number;
      people?: string[];
      topics?: string[];
      thumbnail?: string;
      date?: string;
      spotifyInfo?: any;
      youtubeUrl?: string;
      youtubeMetadata?: any;
    } = {}
  ): Promise<FinalOutput> {
    console.log('Building final output...');

    // Extract names from description and add to people if not already present
    let allPeople = people ? [...people] : [];
    if (description) {
      const namesInDescription = extractNamesFromText(description);
      for (const name of namesInDescription) {
        if (!allPeople.includes(name)) {
          allPeople.push(name);
        }
      }
    }
    // Remove duplicates
    allPeople = Array.from(new Set(allPeople));

    // Limit topics to top 3-5
    const limitedTopics = topics ? limitTopics(topics, 5) : [];

    const output: FinalOutput = {
      title: title,
      source_url: sourceUrl,
      full_transcript: segments,
      highlights: highlights,
      summary: summary,
      description: description || summary,
      duration,
      people: allPeople,
      topics: limitedTopics,
      thumbnail,
      date,
      ...(spotifyInfo && { spotify_info: spotifyInfo }),
      ...(youtubeUrl && { youtube_url: youtubeUrl }),
      ...(youtubeMetadata && { youtube_metadata: youtubeMetadata })
    };

    return output;
  }

  async saveToFile(output: FinalOutput, filePath: string): Promise<void> {
    console.log(`Saving output to ${filePath}...`);

    // Ensure the directory exists
    const dir = path.dirname(filePath);
    await ensureDir(dir);

    // Convert to pretty JSON
    const jsonContent = JSON.stringify(output, null, 2);

    // Save to file
    await fs.writeFile(filePath, jsonContent, 'utf-8');

    console.log(`Output saved successfully to ${filePath}`);
    console.log(`File size: ${(jsonContent.length / 1024).toFixed(2)} KB`);
  }

  async saveTranscriptAsText(
    segments: TranscriptSegment[],
    filePath: string,
    includeMetadata: boolean = true
  ): Promise<void> {
    console.log(`Saving transcript as text to ${filePath}...`);

    const dir = path.dirname(filePath);
    await ensureDir(dir);

    let content = '';

    if (includeMetadata) {
      // Add header with metadata
      content += 'TRANSCRIPT\n';
      content += '==========\n\n';
    }

    // Format transcript
    for (const segment of segments) {
      if (includeMetadata) {
        content += `[${segment.timestamp}]\n`;
        content += `Ad: ${segment.ad ? 'Yes' : 'No'}\n`;
        content += `Speaker: ${segment.speaker}\n`;
        content += `Tone: ${segment.tone}\n\n`;
      }
      content += `${segment.text}\n\n`;
      if (includeMetadata) {
        content += '---\n\n';
      }
    }

    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Text transcript saved to ${filePath}`);
  }

  async saveMetadataReport(
    output: FinalOutput,
    filePath: string
  ): Promise<void> {
    console.log(`Saving metadata report to ${filePath}...`);

    const dir = path.dirname(filePath);
    await ensureDir(dir);

    let report = 'AUDIO TRANSCRIPTION REPORT\n';
    report += '==========================\n\n';
    
    report += `Title: ${output.title}\n`;
    report += `Source: ${output.source_url}\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += 'SUMMARY\n';
    report += '-------\n';
    report += `${output.summary}\n\n`;

    report += 'DESCRIPTION\n';
    report += '-----------\n';
    report += `${output.description || ''}\n\n`;

    report += 'DURATION\n';
    report += '--------\n';
    report += `${output.duration ? output.duration + ' seconds' : 'N/A'}\n\n`;

    report += 'PEOPLE\n';
    report += '------\n';
    report += `${output.people && output.people.length > 0 ? output.people.join(', ') : 'N/A'}\n\n`;

    report += 'TOPICS\n';
    report += '------\n';
    report += `${output.topics && output.topics.length > 0 ? output.topics.join(', ') : 'N/A'}\n\n`;

    report += 'THUMBNAIL\n';
    report += '---------\n';
    report += `${output.thumbnail || 'N/A'}\n\n`;

    report += 'DATE\n';
    report += '----\n';
    report += `${output.date || 'N/A'}\n\n`;

    report += 'KEY HIGHLIGHTS\n';
    report += '--------------\n';
    for (const highlight of output.highlights) {
      report += `• ${highlight}\n`;
    }
    report += '\n';

    report += 'STATISTICS\n';
    report += '----------\n';
    report += `Total segments: ${output.full_transcript.length}\n`;
    
    // Calculate unique speakers
    const speakers = new Set(output.full_transcript.map(s => s.speaker));
    report += `Number of speakers: ${speakers.size}\n`;
    report += `Speakers: ${Array.from(speakers).join(', ')}\n\n`;

    // Calculate tone distribution
    const tones = new Map<string, number>();
    for (const segment of output.full_transcript) {
      const tone = segment.tone || 'Unknown';
      tones.set(tone, (tones.get(tone) || 0) + 1);
    }
    
    report += 'TONE DISTRIBUTION\n';
    report += '-----------------\n';
    for (const [tone, count] of tones.entries()) {
      const percentage = ((count / output.full_transcript.length) * 100).toFixed(1);
      report += `${tone}: ${count} segments (${percentage}%)\n`;
    }

    await fs.writeFile(filePath, report, 'utf-8');
    console.log(`Metadata report saved to ${filePath}`);
  }
}