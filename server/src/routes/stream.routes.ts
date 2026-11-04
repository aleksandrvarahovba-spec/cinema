import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { HDRezkaExtractor } from '../extractors/hdrezka.extractor.js';
import { extractorManager } from '../extractors/index.js';
import { ExtractorMediaInfo, StreamQuality } from '../extractors/types.js';

export async function streamRoutes(fastify: FastifyInstance) {
  // Extract all translations for a media item
  fastify.get('/extract', async (req, reply) => {
    const query = req.query as {
      title?: string;
      originalTitle?: string;
      year?: string;
      imdbId?: string;
      kinopoiskId?: string;
      type?: 'movie' | 'tv';
    };

    if (!query.title && !query.originalTitle && !query.imdbId && !query.kinopoiskId) {
      return reply.status(400).send({ error: 'Title or ID is required' });
    }

    const mediaInfo: ExtractorMediaInfo = {
      title: query.title || '',
      originalTitle: query.originalTitle,
      year: query.year ? parseInt(query.year, 10) : undefined,
      imdbId: query.imdbId,
      kinopoiskId: query.kinopoiskId,
      type: query.type || 'movie',
    };

    const extraction = await extractorManager.extractAll(mediaInfo);

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const hostHeader =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers.host as string) ||
      `${req.hostname}:${config.port}`;
    const host = `${proto}://${hostHeader}`;

    const attachProxy = (qList: StreamQuality[], provider: string): StreamQuality[] => {
      const referer =
        provider === 'hdrezka'
          ? config.rezka.mirror
          : provider === 'kodik'
          ? 'https://kodik.info/'
          : 'https://api.nextembed.ws/';

      return qList.map((q) => {
        const isM3u8 = q.url.includes('.m3u8');
        const endpoint = isM3u8 ? '/api/proxy/m3u8' : '/api/proxy/chunk';
        const proxiedUrl = `${host}${endpoint}?url=${encodeURIComponent(
          q.url
        )}&referer=${encodeURIComponent(referer)}`;

        return {
          ...q,
          proxiedUrl,
        };
      });
    };

    // Attach proxiedUrl to all translation qualities
    for (const trans of extraction.translations) {
      if (trans.qualities) {
        trans.qualities = attachProxy(trans.qualities, trans.provider);
      }
      if (trans.seasons) {
        for (const season of trans.seasons) {
          for (const ep of season.episodes) {
            if (ep.qualities) {
              ep.qualities = attachProxy(ep.qualities, trans.provider);
            }
          }
        }
      }
    }

    return reply.send(extraction);
  });

  // Get direct stream qualities for specific translator & episode/movie
  fastify.get('/url', async (req, reply) => {
    const {
      provider = 'collaps',
      translatorId,
      mediaId,
      season,
      episode,
    } = req.query as {
      provider?: string;
      translatorId: string;
      mediaId: string;
      season?: string;
      episode?: string;
    };

    if (!translatorId || !mediaId) {
      return reply.status(400).send({ error: 'translatorId and mediaId are required' });
    }

    const qualities = await extractorManager.getStreamUrl({
      provider,
      translatorId,
      mediaId,
      season: season ? parseInt(season, 10) : undefined,
      episode: episode ? parseInt(episode, 10) : undefined,
    });

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const hostHeader =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers.host as string) ||
      `${req.hostname}:${config.port}`;
    const host = `${proto}://${hostHeader}`;
    const referer =
      provider === 'hdrezka'
        ? config.rezka.mirror
        : provider === 'kodik'
        ? 'https://kodik.info/'
        : 'https://api.nextembed.ws/';

    // Attach proxiedUrl for seamless CORS-free playback on Tizen TV
    const formattedQualities = qualities.map((q) => {
      const isM3u8 = q.url.includes('.m3u8');
      const endpoint = isM3u8 ? '/api/proxy/m3u8' : '/api/proxy/chunk';
      const proxiedUrl = `${host}${endpoint}?url=${encodeURIComponent(
        q.url
      )}&referer=${encodeURIComponent(referer)}`;

      return {
        ...q,
        proxiedUrl,
      };
    });

    return reply.send({
      qualities: formattedQualities,
    });
  });

  // Fetch updated series structure for a specific translator
  fastify.get('/series-structure', async (req, reply) => {
    const {
      provider = 'hdrezka',
      translatorId,
      mediaId,
    } = req.query as {
      provider?: string;
      translatorId: string;
      mediaId: string;
    };

    if (provider === 'hdrezka') {
      try {
        const hdrezka = new HDRezkaExtractor();
        const seasons = await hdrezka.fetchSeriesStructure(mediaId, translatorId);
        if (seasons.length > 0) {
          return reply.send({ seasons });
        }
      } catch {
        // Fall through
      }
    }

    return reply.send({ seasons: [] });
  });
}
