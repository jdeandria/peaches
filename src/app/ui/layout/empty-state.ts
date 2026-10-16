import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A centred, muted message for empty lists (port of `EmptyState`): a 48px
 * Material Symbol, a title, optional message and an `[emptyAction]` slot.
 */
@Component({
  selector: 'pch-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.title]': 'null' },
  template: `<span class="icon material-symbols-rounded" aria-hidden="true">{{ icon() }}</span>
    <h2 class="pch-title-medium">{{ title() }}</h2>
    @if (message()) {
      <p class="pch-body-medium">{{ message() }}</p>
    }
    <div class="action"><ng-content select="[emptyAction]" /></div>`,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      text-align: center;
    }
    .icon {
      font-size: 48px;
      color: var(--mat-sys-on-surface-variant);
    }
    h2 {
      margin: 16px 0 0;
    }
    p {
      margin: 8px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .action {
      margin-top: 16px;
    }
    .action:empty {
      display: none;
    }
  `,
})
export class EmptyState {
  /** Material Symbols icon name, e.g. `'inventory_2'`. */
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  readonly message = input<string>();
}
