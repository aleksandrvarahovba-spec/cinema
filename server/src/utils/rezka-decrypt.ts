import { StreamQuality, VideoQualityName } from '../extractors/types.js';

/**
 * Decodes HDRezka obfuscated stream URLs into structured qualities.
 * HDRezka uses several encoding schemes across different mirrors.
 */
export function decodeRezkaStreams(rawUrlString: string): StreamQuality[] {
  if (!rawUrlString || typeof rawUrlString !== 'string') {
    return [];
  }

  let cleaned = rawUrlString.trim();

  // If obfuscated (starts with #h or contains garbage separators)
  if (!cleaned.startsWith('[') && !cleaned.startsWith('http')) {
    cleaned = decodeObfuscatedString(cleaned);
  }

  return parseStreamList(cleaned);
}

/**
 * Removes HDRezka garbage strings and decodes base64.
 */
function decodeObfuscatedString(input: string): string {
  try {
    let str = input;

    // Remove trash prefixes if present
    if (str.startsWith('#h')) {
      str = str.substring(2);
    }

    // Common garbage tokens HDRezka inserts to break simple base64 decoding
    const trashTokens = [
      '//_//',
      '$$#!!@#!@#',
      'trash@#@',
      '#h',
      '_',
    ];

    // Attempt direct base64 decode if valid
    const cleanAttempt = tryBase64Decode(str);
    if (cleanAttempt && (cleanAttempt.includes('http') || cleanAttempt.includes('['))) {
      return cleanAttempt;
    }

    // Replace known delimiters and retry
    for (const token of trashTokens) {
      if (str.includes(token)) {
        const parts = str.split(token).join('');
        const decoded = tryBase64Decode(parts);
        if (decoded && (decoded.includes('http') || decoded.includes('['))) {
          return decoded;
        }
      }
    }

    // Some mirrors use custom char substitution or nested base64
    const altDecoded = decodeCustomTrash(str);
    if (altDecoded) {
      return altDecoded;
    }
  } catch (err) {
    console.error('Error decoding obfuscated stream string:', err);
  }

  return input;
}

function tryBase64Decode(str: string): string | null {
  try {
    const buff = Buffer.from(str, 'base64');
    const text = buff.toString('utf-8');
    // Sanity check: valid text should contain readable characters
    if (/^[ -~\t\n\rа-яА-ЯёЁ]+$/.test(text) || text.includes('http') || text.includes('[')) {
      return text;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Advanced garbage cleaner matching HDRezka client-side script decoding
 */
function decodeCustomTrash(str: string): string | null {
  try {
    // HDRezka sometimes uses regex replacement of @#@ patterns
    const stripped = str.replace(/@#@.+?@#@/g, '');
    const decoded = tryBase64Decode(stripped);
    if (decoded && (decoded.includes('http') || decoded.includes('['))) {
      return decoded;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Parses format: "[360p]https://.../360p.mp4 or [1080p Ultra]https://.../manifest.m3u8,[720p]..."
 */
export function parseStreamList(streamListStr: string): StreamQuality[] {
  const qualities: StreamQuality[] = [];
  if (!streamListStr) return qualities;

  // Pattern: [quality]url or [quality]url1 or url2
  // Format examples:
  // "[720p]https://example.com/720.mp4:hls:manifest.m3u8"
  // "[1080p]https://cdn.net/stream/1080.m3u8 or https://cdn.net/stream/1080.mp4"
  const regex = /\[([^\]]+)\]([^\,\[]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(streamListStr)) !== null) {
    const rawQuality = match[1].trim();
    const rawUrlGroup = match[2].trim();

    // Sometimes the group contains multiple URLs separated by " or " (e.g. mp4 or m3u8)
    // We prefer m3u8 for adaptive streaming on Smart TV, or mp4 if m3u8 is not present
    const urlParts = rawUrlGroup.split(/\s+or\s+/);
    let chosenUrl = urlParts[0].trim();

    for (const part of urlParts) {
      if (part.includes('.m3u8')) {
        chosenUrl = part.trim();
        break;
      }
    }

    // Clean any trailing labels like :hls:manifest.m3u8
    if (chosenUrl.includes(':hls:manifest.m3u8')) {
      chosenUrl = chosenUrl.replace(':hls:manifest.m3u8', '');
    }

    const quality = normalizeQuality(rawQuality);
    qualities.push({
      quality,
      url: chosenUrl,
    });
  }

  // If no bracket notation was found, but it's a single raw URL
  if (qualities.length === 0 && streamListStr.startsWith('http')) {
    qualities.push({
      quality: '1080p',
      url: streamListStr.trim(),
    });
  }

  return qualities;
}

function normalizeQuality(raw: string): VideoQualityName {
  const lower = raw.toLowerCase();
  if (lower.includes('2160') || lower.includes('4k')) return '2160p';
  if (lower.includes('ultra') || lower.includes('1080p ultra')) return '1080p Ultra';
  if (lower.includes('1080')) return '1080p';
  if (lower.includes('720')) return '720p';
  if (lower.includes('480')) return '480p';
  return '360p';
}
