import axios from 'axios';
import { FastifyInstance } from 'fastify';
import { config } from '../config.js';

export async function torrserverRoutes(fastify: FastifyInstance) {
  // Check TorrServer status
  fastify.get('/status', async (req, reply) => {
    try {
      const resp = await axios.get(`${config.torrserver.url}/echo`, { timeout: 3000 });
      return reply.send({
        online: true,
        version: resp.data,
        url: config.torrserver.url,
      });
    } catch {
      return reply.send({
        online: false,
        error: `TorrServer unreachable at ${config.torrserver.url}`,
      });
    }
  });

  // Get list of active torrents in TorrServer
  fastify.get('/torrents', async (req, reply) => {
    try {
      const resp = await axios.post(
        `${config.torrserver.url}/torrents`,
        { action: 'list' },
        { timeout: 5000 }
      );
      return reply.send(resp.data);
    } catch (err: any) {
      return reply.status(502).send({ error: 'Failed to fetch torrents', details: err.message });
    }
  });

  // Add magnet link or torrent file to TorrServer
  fastify.post('/add', async (req, reply) => {
    const { link, title, poster } = req.body as {
      link: string;
      title?: string;
      poster?: string;
    };

    if (!link) {
      return reply.status(400).send({ error: 'link parameter is required' });
    }

    try {
      const resp = await axios.post(
        `${config.torrserver.url}/torrents`,
        {
          action: 'add',
          link,
          title: title || 'Media',
          poster: poster || '',
          save_to_db: true,
        },
        { timeout: 10000 }
      );

      const hash = resp.data?.hash;
      const streamUrl = `${config.torrserver.url}/stream?link=${hash}&index=1&play`;

      return reply.send({
        hash,
        streamUrl,
        data: resp.data,
      });
    } catch (err: any) {
      return reply.status(502).send({ error: 'Failed to add torrent', details: err.message });
    }
  });
}
