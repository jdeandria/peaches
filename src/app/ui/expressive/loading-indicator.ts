import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  numberAttribute,
  signal,
} from '@angular/core';
import { FrameLoop, ReducedMotion } from '../core/motion';
import { M3Springs, springCurve } from '../core/springs';
import { blendRadius, EXPRESSIVE_SHAPES, ShapeName, shapePath } from './shapes';

const SEQUENCE: readonly ShapeName[] = [
  'softBurst',
  'cookie9',
  'clover4',
  'sunny',
  'cookie4',
  'clover8',
];
const STEP_MS = 650;
const CYCLE_MS = STEP_MS * SEQUENCE.length;

/**
 * The M3 Expressive loading indicator (port of
 * `ExpressiveLoadingIndicator`): a shape that morphs through the expressive
 * sequence while rotating, for waits under a few seconds. Holds a still
 * shape under reduced motion. `contained` draws it on a circular
 * primary-container, for indicators floating over content.
 */
@Component({
  selector: 'pch-loading-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    '[attr.aria-label]': 'label()',
    '[class.contained]': 'contained()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  template: `<svg
    [attr.width]="inner()"
    [attr.height]="inner()"
    [attr.viewBox]="viewBox()"
    [style.transform]="rotation()"
    aria-hidden="true"
  >
    <path [attr.d]="path()" />
  </svg>`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
    }
    :host(.contained) {
      border-radius: 50%;
      background: var(--mat-sys-primary-container);
    }
    path {
      fill: var(--mat-sys-primary);
    }
    :host(.contained) path {
      fill: var(--mat-sys-on-primary-container);
    }
  `,
})
export class LoadingIndicator {
  readonly size = input(48, { transform: numberAttribute });
  readonly contained = input(false, { transform: booleanAttribute });
  readonly label = input('Loading');

  private readonly reduced = inject(ReducedMotion).reduced;
  private readonly loop = new FrameLoop(inject(DestroyRef));
  private readonly curve = springCurve(M3Springs.spatialFast);
  /** Position in the cycle, 0..1. */
  private readonly progress = signal(0);

  protected readonly inner = computed(() => this.size() * (this.contained() ? 0.62 : 1));
  protected readonly viewBox = computed(() => `0 0 ${this.inner()} ${this.inner()}`);
  protected readonly rotation = computed(() => `rotate(${this.progress() * 720}deg)`);
  protected readonly path = computed(() => {
    const pos = this.progress() * SEQUENCE.length;
    const i = Math.floor(pos) % SEQUENCE.length;
    const t = this.curve(pos - Math.floor(pos));
    const a = EXPRESSIVE_SHAPES[SEQUENCE[i]];
    const b = EXPRESSIVE_SHAPES[SEQUENCE[(i + 1) % SEQUENCE.length]];
    return shapePath(blendRadius(a, b, t), this.inner(), 96);
  });

  constructor() {
    effect(() => {
      if (this.reduced()) {
        this.loop.stop();
        this.progress.set(0);
      } else {
        this.loop.start((elapsed) => this.progress.set((elapsed % CYCLE_MS) / CYCLE_MS));
      }
    });
  }

  /** Whether the indicator is currently animating (for tests). */
  get animating(): boolean {
    return this.loop.running;
  }
}
