import cors from '@fastify/cors';
import Fastify from 'fastify';
import { config } from './config.js';
import { catalogRoutes } from './routes/catalog.routes.js';
import { proxyRoutes } from './routes/proxy.routes.js';
import { streamRoutes } from './routes/stream.routes.js';
import { torrserverRoutes } from './routes/torrserver.routes.js';

const fastify = Fastify({
  trustProxy: true,
  logger: {
    level: 'info',
  },
});

async function main() {
  // Setup CORS for TV client, Vercel and browser debugging (allow all origins)
  await fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type'],
  });

  // Healthcheck
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'os-cinema-backend',
  }));

  // Register API modules
  await fastify.register(catalogRoutes, { prefix: '/api/catalog' });
  await fastify.register(streamRoutes, { prefix: '/api/stream' });
  await fastify.register(proxyRoutes, { prefix: '/api/proxy' });
  await fastify.register(torrserverRoutes, { prefix: '/api/torrserver' });

  try {
    const address = await fastify.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`🚀 OS Cinema Server listening at ${address}`);
    console.log(`📺 Catalog API: ${address}/api/catalog`);
    console.log(`🎬 Stream API:  ${address}/api/stream`);
    console.log(`🔄 Proxy API:   ${address}/api/proxy`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
