import axios from 'axios';

/**
 * Service to resolve external IDs between TMDB, IMDb, and Kinopoisk
 */
export class IdMapperService {
  private cache: Map<string, { kinopoiskId?: string; imdbId?: string }> = new Map();

  /**
   * Tries to find Kinopoisk ID by IMDb ID or Title/Year
   */
  async findKinopoiskId(imdbId?: string, title?: string, year?: number): Promise<string | null> {
    if (imdbId && this.cache.has(imdbId)) {
      return this.cache.get(imdbId)?.kinopoiskId || null;
    }

    // Try free public ID mapping services (Kinobox / Alloha / KP unofficial search)
    if (imdbId) {
      try {
        const resp = await axios.get(
          `https://kinobox.tv/api/players?imdb=${imdbId}`,
          { timeout: 5000 }
        );
        if (resp.data?.kinopoisk) {
          const kpId = String(resp.data.kinopoisk);
          this.cache.set(imdbId, { kinopoiskId: kpId, imdbId });
          return kpId;
        }
      } catch {
        // Ignore and try fallback
      }
    }

    if (title) {
      try {
        const searchUrl = `https://kinobox.tv/api/players?title=${encodeURIComponent(title)}${
          year ? `&year=${year}` : ''
        }`;
        const resp = await axios.get(searchUrl, { timeout: 5000 });
        if (resp.data?.kinopoisk) {
          const kpId = String(resp.data.kinopoisk);
          if (imdbId) this.cache.set(imdbId, { kinopoiskId: kpId, imdbId });
          return kpId;
        }
      } catch {
        // Ignore
      }
    }

    return null;
  }
}

export const idMapperService = new IdMapperService();
