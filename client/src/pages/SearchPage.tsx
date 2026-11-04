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
    <div className="flex gap-12 w-full min-h-[600px] pb-20">
      {/* Left Column: Virtual Keyboard & Input Box */}
      <div className="flex flex-col gap-6 w-[580px] flex-shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-7 rounded-full bg-tv-cyan shadow-[0_0_10px_#00d1ff]" />
            <h2 className="text-3xl lg:text-4xl font-black text-white tracking-wide">
              Поиск фильмов
            </h2>
          </div>
          <p className="text-sm text-tv-muted mt-1.5 font-medium ml-5">
            Начните вводить название с экранной клавиатуры пульта ДУ
          </p>
        </div>

        {/* Liquid Glass Search Input Bar */}
        <div className="flex items-center gap-4 px-6 py-4 liquid-glass rounded-2xl border border-white/20 shadow-2xl">
          <SearchIcon className="text-tv-cyan" size={24} />
          <div className="flex-1 text-xl font-black text-white tracking-wide min-h-[28px] overflow-hidden whitespace-nowrap">
            {query || (
              <span className="text-gray-400 font-normal">Начните ввод названия...</span>
            )}
          </div>
          {query && (
            <span className="text-xs text-tv-cyan font-bold px-3 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              {results.length} найдено
            </span>
          )}
        </div>

        {/* Liquid Glass TV Keyboard */}
        <TVKeyboard
          onInput={handleInput}
          onBackspace={handleBackspace}
          onClear={handleClear}
          onSubmit={() => performSearch(query)}
        />
      </div>

      {/* Right Column: Search Results Grid */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {isSearching ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 border-4 border-tv-cyan border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-300 font-bold text-sm tracking-wide">
              Поиск в VARAHOVBA CINEMA...
            </span>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-3 pb-16">
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
