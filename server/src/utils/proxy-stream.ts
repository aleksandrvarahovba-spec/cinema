import axios from 'axios';
import { FastifyReply, FastifyRequest } from 'fastify';
import { URL } from 'url';
import { config } from '../config.js';

/**
 * Resolves relative URLs within m3u8 playlists against base playlist URL.
 */
function resolveUrl(baseUrl: string, relativePath: string): string {
  try {
    return new URL(relativePath, baseUrl).toString();
  } catch {
    return relativePath;
  }
}

/**
 * Proxies and rewrites M3U8 playlists to bypass CORS, Referer, and User-Agent restrictions.
 */
export async function proxyM3u8(
  req: FastifyRequest<{
    Querystring: { url: string; referer?: string; origin?: string; audio?: string };
  }>,
  reply: FastifyReply
) {
  const { url, referer, origin, audio } = req.query;

  if (!url) {
    return reply.status(400).send({ error: 'Missing url parameter' });
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (referer) headers['Referer'] = referer;
    if (origin) headers['Origin'] = origin;

    const response = await axios.get(url, {
      headers,
      responseType: 'text',
      timeout: 15000,
    });

    const m3u8Content = response.data as string;
    const lines = m3u8Content.split('\n');
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const hostHeader =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers.host as string) ||
      `${req.hostname}:${config.port}`;
    const proxyHost = `${proto}://${hostHeader}`;

    // Target audio track if specified either as query param or inside upstream URL
    let targetAudio = audio ? audio.toLowerCase() : null;
    if (!targetAudio && url.includes('audio=')) {
      const match = url.match(/[?&]audio=([^&]+)/i);
      if (match) {
        targetAudio = decodeURIComponent(match[1]).toLowerCase();
      }
    }

    const rewrittenLines = lines.map((line) => {
      let trimmed = line.trim();
      if (!trimmed) return line;

      // Handle audio track selection if requested
      if (targetAudio && trimmed.startsWith('#EXT-X-MEDIA:TYPE=AUDIO')) {
        const isTarget =
          trimmed.toLowerCase().includes(`name="${targetAudio}"`) ||
          trimmed.toLowerCase().includes(`group-id="${targetAudio}"`);

        trimmed = trimmed.replace(
          /DEFAULT=(YES|NO)/i,
          isTarget ? 'DEFAULT=YES' : 'DEFAULT=NO'
        );
        trimmed = trimmed.replace(
          /AUTOSELECT=(YES|NO)/i,
          isTarget ? 'AUTOSELECT=YES' : 'AUTOSELECT=NO'
        );
      }

      // Handle URI= in #EXT-X-KEY or #EXT-X-MEDIA (audio, subs)
      if (trimmed.startsWith('#EXT-X-KEY') || trimmed.startsWith('#EXT-X-MEDIA')) {
        return trimmed.replace(/URI="([^"]+)"/, (match, subUrl) => {
          const absolute = resolveUrl(url, subUrl);
          const endpoint = absolute.includes('.m3u8') ? '/api/proxy/m3u8' : '/api/proxy/chunk';
          const proxied = `${proxyHost}${endpoint}?url=${encodeURIComponent(
            absolute
          )}&referer=${encodeURIComponent(referer || '')}`;
          return `URI="${proxied}"`;
        });
      }

      // Ignore other tags
      if (trimmed.startsWith('#')) {
        return trimmed;
      }

      // It's a segment or sub-playlist URL
      const absoluteUrl = resolveUrl(url, trimmed);

      // If it's another m3u8 (master playlist)
      if (absoluteUrl.includes('.m3u8')) {
        return `${proxyHost}/api/proxy/m3u8?url=${encodeURIComponent(
          absoluteUrl
        )}&referer=${encodeURIComponent(referer || '')}`;
      }

      // Chunk segment (.ts, .aac, .m4s, etc.)
      return `${proxyHost}/api/proxy/chunk?url=${encodeURIComponent(
        absoluteUrl
      )}&referer=${encodeURIComponent(referer || '')}`;
    });

    const rewrittenM3u8 = rewrittenLines.join('\n');

    reply
      .header('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Headers', '*')
      .header('Cache-Control', 'no-cache')
      .send(rewrittenM3u8);
  } catch (error: any) {
    console.error(`Failed to proxy m3u8: ${url}`, error.message);
    reply.status(502).send({ error: 'Failed to fetch m3u8 playlist', details: error.message });
  }
}

/**
 * Proxies video chunks (.ts, .m4s, mp4, etc.) with HTTP Range support for seeking.
 */
export async function proxyChunk(
  req: FastifyRequest<{
    Querystring: { url: string; referer?: string };
  }>,
  reply: FastifyReply
) {
  const { url, referer } = req.query;

  if (!url) {
    return reply.status(400).send({ error: 'Missing url parameter' });
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (referer) upstreamHeaders['Referer'] = referer;

    // Forward Range header if client is seeking in video
    if (req.headers.range) {
      upstreamHeaders['Range'] = req.headers.range;
    }

    const response = await axios.get(url, {
      headers: upstreamHeaders,
      responseType: 'stream',
      timeout: 20000,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    // Set CORS headers
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', '*');
    reply.header('Accept-Ranges', 'bytes');

    if (response.headers['content-type']) {
      reply.header('Content-Type', response.headers['content-type']);
    }
    if (response.headers['content-length']) {
      reply.header('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      reply.header('Content-Range', response.headers['content-range']);
    }

    reply.status(response.status);
    return reply.send(response.data);
  } catch (error: any) {
    console.error(`Failed to proxy chunk: ${url}`, error.message);
    reply.status(502).send({ error: 'Failed to stream media chunk', details: error.message });
  }
}
