import React, { useState } from 'react';
import { spatialNav } from '../navigation/SpatialNavigation.js';
import { useFocusable } from '../navigation/useNavigation.js';

interface TVKeyboardProps {
  onInput: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
}

const RU_KEYS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Й', 'Ц', 'У', 'К', 'Е', 'Н', 'Г', 'Ш', 'Щ', 'З', 'Х', 'Ъ'],
  ['Ф', 'Ы', 'В', 'А', 'П', 'Р', 'О', 'Л', 'Д', 'Ж', 'Э'],
  ['Я', 'Ч', 'С', 'М', 'И', 'Т', 'Ь', 'Б', 'Ю', '.'],
];

const EN_KEYS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '-'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '_', '/'],
];

const KeyboardKey: React.FC<{
  char: string;
  focusKey: string;
  onClick: () => void;
  width?: string;
  isSpecial?: boolean;
}> = ({ char, focusKey, onClick, width = 'flex-1', isSpecial = false }) => {
  const { ref, isFocused } = useFocusable({
    focusKey,
    zone: 'keyboard',
    onEnter: onClick,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
    if (ref.current) {
      try {
        ref.current.focus({ preventScroll: true });
      } catch {
        ref.current.focus();
      }
    }
    spatialNav.setFocus(focusKey);
  };

  return (
    <button
      ref={ref}
      tabIndex={-1}
      type="button"
      onClick={handleClick}
      onMouseEnter={() => spatialNav.setFocus(focusKey)}
      className={`${width} h-10 rounded-lg btn-spring flex items-center justify-center font-bold text-xs select-none cursor-pointer transition-all duration-150 border box-border ${
        isFocused
          ? 'liquid-glass-active text-black scale-105 shadow-[0_0_16px_rgba(0,209,255,0.7)] z-10 font-black'
          : isSpecial
          ? 'liquid-glass text-tv-cyan border-tv-cyan/30 hover:border-tv-cyan'
          : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border-white/10 hover:border-white/30'
      }`}
    >
      {char}
    </button>
  );
};

export const TVKeyboard: React.FC<TVKeyboardProps> = ({
  onInput,
  onBackspace,
  onClear,
  onSubmit,
}) => {
  const [layout, setLayout] = useState<'RU' | 'EN'>('RU');
  const rows = layout === 'RU' ? RU_KEYS : EN_KEYS;

  return (
    <div className="flex flex-col gap-2 p-3.5 liquid-glass rounded-2xl border border-white/20 shadow-2xl backdrop-blur-2xl w-full max-w-[480px] box-border select-none">
      {/* Letter / Number Rows */}
      {rows.map((row, rIdx) => (
        <div key={rIdx} className="flex gap-1.5 w-full justify-between">
          {row.map((char) => (
            <KeyboardKey
              key={`${layout}-${char}`}
              char={char}
              focusKey={`kb-${layout}-${rIdx}-${char}`}
              onClick={() => onInput(char)}
            />
          ))}
        </div>
      ))}

      {/* Action / Control Row */}
      <div className="flex gap-1.5 w-full justify-between mt-1 pt-2 border-t border-white/10">
        <KeyboardKey
          char={layout === 'RU' ? 'EN' : 'RU'}
          focusKey="kb-toggle-lang"
          width="w-14"
          isSpecial
          onClick={() => setLayout((prev) => (prev === 'RU' ? 'EN' : 'RU'))}
        />
        <KeyboardKey
          char="ПРОБЕЛ"
          focusKey="kb-space"
          width="flex-1"
          onClick={() => onInput(' ')}
        />
        <KeyboardKey
          char="⌫"
          focusKey="kb-backspace"
          width="w-12"
          isSpecial
          onClick={onBackspace}
        />
        <KeyboardKey
          char="СБРОС"
          focusKey="kb-clear"
          width="w-14"
          isSpecial
          onClick={onClear}
        />
        <KeyboardKey
          char="НАЙТИ"
          focusKey="kb-submit"
          width="w-16"
          isSpecial
          onClick={onSubmit}
        />
      </div>
    </div>
  );
};
