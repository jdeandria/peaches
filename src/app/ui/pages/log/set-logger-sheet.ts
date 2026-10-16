import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { DistanceUnits, WeightUnits } from '../../../domain/core/units';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { RoutineItem } from '../../../domain/models/library';
import { UnitSystem } from '../../../domain/models/training';
import { ExerciseLogEntry, exerciseLogEntry, SetLog } from '../../../domain/models/workout-log';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';

export interface SetLoggerData {
  readonly exercise: LoggableExercise;
  readonly existing?: ExerciseLogEntry | null;
  /** A routine's target for this exercise, to start the sets from. */
  readonly target?: RoutineItem | null;
  readonly units?: UnitSystem;
  /** What was lifted last time (kg per set), to start the weights from. */
  readonly previousLoadsKg?: readonly number[] | null;
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

const INTEGER = /^\d+$/;
/** Most sets one entry can hold. */
const MAX_SETS = 20;

/** One set as typed: text per field, so half-typed numbers survive. */
interface SetDraft {
  /** Reps (reps track) or seconds (time track). */
  readonly value: string;
  /** Weight in display units, for exercises that take a load. */
  readonly load: string;
  /** Distance in display units (km/mi, or metres for swimming and rowing). */
  readonly distance: string;
  /** Minutes, for distance sets. */
  readonly minutes: string;
}

/**
 * Records every set of one exercise, however it is measured: reps (with a
 * weight per set for exercises that take a load, in the Peach's units,
 * stored as kg), seconds, or distance and time. Sets can be added and
 * removed; an optional RPE rates the whole exercise.
 */
@Component({
  selector: 'pch-set-logger-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIconButton, MatTooltip, ButtonGroup],
  templateUrl: './set-logger-sheet.html',
  styleUrl: './set-logger-sheet.scss',
})
export class SetLoggerSheet {
  private readonly ref =
    inject<MatBottomSheetRef<SetLoggerSheet, ExerciseLogEntry>>(MatBottomSheetRef);
  protected readonly data = inject<SetLoggerData>(MAT_BOTTOM_SHEET_DATA);

  protected readonly exercise = this.data.exercise;
  private readonly units: UnitSystem = this.data.units ?? 'metric';
  private readonly target = this.data.target ?? null;
  protected readonly track = this.exercise.track;
  protected readonly weighted = this.exercise.takesLoad && this.track === 'reps';
  protected readonly weightUnit = WeightUnits.label(this.units);
  /** Swimming and rowing count metres; travel on foot or wheels counts km or miles. */
  private readonly inMetres =
    this.exercise.distanceKind === 'swimRow' || this.exercise.distanceKind === null;
  protected readonly distanceUnit = this.inMetres ? 'm' : DistanceUnits.label(this.units);
  protected readonly unit = this.track === 'time' ? 'sec' : 'reps';
  /** Increment per tap: a rep or five seconds. */
  private readonly step = this.track === 'time' ? 5 : 1;
  protected readonly rpeOptions = RPE_OPTIONS;

  protected readonly targetLine = this.target ? targetText(this.target) : null;

  protected readonly sets = signal<SetDraft[]>(this.initialSets());
  /** Last committed weight text per set, to carry edits forward. */
  private committed = this.sets().map((s) => s.load);
  protected readonly rpe = signal<number | null>(this.data.existing?.rpe ?? null);

  protected readonly lastTime = computed(() => {
    const previous = this.data.previousLoadsKg;
    if (!this.weighted || !previous || previous.length === 0) return null;
    const shown = previous.map((kg) => WeightUnits.format(WeightUnits.toDisplay(kg, this.units)));
    return `Last time: ${shown.join(' · ')} ${this.weightUnit}`;
  });

  protected readonly canAdd = computed(() => this.sets().length < MAX_SETS);
  protected readonly canRemove = computed(() => this.sets().length > 1);

  private initialSets(): SetDraft[] {
    const existing = this.data.existing?.sets ?? [];
    if (existing.length > 0) return existing.map((s, i) => this.draftFrom(s, i));
    const count = this.target?.sets ?? (this.track === 'distance' ? 1 : 3);
    return Array.from({ length: Math.max(1, Math.min(MAX_SETS, count)) }, (_, i) =>
      this.draftFrom(null, i),
    );
  }

  private draftFrom(set: SetLog | null, i: number): SetDraft {
    const t = this.target;
    const value =
      set?.reps ?? set?.seconds ?? t?.reps ?? t?.seconds ?? (this.track === 'time' ? 30 : 10);
    const meters = set?.meters ?? t?.meters ?? null;
    const seconds = this.track === 'distance' ? (set?.seconds ?? t?.seconds ?? null) : null;
    return {
      value: String(value),
      load: this.initialLoad(set, i),
      distance: meters === null ? '' : this.formatDistance(meters),
      minutes: seconds === null ? '' : String(Math.round((seconds / 60) * 100) / 100),
    };
  }

  private initialLoad(set: SetLog | null, i: number): string {
    if (!this.weighted) return '';
    // This session's entry first, then last time's weight for the same set
    // (or its last set), else blank.
    const previous = this.data.previousLoadsKg;
    const kg =
      set?.loadKg ??
      (previous && previous.length > 0 ? previous[Math.min(i, previous.length - 1)] : null);
    return kg === null ? '' : WeightUnits.format(WeightUnits.toDisplay(kg, this.units));
  }

  private formatDistance(meters: number): string {
    return this.inMetres
      ? String(meters)
      : DistanceUnits.format(DistanceUnits.toDisplay(meters, this.units));
  }

  protected setLabel(i: number): string {
    return `Set ${i + 1}`;
  }

  private update(i: number, change: Partial<SetDraft>): void {
    this.sets.update((all) => all.map((s, j) => (j === i ? { ...s, ...change } : s)));
  }

  protected setValue(i: number, text: string): void {
    this.update(i, { value: text });
  }

  protected setLoad(i: number, text: string): void {
    this.update(i, { load: text });
  }

  protected setDistance(i: number, text: string): void {
    this.update(i, { distance: text });
  }

  protected setMinutes(i: number, text: string): void {
    this.update(i, { minutes: text });
  }

  protected nudgeValue(i: number, direction: 1 | -1): void {
    const current = this.sets()[i].value.trim();
    const n = INTEGER.test(current) ? Number(current) : 0;
    this.setValue(i, String(Math.min(9999, Math.max(0, n + direction * this.step))));
  }

  protected nudgeLoad(i: number, direction: 1 | -1): void {
    const current = parseDecimal(this.sets()[i].load) ?? 0;
    const next = Math.min(9999, Math.max(0, current + direction * WeightUnits.step(this.units)));
    this.commitLoad(i, WeightUnits.format(next));
  }

  /**
   * Sets the weight for set `i` and carries it to later sets that still held
   * the old weight, so changing the working weight is one edit.
   */
  protected commitLoad(i: number, text: string): void {
    const old = this.committed[i];
    const sets = [...this.sets()];
    for (let j = i; j < sets.length; j++) {
      if (j === i || this.committed[j] === old) {
        sets[j] = { ...sets[j], load: text };
        this.committed[j] = text;
      }
    }
    this.sets.set(sets);
  }

  /** Adds a set like the last one. */
  protected addSet(): void {
    if (!this.canAdd()) return;
    const last = this.sets().at(-1)!;
    this.sets.update((all) => [...all, last]);
    this.committed = [...this.committed, last.load];
  }

  protected removeSet(): void {
    if (!this.canRemove()) return;
    this.sets.update((all) => all.slice(0, -1));
    this.committed = this.committed.slice(0, -1);
  }

  /** Puts the routine's target back in every set. */
  protected useTarget(): void {
    this.sets.update((all) => all.map((s, i) => ({ ...this.draftFrom(null, i), load: s.load })));
  }

  protected save(): void {
    const sets: SetLog[] = [];
    for (const draft of this.sets()) {
      const set = this.toSet(draft);
      if (set) sets.push(set);
    }
    this.ref.dismiss(
      exerciseLogEntry({
        exerciseId: this.exercise.id,
        exerciseName: this.exercise.name,
        distanceKind: this.exercise.distanceKind,
        sets,
        rpe: this.rpe(),
      }),
    );
  }

  /** A typed set as stored, or null if nothing usable was entered. */
  private toSet(d: SetDraft): SetLog | null {
    if (this.track === 'distance') {
      const distance = parseDecimal(d.distance);
      const minutes = parseDecimal(d.minutes);
      const meters =
        distance === null || distance <= 0
          ? null
          : this.inMetres
            ? Math.round(distance)
            : DistanceUnits.toMeters(distance, this.units);
      const seconds = minutes === null || minutes <= 0 ? null : Math.round(minutes * 60);
      if (meters === null && seconds === null) return null;
      return { reps: null, loadKg: null, seconds, meters };
    }
    const text = d.value.trim();
    if (!INTEGER.test(text)) return null;
    const value = Number(text);
    if (this.track === 'time') return { reps: null, loadKg: null, seconds: value, meters: null };
    const shown = parseDecimal(d.load);
    return {
      reps: value,
      loadKg:
        this.weighted && shown !== null && shown > 0 ? WeightUnits.toKg(shown, this.units) : null,
      seconds: null,
      meters: null,
    };
  }
}

/** "Target: 3 × 15 reps", "Target: 1 × 4,000 m". */
function targetText(t: RoutineItem): string {
  const amount =
    t.reps !== null
      ? `${t.reps} reps`
      : t.meters !== null
        ? `${t.meters.toLocaleString('en-US')} m`
        : t.seconds !== null
          ? `${t.seconds} s`
          : null;
  return amount ? `Target: ${t.sets} × ${amount}` : `Target: ${t.sets} sets`;
}

/** Parses user input: null unless the whole (trimmed) text is a number. */
function parseDecimal(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
