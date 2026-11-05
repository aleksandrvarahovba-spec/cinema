import React from 'react';
import { spatialNav } from '../navigation/SpatialNavigation.js';
import { useFocusable } from '../navigation/useNavigation.js';

interface TVButtonProps {
  focusKey: string;
  zone?: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  autoFocus?: boolean;
}

export const TVButton: React.FC<TVButtonProps> = ({
  focusKey,
  zone = 'buttons',
  onClick,
  children,
  variant = 'primary',
  className = '',
  autoFocus = false,
}) => {
  const { ref, isFocused } = useFocusable({
    focusKey,
    zone,
    autoFocus,
    onEnter: onClick,
  });

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return isFocused
          ? 'border-2 border-tv-cyan bg-tv-cyan/25 text-white shadow-[0_0_25px_rgba(0,210,255,0.5)] font-black'
          : 'liquid-glass-accent text-white hover:scale-[1.02] shadow-lg border-2 border-transparent';
      case 'danger':
        return isFocused
          ? 'bg-red-600 text-white border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)] font-bold'
          : 'bg-red-950/70 border-2 border-red-800 text-red-200 hover:bg-red-900';
      case 'secondary':
      default:
        return isFocused
          ? 'liquid-glass-btn text-white border-2 border-white/80 shadow-[0_0_20px_rgba(255,255,255,0.35)] font-black'
          : 'liquid-glass-btn text-gray-200 hover:text-white hover:scale-[1.02] border-2 border-transparent';
    }
  };

  return (
    <button
      ref={ref}
      tabIndex={-1}
      onClick={onClick}
      onMouseEnter={() => spatialNav.setFocus(focusKey)}
      className={`relative px-7 py-3.5 rounded-2xl btn-spring transition-all duration-300 flex items-center justify-center gap-2.5 text-base outline-none select-none cursor-pointer overflow-hidden shimmer-sweep ${getVariantStyles()} ${className}`}
    >
      {children}
    </button>
  );
};
