import { FastifyInstance } from 'fastify';
import { tmdbService } from '../services/tmdb.service.js';

export async function catalogRoutes(fastify: FastifyInstance) {
  fastify.get('/trending', async (req, reply) => {
    const { type = 'all', page = '1' } = req.query as {
      type?: 'all' | 'movie' | 'tv';
      page?: string;
    };
    const data = await tmdbService.getTrending(type, parseInt(page, 10) || 1);
    return reply.send(data);
  });

  fastify.get('/popular', async (req, reply) => {
    const { type = 'movie', page = '1' } = req.query as {
      type?: 'movie' | 'tv';
      page?: string;
    };
    const data = await tmdbService.getPopular(type, parseInt(page, 10) || 1);
    return reply.send(data);
  });

  fastify.get('/top-rated', async (req, reply) => {
    const { type = 'movie', page = '1' } = req.query as {
      type?: 'movie' | 'tv';
      page?: string;
    };
    const data = await tmdbService.getTopRated(type, parseInt(page, 10) || 1);
    return reply.send(data);
  });

  fastify.get('/search', async (req, reply) => {
    const { query = '', page = '1' } = req.query as {
      query?: string;
      page?: string;
    };
    if (!query.trim()) {
      return reply.send({ page: 1, totalPages: 0, results: [] });
    }
    const data = await tmdbService.search(query, parseInt(page, 10) || 1);
    return reply.send(data);
  });

  fastify.get('/movie/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const movie = await tmdbService.getMovieDetails(id);
    return reply.send(movie);
  });

  fastify.get('/tv/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const tv = await tmdbService.getTvDetails(id);
    return reply.send(tv);
  });

  fastify.get('/tv/:id/season/:seasonNumber', async (req, reply) => {
    const { id, seasonNumber } = req.params as {
      id: string;
      seasonNumber: string;
    };
    const season = await tmdbService.getTvSeason(id, parseInt(seasonNumber, 10));
    return reply.send(season);
  });
}
