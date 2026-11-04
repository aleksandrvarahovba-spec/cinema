import { FastifyInstance } from 'fastify';
import { proxyChunk, proxyM3u8 } from '../utils/proxy-stream.js';

export async function proxyRoutes(fastify: FastifyInstance) {
  fastify.get('/m3u8', proxyM3u8);
  fastify.get('/chunk', proxyChunk);
}
