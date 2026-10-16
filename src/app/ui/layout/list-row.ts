import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';

/**
 * An M3 list item: `[rowLeading]` (avatar/icon, 40px), the projected
 * headline, `[rowSubtitle]` supporting text and `[rowTrailing]` (meta,
 * icon, action). 56px min height, 72px with a subtitle. Use as
 * `<pch-list-row>`, or `<a pch-list-row routerLink>` / `<button
 * pch-list-row>` for an interactive row with a state layer.
 */
@Component({
  selector: 'pch-list-row, a[pch-list-row], button[pch-list-row]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.interactive]': 'isInteractive()',
  },
  template: `<ng-content select="[rowLeading]" />
    <span class="text">
      <span class="headline"><ng-content /></span>
      <span class="subtitle"><ng-content select="[rowSubtitle]" /></span>
    </span>
    <ng-content select="[rowTrailing]" />`,
  styles: `
    :host {
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
      min-height: 56px;
      padding: 8px 16px;
      color: var(--mat-sys-on-surface);
      text-decoration: none;
      text-align: start;
      font: inherit;
      background: none;
      border: 0;
      position: relative;
    }
    :host:has(.subtitle:not(:empty)) {
      min-height: 72px;
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .headline {
      font: var(--mat-sys-body-large);
      letter-spacing: var(--mat-sys-body-large-tracking);
    }
    .subtitle {
      font: var(--mat-sys-body-medium);
      letter-spacing: var(--mat-sys-body-medium-tracking);
      color: var(--mat-sys-on-surface-variant);
    }
    .subtitle:empty {
      display: none;
    }
    :host(.interactive) {
      cursor: pointer;
    }
    :host(.interactive)::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--mat-sys-on-surface);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms linear;
    }
    :host(.interactive:hover)::after {
      opacity: var(--mat-sys-hover-state-layer-opacity);
    }
    :host(.interactive:active)::after {
      opacity: var(--mat-sys-pressed-state-layer-opacity);
    }
    :host(.interactive:focus-visible) {
      outline-offset: -3px;
      border-radius: var(--pch-radius-medium);
    }
  `,
})
export class ListRow {
  /** Force the interactive state layer (automatic for a/button hosts). */
  readonly interactive = input(false, { transform: booleanAttribute });
  private readonly tag = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.tagName;
  protected readonly isInteractive = computed(
    () => this.interactive() || this.tag === 'A' || this.tag === 'BUTTON',
  );
}
