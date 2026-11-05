import React, { useEffect, useState } from 'react';
import { Info, Play, Sparkles } from 'lucide-react';
import { TVButton } from '../components/TVButton.js';
import { TVCard } from '../components/TVCard.js';
import { getPopular, getTopRated, getTrending } from '../services/api.js';
import { storage } from '../services/storage.js';
import { MediaItem, WatchProgress } from '../types/index.js';

interface HomePageProps {
  onSelectMedia: (item: MediaItem) => void;
  onPlayDirect: (item: MediaItem, resumeTime?: number) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onSelectMedia, onPlayDirect }) => {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>([]);
  const [popularTv, setPopularTv] = useState<MediaItem[]>([]);
  const [topRated, setTopRated] = useState<MediaItem[]>([]);
  const [history, setHistory] = useState<WatchProgress[]>([]);
  const [heroItem, setHeroItem] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadCatalog() {
      setIsLoading(true);
      try {
        const [trendRes, popMovRes, popTvRes, topRes] = await Promise.all([
          getTrending('all', 1),
          getPopular('movie', 1),
          getPopular('tv', 1),
          getTopRated('movie', 1),
        ]);

        const trendItems = trendRes.results || [];
        setTrending(trendItems);
        setPopularMovies(popMovRes.results || []);
        setPopularTv(popTvRes.results || []);
        setTopRated(topRes.results || []);

        if (trendItems.length > 0) {
          setHeroItem(trendItems[0]);
        }

        setHistory(storage.getHistory());
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadCatalog();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-96 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 border-4 border-tv-cyan border-t-transparent rounded-full animate-spin"></div>
        <span className="text-gray-300 font-bold text-sm tracking-wide">
          Загрузка VARAHOVBA CINEMA...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-12 w-full pb-20">
      {/* Hero Featured Title in Liquid Glass */}
      {heroItem && (
        <div className="relative min-h-[480px] rounded-3xl overflow-hidden shadow-2xl flex items-end p-10 lg:p-12 liquid-glass border border-white/20">
          {/* Ken Burns Animated Backdrop */}
          {heroItem.backdrop && (
            <img
              src={heroItem.backdrop}
              alt={heroItem.title}
              className="absolute inset-0 w-full h-full object-cover object-top opacity-35 pointer-events-none ken-burns"
            />
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#06090e] via-[#06090e]/75 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#06090e] via-[#06090e]/50 to-transparent pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1 rounded-full liquid-glass border border-tv-cyan/40 text-tv-cyan text-xs font-black tracking-widest uppercase shadow-md flex items-center gap-1.5">
                <Sparkles size={14} className="animate-pulse" />
                <span>В тренде недели</span>
              </span>
              {heroItem.rating > 0 && (
                <span className="text-yellow-400 font-black text-sm px-2.5 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 shadow-sm">
                  ★ {heroItem.rating}
                </span>
              )}
              {heroItem.year && (
                <span className="text-gray-300 text-sm font-bold">{heroItem.year}</span>
              )}
            </div>

            <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight drop-shadow-lg tracking-wide">
              {heroItem.title}
            </h1>

            <p className="text-gray-300 text-base line-clamp-3 leading-relaxed drop-shadow max-w-2xl">
              {heroItem.overview}
            </p>

            <div className="flex items-center gap-4 pt-3">
              <TVButton
                focusKey="hero-watch"
                zone="hero"
                autoFocus
                onClick={() => onPlayDirect(heroItem)}
                className="font-black text-lg px-9 shadow-xl"
              >
                <Play fill="currentColor" size={22} />
                <span>Смотреть</span>
              </TVButton>

              <TVButton
                focusKey="hero-details"
                zone="hero"
                variant="secondary"
                onClick={() => onSelectMedia(heroItem)}
                className="font-bold text-base px-7"
              >
                <Info size={20} />
                <span>Подробнее</span>
              </TVButton>
            </div>
          </div>
        </div>
      )}

      {/* Row: Продолжить просмотр (if history exists) */}
      {history.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 rounded-full bg-tv-cyan shadow-[0_0_8px_#00d1ff]" />
            <h3 className="text-2xl font-black text-white tracking-wide">Продолжить просмотр</h3>
          </div>
          <div className="flex gap-6 overflow-x-auto pt-3 pb-6 px-3 scrollbar-none items-center">
            {history.map((hist, idx) => {
              const percent =
                hist.duration > 0 ? Math.round((hist.currentTime / hist.duration) * 100) : 0;
              return (
                <div
                  key={hist.mediaId}
                  style={{ '--stagger-idx': idx } as React.CSSProperties}
                  onClick={() =>
                    onPlayDirect(
                      {
                        id: hist.mediaId,
                        type: hist.type,
                        title: hist.title,
                        originalTitle: '',
                        overview: '',
                        poster: hist.poster,
                        backdrop: null,
                        rating: 0,
                        voteCount: 0,
                        year: null,
                      },
                      hist.currentTime
                    )
                  }
                  className="stagger-card movie-card flex-shrink-0 w-64 rounded-[20px] overflow-hidden cursor-pointer hover:scale-[1.04] transition-all duration-300 shadow-xl border-2 border-white/10 hover:border-tv-cyan hover:shadow-[0_0_25px_rgba(0,210,255,0.45)]"
                >
                  <div className="relative aspect-video bg-[#0a0f1d] overflow-hidden">
                    {hist.poster ? (
                      <img src={hist.poster} alt={hist.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-medium">
                        {hist.title}
                      </div>
                    )}
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 w-full h-1.5 bg-black/60">
                      <div className="h-full bg-gradient-to-r from-cyan-400 to-tv-cyan shadow-[0_0_8px_#00d1ff]" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <div className="p-3.5">
                    <h5 className="font-extrabold text-sm text-white truncate">{hist.title}</h5>
                    <div className="flex justify-between items-center text-xs text-tv-muted mt-1 font-medium">
                      <span>{hist.season ? `S${hist.season}:E${hist.episode}` : 'Фильм'}</span>
                      <span className="text-tv-cyan font-bold">{percent}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Row: В тренде */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full bg-tv-cyan shadow-[0_0_8px_#00d1ff]" />
          <h3 className="text-2xl font-black text-white tracking-wide">Сейчас смотрят</h3>
        </div>
        <div className="flex gap-6 overflow-x-auto pt-3 pb-6 px-3 scrollbar-none items-center">
          {trending.map((item, idx) => (
            <TVCard
              key={`trend-${item.id}`}
              item={item}
              focusKey={`home-trend-${item.id}`}
              zone="home-trend"
              staggerIndex={idx}
              onSelect={onSelectMedia}
            />
          ))}
        </div>
      </div>

      {/* Row: Популярные фильмы */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
          <h3 className="text-2xl font-black text-white tracking-wide">Популярные фильмы</h3>
        </div>
        <div className="flex gap-6 overflow-x-auto pt-3 pb-6 px-3 scrollbar-none items-center">
          {popularMovies.map((item, idx) => (
            <TVCard
              key={`pop-m-${item.id}`}
              item={item}
              focusKey={`home-pop-m-${item.id}`}
              zone="home-pop-m"
              staggerIndex={idx}
              onSelect={onSelectMedia}
            />
          ))}
        </div>
      </div>

      {/* Row: Популярные сериалы */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full bg-fuchsia-400 shadow-[0_0_8px_#e879f9]" />
          <h3 className="text-2xl font-black text-white tracking-wide">Популярные сериалы</h3>
        </div>
        <div className="flex gap-6 overflow-x-auto pt-3 pb-6 px-3 scrollbar-none items-center">
          {popularTv.map((item, idx) => (
            <TVCard
              key={`pop-tv-${item.id}`}
              item={item}
              focusKey={`home-pop-tv-${item.id}`}
              zone="home-pop-tv"
              staggerIndex={idx}
              onSelect={onSelectMedia}
            />
          ))}
        </div>
      </div>

      {/* Row: Лучшие по рейтингу */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]" />
          <h3 className="text-2xl font-black text-white tracking-wide">Шедевры мирового кино</h3>
        </div>
        <div className="flex gap-6 overflow-x-auto pt-3 pb-6 px-3 scrollbar-none items-center">
          {topRated.map((item, idx) => (
            <TVCard
              key={`top-${item.id}`}
              item={item}
              focusKey={`home-top-${item.id}`}
              zone="home-top"
              staggerIndex={idx}
              onSelect={onSelectMedia}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
