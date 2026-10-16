import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatSlideToggle } from '@angular/material/slide-toggle';

import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { ExerciseGroup, exerciseSubtitle } from './exercise-groups';

/** Ring geometry: 36px box, 5px stroke. */
const RADIUS = 15.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A collapsible card for one movement pattern, with a ring showing how much
 * of the pattern is in the chosen library. Rows exist only while expanded.
 */
@Component({
  selector: 'pch-exercise-group-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, MatSlideToggle],
  template: `@let g = group();
    <pch-card>
      <h2 class="heading">
        <button
          type="button"
          class="header"
          [attr.aria-expanded]="expanded()"
          [attr.aria-controls]="listId()"
          (click)="toggleExpanded.emit()"
        >
          <svg class="ring" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
            <circle class="track" cx="18" cy="18" [attr.r]="radius" />
            <circle
              class="value"
              cx="18"
              cy="18"
              [attr.r]="radius"
              [attr.stroke-dasharray]="circumference"
              [attr.stroke-dashoffset]="dashOffset()"
              [class.empty]="g.picked === 0"
            />
          </svg>
          <span class="text">
            <span class="pch-title-medium">{{ title() }}</span>
            <span class="pch-body-small muted">
              {{ g.picked }} of {{ g.exercises.length }} in library
            </span>
          </span>
          <span class="chevron material-symbols-rounded" aria-hidden="true">expand_more</span>
        </button>
      </h2>
      @if (expanded()) {
        <div class="rows" role="group" [id]="listId()" [attr.aria-label]="title()">
          @for (e of g.exercises; track e.id) {
            <mat-slide-toggle
              class="row"
              labelPosition="before"
              [checked]="picked().has(e.id)"
              [disabled]="disabled()"
              [aria-describedby]="'ex-sub-' + e.id"
              (change)="setPicked.emit({ exerciseId: e.id, picked: $event.checked })"
            >
              <span class="name pch-body-large">{{ e.name }}</span>
              <span class="pch-body-medium muted" aria-hidden="true" [id]="'ex-sub-' + e.id">{{
                subtitle(e)
              }}</span>
            </mat-slide-toggle>
          }
        </div>
      }
    </pch-card>`,
  styles: `
    :host {
      display: block;
    }
    pch-card {
      --pch-card-padding: 0;
    }
    .heading {
      margin: 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      width: 100%;
      min-height: 64px;
      padding: 14px 12px 14px 16px;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--mat-sys-on-surface);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms linear;
    }
    .header:hover::after {
      opacity: var(--mat-sys-hover-state-layer-opacity);
    }
    .header:active::after {
      opacity: var(--mat-sys-pressed-state-layer-opacity);
    }
    .header:focus-visible {
      outline-offset: -3px;
      border-radius: var(--pch-card-radius, var(--pch-radius-large));
    }
    .ring {
      flex: none;
      transform: rotate(-90deg);
    }
    .ring circle {
      fill: none;
      stroke-width: 5;
    }
    .track {
      stroke: var(--mat-sys-secondary-container);
    }
    .value {
      stroke: var(--mat-sys-primary);
      stroke-linecap: round;
      transition: stroke-dashoffset var(--pch-duration-long) var(--pch-ease-standard);
    }
    .value.empty {
      stroke: transparent;
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .chevron {
      color: var(--mat-sys-on-surface-variant);
      transition: transform var(--pch-duration-short) var(--pch-ease-standard);
    }
    [aria-expanded='true'] .chevron {
      transform: rotate(180deg);
    }
    .rows {
      border-top: 1px solid var(--mat-sys-outline-variant);
      padding-bottom: 4px;
    }
    .row {
      display: block;
      content-visibility: auto;
      contain-intrinsic-size: auto 72px;
    }
    .row ::ng-deep .mdc-form-field {
      display: flex;
      width: 100%;
      min-height: 72px;
      box-sizing: border-box;
      padding: 8px 24px 8px 16px;
      gap: 16px;
    }
    .row ::ng-deep .mdc-label {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      padding: 0;
      margin: 0;
      cursor: pointer;
    }
  `,
})
export class ExerciseGroupCard {
  readonly group = input.required<ExerciseGroup>();
  readonly expanded = input.required<boolean>();
  /** Ids of the exercises in the chosen library. */
  readonly picked = input.required<ReadonlySet<string>>();
  /** True when there is no library to add to. */
  readonly disabled = input(false);
  readonly toggleExpanded = output<void>();
  readonly setPicked = output<{ exerciseId: string; picked: boolean }>();

  protected readonly radius = RADIUS;
  protected readonly circumference = CIRCUMFERENCE;
  protected readonly subtitle = exerciseSubtitle;

  protected readonly title = computed(() => Fmt.pattern(this.group().pattern));
  protected readonly listId = computed(() => `exercise-group-${this.group().pattern}`);
  protected readonly dashOffset = computed(() => {
    const { picked, exercises } = this.group();
    const fraction = exercises.length === 0 ? 0 : picked / exercises.length;
    return CIRCUMFERENCE * (1 - fraction);
  });
}
