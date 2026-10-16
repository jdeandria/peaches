import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { cssColor } from '../core/colors';
import { FrameLoop, ReducedMotion } from '../core/motion';
import { M3Springs, springCurve, springDuration } from '../core/springs';

const STROKE = 4;
const WAVELENGTH = 28;
const AMPLITUDE = 3;
const GAP = 4;
const HEIGHT = 12;
const FLOW_PERIOD_MS = 1600;

/**
 * The M3 Expressive wavy linear progress indicator (port of `WavyProgress`).
 *
 * The active indicator is a sine wave; the remaining track is flat with a
 * gap and a stop dot at the end. The wave flattens as the value approaches
 * 1. With `flowing` the wave travels continuously (reserve for the one bar
 * that matters on screen). Value changes spring to the new value.
 *
 * Decorative (aria-hidden) unless `label` is set, in which case it is a
 * `progressbar` with `aria-valuenow` 0–100.
 */
@Component({
  selector: 'pch-wavy-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'label() ? "progressbar" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-valuemin]': 'label() ? 0 : null',
    '[attr.aria-valuemax]': 'label() ? 100 : null',
    '[attr.aria-valuenow]': 'label() ? percent() : null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `<svg width="100%" height="12" [attr.viewBox]="viewBox()" aria-hidden="true">
    @let g = geometry();
    @if (g.track) {
      <line
        [attr.x1]="g.track[0]"
        y1="6"
        [attr.x2]="g.track[1]"
        y2="6"
        [style.stroke]="trackFill()"
        stroke-width="4"
        stroke-linecap="round"
      />
    }
    @if (g.dot) {
      <circle [attr.cx]="g.dot" cy="6" r="2" [style.fill]="fill()" />
    }
    @if (g.wave) {
      <path
        [attr.d]="g.wave"
        fill="none"
        [style.stroke]="fill()"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    }
  </svg>`,
  styles: `
    :host {
      display: block;
      height: 12px;
      min-width: 24px;
    }
    svg {
      display: block;
      overflow: visible;
    }
  `,
})
export class WavyProgress {
  /** Progress, 0..1 (clamped). */
  readonly value = input.required<number>();
  /** Let the wave travel continuously (stops under reduced motion). */
  readonly flowing = input(false, { transform: booleanAttribute });
  /** Indicator colour: M3 role or CSS colour (default primary). */
  readonly color = input<string>();
  /** Track colour: M3 role or CSS colour (default secondary-container). */
  readonly trackColor = input<string>();
  /** Accessible name; when set the bar is announced as a progressbar. */
  readonly label = input<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly reduced = inject(ReducedMotion).reduced;
  private readonly destroyRef = inject(DestroyRef);
  private readonly valueLoop = new FrameLoop(this.destroyRef);
  private readonly flowLoop = new FrameLoop(this.destroyRef);
  private readonly curve = springCurve(M3Springs.spatialDefault);

  protected readonly width = signal(240);
  private readonly shown = signal<number | null>(null);
  private readonly phase = signal(0);

  private readonly target = computed(() => clamp01(this.value()));
  protected readonly percent = computed(() => Math.round(this.target() * 100));
  protected readonly fill = computed(() => cssColor(this.color()) ?? 'var(--mat-sys-primary)');
  protected readonly trackFill = computed(
    () => cssColor(this.trackColor()) ?? 'var(--mat-sys-secondary-container)',
  );
  protected readonly viewBox = computed(() => `0 0 ${this.width()} ${HEIGHT}`);
  protected readonly geometry = computed(() =>
    wavyGeometry(this.width(), this.shown() ?? this.target(), this.phase()),
  );

  constructor() {
    // Spring to new values; jump on first render and under reduced motion.
    effect(() => {
      const to = this.target();
      const from = untracked(this.shown);
      if (from === null || from === to || untracked(this.reduced)) {
        this.valueLoop.stop();
        this.shown.set(to);
        return;
      }
      const ms = springDuration(M3Springs.spatialDefault);
      this.valueLoop.start((elapsed) => {
        const t = Math.min(1, elapsed / ms);
        this.shown.set(from + (to - from) * this.curve(t));
        return t < 1;
      });
    });

    effect(() => {
      if (this.flowing() && !this.reduced()) {
        if (!this.flowLoop.running) {
          const start = this.phase();
          this.flowLoop.start((elapsed) => {
            this.phase.set((start + elapsed / FLOW_PERIOD_MS) % 1);
          });
        }
      } else {
        this.flowLoop.stop();
      }
    });

    afterNextRender(() => {
      this.width.set(this.host.clientWidth || 240);
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(([entry]) => {
        const w = Math.round(entry.contentRect.width);
        if (w > 0) this.width.set(w);
      });
      ro.observe(this.host);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
  }
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

export interface WavyGeometry {
  /** Flat track [x1, x2], or null when fully covered. */
  readonly track: readonly [number, number] | null;
  /** Stop-dot centre x, or null at 100%. */
  readonly dot: number | null;
  /** SVG path of the active wave, or null when empty. */
  readonly wave: string | null;
}

/** Geometry of the wavy bar (same maths as `_WavyPainter`). */
export function wavyGeometry(width: number, value: number, phase: number): WavyGeometry {
  const mid = HEIGHT / 2;
  const w = width;
  const end = Math.min(w, Math.max(0, w * value));
  const half = STROKE / 2;

  const trackStart = value <= 0 ? half : end + GAP + STROKE;
  const track: [number, number] | null = trackStart < w - half ? [trackStart, w - half] : null;
  const dot = value < 1 ? w - half : null;
  if (end <= half) return { track, dot, wave: null };

  const settle = Math.min(1, Math.max(0, (1 - value) / 0.06));
  const a = AMPLITUDE * settle;
  let d = `M${half} ${mid}`;
  for (let x = half; x <= end - half; x += 1.5) {
    const y = mid + a * Math.sin((x / WAVELENGTH - phase) * 2 * Math.PI);
    d += `L${x.toFixed(1)} ${y.toFixed(2)}`;
  }
  return { track, dot, wave: d };
}
