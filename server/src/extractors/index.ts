import { AllohaExtractor } from './alloha.extractor.js';
import { BaseExtractor } from './base.extractor.js';
import { CollapsExtractor } from './collaps.extractor.js';
import { HDRezkaExtractor } from './hdrezka.extractor.js';
import { KodikExtractor } from './kodik.extractor.js';
import {
  EpisodeStreamParams,
  ExtractionResult,
  ExtractorMediaInfo,
  StreamQuality,
  StreamTranslation,
} from './types.js';

interface CacheEntry {
  timestamp: number;
  data: ExtractionResult;
}

export class ExtractorManager {
  private extractors: Map<string, BaseExtractor> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

  constructor() {
    // Collaps provides fast direct HD Russian streams for both movies and series
    this.register(new CollapsExtractor());
    this.register(new KodikExtractor());
    this.register(new HDRezkaExtractor());
    this.register(new AllohaExtractor());
  }

  register(extractor: BaseExtractor) {
    this.extractors.set(extractor.name, extractor);
  }

  private getCacheKey(media: ExtractorMediaInfo): string {
    return `${media.type}:${media.imdbId || ''}:${media.kinopoiskId || ''}:${media.title.toLowerCase().trim()}:${media.year || ''}`;
  }

  /**
   * Aggregates real translations from all available providers in parallel.
   * Uses in-memory caching for instant (<100ms) re-opens.
   */
  async extractAll(media: ExtractorMediaInfo): Promise<ExtractionResult> {
    const cacheKey = this.getCacheKey(media);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const combinedTranslations: StreamTranslation[] = [];

    // Query active providers in parallel with strict 3500ms timeout
    const extractorPromises = Array.from(this.extractors.values()).map((ext) => {
      return Promise.race([
        ext.extract(media),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
      ]).catch((err: any) => {
        console.warn(`[ExtractorManager] ${ext.name} error:`, err.message);
        return null;
      });
    });

    const results = await Promise.allSettled(extractorPromises);

    for (const res of results) {
      if (res.status === 'fulfilled' && res.value && res.value.translations.length > 0) {
        combinedTranslations.push(...res.value.translations);
      }
    }

    // Deduplicate translations by name while preserving order
    const seenNames = new Set<string>();
    const deduplicatedTranslations: StreamTranslation[] = [];

    for (const t of combinedTranslations) {
      const normName = t.name.toLowerCase().trim();
      if (!seenNames.has(normName)) {
        seenNames.add(normName);
        deduplicatedTranslations.push(t);
      }
    }

    // Always sort so Russian Dubbing or primary Russian voiceover is first
    deduplicatedTranslations.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      if (aLower.includes('дубл') || aLower.includes('полное')) return -1;
      if (bLower.includes('дубл') || bLower.includes('полное')) return 1;
      if (aLower.includes('рус')) return -1;
      if (bLower.includes('рус')) return 1;
      return 0;
    });

    const finalResult: ExtractionResult = {
      title: media.title,
      year: media.year,
      type: media.type,
      translations: deduplicatedTranslations,
    };

    // Cache if we found valid streams
    if (deduplicatedTranslations.length > 0) {
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: finalResult,
      });
    }

    return finalResult;
  }

  /**
   * Fetches stream qualities from a specific provider
   */
  async getStreamUrl(params: EpisodeStreamParams): Promise<StreamQuality[]> {
    try {
      const extractor = this.extractors.get(params.provider);
      if (extractor) {
        const streamUrls = await extractor.getStreamUrl(params);
        if (streamUrls && streamUrls.length > 0) {
          return streamUrls;
        }
      }
    } catch (err: any) {
      console.warn(`[ExtractorManager] getStreamUrl provider failed:`, err.message);
    }

    return [];
  }
}

export const extractorManager = new ExtractorManager();
