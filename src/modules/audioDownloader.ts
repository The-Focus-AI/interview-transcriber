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
      '--referer', 'https://www.youtube.com/',
      '--sleep-interval', '1',
      '--max-sleep-interval', '5',
      '--sleep-subtitles', '1',
    ];

    // Networking and anti-bot tuning via environment
    const forceIpv4 = (process.env.YTDLP_FORCE_IPV4 || '').toLowerCase() === 'true';
    if (forceIpv4) {
      ytDlpOptions.push('--force-ipv4');
    }

    const proxy = process.env.YTDLP_PROXY;
    if (proxy) {
      ytDlpOptions.push('--proxy', proxy);
    }

    // Pause between requests can help reduce bot detection
    const sleepRequests = process.env.YTDLP_SLEEP_REQUESTS;
    const maxSleepRequests = process.env.YTDLP_MAX_SLEEP_REQUESTS;
    if (sleepRequests) ytDlpOptions.push('--sleep-requests', sleepRequests);
    if (maxSleepRequests) ytDlpOptions.push('--max-sleep-interval', maxSleepRequests);

    // Retries
    ytDlpOptions.push('--retries', process.env.YTDLP_RETRIES || '5');
    ytDlpOptions.push('--fragment-retries', process.env.YTDLP_FRAGMENT_RETRIES || '5');

    // Geo-bypass controls
    ytDlpOptions.push('--geo-bypass');
    if (process.env.YTDLP_GEO_BYPASS_COUNTRY) {
      ytDlpOptions.push('--geo-bypass-country', process.env.YTDLP_GEO_BYPASS_COUNTRY);
    }

    // Choose a player client; android is often less strict
    const playerClient = process.env.YTDLP_PLAYER_CLIENT || 'android';
    const extractorArgs =
      process.env.YTDLP_EXTRACTOR_ARGS || `youtube:player_client=${playerClient},player_skip=webpage`;
    ytDlpOptions.push('--extractor-args', extractorArgs);

    // User-Agent selection (align with player client if not overridden)
    const defaultAndroidUA =
      'com.google.android.youtube/18.31.40 (Linux; U; Android 13) gzip';
    const defaultWebUA =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const userAgent = process.env.YTDLP_USER_AGENT || (playerClient === 'android' ? defaultAndroidUA : defaultWebUA);
    ytDlpOptions.push('--user-agent', userAgent);

    // Get cookie path and refresh if needed
    const cookiePath = await this.ensureFreshCookies(options.cookiesPath);
    if (cookiePath) {
      ytDlpOptions.push('--cookies', cookiePath);
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
            const pathWithExt = `${options.outputPath}.${format}`;
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
        return targetPath;
      }
    } catch (err) {
      console.error('Failed writing cookies from env:', err);
    }

    // Default cookie paths to check
    const cookiePaths = [
      '/data/cookies.txt',  // Production path
      './cookies.txt'       // Development path
    ];

    for (const cookiePath of cookiePaths) {
      try {
        if (await fileExists(cookiePath)) {
          const isStale = await this.isCookieFileStale(cookiePath, 60); // 1 hour
          
          if (isStale) {
            console.error(`Cookie file ${cookiePath} is stale, refreshing...`);
            if ((process.env.YTDLP_DISABLE_COOKIE_REFRESH || '').toLowerCase() === 'true') {
              console.error('Cookie refresh disabled by env; using stale cookies.');
            } else {
              await this.refreshCookies(cookiePath);
            }
          }
          
          return cookiePath;
        }
      } catch (error) {
        console.error(`Error checking cookie file ${cookiePath}:`, error);
        continue;
      }
    }

    // No existing cookies, try to create them
    const defaultPath = cookiePaths[0];
    console.error('No cookie file found, creating fresh cookies...');
    try {
      if ((process.env.YTDLP_DISABLE_COOKIE_REFRESH || '').toLowerCase() === 'true') {
        console.error('Cookie refresh disabled; returning null cookies.');
        return null;
      } else {
        await this.refreshCookies(defaultPath);
        return defaultPath;
      }
    } catch (error) {
      console.error('Failed to create fresh cookies:', error);
      return null;
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
      console.error('Starting cookie refresh process...');
      
      const scriptPath = path.join(__dirname, '../../scripts/extract-youtube-cookies.js');
      const child = spawn('node', [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, COOKIE_OUTPUT_PATH: cookiePath }
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.error('Cookie refresh completed successfully');
          resolve();
        } else {
          console.error('Cookie refresh failed:', stderr);
          reject(new Error(`Cookie refresh failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        console.error('Cookie refresh process error:', error);
        reject(error);
      });
    });
  }
}
