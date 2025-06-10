import YTDlpWrap from 'yt-dlp-wrap';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DownloadOptions } from '../types';
import { fileExists } from '../utils/fileUtils';

export class AudioDownloader {
  private ytDlpWrap: YTDlpWrap;

  constructor(ytDlpPath?: string) {
    this.ytDlpWrap = new YTDlpWrap(ytDlpPath);
  }

  async downloadAudio(url: string, options: DownloadOptions): Promise<string> {
    try {
      // Check if it's a YouTube URL or direct MP3 URL
      if (this.isDirectMP3Url(url)) {
        return await this.downloadDirectMP3(url, options.outputPath);
      } else {
        return await this.downloadYouTubeAudio(url, options);
      }
    } catch (error) {
      throw new Error(`Failed to download audio: ${(error as Error).message}`);
    }
  }

  private isDirectMP3Url(url: string): boolean {
    return url.toLowerCase().endsWith('.mp3') || url.includes('.mp3?');
  }

  private async downloadDirectMP3(url: string, outputPath: string): Promise<string> {
    console.log(`Downloading MP3 from: ${url}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const writer = (await import('fs')).createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Downloaded MP3 to: ${outputPath}`);
        resolve(outputPath);
      });
      writer.on('error', reject);
    });
  }

  private async downloadYouTubeAudio(url: string, options: DownloadOptions): Promise<string> {
    console.log(`Downloading audio from YouTube: ${url}`);

    const format = options.format || 'mp3';
    const ytDlpOptions = [
      url,
      '-x', // Extract audio
      '--audio-format', format,
      '--audio-quality', '0', // Best quality
      '-o', options.outputPath,
      '--no-playlist', // Download only the video, not the playlist
      '--no-check-certificate',
      '--prefer-ffmpeg',
      '--add-metadata',
      '--embed-thumbnail',
      '--ppa', 'EmbedThumbnail: --atomic',
    ];

    return new Promise((resolve, reject) => {
      const ytDlpProcess = this.ytDlpWrap
        .exec(ytDlpOptions)
        .on('progress', (progress) => {
          if (progress.percent) {
            process.stdout.write(`\rDownloading: ${progress.percent}%`);
          }
        })
        .on('error', (error) => {
          reject(new Error(`yt-dlp error: ${error.message}`));
        })
        .on('close', async () => {
          process.stdout.write('\n');
          
          // Check if file was created with the expected extension
          if (await fileExists(options.outputPath)) {
            console.log(`Downloaded audio to: ${options.outputPath}`);
            resolve(options.outputPath);
          } else {
            // yt-dlp might have added extension automatically
            const pathWithExt = `${options.outputPath}.${format}`;
            if (await fileExists(pathWithExt)) {
              console.log(`Downloaded audio to: ${pathWithExt}`);
              resolve(pathWithExt);
            } else {
              reject(new Error('Failed to find downloaded audio file'));
            }
          }
        });
    });
  }

  async getVideoInfo(url: string): Promise<any> {
    try {
      const metadata = await this.ytDlpWrap.getVideoInfo(url);
      return metadata;
    } catch (error) {
      throw new Error(`Failed to get video info: ${(error as Error).message}`);
    }
  }
}