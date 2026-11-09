import React, { useEffect, useState } from 'react';
import { TVCard } from '../components/TVCard.js';
import { getPopular, getTopRated } from '../services/api.js';
import { MediaItem } from '../types/index.js';

interface CatalogPageProps {
  type: 'movie' | 'tv';
  onSelectMedia: (item: MediaItem) => void;
}

export const CatalogPage: React.FC<CatalogPageProps> = ({ type, onSelectMedia }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [category, setCategory] = useState<'popular' | 'top_rated'>('popular');
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const res =
          category === 'popular'
            ? await getPopular(type, page)
            : await getTopRated(type, page);
        setItems(res.results || []);
      } catch (err) {
        console.error('Failed to load catalog:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [type, category, page]);

  return (
    <div className="space-y-8 w-full pb-20">
      {/* Header & Category Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-white/70" />
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-wide">
              {type === 'movie' ? 'Коллекция фильмов' : 'Каталог сериалов'}
            </h1>
          </div>
          <p className="text-sm text-white/50 mt-1.5 font-medium ml-4">
            OS Cinema • Выбор всех доступных озвучек и качество до 4K Ultra HD
          </p>
        </div>

        {/* Apple Capsule Category Switcher */}
        <div className="flex gap-2 p-1.5 rounded-full bg-white/[0.06] border border-white/12 shadow-xl">
          <button
            onClick={() => setCategory('popular')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 cursor-pointer ${
              category === 'popular'
                ? 'bg-white text-black shadow-lg scale-100'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Популярные
          </button>
          <button
            onClick={() => setCategory('top_rated')}
            className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-300 cursor-pointer ${
              category === 'top_rated'
                ? 'bg-white text-black shadow-lg scale-100'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            Высокий рейтинг
          </button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="h-96 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
          <span className="text-white/70 font-medium text-sm tracking-wide">Загрузка каталога...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-3 pb-16">
          {items.map((item, idx) => (
            <TVCard
              key={item.id}
              item={item}
              focusKey={`cat-${type}-${item.id}`}
              zone="catalog-grid"
              width="w-full"
              staggerIndex={idx}
              onSelect={onSelectMedia}
            />
          ))}
        </div>
      )}
    </div>
  );
};
