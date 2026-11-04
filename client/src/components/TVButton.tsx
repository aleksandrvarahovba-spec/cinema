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
          ? 'liquid-glass-active text-white ring-2 ring-tv-cyan shadow-[0_0_30px_rgba(0,209,255,0.6)] scale-[1.06] font-black'
          : 'liquid-glass-accent text-white hover:scale-[1.03] shadow-lg';
      case 'danger':
        return isFocused
          ? 'bg-red-600 text-white ring-2 ring-red-400 scale-[1.06] font-bold shadow-lg'
          : 'bg-red-950/70 border border-red-800 text-red-200 hover:bg-red-900';
      case 'secondary':
      default:
        return isFocused
          ? 'liquid-glass-btn text-white ring-2 ring-white border-white/60 shadow-[0_0_25px_rgba(255,255,255,0.4)] scale-[1.06] font-black'
          : 'liquid-glass-btn text-gray-200 hover:text-white hover:scale-[1.02]';
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
