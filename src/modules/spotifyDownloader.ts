import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface SpotifyDownloadOptions {
  outputPath: string;
  username?: string;
  password?: string;
  quality?: 'best' | 'worst' | string;
  showProgress?: boolean;
}

export class SpotifyDownloader {
  async downloadAudio(url: string, options: SpotifyDownloadOptions): Promise<string> {
    console.error(`Downloading audio from Spotify: ${url}`);
    
    const outputDir = path.dirname(options.outputPath);
    
    // Build spotify-dl command arguments
    const args = [
      '--output', outputDir,
      '--output-file-type', 'mp3',
      url
    ];
    
    // Add authentication if provided
    if (options.username && options.password) {
      args.unshift('--username', options.username);
      args.unshift('--password', options.password);
    }
    
    console.error(`spotify-dl command: spotifydl ${args.join(' ')}`);
    
    // Use the node_modules binary path
    const spotifyDlPath = path.join(process.cwd(), 'node_modules', '.bin', 'spotifydl');
    
    return new Promise((resolve, reject) => {
      const process = spawn(spotifyDlPath, args, {
        stdio: options.showProgress ? 'inherit' : 'pipe'
      });
      
      let stdout = '';
      let stderr = '';
      
      if (process.stdout) {
        process.stdout.on('data', (data) => {
          stdout += data.toString();
          if (options.showProgress) {
            console.error(data.toString());
          }
        });
      }
      
      if (process.stderr) {
        process.stderr.on('data', (data) => {
          stderr += data.toString();
          if (options.showProgress) {
            console.error(data.toString());
          }
        });
      }
      
      process.on('close', async (code) => {
        if (code === 0) {
          // Try to find the downloaded file in the output directory
          try {
            const files = await fs.readdir(outputDir);
            const downloadedFile = files.find(file => 
              file.endsWith('.mp3') && file.includes('spotifydl')
            ) || files.find(file => 
              file.endsWith('.mp3')
            );
            
            if (downloadedFile) {
              const fullPath = path.join(outputDir, downloadedFile);
              // Rename to expected path if different
              if (fullPath !== options.outputPath) {
                const targetPath = options.outputPath.endsWith('.mp3') ? options.outputPath : `${options.outputPath}.mp3`;
                await fs.rename(fullPath, targetPath);
                console.error(`Downloaded and renamed audio to: ${targetPath}`);
                resolve(targetPath);
              } else {
                console.error(`Downloaded audio to: ${fullPath}`);
                resolve(fullPath);
              }
            } else {
              reject(new Error('Downloaded file not found'));
            }
          } catch (error) {
            reject(new Error(`Failed to find downloaded file: ${error}`));
          }
        } else {
          reject(new Error(`spotify-dl failed with code ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to start spotify-dl: ${error.message}`));
      });
    });
  }
  
  async getTrackInfo(url: string): Promise<any> {
    // For now, return basic info. Could be extended to extract metadata
    return {
      title: 'Spotify Track',
      description: 'Downloaded from Spotify',
      url: url
    };
  }
}