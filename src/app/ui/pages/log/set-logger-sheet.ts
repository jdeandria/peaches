import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { LoggableExercise } from '../../../domain/exercises/loggable';
import { UnitSystem } from '../../../domain/models/training';
import { entryOf, ExerciseLogEntry, SetLog } from '../../../domain/models/workout-log';
import { implausibility } from '../../../domain/services/plausibility';
import { ReducedMotion } from '../../core/motion';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { Fmt } from '../../format';
import { SetDials } from './set-dials';
import { SetDraft, SetFormat } from './set-format';

export interface SetLoggerData {
  readonly exercise: LoggableExercise;
  /** This session's entry, when editing it. */
  readonly existing?: ExerciseLogEntry | null;
  /** The last time the Peach logged this exercise, to start from. */
  readonly previous?: ExerciseLogEntry | null;
  readonly units?: UnitSystem;
  /**
   * `plan`: the sets are targets for a session, so there's no RPE yet.
   * `log` (the default): the sets were done.
   */
  readonly mode?: 'plan' | 'log';
}

/**
 * Opens the set logger for one exercise and resolves with the entry, or
 * undefined if dismissed.
 */
export function openSetLogger(
  sheet: MatBottomSheet,
  data: SetLoggerData,
): Promise<ExerciseLogEntry | undefined> {
  const ref = sheet.open<SetLoggerSheet, SetLoggerData, ExerciseLogEntry>(SetLoggerSheet, {
    data,
    ariaLabel: data.exercise.name,
    ariaModal: true,
    autoFocus: 'first-heading',
  });
  return firstValueFrom(ref.afterDismissed());
}

const RPE_OPTIONS: ButtonGroupOption<number>[] = [5, 6, 7, 8, 9, 10].map((r) => ({
  value: r,
  label: String(r),
}));

/** Most sets one entry can hold. */
const MAX_SETS = 20;

/**
 * Sets out one exercise a set at a time, however it is measured (see
 * {@link SetFormat}): the targets when planning a session, or what was done
 * when correcting a finished one. Each set's numbers are on dials: swipe
 * along one to turn it, fling it to cover ground, tap it to type. It starts
 * from last time's sets (marked on the dials), so repeating a workout is one
 * tap. Sets are picked from a strip, added and removed; when logging, an
 * optional RPE rates the whole exercise. It's laid out like the runner's
 * set screen (`_set-screen.scss`), so planning a set looks like doing it.
 */
@Component({
  selector: 'pch-set-logger-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIconButton, MatTooltip, ButtonGroup, SetDials],
  templateUrl: './set-logger-sheet.html',
  styleUrl: './set-logger-sheet.scss',
})
export class SetLoggerSheet {
  private readonly ref =
    inject<MatBottomSheetRef<SetLoggerSheet, ExerciseLogEntry>>(MatBottomSheetRef);
  protected readonly data = inject<SetLoggerData>(MAT_BOTTOM_SHEET_DATA);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly reduced = inject(ReducedMotion).reduced;

  protected readonly exercise = this.data.exercise;
  private readonly units: UnitSystem = this.data.units ?? 'metric';
  protected readonly planning = this.data.mode === 'plan';
  protected readonly format = new SetFormat(this.exercise, this.units);
  protected readonly rpeOptions = RPE_OPTIONS;

  protected readonly sets = signal<SetDraft[]>(this.initialSets());
  /** Sets there when the sheet opened; later ones pop in. */
  protected readonly openedWith = this.sets().length;
  /** Last committed weight per set, to carry edits forward. */
  private committed = this.sets().map((s) => s.load);
  protected readonly rpe = signal<number | null>(this.data.existing?.rpe ?? null);

  /** The set on the card. */
  protected readonly selected = signal(0);
  /** Which way the last move between sets went, for the card's slide. */
  protected readonly direction = signal<1 | -1>(1);
  protected readonly moved = signal(false);
  protected readonly isLast = computed(() => this.selected() === this.sets().length - 1);

  protected readonly lastTime = this.data.previous
    ? `Last time: ${Fmt.entrySummary(this.data.previous, this.units)}`
    : null;

  /** Last time's matching set (or its last one), drawn on the dials. */
  private readonly ghost = computed<SetDraft | null>(() => {
    const sets = this.data.previous?.sets ?? [];
    const set = sets[this.selected()] ?? sets.at(-1);
    return set ? this.format.draft(set) : null;
  });
  protected readonly ghostSummary = computed(() => {
    const ghost = this.ghost();
    return ghost ? this.format.summary(ghost) : null;
  });

  /** Why Save was refused, until the sets it was refused for change. */
  private readonly refused = signal<{ sets: SetDraft[]; message: string } | null>(null);
  protected readonly problem = computed(() => {
    const refused = this.refused();
    return refused?.sets === this.sets() ? refused.message : null;
  });

  protected readonly canAdd = computed(() => this.sets().length < MAX_SETS);
  protected readonly canRemove = computed(() => this.sets().length > 1);

  protected readonly dials = computed(() => {
    const i = this.selected();
    return this.format.dials(this.sets()[i], this.ghost(), (patch) =>
      patch.load === undefined ? this.update(i, patch) : this.commitLoad(i, patch.load),
    );
  });

  constructor() {
    // Keep the chosen set's chip in view as sets come and go.
    effect(() => {
      const i = this.selected();
      this.sets();
      afterNextRender(
        () =>
          this.host.querySelectorAll<HTMLElement>('.chip')[i]?.scrollIntoView?.({
            block: 'nearest',
            inline: 'nearest',
            behavior: this.reduced() ? 'auto' : 'smooth',
          }),
        { injector: this.injector },
      );
    });
  }

  private initialSets(): SetDraft[] {
    const from = this.data.existing?.sets ?? this.data.previous?.sets ?? [];
    if (from.length > 0) return from.map((s) => this.format.draft(s));
    const count = this.exercise.track === 'distance' ? 1 : 3;
    return Array.from({ length: count }, () => this.format.draft(null));
  }

  protected chipLabel(i: number, s: SetDraft): string {
    return `Set ${i + 1}: ${this.format.describe(s)}`;
  }

  private update(i: number, change: Partial<SetDraft>): void {
    this.sets.update((all) => all.map((s, j) => (j === i ? { ...s, ...change } : s)));
  }

  /**
   * Sets the weight for set `i` and carries it to later sets that still held
   * the old weight, so changing the working weight is one edit.
   */
  private commitLoad(i: number, load: number): void {
    const old = this.committed[i];
    const sets = [...this.sets()];
    for (let j = i; j < sets.length; j++) {
      if (j === i || this.committed[j] === old) {
        sets[j] = { ...sets[j], load };
        this.committed[j] = load;
      }
    }
    this.sets.set(sets);
  }

  protected select(i: number): void {
    if (i === this.selected() || i < 0 || i >= this.sets().length) return;
    this.direction.set(i > this.selected() ? 1 : -1);
    this.moved.set(true);
    this.selected.set(i);
  }

  protected next(): void {
    this.select(this.selected() + 1);
  }

  /** Adds a set like the one on the card, after the last, and moves to it. */
  protected addSet(): void {
    if (!this.canAdd()) return;
    const copy = this.sets()[this.selected()];
    this.sets.update((all) => [...all, copy]);
    this.committed = [...this.committed, copy.load];
    this.select(this.sets().length - 1);
  }

  /** Removes the set on the card; the one after it (or before, at the end) takes its place. */
  protected removeSet(): void {
    if (!this.canRemove()) return;
    const i = this.selected();
    this.sets.update((all) => all.filter((_, j) => j !== i));
    this.committed = this.committed.filter((_, j) => j !== i);
    this.direction.set(i === this.sets().length ? -1 : 1);
    this.moved.set(true);
    this.selected.set(Math.min(i, this.sets().length - 1));
  }

  /**
   * Hands back the entry, unless its numbers are implausible: then the sheet
   * stays open with the sets as entered (the log would refuse them anyway).
   */
  protected save(): void {
    const sets: SetLog[] = [];
    for (const draft of this.sets()) {
      const set = this.format.toSet(draft);
      if (set) sets.push(set);
    }
    const entry = entryOf(this.exercise, { sets, rpe: this.planning ? null : this.rpe() });
    const message = implausibility(entry);
    if (message) {
      this.refused.set({ sets: this.sets(), message });
      return;
    }
    this.ref.dismiss(entry);
  }
}
