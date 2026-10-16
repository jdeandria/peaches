import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FrameLoop, ReducedMotion } from '../core/motion';
import { M3Springs, springCurve, springDuration } from '../core/springs';

const defaultFormat = (v: number) => String(Math.round(v));

/**
 * A number that counts up or down to its new value on the slow effects
 * spring (port of `AnimatedNumber`). The first value shows immediately;
 * jumps straight to the value under reduced motion. Assistive tech reads
 * only the final formatted value.
 */
@Component({
  selector: 'pch-animated-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span aria-hidden="true">{{ text() }}</span
    ><span class="pch-visually-hidden">{{ finalText() }}</span>`,
  styles: `
    :host {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class AnimatedNumber {
  readonly value = input.required<number>();
  /** Formats the (possibly fractional, mid-tween) value. */
  readonly format = input<(value: number) => string>(defaultFormat);

  private readonly reduced = inject(ReducedMotion).reduced;
  private readonly loop = new FrameLoop(inject(DestroyRef));
  private readonly curve = springCurve(M3Springs.effectsSlow);
  private readonly shown = signal<number | null>(null);

  protected readonly text = computed(() => this.format()(this.shown() ?? this.value()));
  protected readonly finalText = computed(() => this.format()(this.value()));

  constructor() {
    effect(() => {
      const to = this.value();
      const from = untracked(this.shown);
      if (from === null || from === to || untracked(this.reduced)) {
        this.loop.stop();
        this.shown.set(to);
        return;
      }
      const ms = springDuration(M3Springs.effectsSlow);
      this.loop.start((elapsed) => {
        const t = Math.min(1, elapsed / ms);
        this.shown.set(from + (to - from) * this.curve(t));
        return t < 1;
      });
    });
  }
}
