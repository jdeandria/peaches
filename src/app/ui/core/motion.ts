import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Tracks the user's `prefers-reduced-motion` setting as a signal. Every
 * JS-driven animation in the UI kit checks it; CSS animations are handled
 * by the global reduced-motion rules.
 */
@Injectable({ providedIn: 'root' })
export class ReducedMotion {
  private readonly state = signal(false);
  readonly reduced = this.state.asReadonly();

  constructor() {
    const mq =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (!mq) return;
    this.state.set(mq.matches);
    const listener = (e: MediaQueryListEvent) => this.state.set(e.matches);
    mq.addEventListener?.('change', listener);
    inject(DestroyRef).onDestroy(() => mq.removeEventListener?.('change', listener));
  }
}

/**
 * A requestAnimationFrame loop bound to a component's lifetime. `start`
 * calls `tick(elapsedMs)` every frame until `tick` returns false or `stop`
 * is called. Falls back to doing nothing where rAF is unavailable.
 */
export class FrameLoop {
  private handle = 0;
  private startedAt = 0;

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => this.stop());
  }

  get running(): boolean {
    return this.handle !== 0;
  }

  start(tick: (elapsedMs: number) => boolean | void): void {
    this.stop();
    if (typeof requestAnimationFrame !== 'function') return;
    this.startedAt = performance.now();
    const frame = (now: number) => {
      const keepGoing = tick(Math.max(0, now - this.startedAt));
      this.handle = keepGoing === false ? 0 : requestAnimationFrame(frame);
    };
    this.handle = requestAnimationFrame(frame);
  }

  stop(): void {
    if (this.handle && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.handle);
    }
    this.handle = 0;
  }
}
