import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cssColor } from '../core/colors';

/**
 * A compact status label: a dot and text in a role colour (port of
 * `StatusLabel`). Lighter than a filled chip, for states that should be
 * legible but not loud. Text is projected.
 */
@Component({
  selector: 'pch-status-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pch-label-medium', '[style.color]': 'resolved()' },
  template: `<span class="dot" aria-hidden="true"></span><ng-content />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
  `,
})
export class StatusLabel {
  /** M3 role (`'primary'`) or CSS colour; default on-surface-variant. */
  readonly color = input<string>();
  protected readonly resolved = computed(
    () => cssColor(this.color()) ?? 'var(--mat-sys-on-surface-variant)',
  );
}
