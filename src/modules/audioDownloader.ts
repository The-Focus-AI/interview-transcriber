import YTDlpWrap from 'yt-dlp-wrap';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { DownloadOptions as BaseDownloadOptions } from '../types';
import { fileExists } from '../utils/fileUtils';
import { SpotifyDownloader } from './spotifyDownloader';

export interface DownloadOptions extends BaseDownloadOptions {
  showProgress?: boolean;
}

export class AudioDownloader {
  private ytDlpWrap: YTDlpWrap;
  private spotifyDownloader: SpotifyDownloader;

  constructor(ytDlpPath?: string) {
    this.ytDlpWrap = new YTDlpWrap(ytDlpPath);
    this.spotifyDownloader = new SpotifyDownloader();
  }

  async downloadAudio(url: string, options: DownloadOptions): Promise<string> {
    try {
      // Check if it's a direct MP3 URL
      if (this.isDirectMP3Url(url)) {
        return await this.downloadDirectMP3(url, options.outputPath, options.showProgress);
      } else if (this.isSpotifyUrl(url)) {
        return await this.spotifyDownloader.downloadAudio(url, {
          outputPath: options.outputPath,
          showProgress: options.showProgress
        });
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

  private isSpotifyUrl(url: string): boolean {
    return url.includes('open.spotify.com');
  }

  private async downloadDirectMP3(url: string, outputPath: string, showProgress = false): Promise<string> {
    console.error(`Downloading MP3 from: ${url}`);
    
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
        console.error(`Downloaded MP3 to: ${outputPath}`);
        resolve(outputPath);
      });
      writer.on('error', reject);
    });
  }


  private async downloadYouTubeAudio(url: string, options: DownloadOptions): Promise<string> {
    console.error(`Downloading audio from YouTube: ${url}`);

    const ytDlpOptions = [
      url,
      '-x', // Extract audio
      '--audio-format', 'mp3',
      '-o', options.outputPath,
    ];

    // Only add proxy if configured
    const proxy = process.env.YTDLP_PROXY;
    if (proxy) {
      ytDlpOptions.push('--proxy', proxy);
    }

    console.error(`yt-dlp options: ${ytDlpOptions.join(' ')}`);

    return new Promise((resolve, reject) => {
      const ytDlpProcess = this.ytDlpWrap
        .exec(ytDlpOptions)
        .on('progress', (progress) => {
          if (options.showProgress && progress.percent) {
            process.stderr.write(`\rDownloading: ${progress.percent}%`);
          }
        })
        .on('error', (error) => {
          reject(new Error(`yt-dlp error: ${error.message}`));
        })
        .on('close', async () => {
          if (options.showProgress) process.stderr.write('\n');
          
          // Check if file was created with the expected extension
          if (await fileExists(options.outputPath)) {
            console.error(`Downloaded audio to: ${options.outputPath}`);
            resolve(options.outputPath);
          } else {
            // yt-dlp might have added extension automatically
            const pathWithExt = `${options.outputPath}.mp3`;
            if (await fileExists(pathWithExt)) {
              console.error(`Downloaded audio to: ${pathWithExt}`);
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
      if (this.isSpotifyUrl(url)) {
        return await this.spotifyDownloader.getTrackInfo(url);
      } else {
        const metadata = await this.ytDlpWrap.getVideoInfo(url);
        return metadata;
      }
    } catch (error) {
      throw new Error(`Failed to get video info: ${(error as Error).message}`);
    }
  }

  private async ensureFreshCookies(providedCookiePath?: string): Promise<string | null> {
    // If user provided a specific cookie path, use it as-is
    if (providedCookiePath) {
      console.error(`🍪 Using provided cookie path: ${providedCookiePath}`);
      return providedCookiePath;
    }

    // If cookies provided via env (base64), write them once
    try {
      const base64 = process.env.YTDLP_COOKIES_BASE64;
      if (base64) {
        const targetPath = '/data/cookies.txt';
        const buf = Buffer.from(base64, 'base64');
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, buf);
        console.error(`🍪 Cookies written from environment variable to: ${targetPath}`);
        return targetPath;
      }
    } catch (err) {
      console.error('❌ Failed writing cookies from env:', err);
    }

    // Default cookie paths to check
    const cookiePaths = [
      '/data/cookies.txt',  // Production path
      './cookies.txt'       // Development path
    ];

    for (const cookiePath of cookiePaths) {
      try {
        if (await fileExists(cookiePath)) {
          const age = await this.getCookieAge(cookiePath);
          console.error(`🍪 Found cookie file: ${cookiePath} (age: ${age})`);
          
          const maxAgeMinutes = parseInt(process.env.YTDLP_COOKIE_MAX_AGE_MINUTES || '60'); // Default 1 hour
          const isStale = await this.isCookieFileStale(cookiePath, maxAgeMinutes);
          
          if (isStale) {
            console.error(`⚠️ Cookie file ${cookiePath} is stale (${age}), refreshing...`);
            if ((process.env.YTDLP_DISABLE_COOKIE_REFRESH || '').toLowerCase() === 'true') {
              console.error('🚫 Cookie refresh disabled by env; using stale cookies.');
            } else {
              await this.refreshCookies(cookiePath);
            }
          } else {
            console.error(`✅ Cookie file ${cookiePath} is fresh (${age})`);
          }
          
          return cookiePath;
        }
      } catch (error) {
        console.error(`❌ Error checking cookie file ${cookiePath}:`, error);
        continue;
      }
    }

    // No existing cookies, try to create them
    const defaultPath = cookiePaths[0];
    console.error('🍪 No cookie file found, creating fresh cookies...');
    try {
      if ((process.env.YTDLP_DISABLE_COOKIE_REFRESH || '').toLowerCase() === 'true') {
        console.error('🚫 Cookie refresh disabled; returning null cookies.');
        return null;
      } else {
        await this.refreshCookies(defaultPath);
        return defaultPath;
      }
    } catch (error) {
      console.error('❌ Failed to create fresh cookies:', error);
      return null;
    }
  }

  private async getCookieAge(cookiePath: string): Promise<string> {
    try {
      const stats = await fs.stat(cookiePath);
      const ageMs = Date.now() - stats.mtime.getTime();
      const ageMinutes = Math.floor(ageMs / (1000 * 60));
      const ageHours = Math.floor(ageMinutes / 60);
      const ageDays = Math.floor(ageHours / 24);
      
      if (ageDays > 0) {
        return `${ageDays} day(s)`;
      } else if (ageHours > 0) {
        return `${ageHours} hour(s)`;
      } else {
        return `${ageMinutes} minute(s)`;
      }
    } catch {
      return 'unknown';
    }
  }

  private async isCookieFileStale(cookiePath: string, maxAgeMinutes: number): Promise<boolean> {
    try {
      const stats = await fs.stat(cookiePath);
      const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
      return ageMinutes > maxAgeMinutes;
    } catch {
      return true; // If we can't stat the file, consider it stale
    }
  }

  private async refreshCookies(cookiePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.error('🍪 Starting cookie refresh process...');
      
      // Use ts-node to run the TypeScript script
      const scriptPath = path.join(__dirname, '../../scripts/extract-youtube-cookies.ts');
      const child = spawn('npx', ['ts-node', scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, COOKIE_OUTPUT_PATH: cookiePath }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Log cookie extraction progress to stderr for visibility
        process.stderr.write(output);
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Log cookie extraction errors to stderr for visibility
        process.stderr.write(output);
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.error('✅ Cookie refresh completed successfully');
          resolve();
        } else {
          console.error('❌ Cookie refresh failed:', stderr);
          reject(new Error(`Cookie refresh failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        console.error('❌ Cookie refresh process error:', error);
        reject(error);
      });
    });
  }
}
