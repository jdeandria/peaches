import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Card } from './card';

/** One greyed-out peach drifting behind the hero. */
export interface SplashFloater {
  /** Centre, as a percentage of the screen. */
  readonly x: number;
  readonly y: number;
  /** Glyph size (px). */
  readonly size: number;
  /** One drift there-and-back (s) and its phase offset (s, negative). */
  readonly duration: number;
  readonly delay: number;
  /** How far it drifts (px) and turns (deg). */
  readonly dx: number;
  readonly dy: number;
  readonly turn: number;
  /** Depth: further peaches are blurrier and fainter. */
  readonly blur: number;
  readonly opacity: number;
}

/**
 * The background peaches. Fixed rather than random so the static splash in
 * `index.html` (which repeats this list) and this one line up exactly.
 */
export const SPLASH_FLOATERS: readonly SplashFloater[] = [
  {
    x: 8,
    y: 12,
    size: 44,
    duration: 9,
    delay: -1,
    dx: 18,
    dy: -26,
    turn: 14,
    blur: 0,
    opacity: 0.28,
  },
  {
    x: 78,
    y: 8,
    size: 56,
    duration: 11,
    delay: -4,
    dx: -22,
    dy: -30,
    turn: -12,
    blur: 1,
    opacity: 0.22,
  },
  {
    x: 24,
    y: 30,
    size: 32,
    duration: 8,
    delay: -2,
    dx: 14,
    dy: -20,
    turn: 20,
    blur: 0,
    opacity: 0.3,
  },
  {
    x: 88,
    y: 34,
    size: 38,
    duration: 10,
    delay: -6,
    dx: -16,
    dy: -24,
    turn: 16,
    blur: 0,
    opacity: 0.26,
  },
  {
    x: 6,
    y: 52,
    size: 60,
    duration: 12,
    delay: -3,
    dx: 20,
    dy: -34,
    turn: -10,
    blur: 2,
    opacity: 0.18,
  },
  {
    x: 66,
    y: 22,
    size: 28,
    duration: 7,
    delay: -5,
    dx: 12,
    dy: -18,
    turn: -22,
    blur: 0,
    opacity: 0.3,
  },
  {
    x: 30,
    y: 74,
    size: 50,
    duration: 10,
    delay: -7,
    dx: -20,
    dy: -28,
    turn: 12,
    blur: 1,
    opacity: 0.22,
  },
  {
    x: 84,
    y: 66,
    size: 64,
    duration: 13,
    delay: -2,
    dx: -24,
    dy: -36,
    turn: 8,
    blur: 2,
    opacity: 0.18,
  },
  {
    x: 12,
    y: 88,
    size: 36,
    duration: 9,
    delay: -8,
    dx: 16,
    dy: -22,
    turn: -18,
    blur: 0,
    opacity: 0.28,
  },
  {
    x: 60,
    y: 86,
    size: 42,
    duration: 11,
    delay: -1,
    dx: -14,
    dy: -26,
    turn: 14,
    blur: 0,
    opacity: 0.24,
  },
  {
    x: 46,
    y: 6,
    size: 26,
    duration: 8,
    delay: -3,
    dx: 10,
    dy: -16,
    turn: -16,
    blur: 1,
    opacity: 0.26,
  },
  {
    x: 94,
    y: 90,
    size: 30,
    duration: 9,
    delay: -6,
    dx: -12,
    dy: -20,
    turn: 20,
    blur: 0,
    opacity: 0.28,
  },
  {
    x: 18,
    y: 62,
    size: 24,
    duration: 7,
    delay: -4,
    dx: 10,
    dy: -14,
    turn: 24,
    blur: 0,
    opacity: 0.3,
  },
  {
    x: 80,
    y: 80,
    size: 22,
    duration: 8,
    delay: -2,
    dx: -10,
    dy: -16,
    turn: -20,
    blur: 0,
    opacity: 0.3,
  },
];

/**
 * The full-screen splash: a peach pulsing slowly in a warm glow, a field of
 * greyed-out peaches drifting behind it, and a small tonal card with a
 * dedication. Projected content (a status line, an error and its retry)
 * goes under the card.
 *
 * Mirrors the static `#splash` in `index.html`, which paints before Angular
 * starts. Both run their animations on the page clock (`--pch-splash-clock`
 * is minus the time since navigation), so swapping one for the other
 * carries on mid-pulse instead of restarting.
 */
@Component({
  selector: 'pch-splash',
  imports: [Card],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--pch-splash-clock]': 'clock' },
  template: `
    <div class="field" aria-hidden="true">
      @for (f of floaterStyles; track $index) {
        <span class="floater" [style]="f">🍑</span>
      }
    </div>
    <div class="hero" aria-hidden="true">
      <span class="glow"></span>
      <span class="peach">🍑</span>
    </div>
    <pch-card class="note">
      <span class="note-icon" aria-hidden="true">
        <svg viewBox="0 -960 960 960">
          <path
            d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z"
          />
        </svg>
      </span>
      <span class="note-text">
        <span class="note-for">For the gayest &amp; strongest boy</span>
        <span class="note-name">Stevie</span>
      </span>
    </pch-card>
    <ng-content />
  `,
  styles: `
    :host {
      --pch-splash-clock: 0ms;
      position: relative;
      isolation: isolate;
      min-height: 100dvh;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 16px;
      padding: 24px;
      box-sizing: border-box;
      overflow: hidden;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
      background: var(--mat-sys-surface);
    }
    .field {
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
    }
    .floater {
      position: absolute;
      line-height: 1;
      translate: -50% -50%;
      filter: grayscale(1) blur(var(--blur));
      animation: drift var(--duration) ease-in-out calc(var(--delay) + var(--pch-splash-clock))
        infinite alternate;
    }
    @keyframes drift {
      from {
        transform: translate(0, 0) rotate(0deg);
      }
      to {
        transform: translate(var(--dx), var(--dy)) rotate(var(--turn));
      }
    }
    .hero {
      position: relative;
      display: grid;
      place-items: center;
      width: 176px;
      height: 176px;
      margin-bottom: 8px;
    }
    .glow {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgb(255 138 101 / 0.55) 0%,
        rgb(255 181 158 / 0.3) 40%,
        transparent 70%
      );
      animation: glow 3.2s ease-in-out var(--pch-splash-clock) infinite;
    }
    .peach {
      position: relative;
      font-size: 112px;
      line-height: 1;
      transform-origin: 50% 70%;
      animation: pulse 3.2s ease-in-out var(--pch-splash-clock) infinite;
    }
    /* A slow swell, a sigh, a second deeper swell, then a long exhale. */
    @keyframes pulse {
      0%,
      100% {
        transform: scale(1) rotate(-4deg);
        filter: drop-shadow(0 4px 8px rgb(155 68 39 / 0.25));
      }
      30% {
        transform: scale(1.14, 1.1) rotate(2deg);
        filter: drop-shadow(0 6px 18px rgb(255 120 90 / 0.55));
      }
      45% {
        transform: scale(1.07, 1.05) rotate(4deg);
      }
      62% {
        transform: scale(1.18, 1.13) rotate(1deg);
        filter: drop-shadow(0 8px 26px rgb(255 110 80 / 0.7));
      }
    }
    @keyframes glow {
      0%,
      100% {
        transform: scale(0.7);
        opacity: 0.5;
      }
      30% {
        transform: scale(1);
        opacity: 0.85;
      }
      45% {
        transform: scale(0.88);
        opacity: 0.7;
      }
      62% {
        transform: scale(1.12);
        opacity: 1;
      }
    }
    /*
     * The name card: an M3 elevated card laid out like a list item — a tonal
     * icon container, a supporting line, and the name as the headline.
     */
    .note {
      --pch-card-padding: 16px 24px 16px 16px;
      display: grid;
      grid-template-columns: 40px 1fr;
      align-items: center;
      gap: 16px;
      inline-size: min(320px, 100%);
      text-align: start;
      animation: note-in 700ms var(--pch-ease-emphasized-decelerate)
        calc(300ms + var(--pch-splash-clock)) both;
    }
    @media (prefers-color-scheme: dark) {
      .note {
        background: var(--mat-sys-surface-container-high);
      }
    }
    .note-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--pch-radius-medium);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .note-icon svg {
      width: 20px;
      height: 20px;
      fill: currentColor;
    }
    .note-text {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .note-for {
      font: var(--mat-sys-body-medium);
      letter-spacing: var(--mat-sys-body-medium-tracking);
      color: var(--mat-sys-on-surface-variant);
      text-wrap: balance;
    }
    .note-name {
      font: var(--mat-sys-title-large);
      font-weight: 600;
      letter-spacing: var(--mat-sys-title-large-tracking);
      color: var(--mat-sys-on-surface);
    }
    @keyframes note-in {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .floater,
      .glow,
      .peach,
      .note {
        animation: none;
      }
    }
  `,
})
export class Splash {
  protected readonly floaterStyles = SPLASH_FLOATERS.map((f) => ({
    left: `${f.x}%`,
    top: `${f.y}%`,
    'font-size': `${f.size}px`,
    opacity: f.opacity,
    '--blur': `${f.blur}px`,
    '--dx': `${f.dx}px`,
    '--dy': `${f.dy}px`,
    '--turn': `${f.turn}deg`,
    '--duration': `${f.duration}s`,
    '--delay': `${f.delay}s`,
  }));
  /** Start every animation where the page clock says it already is. */
  protected readonly clock = `${-Math.round(performance.now())}ms`;
}
