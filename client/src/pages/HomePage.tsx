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
        <div className="w-12 h-12 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
        <span className="text-white/70 font-medium text-sm tracking-wide">
          Загрузка OS Cinema...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-12 w-full pb-20">
      {/* Hero Featured Title in Apple Frosted Glass */}
      {heroItem && (
        <div className="relative min-h-[480px] rounded-[28px] overflow-hidden shadow-2xl flex items-end p-10 lg:p-12 bg-white/[0.04] border border-white/12">
          {/* Ken Burns Animated Backdrop */}
          {heroItem.backdrop && (
            <img
              src={heroItem.backdrop}
              alt={heroItem.title}
              className="absolute inset-0 w-full h-full object-cover object-top opacity-30 pointer-events-none ken-burns"
            />
          )}

          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/70 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#000000] via-[#000000]/50 to-transparent pointer-events-none" />

          {/* Content */}
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1 rounded-full bg-white/15 text-white text-xs font-semibold tracking-wider uppercase backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-md">
                <Sparkles size={13} className="text-white/80" />
                <span>В тренде недели</span>
              </span>
              {heroItem.rating > 0 && (
                <span className="text-yellow-400 font-bold text-sm px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-sm">
                  ★ {heroItem.rating}
                </span>
              )}
              {heroItem.year && (
                <span className="text-white/70 text-sm font-medium">{heroItem.year}</span>
              )}
            </div>

            <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight drop-shadow-lg tracking-wide">
              {heroItem.title}
            </h1>

            <p className="text-white/75 text-base line-clamp-3 leading-relaxed drop-shadow max-w-2xl">
              {heroItem.overview}
            </p>

            <div className="flex items-center gap-4 pt-3">
              <TVButton
                focusKey="hero-watch"
                zone="hero"
                autoFocus
                onClick={() => onPlayDirect(heroItem)}
                className="font-bold text-lg px-8 py-3.5 rounded-full shadow-xl"
              >
                <Play fill="currentColor" size={20} />
                <span>Смотреть</span>
              </TVButton>

              <TVButton
                focusKey="hero-details"
                zone="hero"
                variant="secondary"
                onClick={() => onSelectMedia(heroItem)}
                className="font-semibold text-base px-7 py-3 rounded-full"
              >
                <Info size={18} />
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
            <div className="w-1 h-5 rounded-full bg-white/70" />
            <h3 className="text-2xl font-bold text-white tracking-wide">Продолжить просмотр</h3>
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
                  className="stagger-card movie-card flex-shrink-0 w-64 rounded-[18px] overflow-hidden cursor-pointer hover:scale-[1.03] transition-all duration-300 shadow-xl border border-white/10 hover:border-white/90 hover:shadow-[0_14px_36px_rgba(0,0,0,0.75),0_0_20px_rgba(255,255,255,0.25)] bg-[#101014]"
                >
                  <div className="relative aspect-video bg-[#141418] overflow-hidden">
                    {hist.poster ? (
                      <img src={hist.poster} alt={hist.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-white/40 font-medium">
                        {hist.title}
                      </div>
                    )}
                    {/* Progress bar in Apple White */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-black/60">
                      <div className="h-full bg-white" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <div className="p-3.5">
                    <h5 className="font-semibold text-sm text-white truncate">{hist.title}</h5>
                    <div className="flex justify-between items-center text-xs text-white/50 mt-1 font-medium">
                      <span>{hist.season ? `S${hist.season}:E${hist.episode}` : 'Фильм'}</span>
                      <span className="text-white font-semibold">{percent}%</span>
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
          <div className="w-1 h-5 rounded-full bg-white/70" />
          <h3 className="text-2xl font-bold text-white tracking-wide">Сейчас смотрят</h3>
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
          <div className="w-1 h-5 rounded-full bg-white/70" />
          <h3 className="text-2xl font-bold text-white tracking-wide">Популярные фильмы</h3>
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
          <div className="w-1 h-5 rounded-full bg-white/70" />
          <h3 className="text-2xl font-bold text-white tracking-wide">Популярные сериалы</h3>
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
          <div className="w-1 h-5 rounded-full bg-white/70" />
          <h3 className="text-2xl font-bold text-white tracking-wide">Шедевры мирового кино</h3>
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
