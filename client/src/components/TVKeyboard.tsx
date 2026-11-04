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
}> = ({ char, focusKey, onClick, width = 'w-11 h-11', isSpecial = false }) => {
  const { ref, isFocused } = useFocusable({
    focusKey,
    zone: 'keyboard',
    onEnter: onClick,
  });

  return (
    <button
      ref={ref}
      tabIndex={-1}
      onClick={onClick}
      onMouseEnter={() => spatialNav.setFocus(focusKey)}
      className={`${width} rounded-xl btn-spring flex items-center justify-center font-black text-sm select-none cursor-pointer transition-all duration-200 border ${
        isFocused
          ? 'liquid-glass-active text-black scale-110 shadow-[0_0_20px_rgba(0,209,255,0.7)] z-10 font-black'
          : isSpecial
          ? 'liquid-glass text-tv-cyan border-tv-cyan/30 hover:border-tv-cyan hover:scale-105'
          : 'bg-white/[0.06] hover:bg-white/[0.12] text-white border-white/10 hover:border-white/30 hover:scale-105'
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
    <div className="flex flex-col gap-2.5 p-5 liquid-glass rounded-3xl border border-white/20 shadow-2xl backdrop-blur-2xl w-max">
      {/* Letter / Number Rows */}
      {rows.map((row, rIdx) => (
        <div key={rIdx} className="flex gap-2 justify-center">
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
      <div className="flex gap-2.5 justify-center mt-2 pt-2 border-t border-white/10">
        <KeyboardKey
          char={layout === 'RU' ? 'EN' : 'RU'}
          focusKey="kb-toggle-lang"
          width="w-20 h-11"
          isSpecial
          onClick={() => setLayout((prev) => (prev === 'RU' ? 'EN' : 'RU'))}
        />
        <KeyboardKey
          char="ПРОБЕЛ"
          focusKey="kb-space"
          width="w-40 h-11"
          onClick={() => onInput(' ')}
        />
        <KeyboardKey
          char="⌫ СТЕРЕТЬ"
          focusKey="kb-backspace"
          width="w-28 h-11"
          isSpecial
          onClick={onBackspace}
        />
        <KeyboardKey
          char="ОЧИСТИТЬ"
          focusKey="kb-clear"
          width="w-28 h-11"
          isSpecial
          onClick={onClear}
        />
        <KeyboardKey
          char="НАЙТИ"
          focusKey="kb-submit"
          width="w-24 h-11"
          isSpecial
          onClick={onSubmit}
        />
      </div>
    </div>
  );
};
