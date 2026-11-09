import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { spatialNav } from '../navigation/SpatialNavigation.js';
import { useFocusable } from '../navigation/useNavigation.js';
import { MediaItem } from '../types/index.js';

interface TVCardProps {
  item: MediaItem;
  focusKey: string;
  zone?: string;
  onSelect: (item: MediaItem) => void;
  width?: string;
  staggerIndex?: number;
}

export const TVCard: React.FC<TVCardProps> = ({
  item,
  focusKey,
  zone = 'carousel',
  onSelect,
  width = 'w-48',
  staggerIndex = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const { ref, isFocused } = useFocusable({
    focusKey,
    zone,
    onEnter: () => onSelect(item),
  });

  const isActive = isFocused || isHovered;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item);
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onClick={handleClick}
      onMouseEnter={() => {
        setIsHovered(true);
        spatialNav.setFocus(focusKey);
      }}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onSelect(item);
        }
      }}
      style={
        {
          '--stagger-idx': staggerIndex,
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          maskImage: 'radial-gradient(white, black)',
          transition:
            'transform 0.28s cubic-bezier(0.2, 0.9, 0.42, 1), box-shadow 0.28s ease, border-color 0.28s ease',
          WebkitTransform: isActive
            ? 'scale(1.03) translateY(-3px) translateZ(0)'
            : 'scale(1) translateY(0) translateZ(0)',
          transform: isActive
            ? 'scale(1.03) translateY(-3px) translateZ(0)'
            : 'scale(1) translateY(0) translateZ(0)',
          boxShadow: isActive
            ? '0 14px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(255, 255, 255, 0.25)'
            : '0 10px 25px rgba(0, 0, 0, 0.45)',
          borderColor: isActive ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.12)',
        } as React.CSSProperties
      }
      className={`stagger-card movie-card relative flex-shrink-0 cursor-pointer select-none ${width} rounded-[18px] overflow-hidden border-2 ${
        isActive ? 'z-20' : 'z-10'
      }`}
    >
      {/* Poster Container */}
      <div
        style={{
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          maskImage: 'radial-gradient(white, black)',
        }}
        className="relative aspect-[2/3] w-full bg-[#101014] overflow-hidden"
      >
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            style={{
              transition: 'transform 0.45s cubic-bezier(0.2, 0.9, 0.42, 1)',
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-sm text-center p-3 font-medium">
            {item.title}
          </div>
        )}

        {/* Play Overlay (appears smoothly on hover / focus in Apple TV+ style) */}
        <div
          style={{
            transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.42, 1)',
            opacity: isActive ? 1 : 0,
            transform: isActive ? 'scale(1)' : 'scale(0.85)',
          }}
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-center justify-center pointer-events-none z-10"
        >
          <div className="flex-shrink-0 w-13 h-13 aspect-square rounded-full bg-white text-black flex items-center justify-center shadow-2xl">
            <Play fill="currentColor" size={20} className="ml-0.5" />
          </div>
        </div>

        {/* Top Floating Apple-style Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
          {item.rating > 0 ? (
            <div className="px-2 py-0.5 rounded-md apple-badge-rating text-xs font-semibold text-white/90 flex items-center gap-1">
              <span className="text-yellow-400 text-[10px]">★</span>
              <span>{item.rating}</span>
            </div>
          ) : <div />}

          <div className="px-2 py-0.5 rounded-md apple-badge-rating text-[10px] text-white/80 uppercase font-semibold tracking-wider">
            {item.type === 'tv' ? 'Сериал' : 'Фильм'}
          </div>
        </div>
      </div>

      {/* Info Bottom Bar */}
      <div className="p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent backdrop-blur-sm">
        <h4 className="font-semibold text-sm truncate text-white leading-tight">{item.title}</h4>
        <div className="flex items-center justify-between mt-1 text-xs text-white/50 font-normal">
          <span>{item.year || '—'}</span>
          {item.genres && item.genres.length > 0 && (
            <span className="truncate max-w-[105px] text-white/60 text-[11px]">
              {item.genres[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
