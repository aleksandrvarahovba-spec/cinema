import React, { useState } from 'react';
import { Search as SearchIcon, Sparkles } from 'lucide-react';
import { TVCard } from '../components/TVCard.js';
import { TVKeyboard } from '../components/TVKeyboard.js';
import { searchMedia } from '../services/api.js';
import { MediaItem } from '../types/index.js';

interface SearchPageProps {
  onSelectMedia: (item: MediaItem) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onSelectMedia }) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Search API trigger
  const performSearch = async (searchStr: string) => {
    if (!searchStr.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await searchMedia(searchStr);
      setResults(res.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInput = (char: string) => {
    const next = query + char;
    setQuery(next);
    if (next.length >= 2) {
      performSearch(next);
    }
  };

  const handleBackspace = () => {
    const next = query.slice(0, -1);
    setQuery(next);
    if (next.length >= 2) {
      performSearch(next);
    } else {
      setResults([]);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
  };

  return (
    <div
      className="fixed top-0 left-[280px] right-0 bottom-0 h-screen overflow-hidden flex bg-[#06090e] z-10 box-border p-8 lg:p-10 gap-8"
      style={{
        position: 'fixed',
        top: 0,
        left: '280px',
        right: 0,
        bottom: 0,
        width: 'calc(100% - 280px)',
        height: '100vh',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Левая колонка (клавиатура и инпут): width: 480px; flex-shrink: 0; height: 100%; overflow: hidden; — стоит неподвижно */}
      <div
        className="w-[480px] min-w-[480px] max-w-[480px] flex-shrink-0 h-full overflow-hidden flex flex-col gap-4 select-none box-border"
        style={{
          width: '480px',
          minWidth: '480px',
          maxWidth: '480px',
          flexShrink: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-6 rounded-full bg-tv-cyan shadow-[0_0_10px_#00d1ff]" />
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-wide">
              Поиск фильмов
            </h2>
          </div>
          <p className="text-xs text-tv-muted mt-1 font-medium ml-5">
            Начните вводить название с экранной клавиатуры
          </p>
        </div>

        {/* Liquid Glass Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-3 liquid-glass rounded-2xl border border-white/20 shadow-xl flex-shrink-0">
          <SearchIcon className="text-tv-cyan flex-shrink-0" size={20} />
          <div className="flex-1 text-base font-black text-white tracking-wide min-h-[24px] overflow-hidden whitespace-nowrap truncate">
            {query || (
              <span className="text-gray-400 font-normal text-sm">Введите название...</span>
            )}
          </div>
          {query && (
            <span className="text-[11px] text-tv-cyan font-bold px-2.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
              {results.length} найдено
            </span>
          )}
        </div>

        {/* Stationary Keyboard */}
        <div className="flex-1 overflow-hidden flex flex-col justify-start">
          <TVKeyboard
            onInput={handleInput}
            onBackspace={handleBackspace}
            onClear={handleClear}
            onSubmit={() => performSearch(query)}
          />
        </div>
      </div>

      {/* Правая колонка (результаты поиска): flex: 1; height: 100%; overflow-y: auto; — скроллится только она */}
      <div
        className="flex-1 h-full overflow-y-auto pr-4 scrollbar-none min-w-0"
        style={{
          flex: '1 1 0%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {isSearching ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-tv-cyan border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-300 font-bold text-sm tracking-wide">
              Поиск в VARAHOVBA CINEMA...
            </span>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pt-1 pb-20">
            {results.map((item, idx) => (
              <TVCard
                key={item.id}
                item={item}
                focusKey={`search-result-${item.id}`}
                zone="search-results"
                width="w-full"
                staggerIndex={idx}
                onSelect={onSelectMedia}
              />
            ))}
          </div>
        ) : query ? (
          <div className="h-80 flex flex-col items-center justify-center gap-3 liquid-glass rounded-3xl p-8 border border-white/10 text-center">
            <span className="text-3xl">🔍</span>
            <span className="text-white font-bold text-lg">Ничего не найдено</span>
            <span className="text-gray-400 text-sm max-w-sm">
              Попробуйте изменить запрос или ввести оригинальное английское название тайтла
            </span>
          </div>
        ) : (
          <div className="h-80 flex flex-col items-center justify-center gap-4 liquid-glass rounded-3xl p-8 border border-white/10 text-center">
            <Sparkles className="text-tv-cyan" size={36} />
            <span className="text-white font-extrabold text-lg">
              Быстрый поиск по базе 100 000+ фильмов и сериалов
            </span>
            <span className="text-gray-400 text-sm max-w-md">
              Ищите любые новинки, классику кино, сериалы и мультфильмы в 4K Ultra HD качестве
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
