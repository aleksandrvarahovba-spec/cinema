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
          ? 'bg-white text-black border-2 border-white/95 shadow-[0_14px_36px_rgba(0,0,0,0.75),0_0_24px_rgba(255,255,255,0.45)] scale-[1.03] font-semibold'
          : 'bg-white text-black hover:bg-white/90 shadow-md border-2 border-transparent font-semibold';
      case 'danger':
        return isFocused
          ? 'bg-red-600 text-white border-2 border-white shadow-[0_14px_36px_rgba(0,0,0,0.75),0_0_20px_rgba(239,68,68,0.5)] scale-[1.03] font-semibold'
          : 'bg-red-950/70 border-2 border-red-800 text-red-200 hover:bg-red-900';
      case 'secondary':
      default:
        return isFocused
          ? 'bg-white text-black border-2 border-white shadow-[0_14px_36px_rgba(0,0,0,0.75),0_0_20px_rgba(255,255,255,0.35)] scale-[1.03] font-semibold'
          : 'bg-white/10 text-white/90 hover:text-white hover:bg-white/15 border border-white/15 font-medium';
    }
  };

  return (
    <button
      ref={ref}
      tabIndex={-1}
      onClick={onClick}
      onMouseEnter={() => spatialNav.setFocus(focusKey)}
      className={`relative px-7 py-3.5 rounded-full btn-spring transition-all duration-200 flex items-center justify-center gap-2.5 text-base outline-none select-none cursor-pointer overflow-hidden ${getVariantStyles()} ${className}`}
    >
      {children}
    </button>
  );
};
