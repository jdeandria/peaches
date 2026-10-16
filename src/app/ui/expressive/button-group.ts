import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
} from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';

export interface ButtonGroupOption<T> {
  readonly value: T;
  readonly label: string;
}

/**
 * An M3 Expressive connected button group (port of `ConnectedButtonGroup`):
 * single-select options as separate buttons with 2px gaps. Inner corners
 * are tight, outer corners fully round, and the selected button morphs to
 * a pill.
 *
 * Accessible as a radio group: one tab stop, arrow keys move and select,
 * Home/End jump, Space/Enter select (or deselect with `allowDeselect`).
 * Two-way bindable: `[(selected)]`; `selectionChange` fires on user changes only.
 */
@Component({
  selector: 'pch-button-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label() || null',
    '[style.--pch-bg-height.px]': 'height()',
    '(keydown)': 'onKeydown($event)',
  },
  template: `@for (o of options(); track $index; let i = $index, first = $first, last = $last) {
    <button
      type="button"
      role="radio"
      class="pch-bg-option"
      [class.first]="first"
      [class.last]="last"
      [class.selected]="i === selectedIndex()"
      [attr.aria-checked]="i === selectedIndex()"
      [attr.tabindex]="i === focusIndex() ? 0 : -1"
      (click)="toggle(i)"
    >
      {{ o.label }}
    </button>
  }`,
  styles: `
    :host {
      display: flex;
      gap: 2px;
    }
    .pch-bg-option {
      --r-full: calc(var(--pch-bg-height) / 2);
      position: relative;
      flex: 1 1 0;
      min-width: 0;
      height: var(--pch-bg-height);
      padding: 0 12px;
      border: 0;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      font-weight: 500;
      letter-spacing: var(--mat-sys-label-large-tracking);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      transition:
        border-radius var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast),
        background-color var(--pch-spring-effects-fast-duration) linear;
    }
    .first {
      border-start-start-radius: var(--r-full);
      border-end-start-radius: var(--r-full);
    }
    .last {
      border-start-end-radius: var(--r-full);
      border-end-end-radius: var(--r-full);
    }
    .selected {
      border-radius: var(--r-full);
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font-weight: 600;
    }
    .pch-bg-option::after {
      content: '';
      position: absolute;
      inset: 0;
      background: currentColor;
      opacity: 0;
      pointer-events: none;
    }
    .pch-bg-option:hover::after {
      opacity: var(--mat-sys-hover-state-layer-opacity);
    }
    .pch-bg-option:focus-visible::after,
    .pch-bg-option:active::after {
      opacity: var(--mat-sys-pressed-state-layer-opacity);
    }
  `,
})
export class ButtonGroup<T> {
  readonly options = input.required<readonly ButtonGroupOption<T>[]>();
  /** The selected value, or null. Two-way bindable. */
  readonly selected = model<T | null>(null);
  /** Allow tapping the selected option again to clear the selection. */
  readonly allowDeselect = input(false, { transform: booleanAttribute });
  /** Accessible name of the group. */
  readonly label = input<string>();
  readonly height = input(48, { transform: numberAttribute });
  /** Emitted when the user changes the selection. */
  readonly selectionChange = output<T | null>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly dir = inject(Directionality, { optional: true });

  protected readonly selectedIndex = computed(() => {
    const s = this.selected();
    return s === null ? -1 : this.options().findIndex((o) => Object.is(o.value, s));
  });
  /** The roving tab stop: the selected option, else the first. */
  protected readonly focusIndex = computed(() => Math.max(0, this.selectedIndex()));

  protected toggle(i: number): void {
    const value = this.options()[i]?.value;
    if (value === undefined) return;
    const next = i === this.selectedIndex() && this.allowDeselect() ? null : value;
    this.select(next);
  }

  private select(value: T | null): void {
    if (Object.is(value, this.selected())) return;
    this.selected.set(value);
    this.selectionChange.emit(value);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const n = this.options().length;
    if (!n) return;
    const buttons = Array.from(this.host.querySelectorAll<HTMLButtonElement>('.pch-bg-option'));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const from = current >= 0 ? current : this.focusIndex();
    const rtl = this.dir?.value === 'rtl';
    let to: number;
    switch (e.key) {
      case 'ArrowRight':
        to = from + (rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        to = from + (rtl ? 1 : -1);
        break;
      case 'ArrowDown':
        to = from + 1;
        break;
      case 'ArrowUp':
        to = from - 1;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    to = (to + n) % n;
    this.select(this.options()[to].value);
    buttons[to]?.focus();
  }
}
