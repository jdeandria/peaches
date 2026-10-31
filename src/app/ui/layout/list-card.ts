import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { Card, CardVariant } from './card';

/**
 * A group of rows inside a card, separated by inset hairlines (port of
 * `TonalListCard`). Project `pch-list-row`s (or any elements) as children.
 * Make it a `cdkDropList` of `cdkDrag` rows to let them be put in order.
 */
@Component({
  selector: 'pch-list-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [Card],
  template: `<pch-card class="pch-list-card__card" [variant]="variant()"><ng-content /></pch-card>`,
  styles: `
    pch-list-card {
      display: block;
    }
    .pch-list-card__card {
      --pch-card-padding: 4px 0;
      /* Rows that swipe stay inside the rounded corners. */
      overflow: hidden;
    }
    .pch-list-card__card > * {
      position: relative;
    }
    .pch-list-card__card > * + *::before {
      content: '';
      position: absolute;
      top: 0;
      inset-inline: 16px;
      border-top: 1px solid color-mix(in srgb, var(--mat-sys-outline-variant) 50%, transparent);
      pointer-events: none;
    }
    /* Rows dragged into another order: the others make way on the fast spring. */
    pch-list-card.cdk-drop-list-dragging .pch-list-card__card > :not(.cdk-drag-placeholder) {
      transition: transform var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast);
    }
  `,
})
export class ListCard {
  readonly variant = input<CardVariant>('elevated');
}
