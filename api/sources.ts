import type { VercelRequest, VercelResponse } from '@vercel/node';

function parsePlayerData(html: string): any {
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
  } catch {
    return null;
  }
}

function cleanTranslationName(rawName: string): string {
  return rawName.trim().replace(/^Рус\.\s*/i, 'Русский ');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers for Smart TV & Web
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { title, imdbId, kinopoiskId, type = 'movie', year } = req.query as {
    title?: string;
    imdbId?: string;
    kinopoiskId?: string;
    type?: string;
    year?: string;
  };

  const translations: any[] = [];
  const collapsMirrors = [
    'https://api.nextembed.ws/embed/',
    'https://api.kinogram.best/embed/',
    'https://api.delivembd.ws/embed/',
  ];

  const paths: string[] = [];
  if (imdbId) paths.push(`imdb/${imdbId}`);
  if (kinopoiskId) paths.push(`kp/${kinopoiskId}`);

  let collapsEmbedBase = imdbId
    ? `https://api.nextembed.ws/embed/imdb/${imdbId}`
    : kinopoiskId
    ? `https://api.nextembed.ws/embed/kp/${kinopoiskId}`
    : '';

  // 1. Fetch Collaps direct .m3u8 streams server-side (Bypasses all iframe ads)
  let playerData: any = null;
  for (const mirror of collapsMirrors) {
    for (const p of paths) {
      try {
        const cRes = await fetch(`${mirror}${p}`, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: mirror,
          },
          signal: AbortSignal.timeout(4500),
        });

        if (cRes.ok) {
          const html = await cRes.text();
          playerData = parsePlayerData(html);
          if (playerData) {
            collapsEmbedBase = `${mirror}${p}`;
            break;
          }
        }
      } catch {
        // Try next mirror
      }
    }
    if (playerData) break;
  }

  if (playerData) {
    const isTv = type === 'tv' || !!playerData.playlist?.seasons;

    if (isTv && playerData.playlist?.seasons && playerData.playlist.seasons.length > 0) {
      const rawSeasons: any[] = playerData.playlist.seasons;

      // Collect all unique audio tracks
      const audioSet = new Set<string>();
      for (const season of rawSeasons) {
        for (const ep of season.episodes || []) {
          for (const aName of ep.audio?.names || []) {
            audioSet.add(aName);
          }
        }
      }

      const audioList = Array.from(audioSet);
      if (audioList.length === 0) audioList.push('Русский (Стандарт)');

      audioList.forEach((audioName, audioIdx) => {
        const seasons = rawSeasons
          .map((s: any) => {
            const seasonNum = parseInt(s.season, 10);
            const episodes = (s.episodes || [])
              .map((ep: any) => {
                const epNum = parseInt(ep.episode, 10);
                const epAudioNames: string[] = ep.audio?.names || [];
                let trackIdx = epAudioNames.indexOf(audioName);
                if (trackIdx === -1) trackIdx = 0;

                const masterHls: string = ep.hls || '';
                const audioParam = `&audio=rus${trackIdx}`;
                const streamUrl = masterHls ? masterHls + audioParam : '';

                return {
                  id: `${seasonNum}_${epNum}`,
                  episode: epNum,
                  title: ep.title || `Серия ${epNum}`,
                  qualities: streamUrl
                    ? [
                        { quality: '1080p', url: streamUrl },
                        { quality: '720p', url: streamUrl },
                        { quality: '480p', url: streamUrl },
                        { quality: '360p', url: streamUrl },
                      ]
                    : [],
                };
              })
              .filter((ep: any) => !isNaN(ep.episode) && ep.episode > 0)
              .sort((a: any, b: any) => a.episode - b.episode);

            return {
              season: seasonNum,
              episodes,
            };
          })
          .filter((s: any) => !isNaN(s.season) && s.season > 0)
          .sort((a: any, b: any) => a.season - b.season);

        translations.push({
          id: `collaps_s_${audioIdx}`,
          name: `${cleanTranslationName(audioName)} (Без рекламы / Direct HD)`,
          provider: 'collaps',
          embedUrl: collapsEmbedBase,
          seasons,
        });
      });
    } else if (playerData.source?.hls) {
      const masterHls: string = playerData.source.hls;
      const audioNames: string[] = playerData.source.audio?.names || ['Русский (Дубляж)'];

      audioNames.forEach((name, idx) => {
        const audioParam = `&audio=rus${idx}`;
        const streamUrl = masterHls + audioParam;
        translations.push({
          id: `collaps_m_${idx}`,
          name: `${cleanTranslationName(name)} (Без рекламы / Direct HD)`,
          provider: 'collaps',
          embedUrl: `${collapsEmbedBase}?audio=rus${idx}`,
          qualities: [
            { quality: '1080p', url: streamUrl },
            { quality: '720p', url: streamUrl },
            { quality: '480p', url: streamUrl },
            { quality: '360p', url: streamUrl },
          ],
        });
      });
    }
  }

  // 2. Add Kodik Balancer
  if (title) {
    try {
      const kodikToken = '41dd95f84c21719b09d6c71182237a25';
      const kodikUrl = imdbId
        ? `https://kodik-api.com/search?token=${kodikToken}&imdb_id=${imdbId}`
        : `https://kodik-api.com/search?token=${kodikToken}&title=${encodeURIComponent(title)}`;

      const kRes = await fetch(kodikUrl, { signal: AbortSignal.timeout(3500) });
      if (kRes.ok) {
        const kData = await kRes.json();
        if (kData.results && kData.results.length > 0) {
          kData.results.slice(0, 3).forEach((item: any, idx: number) => {
            const rawLink = item.link || '';
            const embedLink = rawLink.startsWith('//') ? `https:${rawLink}` : rawLink;
            translations.push({
              id: `kodik_${idx}_${item.id || idx}`,
              name: `Kodik: ${cleanTranslationName(item.translation?.title || item.title || 'Сериал')}`,
              provider: 'kodik',
              embedUrl: `/api/proxy-embed?url=${encodeURIComponent(embedLink)}`,
              rawMeta: { originalEmbed: embedLink },
            });
          });
        }
      }
    } catch {
      // Ignore Kodik timeout
    }
  }

  // 3. Fallback Mirrors for manual backup (Proxied with VAST/ad stripping)
  if (imdbId || kinopoiskId) {
    const delivembdBase = imdbId
      ? `https://api.delivembd.ws/embed/imdb/${imdbId}`
      : `https://api.delivembd.ws/embed/kp/${kinopoiskId}`;
    translations.push({
      id: 'delivembd_mirror',
      name: 'Резервный плеер (Delivembd HD)',
      provider: 'delivembd',
      embedUrl: `/api/proxy-embed?url=${encodeURIComponent(delivembdBase)}`,
      rawMeta: { originalEmbed: delivembdBase },
    });

    const kinogramBase = imdbId
      ? `https://api.kinogram.best/embed/imdb/${imdbId}`
      : `https://api.kinogram.best/embed/kp/${kinopoiskId}`;
    translations.push({
      id: 'kinogram_mirror',
      name: 'Плеер Kinogram (Full HD)',
      provider: 'kinogram',
      embedUrl: `/api/proxy-embed?url=${encodeURIComponent(kinogramBase)}`,
      rawMeta: { originalEmbed: kinogramBase },
    });

    if (imdbId) {
      translations.push({
        id: 'multiembed_4k',
        name: 'Плеер 4K Ultra HD (Multiembed)',
        provider: 'multiembed',
        embedUrl: `/api/proxy-embed?url=${encodeURIComponent(`https://multiembed.mov/?video_id=${imdbId}`)}`,
      });
    }
  }

  // Sort translations so direct ad-free translations (Collaps with qualities or seasons) come FIRST
  translations.sort((a, b) => {
    const aHasDirect = Boolean(
      (a.qualities && a.qualities.length > 0) ||
      (a.seasons && a.seasons.length > 0 && a.seasons[0]?.episodes?.[0]?.qualities?.length > 0)
    );
    const bHasDirect = Boolean(
      (b.qualities && b.qualities.length > 0) ||
      (b.seasons && b.seasons.length > 0 && b.seasons[0]?.episodes?.[0]?.qualities?.length > 0)
    );
    if (aHasDirect && !bHasDirect) return -1;
    if (!aHasDirect && bHasDirect) return 1;
    return 0;
  });

  return res.status(200).json({
    title: title || '',
    year: year ? parseInt(year, 10) : undefined,
    type,
    translations,
  });
}
