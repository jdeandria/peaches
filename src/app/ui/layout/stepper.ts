import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';

/**
 * A number set with − and + (MD3 style: an outlined minus, a tonal plus),
 * for setting a plan's numbers at a glance; dials are for doing the set.
 * The value steps by `step` within `min` and `max`; `format` shows it.
 */
@Component({
  selector: 'pch-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconButton],
  host: { role: 'group', '[attr.aria-label]': 'label()' },
  template: `
    <span class="label pch-body-medium">{{ label() }}</span>
    <button
      matIconButton
      type="button"
      class="minus"
      [disabled]="value() - step() < min()"
      [attr.aria-label]="'Less ' + label().toLowerCase()"
      (click)="change(-1)"
    >
      <span class="material-symbols-rounded" aria-hidden="true">remove</span>
    </button>
    <span class="value pch-title-medium" aria-live="polite">{{ shown() }}</span>
    <button
      matIconButton
      type="button"
      class="plus"
      [disabled]="value() + step() > max()"
      [attr.aria-label]="'More ' + label().toLowerCase()"
      (click)="change(1)"
    >
      <span class="material-symbols-rounded" aria-hidden="true">add</span>
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 48px;
    }
    .label {
      flex: 1;
      min-width: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    button[matIconButton] {
      --mat-icon-button-state-layer-size: 40px;
      padding: 8px;
    }
    .minus {
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .plus {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .plus:disabled {
      background: var(--mat-sys-surface-container-high);
    }
    .value {
      min-width: 76px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `,
})
export class Stepper {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly step = input(1);
  readonly min = input(0);
  readonly max = input(9999);
  readonly format = input<(v: number) => string>(String);
  readonly valueChange = output<number>();

  protected readonly shown = computed(() => this.format()(this.value()));

  protected change(direction: 1 | -1): void {
    const next = Math.round((this.value() + direction * this.step()) * 100) / 100;
    if (next < this.min() || next > this.max()) return;
    this.valueChange.emit(next);
  }
}
