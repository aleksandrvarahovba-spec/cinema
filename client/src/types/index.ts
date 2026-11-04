export type ScreenType = 'home' | 'movies' | 'tv' | 'search' | 'history' | 'details' | 'player';

export interface MediaItem {
  id: number;
  type: 'movie' | 'tv';
  title: string;
  originalTitle: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  rating: number;
  voteCount: number;
  year: number | null;
  genres?: string[];
  imdbId?: string;
  kinopoiskId?: string;
  runtime?: number;
  tagline?: string;
  seasonsCount?: number;
  episodesCount?: number;
  seasons?: {
    id: number;
    seasonNumber: number;
    name: string;
    episodeCount: number;
    poster: string | null;
  }[];
  cast?: {
    id: number;
    name: string;
    character: string;
    photo: string | null;
  }[];
}

export interface StreamQuality {
  quality: 'Auto' | '360p' | '480p' | '720p' | '1080p' | '1080p Ultra' | '2160p';
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
  provider: string;
  isCamRip?: boolean;
  embedUrl?: string;
  seasons?: StreamSeason[];
  qualities?: StreamQuality[];
  rawMeta?: Record<string, any>;
}

export interface ExtractionResult {
  title: string;
  year?: number;
  type: 'movie' | 'tv';
  translations: StreamTranslation[];
}

export interface WatchProgress {
  mediaId: number;
  type: 'movie' | 'tv';
  title: string;
  poster: string | null;
  currentTime: number;
  duration: number;
  updatedAt: number;
  translatorId?: string;
  translatorName?: string;
  provider?: string;
  season?: number;
  episode?: number;
}
