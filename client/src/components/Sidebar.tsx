import React from 'react';
import {
  Film,
  History,
  Home,
  Search,
  Tv,
} from 'lucide-react';
import { spatialNav } from '../navigation/SpatialNavigation.js';
import { useFocusable } from '../navigation/useNavigation.js';
import { ScreenType } from '../types/index.js';

interface SidebarProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
}

const NAV_ITEMS: { screen: ScreenType; label: string; icon: React.ComponentType<any> }[] = [
  { screen: 'home', label: 'Главная', icon: Home },
  { screen: 'movies', label: 'Фильмы', icon: Film },
  { screen: 'tv', label: 'Сериалы', icon: Tv },
  { screen: 'search', label: 'Поиск', icon: Search },
  { screen: 'history', label: 'История', icon: History },
];

const SidebarItem: React.FC<{
  item: (typeof NAV_ITEMS)[0];
  isActive: boolean;
  onSelect: () => void;
}> = ({ item, isActive, onSelect }) => {
  const { ref, isFocused } = useFocusable({
    focusKey: `sidebar-${item.screen}`,
    zone: 'sidebar',
    onEnter: onSelect,
  });

  const Icon = item.icon;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onClick={onSelect}
      onMouseEnter={() => spatialNav.setFocus(`sidebar-${item.screen}`)}
      className={`relative group flex items-center gap-3.5 px-4 py-3 rounded-full cursor-pointer select-none transition-all duration-200 btn-spring ${
        isActive
          ? 'bg-white text-black font-semibold shadow-[0_6px_20px_rgba(255,255,255,0.25)] z-10'
          : isFocused
          ? 'bg-white/20 text-white font-semibold border-2 border-white/90 shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-[1.03] z-10'
          : 'text-white/70 hover:text-white hover:bg-white/[0.08] border border-transparent'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
          isActive
            ? 'bg-black/10 text-black'
            : isFocused
            ? 'bg-white/20 text-white'
            : 'text-white/60 group-hover:text-white'
        }`}
      >
        <Icon size={18} className="flex-shrink-0" />
      </div>

      <span className="text-sm font-semibold tracking-wide flex-1">{item.label}</span>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate }) => {
  return (
    <aside
      className="w-[280px] min-w-[280px] max-w-[280px] flex-shrink-0 h-full bg-[#08080a]/80 backdrop-blur-3xl border-r border-white/10 flex flex-col justify-between py-8 px-5 z-20 select-none relative box-border"
      style={{
        width: '280px',
        minWidth: '280px',
        maxWidth: '280px',
        flexShrink: 0,
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top subtle ambient highlight */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none rounded-tl-3xl" />

      <div>
        {/* Brand Logo in Apple TV+ / visionOS Minimalist Style */}
        <div className="flex items-center gap-3.5 px-2 mb-10 group cursor-default">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-b from-white/25 via-white/10 to-white/5 border border-white/30 shadow-[0_4px_16px_rgba(0,0,0,0.5)] flex items-center justify-center flex-shrink-0 backdrop-blur-md">
            <span className="font-extrabold text-base tracking-tighter text-white drop-shadow">OS</span>
          </div>

          <div className="flex flex-col">
            <h1 className="font-bold text-xl tracking-tight text-white leading-tight flex items-center gap-1.5">
              <span>OS</span>
              <span className="font-light text-white/75">Cinema</span>
            </h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-semibold mt-0.5">
              tvOS • 4K HDR
            </p>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex flex-col gap-2.5">
          {NAV_ITEMS.map((item) => (
            <SidebarItem
              key={item.screen}
              item={item}
              isActive={currentScreen === item.screen}
              onSelect={() => onNavigate(item.screen)}
            />
          ))}
        </nav>
      </div>

      {/* Footer Branding Badge */}
      <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white tracking-wide">OS Cinema</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/90 font-semibold border border-white/20">
            tvOS 18
          </span>
        </div>
        <p className="text-[10px] text-white/45 font-medium">
          Apple TV+ Experience • Dolby Vision
        </p>
      </div>
    </aside>
  );
};
