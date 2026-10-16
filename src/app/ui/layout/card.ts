import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';

export type CardVariant = 'elevated' | 'filled' | 'outlined';

/**
 * A Material 3 card with tonal elevation (port of `TonalCard`).
 *
 * Variants: `elevated` (default; lowest/low container + level-1 shadow),
 * `filled` (surface-container), `outlined` (surface + outline-variant
 * border). Interactive cards lift on hover/focus and settle on press. Hosts
 * `<a pch-card>` and `<button pch-card>` are interactive automatically.
 *
 * Customise with `--pch-card-padding` (default 16px) and
 * `--pch-card-radius` (default 16px).
 */
@Component({
  selector: 'pch-card, [pch-card]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pch-card',
    '[class.pch-card--filled]': 'variant() === "filled"',
    '[class.pch-card--outlined]': 'variant() === "outlined"',
    '[class.pch-card--interactive]': 'isInteractive()',
  },
  template: `<ng-content />`,
  styles: `
    :host {
      --_bg: var(--pch-card-elevated);
      --_bg-hover: var(--pch-card-elevated-hover);
      --_shadow: var(--pch-shadow-1);
      --_shadow-hover: var(--pch-shadow-2);
      display: block;
      box-sizing: border-box;
      position: relative;
      padding: var(--pch-card-padding, 16px);
      border-radius: var(--pch-card-radius, var(--pch-radius-large));
      background: var(--_bg);
      box-shadow: var(--_shadow);
      color: var(--mat-sys-on-surface);
      overflow: hidden;
      transition:
        background-color 150ms var(--pch-ease-standard),
        box-shadow 150ms var(--pch-ease-standard);
    }
    :host(.pch-card--filled) {
      --_bg: var(--mat-sys-surface-container);
      --_bg-hover: var(--mat-sys-surface-container-high);
      --_shadow: none;
      --_shadow-hover: var(--pch-shadow-1);
    }
    :host(.pch-card--outlined) {
      --_bg: var(--mat-sys-surface);
      --_bg-hover: var(--mat-sys-surface-container-low);
      --_shadow: none;
      --_shadow-hover: var(--pch-shadow-1);
      border: 1px solid var(--mat-sys-outline-variant);
    }
    :host(.pch-card--interactive) {
      cursor: pointer;
      text-decoration: none;
      -webkit-user-select: none;
      user-select: none;
    }
    :host(button) {
      width: 100%;
      border: 0;
      font: inherit;
      text-align: start;
    }
    :host(button.pch-card--outlined) {
      border: 1px solid var(--mat-sys-outline-variant);
    }
    :host(.pch-card--interactive:hover),
    :host(.pch-card--interactive:focus-visible) {
      background: var(--_bg-hover);
      box-shadow: var(--_shadow-hover);
    }
    :host(.pch-card--interactive:active) {
      background: var(--_bg);
      box-shadow: var(--_shadow);
    }
    :host(.pch-card--interactive)::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--mat-sys-on-surface);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms linear;
    }
    :host(.pch-card--interactive:active)::after {
      opacity: var(--mat-sys-pressed-state-layer-opacity);
    }
  `,
})
export class Card {
  readonly variant = input<CardVariant>('elevated');
  /** Force interactive styling (automatic for `<a>`/`<button>` hosts). */
  readonly interactive = input(false, { transform: booleanAttribute });

  private readonly tag = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName;
  protected readonly isInteractive = computed(
    () => this.interactive() || this.tag === 'A' || this.tag === 'BUTTON',
  );
}
