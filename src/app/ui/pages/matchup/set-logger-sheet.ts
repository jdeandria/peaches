import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheet,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatTooltip } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { WeightUnits } from '../../../domain/core/units';
import { Exercise, takesLoad } from '../../../domain/exercises/exercise';
import { UnitSystem } from '../../../domain/models/training';
import { prescriptionUnit, targetPerSet, WorkoutItem } from '../../../domain/models/workout';
import { ExerciseLogEntry, exerciseLogEntry, SetLog } from '../../../domain/models/workout-log';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { Fmt } from '../../format';

export interface SetLoggerData {
  readonly exercise: Exercise;
  readonly item: WorkoutItem;
  readonly existing?: ExerciseLogEntry | null;
  readonly units?: UnitSystem;
  /** What was lifted last time (kg per set), to start the weights from. */
  readonly previousLoadsKg?: readonly number[] | null;
}

/**
 * Opens the set logger for one workout item and resolves with the entry,
 * or undefined if dismissed (port of `showSetLoggerSheet`).
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

const INTEGER = /^-?\d+$/;

/**
 * Records every set of one workout item: a value per set (reps, seconds or
 * metres), a weight per set for exercises that take a load (in the Peach's
 * units, stored as kg), and an optional RPE (port of `SetLoggerSheet`).
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
  private readonly p = this.data.item.prescription;
  private readonly units: UnitSystem = this.data.units ?? 'metric';
  protected readonly setCount = this.p.sets * (this.p.perSide ? 2 : 1);
  protected readonly sets = Array.from({ length: this.setCount }, (_, i) => i);
  protected readonly weighted = takesLoad(this.exercise);
  protected readonly weightUnit = WeightUnits.label(this.units);
  protected readonly prescription = Fmt.prescription(this.p);
  private readonly measure = prescriptionUnit(this.p);
  protected readonly unit =
    this.measure === 'duration' ? 'sec' : this.measure === 'distance' ? 'm' : 'reps';
  /** Increment per tap: a rep, five seconds, or ten metres. */
  private readonly step = this.measure === 'duration' ? 5 : this.measure === 'distance' ? 10 : 1;
  protected readonly rpeOptions = RPE_OPTIONS;

  /** Value text per set (pre-filled with the prescription; an existing entry wins). */
  protected readonly values = signal<string[]>(
    this.sets.map((i) => {
      const set = this.existingSet(i);
      return String(set?.reps ?? set?.seconds ?? set?.meters ?? targetPerSet(this.p));
    }),
  );
  /** Weight text per set in display units; blank for exercises without a load. */
  protected readonly loads = signal<string[]>(this.sets.map((i) => this.initialLoad(i)));
  /** Last committed weight text per set, to carry edits forward. */
  private readonly committed = [...this.loads()];
  protected readonly rpe = signal<number | null>(this.data.existing?.rpe ?? null);

  protected readonly lastTime = computed(() => {
    const previous = this.data.previousLoadsKg;
    if (!this.weighted || !previous || previous.length === 0) return null;
    const shown = previous.map((kg) => WeightUnits.format(WeightUnits.toDisplay(kg, this.units)));
    return `Last time: ${shown.join(' · ')} ${this.weightUnit}`;
  });

  private existingSet(i: number): SetLog | null {
    return this.data.existing?.sets[i] ?? null;
  }

  private initialLoad(i: number): string {
    if (!this.weighted) return '';
    // This session's entry first, then last time's weight for the same set
    // (or its last set), else blank.
    const previous = this.data.previousLoadsKg;
    const kg =
      this.existingSet(i)?.loadKg ??
      (previous && previous.length > 0 ? previous[Math.min(i, previous.length - 1)] : null);
    return kg === null ? '' : WeightUnits.format(WeightUnits.toDisplay(kg, this.units));
  }

  protected setLabel(i: number): string {
    return this.p.perSide
      ? `Set ${Math.floor(i / 2) + 1} · ${i % 2 === 0 ? 'Left' : 'Right'}`
      : `Set ${i + 1}`;
  }

  protected setValue(i: number, text: string): void {
    this.values.update((v) => v.map((x, j) => (j === i ? text : x)));
  }

  protected setLoad(i: number, text: string): void {
    this.loads.update((v) => v.map((x, j) => (j === i ? text : x)));
  }

  protected nudgeValue(i: number, direction: 1 | -1): void {
    const current = this.values()[i].trim();
    const n = INTEGER.test(current) ? Number(current) : 0;
    this.setValue(i, String(Math.min(9999, Math.max(0, n + direction * this.step))));
  }

  protected nudgeLoad(i: number, direction: 1 | -1): void {
    const current = parseDecimal(this.loads()[i]) ?? 0;
    const next = Math.min(9999, Math.max(0, current + direction * WeightUnits.step(this.units)));
    this.commitLoad(i, WeightUnits.format(next));
  }

  /**
   * Sets the weight for set `i` and carries it to later sets that still held
   * the old weight, so changing the working weight is one edit.
   */
  protected commitLoad(i: number, text: string): void {
    const old = this.committed[i];
    const loads = [...this.loads()];
    for (let j = i; j < this.setCount; j++) {
      if (j === i || this.committed[j] === old) {
        loads[j] = text;
        this.committed[j] = text;
      }
    }
    this.loads.set(loads);
  }

  protected fillPrescribed(): void {
    this.values.set(this.sets.map(() => String(targetPerSet(this.p))));
  }

  protected save(): void {
    const sets: SetLog[] = [];
    const values = this.values();
    const loads = this.loads();
    for (const i of this.sets) {
      const text = values[i].trim();
      if (!INTEGER.test(text)) continue;
      const value = Number(text);
      const shown = parseDecimal(loads[i]);
      sets.push({
        reps: this.p.reps !== null ? value : null,
        seconds: this.p.seconds !== null ? value : null,
        meters: this.p.meters !== null ? value : null,
        loadKg:
          this.weighted && shown !== null && shown > 0 ? WeightUnits.toKg(shown, this.units) : null,
      });
    }
    this.ref.dismiss(
      exerciseLogEntry({
        exerciseId: this.exercise.id,
        workoutItemId: this.data.item.id,
        sets,
        rpe: this.rpe(),
      }),
    );
  }
}

/** Parses user input: null unless the whole (trimmed) text is a number. */
function parseDecimal(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
