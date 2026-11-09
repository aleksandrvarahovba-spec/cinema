import { WatchProgress } from '../types/index.js';

const STORAGE_KEYS = {
  HISTORY: 'os_cinema_history',
  OLD_HISTORY: 'varahovba_cinema_history',
  LEGACY_HISTORY: 'tizen_cinema_history',
  FAVORITES: 'os_cinema_favorites',
  OLD_FAVORITES: 'varahovba_cinema_favorites',
  LEGACY_FAVORITES: 'tizen_cinema_favorites',
  SETTINGS: 'os_cinema_settings',
};

export const storage = {
  getHistory(): WatchProgress[] {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEYS.HISTORY) ||
        localStorage.getItem(STORAGE_KEYS.OLD_HISTORY) ||
        localStorage.getItem(STORAGE_KEYS.LEGACY_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  getProgress(mediaId: number): WatchProgress | null {
    const list = this.getHistory();
    return list.find((item) => item.mediaId === mediaId) || null;
  },

  saveProgress(progress: WatchProgress) {
    try {
      const list = this.getHistory().filter((i) => i.mediaId !== progress.mediaId);
      list.unshift({ ...progress, updatedAt: Date.now() });
      // Keep max 50 items
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list.slice(0, 50)));
    } catch (err) {
      console.warn('Failed to save progress:', err);
    }
  },

  getFavorites(): number[] {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEYS.FAVORITES) ||
        localStorage.getItem(STORAGE_KEYS.OLD_FAVORITES) ||
        localStorage.getItem(STORAGE_KEYS.LEGACY_FAVORITES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  isFavorite(mediaId: number): boolean {
    return this.getFavorites().includes(mediaId);
  },

  toggleFavorite(mediaId: number): boolean {
    try {
      let list = this.getFavorites();
      const exists = list.includes(mediaId);
      if (exists) {
        list = list.filter((id) => id !== mediaId);
      } else {
        list.unshift(mediaId);
      }
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(list));
      return !exists;
    } catch {
      return false;
    }
  },
};
