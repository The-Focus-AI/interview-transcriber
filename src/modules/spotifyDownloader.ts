import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import SpotifyWebApi from 'spotify-web-api-node';

export interface SpotifyDownloadOptions {
  outputPath: string;
  username?: string;
  password?: string;
  quality?: 'best' | 'worst' | string;
  showProgress?: boolean;
}

export interface SpotifyTrackInfo {
  id: string;
  name: string;
  album_name: string;
  artists: string[];
  duration_ms: number;
  url: string;
}

export class SpotifyDownloader {
  private spotifyApi: SpotifyWebApi;

  constructor() {
    // Initialize Spotify API with the same credentials as spotify-dl
    this.spotifyApi = new SpotifyWebApi({
      clientId: 'acc6302297e040aeb6e4ac1fbdfd62c3',
      clientSecret: '0e8439a1280a43aba9a5bc0a16f3f009',
    });
  }

  private async authenticate(): Promise<void> {
    try {
      // Use client credentials grant for public track access
      const data = await this.spotifyApi.clientCredentialsGrant();
      this.spotifyApi.setAccessToken(data.body['access_token']);
    } catch (error) {
      throw new Error(`Failed to authenticate with Spotify: ${error}`);
    }
  }

  async downloadAudio(url: string, options: SpotifyDownloadOptions): Promise<string> {
    console.error(`Processing Spotify URL: ${url}`);
    
    // Extract track information from Spotify URL
    const trackInfo = await this.getTrackInfo(url);
    if (!trackInfo) {
      throw new Error('Failed to get track information from Spotify');
    }

    console.error(`Track: ${trackInfo.name} by ${trackInfo.artists.join(', ')}`);
    
    // Find YouTube links for this track
    const youtubeLinks = await this.findYouTubeLinks(trackInfo);
    if (!youtubeLinks.length) {
      throw new Error('No YouTube links found for this track');
    }

    console.error(`Found ${youtubeLinks.length} YouTube links, using first one: ${youtubeLinks[0]}`);
    
    // Use the existing audio downloader to download from YouTube
    // We'll need to import it here
    const { AudioDownloader } = await import('./audioDownloader');
    const audioDownloader = new AudioDownloader();
    
    return await audioDownloader.downloadAudio(youtubeLinks[0], {
      outputPath: options.outputPath,
      showProgress: options.showProgress
    });
  }

  async getTrackInfo(url: string): Promise<SpotifyTrackInfo | null> {
    try {
      // Authenticate with Spotify first
      await this.authenticate();
      
      // Parse Spotify URL to extract track ID
      const trackId = this.extractTrackId(url);
      if (!trackId) {
        throw new Error('Invalid Spotify URL');
      }

      // Get track information from Spotify API
      const track = await this.spotifyApi.getTrack(trackId);
      
      return {
        id: track.body.id,
        name: track.body.name,
        album_name: track.body.album.name,
        artists: track.body.artists.map((artist: any) => artist.name),
        duration_ms: track.body.duration_ms,
        url: url
      };
    } catch (error) {
      console.error(`Failed to get track info: ${error}`);
      return null;
    }
  }

  private extractTrackId(url: string): string | null {
    // Handle different Spotify URL formats
    const patterns = [
      /spotify\.com\/track\/([a-zA-Z0-9]+)/,
      /spotify\.com\/track\/([a-zA-Z0-9]+)\?/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private async findYouTubeLinks(trackInfo: SpotifyTrackInfo): Promise<string[]> {
    try {
      // Import required packages
      const ytSearch = require('yt-search');
      const stringSimilarity = require('string-similarity');

      const searchTerms = [
        `${trackInfo.artists[0]} - ${trackInfo.name}`,
        `${trackInfo.album_name} - ${trackInfo.name}`,
        `${trackInfo.artists.join(' ')} - ${trackInfo.name}`
      ];

      for (const searchTerm of searchTerms) {
        console.error(`Searching YouTube for: "${searchTerm}"`);
        
        const result = await ytSearch(searchTerm);
        if (result.videos && result.videos.length > 0) {
          // Filter videos by duration (max 10 minutes for songs)
          const validVideos = result.videos.filter((video: any) => 
            video.seconds > 0 && video.seconds < 600
          );

          if (validVideos.length > 0) {
            return validVideos.slice(0, 3).map((video: any) => 
              video.url.includes('https://youtube.com') 
                ? video.url 
                : 'https://youtube.com' + video.url
            );
          }
        }
      }

      return [];
    } catch (error) {
      console.error(`Failed to find YouTube links: ${error}`);
      return [];
    }
  }
}