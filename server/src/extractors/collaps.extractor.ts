import axios from 'axios';
import { idMapperService } from '../services/id-mapper.service.js';
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

export class CollapsExtractor extends BaseExtractor {
  readonly name = 'collaps';

  private mirrors = [
    'https://api.nextembed.ws/embed/',
    'https://api.kinogram.best/embed/',
    'https://api.delivembd.ws/embed/',
    'https://api.bhcesdf.com/embed/',
  ];

  async extract(media: ExtractorMediaInfo): Promise<ExtractionResult | null> {
    try {
      let imdbId = media.imdbId;
      let kinopoiskId = media.kinopoiskId;

      // If missing IDs, try to resolve via idMapperService
      if (!imdbId && !kinopoiskId && media.title) {
        kinopoiskId = (await idMapperService.findKinopoiskId(
          undefined,
          media.title,
          media.year
        )) || undefined;
      }

      if (!imdbId && !kinopoiskId) {
        return null;
      }

      const paths: string[] = [];
      if (imdbId) paths.push(`imdb/${imdbId}`);
      if (kinopoiskId) paths.push(`kp/${kinopoiskId}`);

      let playerHtml = '';
      let usedMirror = this.mirrors[0];

      // Try mirrors with short timeout
      for (const mirror of this.mirrors) {
        for (const path of paths) {
          try {
            const res = await axios.get(`${mirror}${path}`, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Referer: mirror,
              },
              timeout: 3000,
            });

            if (res.status === 200 && typeof res.data === 'string' && res.data.includes('makePlayer({')) {
              playerHtml = res.data;
              usedMirror = mirror;
              break;
            }
          } catch {
            // Next mirror
          }
        }
        if (playerHtml) break;
      }

      if (!playerHtml) {
        return null;
      }

      const playerData = this.parsePlayerData(playerHtml);
      if (!playerData) {
        return null;
      }

      const isTv = media.type === 'tv' || !!playerData.playlist?.seasons;

      if (isTv && playerData.playlist?.seasons) {
        return this.formatSeriesResult(media, playerData);
      } else if (playerData.source?.hls) {
        return this.formatMovieResult(media, playerData);
      }

      return null;
    } catch (err: any) {
      console.warn(`[CollapsExtractor] extract failed:`, err.message);
      return null;
    }
  }

  /**
   * Safely extract the JSON object passed to makePlayer({ ... })
   */
  private parsePlayerData(html: string): any {
    try {
      const callPos = html.indexOf('makePlayer({');
      if (callPos === -1) return null;

      let count = 0;
      let end = -1;
      for (let i = callPos + 11; i < html.length; i++) {
        if (html[i] === '{') count++;
        else if (html[i] === '}') {
          count--;
          if (count === 0) {
            end = i;
            break;
          }
        }
      }

      if (end === -1) return null;
      const objStr = html.substring(callPos + 11, end + 1);
      return new Function('return ' + objStr)();
    } catch (err: any) {
      console.warn('[CollapsExtractor] Failed to parse player data:', err.message);
      return null;
    }
  }

  /**
   * Formats a movie result with all available Russian audio tracks
   */
  private formatMovieResult(media: ExtractorMediaInfo, data: any): ExtractionResult {
    const masterHls: string = data.source.hls;
    const audioNames: string[] = data.source.audio?.names || ['Русский'];
    const translations: StreamTranslation[] = [];

    // Build qualities for movie
    const buildQualities = (trackIndex: number): StreamQuality[] => {
      const audioParam = `&audio=rus${trackIndex}`;
      return [
        { quality: '1080p', url: masterHls + audioParam },
        { quality: '720p', url: masterHls + audioParam },
        { quality: '480p', url: masterHls + audioParam },
        { quality: '360p', url: masterHls + audioParam },
      ];
    };

    audioNames.forEach((name, idx) => {
      translations.push({
        id: `collaps_m_${idx}`,
        name: this.cleanTranslationName(name),
        provider: this.name,
        qualities: buildQualities(idx),
        rawMeta: {
          masterHls,
          trackIndex: idx,
          isSeries: false,
        },
      });
    });

    // Ensure Russian Dubbing or main Russian track is first
    translations.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      if (aLower.includes('дубл') || aLower.includes('полное')) return -1;
      if (bLower.includes('дубл') || bLower.includes('полное')) return 1;
      if (aLower.includes('рус')) return -1;
      if (bLower.includes('рус')) return 1;
      return 0;
    });

    return {
      title: media.title,
      year: media.year,
      type: 'movie',
      translations,
    };
  }

  /**
   * Formats a TV series result with all seasons, episodes and audio tracks
   */
  private formatSeriesResult(media: ExtractorMediaInfo, data: any): ExtractionResult {
    const rawSeasons: any[] = data.playlist?.seasons || [];
    if (rawSeasons.length === 0) {
      return {
        title: media.title,
        year: media.year,
        type: 'tv',
        translations: [],
      };
    }

    // Collect all unique audio track names across all episodes
    const audioSet = new Set<string>();
    for (const season of rawSeasons) {
      for (const ep of season.episodes || []) {
        for (const aName of ep.audio?.names || []) {
          audioSet.add(aName);
        }
      }
    }

    const audioList = Array.from(audioSet);
    if (audioList.length === 0) {
      audioList.push('Русский');
    }

    const translations: StreamTranslation[] = [];

    audioList.forEach((audioName, audioIdx) => {
      const seasons: StreamSeason[] = [];

      for (const season of rawSeasons) {
        const episodes: StreamEpisode[] = [];

        for (const ep of season.episodes || []) {
          const epAudioNames: string[] = ep.audio?.names || [];
          let trackIdx = epAudioNames.indexOf(audioName);
          if (trackIdx === -1) trackIdx = 0;

          const masterHls: string = ep.hls || '';
          const audioParam = `&audio=rus${trackIdx}`;

          const qualities: StreamQuality[] = masterHls
            ? [
                { quality: '1080p', url: masterHls + audioParam },
                { quality: '720p', url: masterHls + audioParam },
                { quality: '480p', url: masterHls + audioParam },
                { quality: '360p', url: masterHls + audioParam },
              ]
            : [];

          episodes.push({
            id: `${season.season}_${ep.episode}`,
            episode: ep.episode,
            title: ep.title || `Серия ${ep.episode}`,
            qualities,
          });
        }

        seasons.push({
          season: season.season,
          episodes: episodes.sort((a, b) => a.episode - b.episode),
        });
      }

      translations.push({
        id: `collaps_s_${audioIdx}`,
        name: this.cleanTranslationName(audioName),
        provider: this.name,
        seasons: seasons.sort((a, b) => a.season - b.season),
        rawMeta: {
          audioName,
          audioIdx,
          isSeries: true,
        },
      });
    });

    // Prioritize popular Russian translations (Дубляж, LostFilm, Кубик в кубе)
    translations.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      if (aLower.includes('дубл')) return -1;
      if (bLower.includes('дубл')) return 1;
      if (aLower.includes('lostfilm')) return -1;
      if (bLower.includes('lostfilm')) return 1;
      if (aLower.includes('кубик')) return -1;
      if (bLower.includes('кубик')) return 1;
      return 0;
    });

    return {
      title: media.title,
      year: media.year,
      type: 'tv',
      translations,
    };
  }

  async getStreamUrl(params: EpisodeStreamParams): Promise<StreamQuality[]> {
    // Quality URLs are pre-generated with stream master m3u8 and audio parameter
    return [];
  }

  private cleanTranslationName(rawName: string): string {
    return rawName.trim().replace(/^Рус\.\s*/i, 'Русский ');
  }
}
