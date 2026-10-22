import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Dial } from '../../expressive/dial';
import { DialSpec } from './set-format';

/**
 * A set's numbers on dials: two side by side, reading as one quantity with
 * `joiner` between them (8 × 60, 1 : 30), or one with its unit beside it
 * ("12 reps"). Captions sit over each dial's faded top edge.
 */
@Component({
  selector: 'pch-set-dials',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dial],
  host: { '[class.single]': 'dials().length === 1' },
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
  `,
})
export class SetDials {
  readonly dials = input.required<readonly DialSpec[]>();
  readonly joiner = input<string | null>(null);
}
