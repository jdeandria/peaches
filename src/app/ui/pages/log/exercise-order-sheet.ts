import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { firstValueFrom } from 'rxjs';

import { doneCount, WorkoutLog } from '../../../domain/models/workout-log';
import { Fmt } from '../../format';

export interface ExerciseOrderItem {
  readonly id: string;
  readonly name: string;
  /** "3 sets", "1 of 3 sets done". */
  readonly summary: string;
  readonly complete: boolean;
}

export interface ExerciseOrderData {
  readonly items: readonly ExerciseOrderItem[];
  /** Takes the new order (exercise ids, first to last) after each move. */
  readonly reorder: (exerciseIds: string[]) => void;
}

/** A workout's planned exercises, in order, with how far along each is. */
export function exerciseOrderItems(log: WorkoutLog): ExerciseOrderItem[] {
  return log.plan.map((e) => {
    const done = doneCount(log, e.exerciseId);
    return {
      id: e.exerciseId,
      name: e.exerciseName,
      summary:
        done === 0 ? Fmt.count(e.sets.length, 'set') : `${done} of ${e.sets.length} sets done`,
      complete: done >= e.sets.length,
    };
  });
}

export function openExerciseOrder(sheet: MatBottomSheet, data: ExerciseOrderData): Promise<void> {
  const ref = sheet.open<ExerciseOrderSheet, ExerciseOrderData>(ExerciseOrderSheet, {
    data,
    ariaLabel: 'Exercise order',
    ariaModal: true,
    autoFocus: 'first-heading',
  });
  return firstValueFrom(ref.afterDismissed());
}

/**
 * Reorders a workout's exercises while it's under way: drag one by its
 * handle (or, from a keyboard, move it up or down), and the next set comes
 * from whatever is now first with sets left. Each move applies at once.
 */
@Component({
  selector: 'pch-exercise-order-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDrag, CdkDragHandle, CdkDragPlaceholder, CdkDropList, MatButton, MatIconButton],
  template: `
    <h2 class="pch-title-large" tabindex="-1">Exercise order</h2>
    <p class="hint pch-body-medium">Drag an exercise to do it sooner or later.</p>
    <ol
      class="list"
      cdkDropList
      cdkDropListLockAxis="y"
      aria-label="Exercises, in order"
      (cdkDropListDropped)="drop($event)"
    >
      @for (item of items(); track item.id; let i = $index, first = $first, last = $last) {
        <li class="row" cdkDrag cdkDragPreviewContainer="parent" [class.complete]="item.complete">
          <span class="handle material-symbols-rounded" cdkDragHandle aria-hidden="true"
            >drag_indicator</span
          >
          <span class="text">
            <span class="pch-title-medium">{{ item.name }}</span>
            <span class="pch-body-medium muted">{{ item.summary }}</span>
          </span>
          @if (item.complete) {
            <span class="material-symbols-rounded check" aria-hidden="true">check_circle</span>
          }
          <span class="moves">
            <button
              matIconButton
              type="button"
              [disabled]="first"
              [attr.aria-label]="'Move ' + item.name + ' up'"
              (click)="move(i, i - 1)"
            >
              <span class="material-symbols-rounded" aria-hidden="true">arrow_upward</span>
            </button>
            <button
              matIconButton
              type="button"
              [disabled]="last"
              [attr.aria-label]="'Move ' + item.name + ' down'"
              (click)="move(i, i + 1)"
            >
              <span class="material-symbols-rounded" aria-hidden="true">arrow_downward</span>
            </button>
          </span>
          <div class="placeholder" *cdkDragPlaceholder></div>
        </li>
      }
    </ol>
    <button matButton="filled" type="button" class="done" (click)="close()">Done</button>
  `,
  styles: `
    :host {
      display: block;
      padding-bottom: 16px;
    }
    h2 {
      margin: 0;
      padding: 0 8px;
      outline: none;
    }
    .hint {
      margin: 4px 8px 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 64px;
      padding: 4px 4px 4px 0;
      border-radius: var(--pch-radius-large);
      background: var(--mat-sys-surface-container-low);
      box-sizing: border-box;
    }
    .row + .row {
      margin-top: 4px;
    }
    .row.complete .text {
      opacity: 0.7;
    }
    .handle {
      align-self: stretch;
      display: grid;
      place-items: center;
      width: 48px;
      color: var(--mat-sys-on-surface-variant);
      cursor: grab;
      touch-action: none;
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .check {
      color: var(--mat-sys-primary);
      font-size: 20px;
    }
    .moves {
      display: flex;
    }
    /* On touch screens the handle is the control; the buttons are for keyboards. */
    @media (pointer: coarse) {
      .moves:not(:focus-within) {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    }
    .placeholder {
      min-height: 64px;
      border: 2px dashed var(--mat-sys-outline-variant);
      border-radius: var(--pch-radius-large);
      box-sizing: border-box;
    }
    /* Picked up: lifted, and squarer, on the fast spatial spring. */
    .row.cdk-drag-preview {
      background: var(--mat-sys-surface-container-highest);
      box-shadow: var(--pch-shadow-3);
      border-radius: var(--pch-radius-medium);
    }
    .row.cdk-drag-animating,
    .list.cdk-drop-list-dragging .row:not(.cdk-drag-placeholder) {
      transition: transform var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast);
    }
    .done {
      width: 100%;
      margin-top: 16px;
    }
  `,
})
export class ExerciseOrderSheet {
  private readonly data = inject<ExerciseOrderData>(MAT_BOTTOM_SHEET_DATA);
  private readonly ref = inject<MatBottomSheetRef<ExerciseOrderSheet>>(MatBottomSheetRef);
  protected readonly items = signal<readonly ExerciseOrderItem[]>(this.data.items);

  protected drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  protected move(from: number, to: number): void {
    const items = [...this.items()];
    if (from === to || to < 0 || to >= items.length) return;
    moveItemInArray(items, from, to);
    this.items.set(items);
    this.data.reorder(items.map((i) => i.id));
  }

  protected close(): void {
    this.ref.dismiss();
  }
}
