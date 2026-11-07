import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';

import { LocalDate } from '../../../domain/core/local-date';
import { daysOf, PlannedWorkout } from '../../../domain/models/week-plan';
import { ExerciseLogEntry, SetLog, WorkoutLog } from '../../../domain/models/workout-log';
import { AppState } from '../../../state/app-state';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { Fmt } from '../../format';
import { Stepper } from '../../layout/stepper';
import { HOLD_TO_DRAG, keepFocus, SwipeRow } from '../../layout/swipe-row';
import { SetDraft, SetFormat } from '../log/set-format';
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

/** Most sets an exercise can plan. */
const MAX_SETS = 20;
/** How long after the last − or + the change is saved. */
const SAVE_AFTER_MS = 600;

/** An exercise's numbers being set. */
interface Edit {
  readonly entry: ExerciseLogEntry;
  readonly format: SetFormat;
  readonly sets: readonly SetDraft[];
}

/**
 * A workout on the Plan: one row that opens to its exercises. The row
 * leads with a play button (this week, until it's done) that starts the
 * workout or carries on with it, open or not; each exercise has its own,
 * to start there. Tapping an exercise sets its numbers with − and +
 * (sets, then reps and weight, a hold's time, or distance and time),
 * saved a moment after the last tap; exercises are added
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
    Stepper,
    SwipeRow,
  ],
  template: `
    @let v = view();
    @let w = v.workout;
    <div class="head">
      <!-- Start (or carry on) from the row itself, open or not; otherwise what state it's in. -->
      @if (v.canLaunch) {
        <button
          matIconButton
          type="button"
          class="start"
          [attr.aria-label]="
            (v.state === 'going' ? 'Continue workout: ' : 'Start workout: ') + w.name
          "
          (click)="playWorkout()"
        >
          <span class="material-symbols-rounded" aria-hidden="true">play_arrow</span>
        </button>
      } @else {
        <pch-shaped-avatar
          [shape]="v.state === 'done' ? 'softBurst' : 'circle'"
          [color]="v.state === 'done' ? 'primary-container' : 'surface-container-high'"
          [foreground]="v.state === 'done' ? 'on-primary-container' : 'on-surface-variant'"
        >
          <span class="material-symbols-rounded" aria-hidden="true">{{ icon() }}</span>
        </pch-shaped-avatar>
      }
      <button
        type="button"
        class="toggle"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="bodyId"
        (click)="openChange.emit()"
      >
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
    </div>

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
              @let editing = editingId() === e.entry.exerciseId;
              <div class="exercise" [class.complete]="e.complete" [class.editing]="editing">
                <div class="row">
                  @if (editable() && !e.complete) {
                    <!-- Tap an exercise to set its numbers. -->
                    <button
                      type="button"
                      class="text edit"
                      [attr.aria-expanded]="editing"
                      [attr.aria-controls]="bodyId + '-' + e.entry.exerciseId"
                      (click)="toggleEdit(e)"
                    >
                      <span class="pch-body-large one-line">{{ e.entry.exerciseName }}</span>
                      <span class="pch-body-small muted one-line">{{
                        editing ? (editedSummary() ?? e.summary) : e.summary
                      }}</span>
                    </button>
                  } @else {
                    <span class="text">
                      <span class="pch-body-large one-line">{{ e.entry.exerciseName }}</span>
                      <span class="pch-body-small muted one-line">{{ e.summary }}</span>
                    </span>
                  }
                  @if (v.state === 'going' && !e.complete && e.done > 0) {
                    <span class="count pch-label-large"
                      >{{ e.done }}/{{ e.entry.sets.length }}</span
                    >
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
                @if (editing && edit(); as d) {
                  <div
                    class="editor"
                    [id]="bodyId + '-' + e.entry.exerciseId"
                    role="group"
                    [attr.aria-label]="'Sets for ' + e.entry.exerciseName"
                  >
                    <pch-stepper
                      label="Sets"
                      [value]="d.sets.length"
                      [min]="1"
                      [max]="maxSets"
                      (valueChange)="setCount($event)"
                    />
                    @for (spec of specs(); track spec.key) {
                      <pch-stepper
                        [label]="spec.label"
                        [value]="spec.value"
                        [step]="spec.step"
                        [min]="spec.min"
                        [max]="spec.max"
                        [format]="spec.format"
                        (valueChange)="setField(spec.key, $event)"
                      />
                    }
                  </div>
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
      gap: 4px;
      min-height: 64px;
      padding-inline-start: 12px;
    }
    .head pch-shaped-avatar {
      margin: 0 4px;
    }
    .start {
      flex: none;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .toggle {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 12px;
      min-width: 0;
      align-self: stretch;
      padding: 8px 12px 8px 8px;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .toggle:hover {
      background: color-mix(
        in srgb,
        var(--mat-sys-on-surface) calc(var(--mat-sys-hover-state-layer-opacity) * 100%),
        transparent
      );
    }
    .toggle:focus-visible {
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
      padding: 4px 4px 4px 64px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 48px;
    }
    .edit {
      align-self: stretch;
      justify-content: center;
      margin: -4px 0 -4px -16px;
      padding: 4px 0 4px 16px;
      border: 0;
      border-radius: var(--pch-radius-medium);
      background: none;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .edit:hover {
      background: color-mix(
        in srgb,
        var(--mat-sys-on-surface) calc(var(--mat-sys-hover-state-layer-opacity) * 100%),
        transparent
      );
    }
    .edit:focus-visible {
      outline: var(--pch-focus-ring);
      outline-offset: -3px;
    }
    .editor {
      padding: 4px 0 8px;
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
      padding: 0 4px 0 48px;
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
  private readonly state = inject(AppState);

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

  // ── Setting an exercise's numbers ──────────────────────────────────────

  protected readonly maxSets = MAX_SETS;
  /** The exercise whose numbers are open, and its sets as they're being set. */
  protected readonly edit = signal<Edit | null>(null);
  protected readonly editingId = computed(() => this.edit()?.entry.exerciseId ?? null);
  /** One stepper per number: they set every set at once (sets differing keep the rest). */
  protected readonly specs = computed(() => {
    const d = this.edit();
    return d ? d.format.steppers(d.sets[0]) : [];
  });
  protected readonly editedSummary = computed(() => {
    const d = this.edit();
    return d ? Fmt.entrySummary(this.entryOf(d), this.state.units()) : null;
  });
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.flush());
  }

  protected toggleEdit(e: ExerciseView): void {
    const open = this.editingId() === e.entry.exerciseId;
    this.flush();
    if (open) {
      this.edit.set(null);
      return;
    }
    const format = new SetFormat(e.entry, this.state.units());
    this.edit.set({ entry: e.entry, format, sets: e.entry.sets.map((s) => format.draft(s)) });
  }

  protected setField(key: keyof SetDraft, value: number): void {
    this.edit.update((d) => d && { ...d, sets: d.sets.map((s) => ({ ...s, [key]: value })) });
    this.later();
  }

  /** More sets copy the last; fewer drop from the end. */
  protected setCount(n: number): void {
    this.edit.update((d) => {
      if (!d || n < 1) return d;
      const sets =
        n <= d.sets.length
          ? d.sets.slice(0, n)
          : [...d.sets, ...Array.from({ length: n - d.sets.length }, () => d.sets.at(-1)!)];
      return { ...d, sets };
    });
    this.later();
  }

  private entryOf(d: Edit): ExerciseLogEntry {
    const sets = d.sets.map((s) => d.format.toSet(s)).filter((s): s is SetLog => s !== null);
    return { ...d.entry, sets };
  }

  /** Saves a moment after the last tap, so a run of taps is one save. */
  private later(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_AFTER_MS);
  }

  private flush(): void {
    if (!this.saveTimer) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    const d = this.edit();
    if (!d) return;
    const entry = this.entryOf(d);
    if (entry.sets.length === 0) return;
    const v = this.view();
    void this.actions.updateExercise(this.monday(), v.workout, v.log, entry);
  }

  protected add(): void {
    const v = this.view();
    void this.actions.addExercise(this.monday(), v.workout, v.log);
  }

  protected remove(e: ExerciseView): void {
    const v = this.view();
    void this.actions.removeExercise(this.monday(), v.workout, v.log, e.entry);
  }

  /** Starts the workout, or carries on where it left off. */
  protected playWorkout(): void {
    void this.actions.play(this.monday(), this.view().workout);
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
