import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import { BaseExtractor } from './base.extractor.js';
import {
  EpisodeStreamParams,
  ExtractionResult,
  ExtractorMediaInfo,
  StreamQuality,
  StreamTranslation,
} from './types.js';

export class AllohaExtractor extends BaseExtractor {
  readonly name = 'alloha';
  private client: AxiosInstance;

  constructor() {
    super();
    this.client = axios.create({
      baseURL: config.alloha.baseUrl,
      timeout: 10000,
    });
  }

  async extract(media: ExtractorMediaInfo): Promise<ExtractionResult | null> {
    try {
      if (!config.alloha.token) {
        // Return null if token not configured so other providers handle it
        return null;
      }

      const params: Record<string, string> = {
        token: config.alloha.token,
      };

      if (media.imdbId) params['imdb'] = media.imdbId;
      if (media.kinopoiskId) params['kp'] = media.kinopoiskId;
      if (media.title) params['name'] = media.title;

      const res = await this.client.get('/', { params });
      const data = res.data?.data;

      if (!data) return null;

      const translations: StreamTranslation[] = [];

      if (data.translation) {
        translations.push({
          id: String(data.translation_id || '1'),
          name: data.translation,
          provider: this.name,
          rawMeta: {
            iframeUrl: data.iframe,
          },
        });
      }

      return {
        title: media.title,
        year: media.year,
        type: media.type,
        translations,
      };
    } catch {
      return null;
    }
  }

  async getStreamUrl(params: EpisodeStreamParams): Promise<StreamQuality[]> {
    // If iframe or direct stream URL is provided by Alloha
    return [];
  }
}
