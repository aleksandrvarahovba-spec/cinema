export type VideoQualityName =
  | 'Auto'
  | '360p'
  | '480p'
  | '720p'
  | '1080p'
  | '1080p Ultra'
  | '2160p';

export interface StreamQuality {
  quality: VideoQualityName;
  url: string;
  proxiedUrl?: string;
}

export interface StreamEpisode {
  id: string;
  episode: number;
  title?: string;
  qualities?: StreamQuality[];
}

export interface StreamSeason {
  season: number;
  episodes: StreamEpisode[];
}

export interface StreamTranslation {
  id: string;
  name: string;
  provider: 'hdrezka' | 'kodik' | 'alloha' | 'collaps' | string;
  isCamRip?: boolean;
  seasons?: StreamSeason[];
  qualities?: StreamQuality[]; // populated for movies
  rawMeta?: Record<string, any>;
}

export interface ExtractorMediaInfo {
  title: string;
  originalTitle?: string;
  year?: number;
  imdbId?: string;
  kinopoiskId?: string;
  type: 'movie' | 'tv';
}

export interface ExtractionResult {
  title: string;
  year?: number;
  type: 'movie' | 'tv';
  translations: StreamTranslation[];
}

export interface EpisodeStreamParams {
  provider: string;
  translatorId: string;
  mediaId: string;
  season?: number;
  episode?: number;
}
