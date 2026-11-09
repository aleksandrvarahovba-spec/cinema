import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const targetUrl = (req.query.url as string) || '';
  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const origin = parsedUrl.origin;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: origin + '/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch target balancer: ${response.statusText}`);
    }

    let html = await response.text();

    // 1. Remove third-party ad scripts, casino trackers, clickunders
    html = html.replace(
      /<script[^>]*src=["'][^"']*(?:yandex|adriver|rutarget|zerotop|propeller|monetag|1xbet|melbet|betandyou|vast|banner|onclick|popunder|advert|marketgid|teaser)[^"']*["'][^>]*><\/script>/gi,
      ''
    );

    // 2. Remove third-party ad iframes (banners, clickers)
    html = html.replace(
      /<iframe[^>]*src=["'][^"']*(?:banner|advert|casino|1xbet|melbet|betandyou|promo)[^"']*["'][^>]*><\/iframe>/gi,
      ''
    );

    // 3. Strip Playerjs / Kodik / Venom VAST, preroll, midroll configurations
    html = html.replace(
      /(["']?(?:preroll|midroll|postroll|vast|pa_|adv|advert|banner|brand|clickunder|ad_url|vast_url|vast_url2|vast_url3|preroll_url)[^"':]*["']?\s*:\s*)(["'][^"']*["']|\[[^\]]*\]|\{[^}]*\})/gi,
      '$1""'
    );
    html = html.replace(
      /\b(vast|preroll|midroll|postroll|ad_url)\s*=\s*['"][^'"]*['"]/gi,
      '$1=""'
    );

    // 4. Inject <base> tag so all relative assets, skins, scripts and player styles load seamlessly
    if (!html.includes('<base ') && !html.includes('<base>')) {
      html = html.replace(/<head[^>]*>/i, `$&\n  <base href="${origin}/">`);
    }

    // 5. Inject client-side popup killer and VAST bypass into <head>
    const injection = `
  <script>
    (function() {
      // Neutralize window.open popups & redirects
      window.open = function() { console.log('[OS Cinema Shield] Blocked popup'); return null; };
      window.alert = function() {};
      window.confirm = function() { return true; };

      // Neutralize Playerjs ads
      var checkPjs = function() {
        if (window.Playerjs) {
          try {
            var origPjs = window.Playerjs;
            window.Playerjs = function(cfg) {
              if (cfg) {
                delete cfg.preroll;
                delete cfg.vast;
                delete cfg.midroll;
                delete cfg.postroll;
                delete cfg.brand;
                delete cfg.banner;
              }
              return new origPjs(cfg);
            };
          } catch(e) {}
        }
      };
      checkPjs();
      document.addEventListener('DOMContentLoaded', checkPjs);
    })();
  </script>
`;
    html = html.replace(/<head[^>]*>/i, `$&\n${injection}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err: any) {
    return res.status(500).send(`Proxy error: ${err.message}`);
  }
}
