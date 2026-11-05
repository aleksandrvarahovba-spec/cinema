import React, { useState } from 'react';
import { History, Play, Sparkles, Trash2 } from 'lucide-react';
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
    localStorage.removeItem('varahovba_cinema_history');
    localStorage.removeItem('tizen_cinema_history');
    setHistory([]);
  };

  const handleRemoveItem = (mediaId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((i) => i.mediaId !== mediaId);
    localStorage.setItem('varahovba_cinema_history', JSON.stringify(updated));
    setHistory(updated);
  };

  return (
    <div className="space-y-8 w-full pb-20">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-7 rounded-full bg-tv-cyan shadow-[0_0_10px_#00d1ff]" />
            <h1 className="text-3xl lg:text-4xl font-black text-white tracking-wide">
              История просмотров
            </h1>
          </div>
          <p className="text-sm text-tv-muted mt-1.5 font-medium ml-5">
            Продолжайте просмотр фильмов и сериалов с сохраненного таймкода
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-950/60 hover:bg-red-900 border border-red-800/80 text-red-200 text-sm font-bold transition-all cursor-pointer shadow-lg hover:scale-105 btn-spring"
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
                className="stagger-card movie-card group relative rounded-[20px] overflow-hidden cursor-pointer hover:scale-[1.04] transition-all duration-300 shadow-xl border-2 border-white/10 hover:border-tv-cyan hover:shadow-[0_0_25px_rgba(0,210,255,0.45)]"
              >
                {/* Poster / Thumbnail */}
                <div className="relative aspect-video bg-[#0a0f1d] overflow-hidden">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 font-bold">
                      {item.title}
                    </div>
                  )}

                  {/* Play overlay button */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-400 to-tv-cyan text-black flex items-center justify-center shadow-2xl shadow-cyan-500/50">
                      <Play fill="currentColor" size={22} className="ml-0.5" />
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => handleRemoveItem(item.mediaId, e)}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all border border-white/20 shadow-md"
                    title="Удалить из истории"
                  >
                    <Trash2 size={14} />
                  </button>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 w-full h-2 bg-black/60">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-tv-cyan shadow-[0_0_8px_#00d1ff]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="font-black text-sm text-white truncate drop-shadow-sm">
                    {item.title}
                  </h4>
                  <div className="flex justify-between items-center text-xs text-tv-muted mt-1.5 font-semibold">
                    <span>{item.season ? `S${item.season} • E${item.episode}` : 'Фильм'}</span>
                    <span className="text-tv-cyan font-bold">{percent}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center gap-4 liquid-glass rounded-3xl p-10 border border-white/10 text-center">
          <History className="text-tv-cyan/80" size={48} />
          <span className="text-white font-extrabold text-xl">История просмотров пуста</span>
          <span className="text-gray-400 text-sm max-w-md">
            Фильмы и сериалы, которые вы начнете смотреть, автоматически появятся здесь с сохраненным таймкодом
          </span>
        </div>
      )}
    </div>
  );
};
