import {
  ExtractionResult,
  MediaItem,
  StreamEpisode,
  StreamQuality,
  StreamSeason,
  StreamTranslation,
} from '../types/index.js';

const RAW_API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
export const API_BASE = RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`;

export async function getTrending(type: 'all' | 'movie' | 'tv' = 'all', page = 1) {
  const res = await fetch(`${API_BASE}/catalog/trending?type=${type}&page=${page}`);
  return await res.json();
}

export async function getPopular(type: 'movie' | 'tv' = 'movie', page = 1) {
  const res = await fetch(`${API_BASE}/catalog/popular?type=${type}&page=${page}`);
  return await res.json();
}

export async function getTopRated(type: 'movie' | 'tv' = 'movie', page = 1) {
  const res = await fetch(`${API_BASE}/catalog/top-rated?type=${type}&page=${page}`);
  return await res.json();
}

export async function searchMedia(query: string, page = 1) {
  const res = await fetch(
    `${API_BASE}/catalog/search?query=${encodeURIComponent(query)}&page=${page}`
  );
  return await res.json();
}

export async function getMovieDetails(id: number | string): Promise<MediaItem> {
  const res = await fetch(`${API_BASE}/catalog/movie/${id}`);
  return await res.json();
}

export async function getTvDetails(id: number | string): Promise<MediaItem> {
  const res = await fetch(`${API_BASE}/catalog/tv/${id}`);
  return await res.json();
}

export async function getTvSeason(id: number | string, seasonNumber: number) {
  const res = await fetch(`${API_BASE}/catalog/tv/${id}/season/${seasonNumber}`);
  return await res.json();
}

export async function extractStreams(params: {
  title: string;
  originalTitle?: string;
  year?: number;
  imdbId?: string;
  kinopoiskId?: string;
  type: 'movie' | 'tv';
}): Promise<ExtractionResult> {
  try {
    const query = new URLSearchParams({
      title: params.title,
      type: params.type,
    });

    if (params.originalTitle) query.set('originalTitle', params.originalTitle);
    if (params.year) query.set('year', params.year.toString());
    if (params.imdbId) query.set('imdbId', params.imdbId);
    if (params.kinopoiskId) query.set('kinopoiskId', params.kinopoiskId);

    const res = await fetch(`${API_BASE}/stream/extract?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.translations && data.translations.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend extractStreams request failed:', err);
  }

  // Return empty translations without any placeholder demo streams
  return {
    title: params.title,
    year: params.year,
    type: params.type,
    translations: [],
  };
}

export async function getStreamQualities(params: {
  provider: string;
  translatorId: string;
  mediaId: string;
  season?: number;
  episode?: number;
}): Promise<StreamQuality[]> {
  try {
    const query = new URLSearchParams({
      provider: params.provider,
      translatorId: params.translatorId,
      mediaId: params.mediaId,
    });

    if (params.season !== undefined) query.set('season', params.season.toString());
    if (params.episode !== undefined) query.set('episode', params.episode.toString());

    const res = await fetch(`${API_BASE}/stream/url?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.qualities && data.qualities.length > 0) {
        return data.qualities;
      }
    }
  } catch (err) {
    console.warn('Backend getStreamQualities failed:', err);
  }

  return [];
}

export async function fetchSeriesStructure(
  provider: string,
  translatorId: string,
  mediaId: string
): Promise<StreamSeason[]> {
  try {
    const query = new URLSearchParams({
      provider,
      translatorId,
      mediaId,
    });
    const res = await fetch(`${API_BASE}/stream/series-structure?${query.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.seasons && data.seasons.length > 0) {
        return data.seasons;
      }
    }
  } catch (err) {
    console.warn('fetchSeriesStructure failed:', err);
  }

  return [];
}
