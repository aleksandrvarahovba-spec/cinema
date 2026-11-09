import React, { useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { storage } from '../services/storage.js';
import { MediaItem, WatchProgress } from '../types/index.js';

interface HistoryPageProps {
  onPlayDirect: (item: MediaItem, resumeTime?: number) => void;
  onSelectMedia: (item: MediaItem) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  onPlayDirect,
  onSelectMedia,
}) => {
  const [history, setHistory] = useState<WatchProgress[]>(() => storage.getHistory());

  const handleClearAll = () => {
    localStorage.removeItem('os_cinema_history');
    localStorage.removeItem('varahovba_cinema_history');
    localStorage.removeItem('tizen_cinema_history');
    setHistory([]);
  };

  return (
    <div className="space-y-8 w-full pb-20">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-white/70" />
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-wide">
              История просмотров
            </h1>
          </div>
          <p className="text-sm text-white/50 mt-1.5 font-medium ml-4">
            Продолжайте просмотр фильмов и сериалов с сохраненного таймкода
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-sm font-semibold transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
          >
            <Trash2 size={16} />
            <span>Очистить историю</span>
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-3 pb-16">
          {history.map((item, idx) => {
            const percent =
              item.duration > 0 ? Math.round((item.currentTime / item.duration) * 100) : 0;
            return (
              <div
                key={item.mediaId}
                style={{ '--stagger-idx': idx } as React.CSSProperties}
                onClick={() =>
                  onSelectMedia({
                    id: item.mediaId,
                    type: item.type,
                    title: item.title,
                    originalTitle: '',
                    overview: '',
                    poster: item.poster,
                    backdrop: null,
                    rating: 0,
                    voteCount: 0,
                    year: null,
                  })
                }
                className="stagger-card movie-card group relative rounded-[18px] overflow-hidden cursor-pointer hover:scale-[1.03] transition-all duration-300 shadow-xl border border-white/10 hover:border-white/90 hover:shadow-[0_14px_36px_rgba(0,0,0,0.75),0_0_20px_rgba(255,255,255,0.25)] bg-[#101014]"
              >
                {/* Poster / Thumbnail */}
                <div className="relative aspect-video bg-[#141418] overflow-hidden">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-white/40 font-medium">
                      {item.title}
                    </div>
                  )}

                  {/* Play overlay button in Apple pure white */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
                      <Play fill="currentColor" size={20} className="ml-0.5" />
                    </div>
                  </div>

                  {/* Clean White Progress Bar */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-black/60">
                    <div
                      className="h-full bg-white transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="p-3.5">
                  <h5 className="font-semibold text-sm text-white truncate">{item.title}</h5>
                  <div className="flex justify-between items-center text-xs text-white/50 mt-1 font-medium">
                    <span>{item.season ? `S${item.season}:E${item.episode}` : 'Фильм'}</span>
                    <span className="text-white font-semibold">{percent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-80 flex flex-col items-center justify-center gap-3 bg-white/[0.04] rounded-[24px] p-8 border border-white/10 text-center">
          <span className="text-white font-bold text-lg">История пуста</span>
          <span className="text-white/50 text-sm max-w-sm">
            Здесь будут отображаться фильмы и сериалы, которые вы начали смотреть
          </span>
        </div>
      )}
    </div>
  );
};
