import * as fs from 'fs/promises';
import * as path from 'path';
import { FinalOutput, TranscriptSegment } from '../types';
import { ensureDir } from '../utils/fileUtils';

export class OutputBuilder {
  async buildOutput(
    title: string,
    sourceUrl: string,
    segments: TranscriptSegment[],
    highlights: string[],
    summary: string
  ): Promise<FinalOutput> {
    console.log('Building final output...');

    const output: FinalOutput = {
      title: title,
      source_url: sourceUrl,
      full_transcript: segments,
      highlights: highlights,
      summary: summary
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