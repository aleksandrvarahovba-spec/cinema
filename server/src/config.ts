import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || '4ef0d7355d9ffb5151e987764708ce96',
    baseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
    imageBaseUrl: process.env.TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p',
    defaultLanguage: 'ru-RU',
  },
  rezka: {
    mirror: process.env.REZKA_MIRROR || 'https://hdrezka.me',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  kodik: {
    apiToken: process.env.KODIK_API_TOKEN || '41dd95f84c21719b09d6c71182237a25',
    baseUrl: 'https://kodik-api.com',
  },
  alloha: {
    token: process.env.ALLOHA_TOKEN || '',
    baseUrl: 'https://api.alloha.tv',
  },
  torrserver: {
    url: process.env.TORRSERVER_URL || 'http://127.0.0.1:8090',
  },
};
