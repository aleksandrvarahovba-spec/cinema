import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import { idMapperService } from './id-mapper.service.js';

export interface FormattedMediaItem {
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
}

export class TmdbService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.tmdb.baseUrl,
      params: {
        api_key: config.tmdb.apiKey,
        language: config.tmdb.defaultLanguage,
      },
      timeout: 10000,
    });
  }

  private buildImageUrl(path: string | null, size = 'w500'): string | null {
    if (!path) return null;
    return `${config.tmdb.imageBaseUrl}/${size}${path}`;
  }

  private formatItem(item: any, explicitType?: 'movie' | 'tv'): FormattedMediaItem {
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
      poster: this.buildImageUrl(item.poster_path, 'w500'),
      backdrop: this.buildImageUrl(item.backdrop_path, 'w1280'),
      rating: Math.round((item.vote_average || 0) * 10) / 10,
      voteCount: item.vote_count || 0,
      year: isNaN(year as number) ? null : year,
      genres: item.genres?.map((g: any) => g.name) || [],
    };
  }

  async getTrending(type: 'all' | 'movie' | 'tv' = 'all', page = 1) {
    const res = await this.client.get(`/trending/${type}/week`, { params: { page } });
    return {
      page: res.data.page,
      totalPages: res.data.total_pages,
      results: (res.data.results || []).map((item: any) => this.formatItem(item)),
    };
  }

  async getPopular(type: 'movie' | 'tv' = 'movie', page = 1) {
    const res = await this.client.get(`/${type}/popular`, { params: { page } });
    return {
      page: res.data.page,
      totalPages: res.data.total_pages,
      results: (res.data.results || []).map((item: any) => this.formatItem(item, type)),
    };
  }

  async getTopRated(type: 'movie' | 'tv' = 'movie', page = 1) {
    const res = await this.client.get(`/${type}/top_rated`, { params: { page } });
    return {
      page: res.data.page,
      totalPages: res.data.total_pages,
      results: (res.data.results || []).map((item: any) => this.formatItem(item, type)),
    };
  }

  async search(query: string, page = 1) {
    const res = await this.client.get('/search/multi', {
      params: { query, page, include_adult: false },
    });
    const filtered = (res.data.results || []).filter(
      (i: any) => i.media_type === 'movie' || i.media_type === 'tv'
    );
    return {
      page: res.data.page,
      totalPages: res.data.total_pages,
      results: filtered.map((item: any) => this.formatItem(item)),
    };
  }

  async getMovieDetails(id: number | string) {
    const res = await this.client.get(`/movie/${id}`, {
      params: {
        append_to_response: 'credits,recommendations,external_ids',
      },
    });

    const item = res.data;
    const formatted = this.formatItem(item, 'movie');
    const imdbId = item.external_ids?.imdb_id;
    const kinopoiskId = await idMapperService.findKinopoiskId(
      imdbId,
      formatted.title,
      formatted.year || undefined
    );

    return {
      ...formatted,
      runtime: item.runtime,
      tagline: item.tagline,
      status: item.status,
      imdbId,
      kinopoiskId,
      cast: (item.credits?.cast || []).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        photo: this.buildImageUrl(c.profile_path, 'w185'),
      })),
      recommendations: (item.recommendations?.results || [])
        .slice(0, 12)
        .map((r: any) => this.formatItem(r, 'movie')),
    };
  }

  async getTvDetails(id: number | string) {
    const res = await this.client.get(`/tv/${id}`, {
      params: {
        append_to_response: 'credits,recommendations,external_ids',
      },
    });

    const item = res.data;
    const formatted = this.formatItem(item, 'tv');
    const imdbId = item.external_ids?.imdb_id;
    const kinopoiskId = await idMapperService.findKinopoiskId(
      imdbId,
      formatted.title,
      formatted.year || undefined
    );

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
          poster: this.buildImageUrl(s.poster_path, 'w300'),
          airDate: s.air_date,
        })),
      imdbId,
      kinopoiskId,
      cast: (item.credits?.cast || []).slice(0, 10).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character,
        photo: this.buildImageUrl(c.profile_path, 'w185'),
      })),
      recommendations: (item.recommendations?.results || [])
        .slice(0, 12)
        .map((r: any) => this.formatItem(r, 'tv')),
    };
  }

  async getTvSeason(tvId: number | string, seasonNumber: number) {
    const res = await this.client.get(`/tv/${tvId}/season/${seasonNumber}`);
    const data = res.data;

    return {
      id: data.id,
      seasonNumber: data.season_number,
      name: data.name,
      overview: data.overview,
      episodes: (data.episodes || []).map((ep: any) => ({
        id: ep.id,
        episodeNumber: ep.episode_number,
        name: ep.name,
        overview: ep.overview,
        still: this.buildImageUrl(ep.still_path, 'w300'),
        rating: Math.round((ep.vote_average || 0) * 10) / 10,
        runtime: ep.runtime,
        airDate: ep.air_date,
      })),
    };
  }
}

export const tmdbService = new TmdbService();
