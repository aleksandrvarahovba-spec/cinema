import React from 'react';
import {
  Film,
  History,
  Home,
  Search,
  Sparkles,
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
      className={`relative group flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer select-none transition-all duration-300 btn-spring ${
        isFocused
          ? 'liquid-glass-active text-white scale-[1.04] font-bold z-10'
          : isActive
          ? 'liquid-glass text-tv-cyan border-l-4 border-l-tv-cyan font-bold shadow-lg'
          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      {/* Specular sheen when focused/active */}
      {(isFocused || isActive) && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/20 via-transparent to-transparent pointer-events-none" />
      )}

      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          isFocused
            ? 'bg-tv-cyan text-black shadow-lg shadow-tv-cyan/50'
            : isActive
            ? 'bg-tv-cyan/20 text-tv-cyan border border-tv-cyan/40'
            : 'text-gray-400 group-hover:text-white'
        }`}
      >
        <Icon size={20} className="flex-shrink-0" />
      </div>

      <span className="text-base font-semibold tracking-wide flex-1">{item.label}</span>

      {isActive && (
        <div className="w-1.5 h-1.5 rounded-full bg-tv-cyan shadow-[0_0_8px_#00d1ff] mr-1" />
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate }) => {
  return (
    <aside className="w-[280px] flex-shrink-0 h-full liquid-glass border-r border-white/10 flex flex-col justify-between py-8 px-5 z-20 select-none relative">
      {/* Subtle ambient light inside sidebar */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent pointer-events-none rounded-tl-3xl" />

      <div>
        {/* Brand Logo with Liquid Glass Specular Reflection */}
        <div className="flex items-center gap-3.5 px-2 mb-10 group cursor-default">
          {/* Glass Icon with Specular Sheen */}
          <div className="relative w-12 h-12 rounded-2xl p-[1px] bg-gradient-to-br from-cyan-300 via-indigo-500 to-fuchsia-500 shadow-xl shadow-cyan-500/20 flex-shrink-0">
            <div className="w-full h-full rounded-[15px] bg-[#070b14]/90 backdrop-blur-md flex items-center justify-center overflow-hidden relative">
              {/* Glass reflection gradient */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-transparent to-transparent pointer-events-none" />
              <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-cyan-400/30 blur-sm pointer-events-none" />
              <Sparkles className="text-tv-cyan relative z-10 animate-pulse" size={24} />
            </div>
          </div>

          <div className="flex flex-col">
            <h1 className="font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-300 drop-shadow-md">
              VARAHOVBA
            </h1>
            <p className="text-[10px] text-tv-cyan/90 uppercase tracking-[0.22em] font-extrabold flex items-center gap-1.5 mt-0.5">
              <span>CINEMA</span>
              <span className="w-1 h-1 rounded-full bg-tv-cyan" />
              <span className="text-gray-400 font-semibold">4K ULTRA HD</span>
            </p>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex flex-col gap-3">
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
          <span className="text-xs font-bold text-white tracking-wide">VARAHOVBA OS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-tv-cyan font-bold border border-cyan-500/30">
            v2.0
          </span>
        </div>
        <p className="text-[10px] text-gray-400 font-medium">
          Apple Liquid Glass • Tizen 3.0
        </p>
      </div>
    </aside>
  );
};
