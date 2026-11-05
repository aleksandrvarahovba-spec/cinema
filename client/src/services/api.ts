import {
  ExtractionResult,
  MediaItem,
  StreamEpisode,
  StreamQuality,
  StreamSeason,
  StreamTranslation,
} from '../types/index.js';
import { resolveAllSources } from './sources.service.js';

const RAW_API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE = RAW_API_URL ? (RAW_API_URL.endsWith('/api') ? RAW_API_URL : `${RAW_API_URL}/api`) : '/api';

const TMDB_KEY = '4ef0d7355d9ffb5151e987764708ce96';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

function buildImg(path: string | null, size = 'w500'): string | null {
  return path ? `${TMDB_IMG}/${size}${path}` : null;
}

function formatTmdbItem(item: any, explicitType?: 'movie' | 'tv'): MediaItem {
  const type = explicitType || (item.media_type === 'tv' || item.first_air_date ? 'tv' : 'movie');
  const title = item.title || item.name || '';
  const originalTitle = item.original_title || item.original_name || '';
  const dateStr = item.release_date || item.first_air_date || '';
  const year = dateStr ? new Date(dateStr).getFullYear() : null;

  return {
    id: item.id,
    type,
    title,
    originalTitle,
    overview: item.overview || '',
    poster: buildImg(item.poster_path, 'w500'),
    backdrop: buildImg(item.backdrop_path, 'w1280'),
    rating: Math.round((item.vote_average || 0) * 10) / 10,
    voteCount: item.vote_count || 0,
    year: isNaN(year as number) ? null : year,
    genres: item.genres?.map((g: any) => g.name) || [],
  };
}

export async function getTrending(type: 'all' | 'movie' | 'tv' = 'all', page = 1) {
  try {
    const res = await fetch(`${API_BASE}/catalog/trending?type=${type}&page=${page}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback directly to TMDB
  }

  const endpoint = type === 'all' ? 'trending/all/week' : `trending/${type}/week`;
  const res = await fetch(
    `${TMDB_BASE}/${endpoint}?api_key=${TMDB_KEY}&language=ru-RU&page=${page}`
  );
  const data = await res.json();
  return {
    page: data.page,
    totalPages: data.total_pages,
    results: (data.results || []).map((i: any) => formatTmdbItem(i)),
  };
}

export async function getPopular(type: 'movie' | 'tv' = 'movie', page = 1) {
  try {
    const res = await fetch(`${API_BASE}/catalog/popular?type=${type}&page=${page}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback directly to TMDB
  }

  const res = await fetch(
    `${TMDB_BASE}/${type}/popular?api_key=${TMDB_KEY}&language=ru-RU&page=${page}`
  );
  const data = await res.json();
  return {
    page: data.page,
    totalPages: data.total_pages,
    results: (data.results || []).map((i: any) => formatTmdbItem(i, type)),
  };
}

export async function getTopRated(type: 'movie' | 'tv' = 'movie', page = 1) {
  try {
    const res = await fetch(`${API_BASE}/catalog/top-rated?type=${type}&page=${page}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback directly to TMDB
  }

  const res = await fetch(
    `${TMDB_BASE}/${type}/top_rated?api_key=${TMDB_KEY}&language=ru-RU&page=${page}`
  );
  const data = await res.json();
  return {
    page: data.page,
    totalPages: data.total_pages,
    results: (data.results || []).map((i: any) => formatTmdbItem(i, type)),
  };
}

export async function searchMedia(query: string, page = 1) {
  try {
    const res = await fetch(
      `${API_BASE}/catalog/search?query=${encodeURIComponent(query)}&page=${page}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) return await res.json();
  } catch {
    // Fallback directly to TMDB
  }

  const res = await fetch(
    `${TMDB_BASE}/search/multi?api_key=${TMDB_KEY}&language=ru-RU&query=${encodeURIComponent(
      query
    )}&page=${page}`
  );
  const data = await res.json();
  return {
    page: data.page,
    totalPages: data.total_pages,
    results: (data.results || [])
      .filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv')
      .map((i: any) => formatTmdbItem(i)),
  };
}

export async function getMovieDetails(id: number | string): Promise<MediaItem> {
  try {
    const res = await fetch(`${API_BASE}/catalog/movie/${id}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback directly to TMDB
  }

  const res = await fetch(
    `${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}&language=ru-RU&append_to_response=credits,recommendations,external_ids`
  );
  const item = await res.json();
  const formatted = formatTmdbItem(item, 'movie');
  const imdbId = item.external_ids?.imdb_id || item.imdb_id;

  return {
    ...formatted,
    runtime: item.runtime,
    tagline: item.tagline,
    imdbId,
    genres: item.genres?.map((g: any) => g.name) || [],
    cast: (item.credits?.cast || []).slice(0, 10).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      photo: buildImg(c.profile_path, 'w185'),
    })),
  };
}

export async function getTvDetails(id: number | string): Promise<MediaItem> {
  try {
    const res = await fetch(`${API_BASE}/catalog/tv/${id}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback directly to TMDB
  }

  const res = await fetch(
    `${TMDB_BASE}/tv/${id}?api_key=${TMDB_KEY}&language=ru-RU&append_to_response=credits,recommendations,external_ids`
  );
  const item = await res.json();
  const formatted = formatTmdbItem(item, 'tv');
  const imdbId = item.external_ids?.imdb_id;

  return {
    ...formatted,
    seasonsCount: item.number_of_seasons,
    episodesCount: item.number_of_episodes,
    seasons: (item.seasons || [])
      .filter((s: any) => s.season_number > 0)
      .map((s: any) => ({
        id: s.id,
        seasonNumber: s.season_number,
        name: s.name,
        episodeCount: s.episode_count,
        poster: buildImg(s.poster_path, 'w300'),
      })),
    imdbId,
    genres: item.genres?.map((g: any) => g.name) || [],
    cast: (item.credits?.cast || []).slice(0, 10).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character,
      photo: buildImg(c.profile_path, 'w185'),
    })),
  };
}

export async function getTvSeason(id: number | string, seasonNumber: number) {
  try {
    const res = await fetch(`${API_BASE}/catalog/tv/${id}/season/${seasonNumber}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback directly to TMDB
  }

  const res = await fetch(
    `${TMDB_BASE}/tv/${id}/season/${seasonNumber}?api_key=${TMDB_KEY}&language=ru-RU`
  );
  return await res.json();
}

/**
 * Universal Failproof Stream Extractor.
 * Tries backend first; if backend is unreachable or returns 0 streams,
 * seamlessly pulls all Russian balancers (Collaps, Kodik, Delivembd, Multiembed 4K).
 */
export async function extractStreams(params: {
  title: string;
  originalTitle?: string;
  year?: number;
  imdbId?: string;
  kinopoiskId?: string;
  type: 'movie' | 'tv';
  mediaItem?: MediaItem;
}): Promise<ExtractionResult> {
  const query = new URLSearchParams({
    title: params.title,
    type: params.type,
  });

  if (params.originalTitle) query.set('originalTitle', params.originalTitle);
  if (params.year) query.set('year', params.year.toString());
  if (params.imdbId) query.set('imdbId', params.imdbId);
  if (params.kinopoiskId) query.set('kinopoiskId', params.kinopoiskId);

  // 1. First try Vercel serverless /api/sources (extracts direct ad-free .m3u8 streams)
  try {
      const res = await fetch(`${API_BASE}/sources?${query.toString()}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.translations && data.translations.length > 0) {
          return data;
        }
      }
    } catch {
      // Continue to next fallback
    }

    // 1b. Try Render backend /api/stream/extract if available
    try {
      const res = await fetch(`${API_BASE}/stream/extract?${query.toString()}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.translations && data.translations.length > 0) {
          return data;
        }
      }
    } catch {
      // Backend offline / running standalone on Vercel
    }

  // 2. Direct Multi-Balancer Resolution (Collaps, Kodik, Delivembd, Multiembed)
  try {
    const multiSources = await resolveAllSources(params);
    if (multiSources && multiSources.translations.length > 0) {
      return multiSources;
    }
  } catch (err) {
    console.warn('[extractStreams] Multi-balancer resolution error:', err);
  }

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

    const res = await fetch(`${API_BASE}/stream/url?${query.toString()}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.qualities && data.qualities.length > 0) {
        return data.qualities;
      }
    }
  } catch {
    // Backend offline
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
    const res = await fetch(`${API_BASE}/stream/series-structure?${query.toString()}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.seasons && data.seasons.length > 0) {
        return data.seasons;
      }
    }
  } catch {
    // Backend offline
  }

  return [];
}
