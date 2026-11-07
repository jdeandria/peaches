import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';

import { LocalDate } from '../../../domain/core/local-date';
import { daysOf, PlannedWorkout } from '../../../domain/models/week-plan';
import { ExerciseLogEntry, WorkoutLog } from '../../../domain/models/workout-log';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { Fmt } from '../../format';
import { HOLD_TO_DRAG, keepFocus, SwipeRow } from '../../layout/swipe-row';
import { PlanActions } from './plan-actions';

/** One exercise in a workout card, with how much of it is done. */
export interface ExerciseView {
  readonly entry: ExerciseLogEntry;
  readonly summary: string;
  readonly done: number;
  readonly complete: boolean;
}

/** A planned workout as the Plan shows it. */
export interface WorkoutView {
  readonly workout: PlannedWorkout;
  readonly state: 'planned' | 'going' | 'done';
  /** The log it was launched as, once launched. */
  readonly log: WorkoutLog | null;
  readonly subtitle: string;
  readonly points: string | null;
  /** Planned or done exercises, in the order they'll be (or were) done. */
  readonly exercises: readonly ExerciseView[];
  /** This week's, not done: each exercise can start it. */
  readonly canLaunch: boolean;
}

const ICONS = { planned: 'fitness_center', going: 'directions_run', done: 'check' } as const;

let nextId = 0;

/**
 * A workout on the Plan: one row that opens to its exercises. Each one
 * has a play button that starts the workout there; exercises are added
 * from the picker (no numbers asked: last time's sets, dialled in when
 * done), swiped left to remove and held and dragged to reorder. The menu
 * holds the rest: move to another day, where, save as a routine, take off
 * the plan. A done workout lists what was done.
 */
@Component({
  selector: 'pch-workout-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkDrag,
    CdkDropList,
    MatButton,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    ShapedAvatar,
    SwipeRow,
  ],
  template: `
    @let v = view();
    @let w = v.workout;
    <button
      type="button"
      class="head"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="bodyId"
      (click)="openChange.emit()"
    >
      <pch-shaped-avatar
        [shape]="v.state === 'done' ? 'softBurst' : 'circle'"
        [color]="
          v.state === 'done'
            ? 'primary-container'
            : v.state === 'going'
              ? 'tertiary-container'
              : 'surface-container-high'
        "
        [foreground]="
          v.state === 'done'
            ? 'on-primary-container'
            : v.state === 'going'
              ? 'on-tertiary-container'
              : 'on-surface-variant'
        "
      >
        <span class="material-symbols-rounded" aria-hidden="true">{{ icon() }}</span>
      </pch-shaped-avatar>
      <span class="text">
        <span class="name pch-title-medium one-line">{{ w.name }}</span>
        <span class="pch-body-small muted one-line">{{ v.subtitle }}</span>
      </span>
      @if (v.points) {
        <span class="pts pch-label-large">{{ v.points }} pts</span>
      }
      <span class="material-symbols-rounded chevron" [class.open]="open()" aria-hidden="true"
        >expand_more</span
      >
    </button>

    @if (open()) {
      <div class="body" [id]="bodyId">
        <div
          class="exercises"
          cdkDropList
          cdkDropListLockAxis="y"
          [cdkDropListDisabled]="!editable()"
          [attr.aria-label]="'Exercises in ' + w.name + ', in order'"
          (cdkDropListDropped)="drop($event)"
        >
          @for (e of v.exercises; track e.entry.exerciseId; let i = $index) {
            <pch-swipe-row
              [removable]="editable()"
              cdkDrag
              [cdkDragDisabled]="!editable()"
              [cdkDragStartDelay]="hold"
              (remove)="remove(e)"
              (keydown.alt.arrowup)="move(i, i - 1, $event)"
              (keydown.alt.arrowdown)="move(i, i + 1, $event)"
            >
              <div class="exercise" [class.complete]="e.complete">
                <span class="text">
                  <span class="pch-body-large one-line">{{ e.entry.exerciseName }}</span>
                  <span class="pch-body-small muted one-line">{{ e.summary }}</span>
                </span>
                @if (v.state === 'going' && !e.complete && e.done > 0) {
                  <span class="count pch-label-large">{{ e.done }}/{{ e.entry.sets.length }}</span>
                }
                @if (e.complete) {
                  <span
                    class="material-symbols-rounded check"
                    [attr.aria-label]="e.entry.exerciseName + ' done'"
                    >check_circle</span
                  >
                } @else if (v.canLaunch) {
                  <button
                    matIconButton
                    type="button"
                    class="play"
                    [attr.aria-label]="'Start ' + e.entry.exerciseName"
                    (click)="play(e)"
                  >
                    <span class="material-symbols-rounded" aria-hidden="true">play_arrow</span>
                  </button>
                }
                @if (editable()) {
                  <span class="pch-swipe-actions">
                    <button
                      matIconButton
                      type="button"
                      [attr.aria-label]="'Remove ' + e.entry.exerciseName"
                      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                      (click)="remove(e)"
                    >
                      <span class="material-symbols-rounded" aria-hidden="true">delete</span>
                    </button>
                  </span>
                }
              </div>
            </pch-swipe-row>
          }
        </div>
        <div class="foot">
          @if (editable()) {
            <button matButton type="button" class="add" (click)="add()">
              <span class="material-symbols-rounded" aria-hidden="true">add</span>
              Add exercise
            </button>
          }
          <button
            matIconButton
            type="button"
            class="more"
            [attr.aria-label]="'More for ' + w.name"
            [matMenuTriggerFor]="menu"
          >
            <span class="material-symbols-rounded" aria-hidden="true">more_vert</span>
          </button>
        </div>
      </div>
    }

    <mat-menu #menu="matMenu">
      @if (v.state === 'planned') {
        <button mat-menu-item type="button" [matMenuTriggerFor]="days">Move to</button>
        @if (actions.locations().length > 0) {
          <button mat-menu-item type="button" [matMenuTriggerFor]="where">Where</button>
        }
      }
      @if (v.exercises.length > 0) {
        <button mat-menu-item type="button" (click)="saveRoutine()">Save as routine</button>
      }
      <button mat-menu-item type="button" (click)="takeOff()">Take off the plan</button>
    </mat-menu>
    <mat-menu #days="matMenu">
      @for (d of dayOptions(); track d.date) {
        <button mat-menu-item type="button" [disabled]="d.date === w.day" (click)="moveTo(d.date)">
          {{ d.label }}
        </button>
      }
    </mat-menu>
    <mat-menu #where="matMenu">
      <button
        mat-menu-item
        type="button"
        [disabled]="w.locationId === null"
        (click)="setWhere(null)"
      >
        Anywhere
      </button>
      @for (l of actions.locations(); track l.id) {
        <button
          mat-menu-item
          type="button"
          [disabled]="w.locationId === l.id"
          (click)="setWhere(l.id)"
        >
          {{ l.name }}
        </button>
      }
    </mat-menu>
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 64px;
      padding: 8px 12px 8px 16px;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .head:hover {
      background: color-mix(
        in srgb,
        var(--mat-sys-on-surface) calc(var(--mat-sys-hover-state-layer-opacity) * 100%),
        transparent
      );
    }
    .head:focus-visible {
      outline: var(--pch-focus-ring);
      outline-offset: -3px;
    }
    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .one-line {
      display: block;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    :host([data-state='done']) .name {
      color: var(--mat-sys-on-surface-variant);
    }
    .pts {
      color: var(--mat-sys-primary);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .chevron {
      color: var(--mat-sys-on-surface-variant);
      transition: transform var(--pch-spring-spatial-fast-duration) var(--pch-spring-spatial-fast);
    }
    .chevron.open {
      transform: rotate(180deg);
    }
    .body {
      padding-bottom: 4px;
    }
    .exercise {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 56px;
      padding: 4px 4px 4px 68px;
    }
    .exercise.complete .text > :first-child {
      color: var(--mat-sys-on-surface-variant);
    }
    .count {
      color: var(--mat-sys-on-surface-variant);
      font-variant-numeric: tabular-nums;
    }
    .check {
      display: grid;
      place-items: center;
      width: 48px;
      color: var(--mat-sys-primary);
    }
    .play {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px 0 56px;
    }
    .more {
      margin-inline-start: auto;
    }
    .add .material-symbols-rounded {
      margin-inline-end: 4px;
      font-size: 20px;
    }
  `,
  host: { '[attr.data-state]': 'view().state' },
})
export class WorkoutCard {
  protected readonly actions = inject(PlanActions);
  private readonly injector = inject(Injector);

  readonly view = input.required<WorkoutView>();
  /** The Monday of the week it's in. */
  readonly monday = input.required<LocalDate>();
  readonly open = input(false);
  /** The row was tapped: open it, or close it. */
  readonly openChange = output<void>();

  protected readonly hold = HOLD_TO_DRAG;
  protected readonly bodyId = `pch-workout-${nextId++}`;
  protected readonly icon = computed(() => ICONS[this.view().state]);
  /** Exercises can change until it's done. */
  protected readonly editable = computed(() => this.view().state !== 'done');
  protected readonly dayOptions = computed(() =>
    daysOf(this.monday()).map((date) => ({ date, label: Fmt.day(date) })),
  );

  protected add(): void {
    const v = this.view();
    void this.actions.addExercise(this.monday(), v.workout, v.log);
  }

  protected remove(e: ExerciseView): void {
    const v = this.view();
    void this.actions.removeExercise(this.monday(), v.workout, v.log, e.entry);
  }

  protected play(e: ExerciseView): void {
    void this.actions.play(this.monday(), this.view().workout, e.entry.exerciseId);
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  /** Moves the exercise at `from` to `to` (from the keyboard, with `event`). */
  protected move(from: number, to: number, event?: Event): void {
    event?.preventDefault();
    const v = this.view();
    if (!this.editable() || from === to || to < 0 || to >= v.exercises.length) return;
    if (event) keepFocus(this.injector);
    const ids = v.exercises.map((e) => e.entry.exerciseId);
    void this.actions.moveExercise(this.monday(), v.workout, v.log, ids, from, to);
  }

  protected moveTo(day: LocalDate): void {
    void this.actions.moveTo(this.monday(), this.view().workout, day);
  }

  protected setWhere(locationId: string | null): void {
    void this.actions.setWhere(this.monday(), this.view().workout, locationId);
  }

  protected saveRoutine(): void {
    const v = this.view();
    void this.actions.saveRoutine(
      v.workout,
      v.exercises.map((e) => e.entry),
    );
  }

  protected takeOff(): void {
    void this.actions.takeOff(this.monday(), this.view().workout);
  }
}
