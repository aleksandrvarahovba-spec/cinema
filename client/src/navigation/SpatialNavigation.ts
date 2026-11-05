export type Direction = 'up' | 'down' | 'left' | 'right';

export interface FocusableNode {
  key: string;
  zone: string;
  element: HTMLElement;
  onEnter?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

class SpatialNavigationManager {
  private nodes: Map<string, FocusableNode> = new Map();
  private currentKey: string | null = null;
  private zoneMemory: Map<string, string> = new Map();
  private listeners: Set<(currentKey: string | null) => void> = new Set();
  private isHandlingKey = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }
  }

  register(node: FocusableNode) {
    this.nodes.set(node.key, node);

    // If nothing is focused yet, or if this node was previously focused
    if (!this.currentKey) {
      this.setFocus(node.key);
    }
  }

  unregister(key: string) {
    this.nodes.delete(key);
    if (this.currentKey === key) {
      // Find another available node in the same zone or any zone
      const nextKey = this.nodes.keys().next().value || null;
      this.setFocus(nextKey);
    }
  }

  getCurrentKey(): string | null {
    return this.currentKey;
  }

  subscribe(listener: (currentKey: string | null) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentKey));
  }

  setFocus(key: string | null) {
    if (this.currentKey === key) return;

    if (this.currentKey && this.nodes.has(this.currentKey)) {
      this.nodes.get(this.currentKey)?.onBlur?.();
    }

    this.currentKey = key;

    if (key && this.nodes.has(key)) {
      const node = this.nodes.get(key)!;
      this.zoneMemory.set(node.zone, key);
      node.onFocus?.();

      if (node.element) {
        try {
          node.element.focus({ preventScroll: true });
        } catch {
          node.element.focus();
        }
      }

      // Ensure element is visible on the 1080p screen (skip stationary zones like keyboard or sidebar)
      if (node.zone !== 'keyboard' && node.zone !== 'sidebar' && node.zone !== 'search-input') {
        try {
          node.element.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          });
        } catch {
          // Fallback
        }
      }
    }

    this.notify();
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Prevent default scrolling on arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }

    if (this.isHandlingKey) return;
    this.isHandlingKey = true;

    try {
      if (e.key === 'ArrowUp' || e.keyCode === 38) {
        this.navigate('up');
      } else if (e.key === 'ArrowDown' || e.keyCode === 40) {
        this.navigate('down');
      } else if (e.key === 'ArrowLeft' || e.keyCode === 37) {
        this.navigate('left');
      } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
        this.navigate('right');
      } else if (e.key === 'Enter' || e.keyCode === 13) {
        if (this.currentKey && this.nodes.has(this.currentKey)) {
          this.nodes.get(this.currentKey)?.onEnter?.();
        }
      }
    } finally {
      this.isHandlingKey = false;
    }
  }

  private navigate(direction: Direction) {
    if (!this.currentKey || !this.nodes.has(this.currentKey)) {
      const first = this.nodes.keys().next().value;
      if (first) this.setFocus(first);
      return;
    }

    const current = this.nodes.get(this.currentKey)!;
    const currentRect = current.element.getBoundingClientRect();

    let bestCandidate: FocusableNode | null = null;
    let minDistance = Infinity;

    // Evaluate all candidates
    for (const [key, candidate] of this.nodes) {
      if (key === this.currentKey) continue;

      // When in keyboard, do NOT jump into search-results unless user explicitly presses 'right'
      if (current.zone === 'keyboard' && candidate.zone === 'search-results' && direction !== 'right') {
        continue;
      }
      // When in search-results, do NOT jump back to keyboard unless user explicitly presses 'left'
      if (current.zone === 'search-results' && candidate.zone === 'keyboard' && direction !== 'left') {
        continue;
      }

      // Skip elements that are not visible or detached
      if (!candidate.element.offsetParent && candidate.element.offsetWidth === 0) {
        continue;
      }

      const rect = candidate.element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const isDirectionalMatch = this.checkDirection(direction, currentRect, rect);
      if (!isDirectionalMatch) continue;

      const dist = this.calculateDistance(direction, currentRect, rect);

      // Prioritize staying in the same zone if close, or matching historical zone memory
      const zoneBonus = candidate.zone === current.zone ? 0 : 50;
      const totalScore = dist + zoneBonus;

      if (totalScore < minDistance) {
        minDistance = totalScore;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      this.setFocus(bestCandidate.key);
    }
  }

  private checkDirection(direction: Direction, from: DOMRect, to: DOMRect): boolean {
    const threshold = 10;
    switch (direction) {
      case 'up':
        return to.bottom <= from.top + threshold;
      case 'down':
        return to.top >= from.bottom - threshold;
      case 'left':
        return to.right <= from.left + threshold;
      case 'right':
        return to.left >= from.right - threshold;
    }
  }

  private calculateDistance(direction: Direction, from: DOMRect, to: DOMRect): number {
    const fromCenterX = from.left + from.width / 2;
    const fromCenterY = from.top + from.height / 2;
    const toCenterX = to.left + to.width / 2;
    const toCenterY = to.top + to.height / 2;

    const dx = Math.abs(fromCenterX - toCenterX);
    const dy = Math.abs(fromCenterY - toCenterY);

    if (direction === 'left' || direction === 'right') {
      return dx + dy * 2.5; // orthogonal penalty
    } else {
      return dy + dx * 2.5;
    }
  }
}

export const spatialNav = new SpatialNavigationManager();
