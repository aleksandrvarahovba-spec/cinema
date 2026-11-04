import { useEffect, useRef, useState } from 'react';
import { spatialNav } from './SpatialNavigation.js';

interface UseFocusableOptions {
  focusKey: string;
  zone?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function useFocusable({
  focusKey,
  zone = 'default',
  autoFocus = false,
  onEnter,
  onFocus,
  onBlur,
}: UseFocusableOptions) {
  const ref = useRef<any>(null);
  const [isFocused, setIsFocused] = useState<boolean>(() => {
    return spatialNav.getCurrentKey() === focusKey;
  });

  const callbacksRef = useRef({ onEnter, onFocus, onBlur });
  callbacksRef.current = { onEnter, onFocus, onBlur };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    spatialNav.register({
      key: focusKey,
      zone,
      element: el,
      onEnter: () => callbacksRef.current.onEnter?.(),
      onFocus: () => {
        setIsFocused(true);
        callbacksRef.current.onFocus?.();
      },
      onBlur: () => {
        setIsFocused(false);
        callbacksRef.current.onBlur?.();
      },
    });

    if (autoFocus) {
      spatialNav.setFocus(focusKey);
    }

    const unsubscribe = spatialNav.subscribe((activeKey) => {
      setIsFocused(activeKey === focusKey);
    });

    return () => {
      unsubscribe();
      spatialNav.unregister(focusKey);
    };
  }, [focusKey, zone, autoFocus]);

  const focus = () => {
    spatialNav.setFocus(focusKey);
  };

  return { ref, isFocused, focus };
}
