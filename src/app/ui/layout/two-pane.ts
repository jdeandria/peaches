import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

/**
 * Lays `[primaryPane]` and `[secondaryPane]` side by side (3:2, 24px gap,
 * tops aligned) when its own width is at least 880px, stacked otherwise
 * (port of `TwoPane`, using a container query).
 */
@Component({
  selector: 'pch-two-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--pch-stacked-gap.px]': 'stackedGap()' },
  template: `<div class="panes">
    <div class="pane"><ng-content select="[primaryPane]" /></div>
    <div class="pane"><ng-content select="[secondaryPane]" /></div>
  </div>`,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
    }
    .panes {
      display: grid;
      gap: var(--pch-stacked-gap);
      align-items: start;
    }
    .pane {
      min-width: 0;
    }
    @container (min-width: 880px) {
      .panes {
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
        gap: 24px;
      }
    }
  `,
})
export class TwoPane {
  /** Space between the panes when stacked, in px (default 0). */
  readonly stackedGap = input(0, { transform: numberAttribute });
}
