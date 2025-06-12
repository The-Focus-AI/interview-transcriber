import { GoogleGenerativeAI } from '@google/generative-ai';
import { TranscriptSegment } from '../types';

export class HighlightsExtractor {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private maxRetries = 3;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'models/gemini-2.5-flash-preview-05-20' 
    });
  }

  private async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T> {
    let retries = 0;
    
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        retries++;
        
        if (retries > this.maxRetries) {
          console.error(`${errorMessage}: ${error.message}`);
          throw error;
        }
        
        // Calculate delay: 1s, 2s, 4s, etc.
        const delay = Math.pow(2, retries - 1) * 1000;
        console.log(`Retry attempt ${retries}/${this.maxRetries} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async extractHighlights(segments: TranscriptSegment[]): Promise<string[]> {
    console.log('Extracting key highlights from transcript...');

    try {
      // Limit transcript size if too large to avoid token limits
      const maxSegments = 500;
      const usedSegments = segments.length > maxSegments 
        ? [
            ...segments.slice(0, Math.floor(maxSegments/2)), 
            ...segments.slice(segments.length - Math.floor(maxSegments/2))
          ]
        : segments;

      console.log(`Using ${usedSegments.length}/${segments.length} segments for highlights extraction`);
      
      const transcriptText = usedSegments
        .map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
        .join('\n\n');

      const prompt = `Extract EXACTLY 3-5 key highlights from this transcript. 
Focus on the most important points, insights, or memorable quotes.

YOUR RESPONSE MUST:
1. Be ONLY a bullet point list with each highlight as a separate bullet
2. Start each bullet with "• " or "- "
3. Be concise (1-2 sentences per highlight)
4. NOT include timestamps or speaker names
5. Focus on content of substantive value

Here is the transcript:
${transcriptText}`;

      const operation = async () => {
        console.log('Sending highlight extraction request to API...');
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();
        console.log('Received highlight extraction response:');
        console.log('---');
        console.log(text);
        console.log('---');

        // Try multiple parsing approaches to extract highlights
        // 1. Find bullet points with • or -
        const bulletPoints = text.split('\n')
          .filter((line: string) => line.trim().startsWith('•') || line.trim().startsWith('-'))
          .map((line: string) => line.trim().replace(/^[•\-]\s*/, '').trim());
          
        if (bulletPoints.length >= 1) {
          console.log(`Extracted ${bulletPoints.length} bullet point highlights`);
          return bulletPoints;
        }

        // 2. Try numbered list (1. 2. 3.)
        const numberedPoints = text.split('\n')
          .filter((line: string) => /^\d+\./.test(line.trim()))
          .map((line: string) => line.trim().replace(/^\d+\.\s*/, '').trim());
          
        if (numberedPoints.length >= 1) {
          console.log(`Extracted ${numberedPoints.length} numbered highlights`);
          return numberedPoints;
        }

        // 3. Last resort: split by newlines and filter out empty lines
        const lines = text.split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 15 && !line.toLowerCase().includes('highlight'));
          
        if (lines.length >= 1) {
          console.log(`Extracted ${lines.length} highlights by line splitting`);
          return lines.slice(0, 5); // Limit to 5 max
        }

        // If all parsing fails, throw
        throw new Error('Could not parse highlights from model response');
      };

      let highlights = await this.retryWithExponentialBackoff(
        operation,
        "Failed to extract highlights"
      );
      
      // Apply post-processing to clean up highlights
      highlights = highlights
        .map((h: string) => h.trim())
        .filter((h: string) => h.length > 0)
        .map((h: string) => h.endsWith('.') ? h : `${h}.`);
        
      // Ensure we have at least some highlights
      if (highlights.length === 0) {
        console.warn('No highlights extracted from model response, using fallback');
        return this.extractFallbackHighlights(segments);
      }
      
      // Limit to 5 max highlights
      return highlights.slice(0, 5);

    } catch (error) {
      console.warn('Failed to extract highlights:', error);
      console.log('Using fallback highlight extraction...');
      
      return this.extractFallbackHighlights(segments);
    }
  }

  private extractFallbackHighlights(segments: TranscriptSegment[]): string[] {
    console.log('Generating fallback highlights from transcript');
    const highlights: string[] = [];
    
    if (segments.length === 0) {
      console.warn('No segments available for fallback highlights');
      return ["No transcript available for highlight extraction."];
    }
    
    // Try to get interesting segments based on length and content
    const candidateSegments = segments
      .filter(s => s.text.length > 30)
      .sort((a, b) => b.text.length - a.text.length)
      .slice(0, 20); // Take top 20 longest segments as candidates
    
    // Extract approximately 3-5 highlights
    const step = Math.max(1, Math.floor(candidateSegments.length / 4));
    
    for (let i = 0; i < candidateSegments.length; i += step) {
      const text = candidateSegments[i].text;
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      
      if (sentences.length > 0) {
        const highlight = `${sentences[0].trim()}.`;
        highlights.push(highlight);
        console.log(`Added fallback highlight: ${highlight}`);
      }
      
      if (highlights.length >= 5) break;
    }
    
    // If we still don't have highlights, use topic analysis
    if (highlights.length === 0) {
      const topics = this.analyzeTopics(segments);
      if (topics.length > 0) {
        highlights.push(`The transcript discusses topics including: ${topics.slice(0, 5).join(', ')}.`);
      }
    }
    
    // Ensure we have at least one highlight
    if (highlights.length === 0) {
      highlights.push(`Transcript contains ${segments.length} segments with content from ${segments[0].speaker}.`);
    }
    
    console.log(`Generated ${highlights.length} fallback highlights`);
    return highlights;
  }

  async generateSummary(segments: TranscriptSegment[]): Promise<string> {
    console.log('Generating summary of transcript...');

    try {
      const transcriptText = segments
        .map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
        .join('\n\n');

      const prompt = `Write a concise summary of this transcript in 2-3 paragraphs. Focus on the main topics discussed, key points, and overall themes.
      
Transcript:
${transcriptText}`;

      const operation = async () => {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
      };

      return await this.retryWithExponentialBackoff(
        operation,
        "Failed to generate summary"
      );

    } catch (error) {
      console.warn('Failed to generate summary:', error);
      
      // Return a simple fallback summary
      return this.generateFallbackSummary(segments);
    }
  }

  private generateFallbackSummary(segments: TranscriptSegment[]): string {
    if (segments.length === 0) {
      return "No transcript segments available for summarization.";
    }
    
    // Determine the main speakers 
    const speakerCounts = new Map<string, number>();
    segments.forEach(s => {
      const count = speakerCounts.get(s.speaker) || 0;
      speakerCounts.set(s.speaker, count + 1);
    });
    
    const sortedSpeakers = Array.from(speakerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])
      .slice(0, 2);
    
    // Generate a simple summary based on basic info
    return `This transcript contains a conversation between ${
      sortedSpeakers.join(' and ')
    }. The transcript includes ${segments.length} segments, starting at ${
      segments[0].timestamp
    } and ending at ${segments[segments.length - 1].timestamp}.`;
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