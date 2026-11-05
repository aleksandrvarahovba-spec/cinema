/**
 * Samsung Tizen and Browser Remote Control Key Mappings
 */
export const TVKeys = {
  // Navigation
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  ENTER: 13,

  // Return / Back
  BACK_TIZEN: 10009,
  BACK_BROWSER: 27, // Escape
  BACK_SPACE: 8,

  // Media Controls (Tizen & Smart Remote)
  PLAY: 415,
  PAUSE: 19,
  PLAY_PAUSE: 10252,
  STOP: 413,
  FAST_FORWARD: 417,
  REWIND: 412,

  // Numeric Keys
  NUM_0: 48,
  NUM_1: 49,
  NUM_2: 50,
  NUM_3: 51,
  NUM_4: 52,
  NUM_5: 53,
  NUM_6: 54,
  NUM_7: 55,
  NUM_8: 56,
  NUM_9: 57,
};

/**
 * Registers Smart TV hardware remote keys via Samsung Tizen WebAPIs
 */
export function registerTizenKeys() {
  if (typeof window !== 'undefined' && (window as any).tizen) {
    try {
      const tvInputDevice = (window as any).tizen.tvinputdevice;
      if (tvInputDevice) {
        const supportedKeys = [
          'Return',
          'MediaPlay',
          'MediaPause',
          'MediaPlayPause',
          'MediaStop',
          'MediaFastForward',
          'MediaRewind',
          '0',
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9',
        ];

        for (const keyName of supportedKeys) {
          try {
            tvInputDevice.registerKey(keyName);
          } catch (e) {
            // Ignore unsupported keys
          }
        }
        console.log('[Tizen] Hardware remote keys successfully registered');
      }
    } catch (err) {
      console.warn('[Tizen] Failed to register TV keys:', err);
    }
  }
}

/**
 * Checks if a KeyboardEvent represents the Back/Return action
 */
export function isBackKey(e: KeyboardEvent): boolean {
  return (
    e.keyCode === TVKeys.BACK_TIZEN ||
    e.keyCode === TVKeys.BACK_BROWSER ||
    (e.keyCode === TVKeys.BACK_SPACE && (e.target as HTMLElement)?.tagName !== 'INPUT')
  );
}

/**
 * Checks if a KeyboardEvent is an Enter / Select action
 */
export function isEnterKey(e: KeyboardEvent): boolean {
  return e.keyCode === TVKeys.ENTER || e.key === 'Enter';
}

/**
 * Checks if a KeyboardEvent is Play/Pause
 */
export function isPlayPauseKey(e: KeyboardEvent): boolean {
  return (
    e.keyCode === TVKeys.PLAY_PAUSE ||
    e.keyCode === TVKeys.PLAY ||
    e.keyCode === TVKeys.PAUSE ||
    e.key === 'MediaPlayPause' ||
    e.code === 'Space'
  );
}
