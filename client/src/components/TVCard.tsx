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
          transition:
            'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-color 0.35s ease, background 0.35s ease',
          transform: isActive ? 'scale(1.07) translateY(-6px)' : 'scale(1) translateY(0)',
          boxShadow: isActive
            ? '0 16px 36px rgba(0, 209, 255, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
            : 'inset 0 1px 1px rgba(255, 255, 255, 0.2), 0 10px 25px rgba(0, 0, 0, 0.4)',
          borderColor: isActive ? 'rgba(0, 209, 255, 0.9)' : 'rgba(255, 255, 255, 0.12)',
        } as React.CSSProperties
      }
      className={`stagger-card relative flex-shrink-0 cursor-pointer select-none ${width} rounded-3xl overflow-hidden liquid-glass-card border ${
        isActive ? 'z-20' : 'z-10'
      }`}
    >
      {/* Specular glass reflection bar across card */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent pointer-events-none z-10" />

      {/* Poster Container */}
      <div className="relative aspect-[2/3] w-full bg-[#0a0f1d] overflow-hidden">
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
            style={{
              transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              transform: isActive ? 'scale(1.1)' : 'scale(1)',
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
            transition:
              'opacity 0.35s ease, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
            opacity: isActive ? 1 : 0,
            transform: isActive ? 'scale(1)' : 'scale(0.85)',
          }}
          className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-center pointer-events-none z-10"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-400 to-tv-cyan text-black flex items-center justify-center shadow-2xl shadow-cyan-500/50">
            <Play fill="currentColor" size={24} className="ml-0.5" />
          </div>
        </div>

        {/* Top Floating Glass Badges */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 pointer-events-none">
          {item.rating > 0 ? (
            <div className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-xs font-black text-yellow-400 flex items-center gap-1 border border-white/10 shadow-md">
              <span>★</span>
              <span>{item.rating}</span>
            </div>
          ) : <div />}

          <div className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] text-gray-200 uppercase font-black tracking-wider border border-white/10 shadow-md">
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
