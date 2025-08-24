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

export interface SpotifyDownloadResult {
  filePath: string;
  spotifyInfo: SpotifyItemInfo;
  youtubeUrl: string;
  youtubeMetadata?: any;
}

export interface SpotifyTrackInfo {
  id: string;
  name: string;
  album_name: string;
  artists: string[];
  duration_ms: number;
  url: string;
}

export interface SpotifyEpisodeInfo {
  id: string;
  name: string;
  show_name: string;
  description: string;
  duration_ms: number;
  url: string;
}

export type SpotifyItemInfo = SpotifyTrackInfo | SpotifyEpisodeInfo;

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

  async downloadAudio(url: string, options: SpotifyDownloadOptions): Promise<SpotifyDownloadResult> {
    console.error(`Processing Spotify URL: ${url}`);
    
    // Extract item information from Spotify URL (track or episode)
    const itemInfo = await this.getItemInfo(url);
    if (!itemInfo) {
      throw new Error('Failed to get item information from Spotify');
    }

    if ('artists' in itemInfo) {
      // It's a track
      console.error(`Track: ${itemInfo.name} by ${itemInfo.artists.join(', ')}`);
    } else {
      // It's an episode
      console.error(`Episode: ${itemInfo.name} from ${itemInfo.show_name}`);
    }
    
    // Find YouTube links for this item
    const youtubeLinks = await this.findYouTubeLinks(itemInfo);
    if (!youtubeLinks.length) {
      throw new Error('No YouTube links found for this item');
    }

    const youtubeUrl = youtubeLinks[0];
    console.error(`Found ${youtubeLinks.length} YouTube links, using first one: ${youtubeUrl}`);
    
    // Get YouTube metadata
    const youtubeMetadata = await this.getYouTubeMetadata(youtubeUrl);
    
    // Use the existing audio downloader to download from YouTube
    // We'll need to import it here
    const { AudioDownloader } = await import('./audioDownloader');
    const audioDownloader = new AudioDownloader();
    
    const filePath = await audioDownloader.downloadAudio(youtubeUrl, {
      outputPath: options.outputPath,
      showProgress: options.showProgress
    });
    
    return {
      filePath,
      spotifyInfo: itemInfo,
      youtubeUrl,
      youtubeMetadata
    };
  }

  async getItemInfo(url: string): Promise<SpotifyItemInfo | null> {
    try {
      // Authenticate with Spotify first
      await this.authenticate();
      
      // Check if it's a track or episode
      if (url.includes('/track/')) {
        return await this.getTrackInfo(url);
      } else if (url.includes('/episode/')) {
        return await this.getEpisodeInfo(url);
      } else {
        throw new Error('Unsupported Spotify URL type');
      }
    } catch (error) {
      console.error(`Failed to get item info: ${error}`);
      return null;
    }
  }

  async getTrackInfo(url: string): Promise<SpotifyTrackInfo | null> {
    try {
      // Parse Spotify URL to extract track ID
      const trackId = this.extractTrackId(url);
      if (!trackId) {
        throw new Error('Invalid Spotify track URL');
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

  async getEpisodeInfo(url: string): Promise<SpotifyEpisodeInfo | null> {
    try {
      // Parse Spotify URL to extract episode ID
      const episodeId = this.extractEpisodeId(url);
      if (!episodeId) {
        throw new Error('Invalid Spotify episode URL');
      }

      // Get episode information from Spotify API
      const episode = await this.spotifyApi.getEpisode(episodeId);
      
      return {
        id: episode.body.id,
        name: episode.body.name,
        show_name: episode.body.show.name,
        description: episode.body.description,
        duration_ms: episode.body.duration_ms,
        url: url
      };
    } catch (error) {
      console.error(`Failed to get episode info: ${error}`);
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

  private extractEpisodeId(url: string): string | null {
    // Handle different Spotify URL formats
    const patterns = [
      /spotify\.com\/episode\/([a-zA-Z0-9]+)/,
      /spotify\.com\/episode\/([a-zA-Z0-9]+)\?/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  private async findYouTubeLinks(itemInfo: SpotifyItemInfo): Promise<string[]> {
    try {
      // Import required packages
      const ytSearch = require('yt-search');
      const stringSimilarity = require('string-similarity');

      let searchTerms: string[] = [];

      if ('artists' in itemInfo) {
        // It's a track
        searchTerms = [
          `${itemInfo.artists[0]} - ${itemInfo.name}`,
          `${itemInfo.album_name} - ${itemInfo.name}`,
          `${itemInfo.artists.join(' ')} - ${itemInfo.name}`
        ];
      } else {
        // It's an episode
        searchTerms = [
          `${itemInfo.show_name} - ${itemInfo.name}`,
          `${itemInfo.name} ${itemInfo.show_name}`,
          `${itemInfo.name} podcast episode`
        ];
      }

      for (const searchTerm of searchTerms) {
        console.error(`Searching YouTube for: "${searchTerm}"`);
        
        const result = await ytSearch(searchTerm);
        if (result.videos && result.videos.length > 0) {
          // Filter videos by duration (max 60 minutes for episodes, 10 minutes for tracks)
          const maxDuration = 'artists' in itemInfo ? 600 : 3600;
          const validVideos = result.videos.filter((video: any) => 
            video.seconds > 0 && video.seconds < maxDuration
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

  private async getYouTubeMetadata(youtubeUrl: string): Promise<any> {
    try {
      // Use the existing audio downloader to get YouTube metadata
      const { AudioDownloader } = await import('./audioDownloader');
      const audioDownloader = new AudioDownloader();
      
      return await audioDownloader.getVideoInfo(youtubeUrl);
    } catch (error) {
      console.error(`Failed to get YouTube metadata: ${error}`);
      return null;
    }
  }
}