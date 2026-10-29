import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Dial } from '../../expressive/dial';
import { DialSpec } from './set-format';

/**
 * A set's numbers on dials: two side by side, reading as one quantity with
 * `joiner` between them (8 × 60, 1 : 30), or one with its unit beside it
 * ("12 reps"). Captions sit over each dial's faded top edge. With `fill`
 * the dials grow to whatever space they're given. With `apart` they slide
 * out to the sides on the spatial spring, `--pch-dials-apart` each, to
 * make room for something between them (the rest timer); they stay live.
 */
@Component({
  selector: 'pch-set-dials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dial],
  host: {
    '[class.single]': 'dials().length === 1',
    '[class.fill]': 'fill()',
    '[class.apart]': 'apart()',
  },
  template: `@for (d of dials(); track d.key; let first = $first) {
    @if (!first && joiner()) {
      <span class="joiner" [class.word]="joiner() === 'in'" aria-hidden="true">{{ joiner() }}</span>
    }
    <div class="dial-column" [class.end]="!first">
      @if (dials().length > 1) {
        <span class="unit pch-label-large" aria-hidden="true">{{ d.unit }}</span>
      }
      <pch-dial
        [side]="first ? 'start' : 'end'"
        [label]="d.label"
        [unit]="d.unit"
        [step]="d.step"
        [max]="d.max"
        [format]="d.format"
        [parse]="d.parse"
        [value]="d.value"
        [ghost]="d.ghost"
        (valueChange)="d.change($event)"
      />
    </div>
    @if (dials().length === 1) {
      <span class="unit solo pch-headline-small" aria-hidden="true">{{ d.unit }}</span>
    }
  }`,
  styles: `
    :host {
      display: flex;
      align-items: stretch;
    }
    /* One dial: its rim just past the middle, the unit reading on from it. */
    :host(.single) .dial-column {
      flex: 0 0 calc(50% + 24px);
    }
    .solo {
      align-self: center;
      padding-inline-start: 4px;
      color: var(--mat-sys-on-surface-variant);
    }
    .dial-column {
      position: relative;
      flex: 1;
      min-width: 0;
    }
    .dial-column .unit {
      position: absolute;
      z-index: 1;
      top: 0;
      inset-inline: 0;
      padding-inline-end: 22px;
      pointer-events: none;
      color: var(--mat-sys-on-surface-variant);
      text-align: end;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .dial-column.end .unit {
      padding-inline: 22px 0;
      text-align: start;
    }
    .joiner {
      flex: none;
      align-self: center;
      width: 20px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-headline-small);
      text-align: center;
    }
    .joiner.word {
      font: var(--mat-sys-label-large);
    }
    :host(.fill) .dial-column {
      display: flex;
      flex-direction: column;
    }
    :host(.fill) pch-dial {
      flex: 1 1 0;
      min-height: 0;
      height: auto;
    }
    .dial-column,
    .joiner,
    .solo {
      transition:
        transform var(--pch-spring-spatial-default-duration) var(--pch-spring-spatial-default),
        opacity var(--pch-spring-effects-fast-duration) linear;
    }
    :host(.apart) .dial-column {
      transform: translateX(calc(-1 * var(--pch-dials-apart, 96px)));
    }
    :host(.apart) .dial-column.end,
    :host(.apart) .solo {
      transform: translateX(var(--pch-dials-apart, 96px));
    }
    :host(.apart) .joiner {
      opacity: 0;
      transform: scale(0.4);
    }
  `,
})
export class SetDials {
  readonly dials = input.required<readonly DialSpec[]>();
  readonly joiner = input<string | null>(null);
  /** Grow to fill the space given, rather than the dials' own height. */
  readonly fill = input(false, { transform: booleanAttribute });
  /** Slide the dials out to the sides, leaving room between them. */
  readonly apart = input(false, { transform: booleanAttribute });
}
