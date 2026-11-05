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
            'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease',
          WebkitTransform: isActive
            ? 'scale(1.06) translateY(-4px) translateZ(0)'
            : 'scale(1) translateY(0) translateZ(0)',
          transform: isActive
            ? 'scale(1.06) translateY(-4px) translateZ(0)'
            : 'scale(1) translateY(0) translateZ(0)',
          boxShadow: isActive
            ? '0 0 25px rgba(0, 210, 255, 0.45), inset 0 0 15px rgba(0, 210, 255, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
            : 'inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 10px 25px rgba(0, 0, 0, 0.4)',
          borderColor: isActive ? 'rgba(0, 210, 255, 0.85)' : 'rgba(255, 255, 255, 0.12)',
        } as React.CSSProperties
      }
      className={`stagger-card movie-card relative flex-shrink-0 cursor-pointer select-none ${width} rounded-[20px] overflow-hidden border-2 ${
        isActive ? 'z-20' : 'z-10'
      }`}
    >
      {/* Specular glass reflection bar across card */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none z-10" />

      {/* Poster Container */}
      <div
        style={{
          WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          maskImage: 'radial-gradient(white, black)',
        }}
        className="relative aspect-[2/3] w-full bg-[#0a0f1d] overflow-hidden"
      >
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            style={{
              transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              transform: isActive ? 'scale(1.08)' : 'scale(1)',
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-tv-muted text-sm text-center p-2 font-medium">
            {item.title}
          </div>
        )}

        {/* Play Overlay (appears smoothly on hover / focus) */}
        <div
          style={{
            transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
            opacity: isActive ? 1 : 0,
            transform: isActive ? 'scale(1)' : 'scale(0.85)',
          }}
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex items-center justify-center pointer-events-none z-10"
        >
          <div className="flex-shrink-0 w-14 h-14 aspect-square rounded-full bg-gradient-to-tr from-cyan-400 to-tv-cyan text-black flex items-center justify-center shadow-[0_0_25px_rgba(0,210,255,0.6)]">
            <Play fill="currentColor" size={22} className="ml-1" />
          </div>
        </div>

        {/* Top Floating Glass Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
          {item.rating > 0 ? (
            <div className="px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-md text-xs font-black text-yellow-400 flex items-center gap-1 border border-white/15 shadow-md leading-none">
              <span className="text-[11px] leading-none">★</span>
              <span className="leading-none">{item.rating}</span>
            </div>
          ) : <div />}

          <div className="px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-md text-[10px] text-gray-200 uppercase font-black tracking-wider border border-white/15 shadow-md leading-none">
            {item.type === 'tv' ? 'Сериал' : 'Фильм'}
          </div>
        </div>
      </div>

      {/* Info Bottom Bar */}
      <div className="p-3.5 bg-gradient-to-t from-black/90 to-transparent backdrop-blur-sm">
        <h4 className="font-extrabold text-sm truncate text-white drop-shadow-sm">{item.title}</h4>
        <div className="flex items-center justify-between mt-1 text-xs text-tv-muted font-medium">
          <span className="font-semibold text-gray-300">{item.year || '—'}</span>
          {item.genres && item.genres.length > 0 && (
            <span className="truncate max-w-[105px] text-tv-cyan/80 text-[11px] font-bold">
              {item.genres[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
