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

import { DistanceUnits, WeightUnits } from '../../../domain/core/units';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { UnitSystem } from '../../../domain/models/training';
import { entryOf, ExerciseLogEntry, SetLog } from '../../../domain/models/workout-log';
import { implausibility } from '../../../domain/services/plausibility';
import { ReducedMotion } from '../../core/motion';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { Dial, parseNumber } from '../../expressive/dial';
import { Fmt } from '../../format';

export interface SetLoggerData {
  readonly exercise: LoggableExercise;
  /** This session's entry, when editing it. */
  readonly existing?: ExerciseLogEntry | null;
  /** The last time the Peach logged this exercise, to start from. */
  readonly previous?: ExerciseLogEntry | null;
  readonly units?: UnitSystem;
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

/** One set as dialled in, in display units; 0 means not entered. */
interface SetDraft {
  /** Reps (reps track) or seconds (time track). */
  readonly value: number;
  /** Weight, for exercises that take a load. */
  readonly load: number;
  /** Distance (km/mi, or metres for swimming and rowing). */
  readonly distance: number;
  /** Minutes, for distance sets. */
  readonly minutes: number;
}

/** One dial on the set card. */
interface DialSpec {
  readonly key: string;
  /** Accessible name. */
  readonly label: string;
  /** Caption above the dial, and read after its value. */
  readonly unit: string;
  readonly step: number;
  readonly max: number;
  readonly format: (v: number) => string;
  readonly parse?: (text: string) => number | null;
  readonly value: number;
  /** Last time's value for this set. */
  readonly ghost: number | null;
  readonly change: (v: number) => void;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const plain = (v: number) => String(round2(v));
const twoDigits = (v: number) => String(v).padStart(2, '0');
/** Minutes as "34" or "34:03". */
const clockMinutes = (v: number) => {
  const seconds = Math.round(v * 60);
  return seconds % 60 === 0 ? String(seconds / 60) : Fmt.clock(seconds);
};
/** "34:03" or "34.05" as minutes. */
const parseMinutes = (text: string) => {
  const m = /^(\d+):([0-5]?\d)$/.exec(text.trim());
  return m ? round2(Number(m[1]) + Number(m[2]) / 60) : parseNumber(text);
};

/**
 * Records one exercise a set at a time, however it is measured: reps (with
 * a weight for exercises that take a load, in the Peach's units, stored as
 * kg), minutes and seconds, or distance and time. Each set's numbers are
 * on two dials: swipe along one to turn it, fling it to cover ground, tap
 * it to type. It starts from last time's sets (marked on the dials), so
 * repeating a workout is one tap. Sets are picked from a strip, added and
 * removed; an optional RPE rates the whole exercise.
 */
@Component({
  selector: 'pch-set-logger-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatIconButton, MatTooltip, ButtonGroup, Dial],
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
  protected readonly track = this.exercise.track;
  protected readonly weighted = this.exercise.takesLoad && this.track === 'reps';
  protected readonly weightUnit = WeightUnits.label(this.units);
  /** Swimming and rowing count metres; travel on foot or wheels counts km or miles. */
  private readonly inMetres =
    this.exercise.distanceKind === 'swimRow' || this.exercise.distanceKind === null;
  protected readonly distanceUnit = this.inMetres ? 'm' : DistanceUnits.label(this.units);
  protected readonly rpeOptions = RPE_OPTIONS;
  protected readonly parseNumber = parseNumber;
  /** What reads between the two dials: 8 × 60, 1:30, 5 km in 25 min. */
  protected readonly joiner =
    this.track === 'time' ? ':' : this.track === 'distance' ? 'in' : this.weighted ? '×' : null;

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
    return set ? this.draftFrom(set) : null;
  });
  protected readonly ghostSummary = computed(() => {
    const ghost = this.ghost();
    return ghost ? this.summary(ghost) : null;
  });

  /** Why Save was refused, until the sets it was refused for change. */
  private readonly refused = signal<{ sets: SetDraft[]; message: string } | null>(null);
  protected readonly problem = computed(() => {
    const refused = this.refused();
    return refused?.sets === this.sets() ? refused.message : null;
  });

  protected readonly canAdd = computed(() => this.sets().length < MAX_SETS);
  protected readonly canRemove = computed(() => this.sets().length > 1);

  private readonly formatWeight = (v: number) => WeightUnits.format(v);
  private readonly formatDistance = (v: number) =>
    this.inMetres || !Number.isInteger(round2(v * 10)) ? plain(v) : v.toFixed(1);

  protected readonly dials = computed<DialSpec[]>(() => {
    const i = this.selected();
    const s = this.sets()[i];
    const g = this.ghost();
    switch (this.track) {
      case 'distance':
        return [
          {
            key: 'distance',
            label: `Distance in ${this.distanceUnit}`,
            unit: this.distanceUnit,
            step: this.inMetres ? 50 : 0.1,
            max: this.inMetres ? 99999 : 999,
            format: this.formatDistance,
            value: s.distance,
            ghost: g?.distance || null,
            change: (v) => this.update(i, { distance: v }),
          },
          {
            key: 'minutes',
            label: 'Time in minutes',
            unit: 'min',
            step: 1,
            max: 9999,
            format: clockMinutes,
            parse: parseMinutes,
            value: s.minutes,
            ghost: g?.minutes || null,
            change: (v) => this.update(i, { minutes: v }),
          },
        ];
      case 'time':
        return [
          {
            key: 'min',
            label: 'Minutes',
            unit: 'min',
            step: 1,
            max: 166,
            format: String,
            value: Math.floor(s.value / 60),
            ghost: g ? Math.floor(g.value / 60) : null,
            change: (v) => this.update(i, { value: Math.round(v) * 60 + (s.value % 60) }),
          },
          {
            key: 'sec',
            label: 'Seconds',
            unit: 'sec',
            step: 5,
            max: 59,
            format: twoDigits,
            value: s.value % 60,
            ghost: g ? g.value % 60 : null,
            change: (v) => this.update(i, { value: Math.floor(s.value / 60) * 60 + Math.round(v) }),
          },
        ];
      default: {
        const reps: DialSpec = {
          key: 'reps',
          label: 'Reps',
          unit: 'reps',
          step: 1,
          max: 9999,
          format: String,
          value: s.value,
          ghost: g?.value ?? null,
          change: (v) => this.update(i, { value: Math.round(v) }),
        };
        if (!this.weighted) return [reps];
        return [
          reps,
          {
            key: 'load',
            label: `Weight in ${this.weightUnit}`,
            unit: this.weightUnit,
            step: WeightUnits.step(this.units),
            max: 9999,
            format: this.formatWeight,
            value: s.load,
            ghost: g?.load || null,
            change: (v) => this.commitLoad(i, v),
          },
        ];
      }
    }
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
    if (from.length > 0) return from.map((s) => this.draftFrom(s));
    const count = this.track === 'distance' ? 1 : 3;
    return Array.from({ length: count }, () => this.draftFrom(null));
  }

  private draftFrom(set: SetLog | null): SetDraft {
    const seconds = this.track === 'distance' ? (set?.seconds ?? null) : null;
    return {
      value: set?.reps ?? set?.seconds ?? (this.track === 'time' ? 30 : 10),
      load:
        this.weighted && set?.loadKg != null
          ? WeightUnits.tidy(WeightUnits.toDisplay(set.loadKg, this.units))
          : 0,
      distance:
        set?.meters == null
          ? 0
          : this.inMetres
            ? set.meters
            : round2(DistanceUnits.toDisplay(set.meters, this.units)),
      minutes: seconds === null ? 0 : round2(seconds / 60),
    };
  }

  /** A set in a few characters: "8 × 60", "12 reps", "1:30", "5 km". */
  protected summary(s: SetDraft): string {
    switch (this.track) {
      case 'distance':
        if (s.distance > 0) return `${this.formatDistance(s.distance)} ${this.distanceUnit}`;
        return s.minutes > 0 ? `${clockMinutes(s.minutes)} min` : '–';
      case 'time':
        return `${Math.floor(s.value / 60)}:${twoDigits(s.value % 60)}`;
      default:
        if (!this.weighted) return `${s.value} reps`;
        return s.load > 0 ? `${s.value} × ${this.formatWeight(s.load)}` : `${s.value} reps`;
    }
  }

  protected chipLabel(i: number, s: SetDraft): string {
    const unit = this.weighted && s.load > 0 ? ` ${this.weightUnit}` : '';
    return `Set ${i + 1}: ${this.summary(s)}${unit}`;
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
      const set = this.toSet(draft);
      if (set) sets.push(set);
    }
    const entry = entryOf(this.exercise, { sets, rpe: this.rpe() });
    const message = implausibility(entry);
    if (message) {
      this.refused.set({ sets: this.sets(), message });
      return;
    }
    this.ref.dismiss(entry);
  }

  /** A set as stored, or null if nothing was entered. */
  private toSet(d: SetDraft): SetLog | null {
    if (this.track === 'distance') {
      const meters =
        d.distance <= 0
          ? null
          : this.inMetres
            ? Math.round(d.distance)
            : DistanceUnits.toMeters(d.distance, this.units);
      const seconds = d.minutes <= 0 ? null : Math.round(d.minutes * 60);
      if (meters === null && seconds === null) return null;
      return { reps: null, loadKg: null, seconds, meters };
    }
    if (d.value <= 0) return null;
    if (this.track === 'time') return { reps: null, loadKg: null, seconds: d.value, meters: null };
    return {
      reps: d.value,
      loadKg: this.weighted && d.load > 0 ? WeightUnits.toKg(d.load, this.units) : null,
      seconds: null,
      meters: null,
    };
  }
}
