import { GoogleGenerativeAI } from '@google/generative-ai';
import { TranscriptSegment } from '../types';

export class HighlightsExtractor {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async extractHighlights(segments: TranscriptSegment[]): Promise<string[]> {
    console.log('Extracting highlights from transcript...');

    // Combine all text for analysis
    const fullText = segments.map(seg => seg.text).join('\n\n');

    const prompt = `Analyze the following transcript and extract the key highlights. 
Focus on:
1. Main themes and topics discussed
2. Important statements or conclusions
3. Notable quotes or memorable moments
4. Key decisions or action items mentioned
5. Significant emotional moments or turning points

Provide a list of 5-10 concise highlights (one sentence each).
Format as a JSON array of strings.

Transcript:
${fullText}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Parse the JSON response
      const jsonText = text.match(/\[[\s\S]*\]/)?.[0] || text;
      const highlights = JSON.parse(jsonText);

      if (Array.isArray(highlights)) {
        console.log(`Extracted ${highlights.length} highlights`);
        return highlights.filter((h: any) => typeof h === 'string' && h.trim() !== '');
      }

      throw new Error('Invalid highlights format');
    } catch (error) {
      console.error('Failed to extract highlights:', error);
      // Fallback: extract some basic highlights manually
      return this.extractBasicHighlights(segments);
    }
  }

  async generateSummary(segments: TranscriptSegment[]): Promise<string> {
    console.log('Generating summary of transcript...');

    const fullText = segments.map(seg => `[${seg.speaker}]: ${seg.text}`).join('\n\n');

    const prompt = `Create a comprehensive summary of the following transcript.
The summary should:
1. Capture the main topics and themes
2. Highlight key points and conclusions
3. Mention important speakers and their contributions
4. Be concise but thorough (2-3 paragraphs)
5. Maintain the context and flow of the conversation

Transcript:
${fullText}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const summary = response.text().trim();

      console.log('Summary generated successfully');
      return summary;
    } catch (error) {
      console.error('Failed to generate summary:', error);
      return 'Summary generation failed. Please review the transcript for details.';
    }
  }

  private extractBasicHighlights(segments: TranscriptSegment[]): string[] {
    console.log('Using fallback highlight extraction...');
    
    const highlights: string[] = [];
    
    // Extract segments with strong emotional tones
    const emotionalSegments = segments.filter(seg => 
      seg.tone && ['excited', 'angry', 'sad', 'surprised'].includes(seg.tone.toLowerCase())
    );
    
    if (emotionalSegments.length > 0) {
      highlights.push(`Emotional moment: ${emotionalSegments[0].text.substring(0, 100)}...`);
    }

    // Extract longest segments (likely important topics)
    const sortedByLength = [...segments].sort((a, b) => b.text.length - a.text.length);
    for (let i = 0; i < Math.min(3, sortedByLength.length); i++) {
      const text = sortedByLength[i].text;
      if (text.length > 50) {
        highlights.push(`Key topic discussed: ${text.substring(0, 80)}...`);
      }
    }

    // Extract segments with questions
    const questions = segments.filter(seg => seg.text.includes('?'));
    if (questions.length > 0) {
      highlights.push(`Question raised: ${questions[0].text.substring(0, 80)}...`);
    }

    return highlights.slice(0, 5);
  }

  analyzeTopics(segments: TranscriptSegment[]): string[] {
    console.log('Analyzing topics in transcript...');

    // Simple topic extraction based on word frequency
    const wordFreq = new Map<string, number>();
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);

    for (const segment of segments) {
      const words = segment.text.toLowerCase().split(/\s+/);
      for (const word of words) {
        const cleaned = word.replace(/[^a-z0-9]/g, '');
        if (cleaned.length > 3 && !stopWords.has(cleaned)) {
          wordFreq.set(cleaned, (wordFreq.get(cleaned) || 0) + 1);
        }
      }
    }

    // Sort by frequency and get top words
    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return sortedWords;
  }
}