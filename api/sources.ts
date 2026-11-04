import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers for Smart TV & Web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { title, imdbId, kinopoiskId, type = 'movie' } = req.query as {
    title?: string;
    imdbId?: string;
    kinopoiskId?: string;
    type?: string;
  };

  const translations: any[] = [];

  if (imdbId || kinopoiskId) {
    const collapsBase = imdbId
      ? `https://api.nextembed.ws/embed/imdb/${imdbId}`
      : `https://api.nextembed.ws/embed/kp/${kinopoiskId}`;

    translations.push({
      id: 'collaps_primary',
      name: 'Основной плеер: Дубляж (Collaps Full HD)',
      provider: 'collaps',
      embedUrl: collapsBase,
    });

    const delivembdBase = imdbId
      ? `https://api.delivembd.ws/embed/imdb/${imdbId}`
      : `https://api.delivembd.ws/embed/kp/${kinopoiskId}`;
    translations.push({
      id: 'delivembd_mirror',
      name: 'Резервный плеер (Delivembd 1080p)',
      provider: 'delivembd',
      embedUrl: delivembdBase,
    });

    const kinogramBase = imdbId
      ? `https://api.kinogram.best/embed/imdb/${imdbId}`
      : `https://api.kinogram.best/embed/kp/${kinopoiskId}`;
    translations.push({
      id: 'kinogram_mirror',
      name: 'Плеер Kinogram (Full HD)',
      provider: 'kinogram',
      embedUrl: kinogramBase,
    });

    if (imdbId) {
      translations.push({
        id: 'multiembed_4k',
        name: 'Плеер 4K Ultra HD (Multiembed)',
        provider: 'multiembed',
        embedUrl: `https://multiembed.mov/?video_id=${imdbId}`,
      });
    }
  }

  // Kodik search
  if (title) {
    try {
      const kodikToken = '41dd95f84c21719b09d6c71182237a25';
      const kodikUrl = imdbId
        ? `https://kodik-api.com/search?token=${kodikToken}&imdb_id=${imdbId}`
        : `https://kodik-api.com/search?token=${kodikToken}&title=${encodeURIComponent(title)}`;

      const kRes = await fetch(kodikUrl, { signal: AbortSignal.timeout(3000) });
      if (kRes.ok) {
        const kData = await kRes.json();
        if (kData.results && kData.results.length > 0) {
          kData.results.slice(0, 3).forEach((item: any, idx: number) => {
            const rawLink = item.link || '';
            const embedLink = rawLink.startsWith('//') ? `https:${rawLink}` : rawLink;
            translations.push({
              id: `kodik_${idx}`,
              name: `Kodik: ${item.translation?.title || item.title || 'Сериал'}`,
              provider: 'kodik',
              embedUrl: embedLink,
            });
          });
        }
      }
    } catch {
      // Ignore Kodik timeout
    }
  }

  return res.status(200).json({
    title: title || '',
    type,
    translations,
  });
}
