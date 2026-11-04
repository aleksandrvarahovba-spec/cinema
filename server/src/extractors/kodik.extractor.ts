import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import { BaseExtractor } from './base.extractor.js';
import {
  EpisodeStreamParams,
  ExtractionResult,
  ExtractorMediaInfo,
  StreamEpisode,
  StreamQuality,
  StreamSeason,
  StreamTranslation,
  VideoQualityName,
} from './types.js';

export class KodikExtractor extends BaseExtractor {
  readonly name = 'kodik';
  private client: AxiosInstance;

  constructor() {
    super();
    this.client = axios.create({
      baseURL: config.kodik.baseUrl,
      timeout: 15000,
    });
  }

  async extract(media: ExtractorMediaInfo): Promise<ExtractionResult | null> {
    try {
      if (!config.kodik.apiToken) return null;

      const params: Record<string, string> = {
        token: config.kodik.apiToken,
        with_episodes: 'true',
        with_material_data: 'true',
      };

      if (media.kinopoiskId) {
        params['kinopoisk_id'] = media.kinopoiskId;
      } else if (media.imdbId) {
        params['imdb_id'] = media.imdbId;
      } else if (media.title) {
        params['title'] = media.title;
      } else {
        return null;
      }

      const res = await this.client.get('/search', { params });
      const results: any[] = res.data?.results || [];

      if (results.length === 0) {
        return null;
      }

      const translationsMap = new Map<string, StreamTranslation>();

      for (const item of results) {
        const transId = String(item.translation?.id || '0');
        const transTitle = item.translation?.title || 'Стандартный';
        const isSeries = item.type?.includes('serial');

        if (!translationsMap.has(transId)) {
          translationsMap.set(transId, {
            id: transId,
            name: transTitle,
            provider: this.name,
            rawMeta: {
              link: item.link,
              mediaId: String(item.id),
              isSeries,
            },
          });
        }

        const translation = translationsMap.get(transId)!;

        if (isSeries && item.seasons) {
          const seasons: StreamSeason[] = [];

          for (const [seasonNumStr, seasonData] of Object.entries<any>(item.seasons)) {
            const seasonNum = parseInt(seasonNumStr, 10);
            const episodes: StreamEpisode[] = [];

            if (seasonData.episodes) {
              for (const [epNumStr, epLink] of Object.entries<string>(seasonData.episodes)) {
                const epNum = parseInt(epNumStr, 10);
                episodes.push({
                  id: `${seasonNum}_${epNum}`,
                  episode: epNum,
                  title: `Серия ${epNum}`,
                });
              }
            }

            seasons.push({
              season: seasonNum,
              episodes: episodes.sort((a, b) => a.episode - b.episode),
            });
          }

          translation.seasons = seasons.sort((a, b) => a.season - b.season);
        } else if (!isSeries) {
          // Movie link
          translation.rawMeta = {
            ...translation.rawMeta,
            link: item.link,
          };
        }
      }

      const translations = Array.from(translationsMap.values());
      if (translations.length === 0) return null;

      return {
        title: media.title,
        year: media.year,
        type: media.type,
        translations,
      };
    } catch (err: any) {
      console.error(`[Kodik] Extraction error:`, err.message);
      return null;
    }
  }

  async getStreamUrl(params: EpisodeStreamParams): Promise<StreamQuality[]> {
    try {
      // Find the player link via Kodik search or direct params
      const searchRes = await this.client.get('/search', {
        params: {
          token: config.kodik.apiToken,
          id: params.mediaId,
          with_episodes: 'true',
        },
      });

      const item = searchRes.data?.results?.[0];
      if (!item) return [];

      let playerLink = item.link;

      // If series, navigate to specific season and episode
      if (params.season !== undefined && params.episode !== undefined && item.seasons) {
        playerLink = item.seasons[params.season]?.episodes?.[params.episode] || item.link;
      }

      if (!playerLink) return [];

      if (playerLink.startsWith('//')) {
        playerLink = `https:${playerLink}`;
      }

      // Extract direct video streams from Kodik player URL
      return await this.resolvePlayerStreams(playerLink);
    } catch (err: any) {
      console.error(`[Kodik] getStreamUrl error:`, err.message);
      return [];
    }
  }

  /**
   * Parses Kodik iframe player page and extracts direct .m3u8 streams
   */
  private async resolvePlayerStreams(playerUrl: string): Promise<StreamQuality[]> {
    try {
      const pageResp = await axios.get(playerUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://kodik.info/',
        },
      });

      const html = pageResp.data as string;

      // Extract urlParams or video info
      const urlParamsMatch = html.match(/urlParams\s*=\s*'([^']+)'/);
      const postUrlMatch = html.match(
        /\$\.ajax\(\{\s*type:\s*['"]POST['"],\s*url:\s*['"]([^'"]+)['"]/
      );

      const qualities: StreamQuality[] = [];

      // Pattern match for direct m3u8 in html or scripts
      const m3u8Matches = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/g);
      if (m3u8Matches && m3u8Matches.length > 0) {
        const uniqueUrls = Array.from(new Set(m3u8Matches));
        for (const u of uniqueUrls) {
          qualities.push({
            quality: '720p',
            url: u,
          });
        }
      }

      // If direct stream URL was not found in static html, use fallback standard master playlist resolver
      if (qualities.length === 0 && urlParamsMatch && postUrlMatch) {
        try {
          const postEndpoint = new URL(postUrlMatch[1], playerUrl).toString();
          const gviResp = await axios.post(
            postEndpoint,
            new URLSearchParams(JSON.parse(urlParamsMatch[1])).toString(),
            {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: playerUrl,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              },
            }
          );

          if (gviResp.data?.links) {
            for (const [resKey, linkItems] of Object.entries<any>(gviResp.data.links)) {
              const directSrc = linkItems?.[0]?.src;
              if (directSrc) {
                const qName = this.mapResolution(resKey);
                qualities.push({
                  quality: qName,
                  url: directSrc.startsWith('//') ? `https:${directSrc}` : directSrc,
                });
              }
            }
          }
        } catch (innerErr) {
          // Fall through
        }
      }

      return qualities;
    } catch (err: any) {
      console.error(`[Kodik] resolvePlayerStreams failed:`, err.message);
      return [];
    }
  }

  private mapResolution(res: string): VideoQualityName {
    if (res.includes('1080')) return '1080p';
    if (res.includes('720')) return '720p';
    if (res.includes('480')) return '480p';
    return '360p';
  }
}
