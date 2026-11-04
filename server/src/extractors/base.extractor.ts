import {
  EpisodeStreamParams,
  ExtractionResult,
  ExtractorMediaInfo,
  StreamQuality,
} from './types.js';

export abstract class BaseExtractor {
  abstract readonly name: string;

  /**
   * Search and extract available translations and season/episode structure
   */
  abstract extract(media: ExtractorMediaInfo): Promise<ExtractionResult | null>;

  /**
   * Get direct stream URLs for specific translation and episode/movie
   */
  abstract getStreamUrl(params: EpisodeStreamParams): Promise<StreamQuality[]>;
}
