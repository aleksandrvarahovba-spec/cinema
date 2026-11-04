import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { decodeRezkaStreams } from '../utils/rezka-decrypt.js';
import { BaseExtractor } from './base.extractor.js';
import {
  EpisodeStreamParams,
  ExtractionResult,
  ExtractorMediaInfo,
  StreamEpisode,
  StreamQuality,
  StreamSeason,
  StreamTranslation,
} from './types.js';

export class HDRezkaExtractor extends BaseExtractor {
  readonly name = 'hdrezka';
  private client: AxiosInstance;

  constructor() {
    super();
    this.client = axios.create({
      baseURL: config.rezka.mirror,
      headers: {
        'User-Agent': config.rezka.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 15000,
    });
  }

  async extract(media: ExtractorMediaInfo): Promise<ExtractionResult | null> {
    try {
      const searchTarget = media.title || media.originalTitle;
      if (!searchTarget) return null;

      // 1. Search HDRezka
      const pageUrl = await this.searchPage(searchTarget, media.year);
      if (!pageUrl) {
        return null;
      }

      // 2. Fetch media page HTML
      const resp = await this.client.get(pageUrl);
      const $ = cheerio.load(resp.data);

      // Find Movie/Series ID
      let movieId = $('input#post_id').val()?.toString();
      if (!movieId) {
        const idMatch = resp.data.match(/sof\.tv\.initCDN(?:Movies|Series)Events\(\s*(\d+)/i);
        if (idMatch) movieId = idMatch[1];
      }

      if (!movieId) {
        console.warn(`[HDRezka] Failed to find movie ID for ${media.title}`);
        return null;
      }

      const isSeries =
        media.type === 'tv' ||
        $('.b-simple_seasons__list').length > 0 ||
        resp.data.includes('initCDNSeriesEvents');

      // 3. Extract Translations
      const translations: StreamTranslation[] = [];
      const translatorsList = $('#translators-list li.b-translator__item');

      if (translatorsList.length > 0) {
        translatorsList.each((_, el) => {
          const $el = $(el);
          const translatorId = $el.attr('data-translator_id');
          const name = $el.text().trim() || $el.attr('title') || 'Default';
          const isCamRip = $el.find('.b-translator__camrip').length > 0;

          if (translatorId) {
            translations.push({
              id: translatorId,
              name,
              provider: this.name,
              isCamRip,
              rawMeta: { movieId, pageUrl, isSeries },
            });
          }
        });
      } else {
        // Single default translation
        const translatorMatch = resp.data.match(
          /sof\.tv\.initCDN(?:Movies|Series)Events\(\s*\d+\s*,\s*(\d+)/i
        );
        const translatorId = translatorMatch ? translatorMatch[1] : '0';
        translations.push({
          id: translatorId,
          name: 'Оригинал / Стандартный',
          provider: this.name,
          rawMeta: { movieId, pageUrl, isSeries },
        });
      }

      // 4. If series, pre-fetch structure for the first translation
      if (isSeries && translations.length > 0) {
        const defaultTranslation = translations[0];
        const seasons = await this.fetchSeriesStructure(movieId, defaultTranslation.id);
        defaultTranslation.seasons = seasons;
      } else if (!isSeries && translations.length > 0) {
        // Pre-fetch movie qualities for default translation
        const defaultTranslation = translations[0];
        const qualities = await this.getStreamUrl({
          provider: this.name,
          mediaId: movieId,
          translatorId: defaultTranslation.id,
        });
        defaultTranslation.qualities = qualities;
      }

      return {
        title: media.title,
        year: media.year,
        type: isSeries ? 'tv' : 'movie',
        translations,
      };
    } catch (err: any) {
      console.error(`[HDRezka] Extraction failed:`, err.message);
      return null;
    }
  }

  /**
   * Searches HDRezka mirror and selects the most relevant page URL
   */
  private async searchPage(query: string, targetYear?: number): Promise<string | null> {
    try {
      const searchUrl = `/search/?do=search&subaction=search&q=${encodeURIComponent(query)}`;
      const res = await this.client.get(searchUrl);
      const $ = cheerio.load(res.data);

      const items = $('.b-content__inline_item');
      if (items.length === 0) return null;

      let bestMatchUrl: string | null = null;

      items.each((_, el) => {
        if (bestMatchUrl) return;
        const $el = $(el);
        const link = $el.find('.b-content__inline_item-link a').attr('href');
        const title = $el.find('.b-content__inline_item-link a').text().toLowerCase();
        const desc = $el.find('.b-content__inline_item-link div').text();

        if (link) {
          if (targetYear && desc.includes(targetYear.toString())) {
            bestMatchUrl = link;
          } else if (!bestMatchUrl) {
            bestMatchUrl = link;
          }
        }
      });

      return bestMatchUrl;
    } catch (err: any) {
      console.error(`[HDRezka] Search error:`, err.message);
      return null;
    }
  }

  /**
   * Fetches the seasons and episodes tree for a series translation
   */
  async fetchSeriesStructure(movieId: string, translatorId: string): Promise<StreamSeason[]> {
    try {
      const resp = await this.client.post(
        `/ajax/get_cdn_series/?t=${Date.now()}`,
        new URLSearchParams({
          action: 'get_episodes',
          id: movieId,
          translator_id: translatorId,
        }).toString(),
        {
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
        }
      );

      if (!resp.data || !resp.data.success) {
        return [];
      }

      const $seasons = cheerio.load(resp.data.seasons || '');
      const $episodes = cheerio.load(resp.data.episodes || '');

      const seasonMap = new Map<number, StreamEpisode[]>();

      // Extract all episodes
      $episodes('li.b-simple_episode__item').each((_, el) => {
        const $el = $episodes(el);
        const seasonId = parseInt($el.attr('data-season_id') || '1', 10);
        const episodeId = parseInt($el.attr('data-episode_id') || '1', 10);
        const title = $el.text().trim() || `Серия ${episodeId}`;

        if (!seasonMap.has(seasonId)) {
          seasonMap.set(seasonId, []);
        }

        seasonMap.get(seasonId)!.push({
          id: `${seasonId}_${episodeId}`,
          episode: episodeId,
          title,
        });
      });

      const result: StreamSeason[] = [];

      // Sort seasons
      const seasonNumbers = Array.from(seasonMap.keys()).sort((a, b) => a - b);
      for (const sNum of seasonNumbers) {
        const episodes = (seasonMap.get(sNum) || []).sort((a, b) => a.episode - b.episode);
        result.push({
          season: sNum,
          episodes,
        });
      }

      // If no seasons structure returned but only episodes
      if (result.length === 0 && seasonMap.size === 0) {
        result.push({
          season: 1,
          episodes: [{ id: '1_1', episode: 1, title: 'Серия 1' }],
        });
      }

      return result;
    } catch (err: any) {
      console.error(`[HDRezka] Failed to fetch series structure:`, err.message);
      return [];
    }
  }

  /**
   * Fetches direct stream qualities for an episode or movie
   */
  async getStreamUrl(params: EpisodeStreamParams): Promise<StreamQuality[]> {
    try {
      const isSeries = params.season !== undefined && params.episode !== undefined;
      const payload: Record<string, string> = {
        id: params.mediaId,
        translator_id: params.translatorId,
      };

      if (isSeries) {
        payload['action'] = 'get_stream';
        payload['season'] = params.season!.toString();
        payload['episode'] = params.episode!.toString();
      } else {
        payload['action'] = 'get_movie';
      }

      const resp = await this.client.post(
        `/ajax/get_cdn_series/?t=${Date.now()}`,
        new URLSearchParams(payload).toString(),
        {
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
        }
      );

      if (!resp.data || !resp.data.url) {
        console.warn(`[HDRezka] No url field in response:`, resp.data);
        return [];
      }

      // Decode obfuscated HDRezka stream string
      return decodeRezkaStreams(resp.data.url);
    } catch (err: any) {
      console.error(`[HDRezka] getStreamUrl error:`, err.message);
      return [];
    }
  }
}
