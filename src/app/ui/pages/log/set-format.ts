import { DistanceUnits, WeightUnits } from '../../../domain/core/units';
import { LoggableExercise } from '../../../domain/exercises/loggable';
import { UnitSystem } from '../../../domain/models/training';
import { SetLog } from '../../../domain/models/workout-log';
import { parseNumber } from '../../expressive/dial';
import { Fmt } from '../../format';

/** One set as dialled in, in display units; 0 means not entered. */
export interface SetDraft {
  /** Reps (reps track) or seconds (time track). */
  readonly value: number;
  /** Weight, for exercises that take a load. */
  readonly load: number;
  /** Distance (km/mi, or metres for swimming and rowing). */
  readonly distance: number;
  /** Minutes, for distance sets. */
  readonly minutes: number;
}

/** One dial for a set. */
export interface DialSpec {
  readonly key: string;
  /** Accessible name. */
  readonly label: string;
  /** Caption above the dial, and read after its value. */
  readonly unit: string;
  readonly step: number;
  readonly max: number;
  readonly format: (v: number) => string;
  readonly parse: (text: string) => number | null;
  readonly value: number;
  /** Where a reference set (last time's, or the target) sits on this dial. */
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
 * How one exercise's sets are shown, dialled and stored: reps (with a
 * weight for exercises that take a load, in the Peach's units, stored as
 * kg), minutes and seconds, or distance and time.
 */
export class SetFormat {
  readonly track: LoggableExercise['track'];
  readonly weighted: boolean;
  readonly weightUnit: string;
  /** Swimming and rowing count metres; travel on foot or wheels counts km or miles. */
  private readonly inMetres: boolean;
  readonly distanceUnit: string;
  /** What reads between the two dials: 8 × 60, 1:30, 5 km in 25 min. */
  readonly joiner: string | null;

  constructor(
    exercise: Pick<LoggableExercise, 'track' | 'takesLoad' | 'distanceKind'>,
    readonly units: UnitSystem,
  ) {
    this.track = exercise.track;
    this.weighted = exercise.takesLoad && this.track === 'reps';
    this.weightUnit = WeightUnits.label(units);
    this.inMetres = exercise.distanceKind === 'swimRow' || exercise.distanceKind === null;
    this.distanceUnit = this.inMetres ? 'm' : DistanceUnits.label(units);
    this.joiner =
      this.track === 'time' ? ':' : this.track === 'distance' ? 'in' : this.weighted ? '×' : null;
  }

  private readonly formatWeight = (v: number) => WeightUnits.format(v);
  private readonly formatDistance = (v: number) =>
    this.inMetres || !Number.isInteger(round2(v * 10)) ? plain(v) : v.toFixed(1);

  /** A stored set (or a fresh one) as dial values. */
  draft(set: SetLog | null): SetDraft {
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

  /** A set as stored, or null if nothing was entered. */
  toSet(d: SetDraft): SetLog | null {
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

  /** A set in a few characters: "8 × 60", "12 reps", "1:30", "5 km". */
  summary(s: SetDraft): string {
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

  /** Like `summary`, with the weight's unit: "8 × 60 kg". */
  describe(s: SetDraft): string {
    const unit = this.weighted && s.load > 0 ? ` ${this.weightUnit}` : '';
    return `${this.summary(s)}${unit}`;
  }

  /** The dials for a set; `change` gets what a turn changed. */
  dials(
    s: SetDraft,
    ghost: SetDraft | null,
    change: (patch: Partial<SetDraft>) => void,
  ): DialSpec[] {
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
            parse: parseNumber,
            value: s.distance,
            ghost: ghost?.distance || null,
            change: (v) => change({ distance: v }),
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
            ghost: ghost?.minutes || null,
            change: (v) => change({ minutes: v }),
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
            parse: parseNumber,
            value: Math.floor(s.value / 60),
            ghost: ghost ? Math.floor(ghost.value / 60) : null,
            change: (v) => change({ value: Math.round(v) * 60 + (s.value % 60) }),
          },
          {
            key: 'sec',
            label: 'Seconds',
            unit: 'sec',
            step: 5,
            max: 59,
            format: twoDigits,
            parse: parseNumber,
            value: s.value % 60,
            ghost: ghost ? ghost.value % 60 : null,
            change: (v) => change({ value: Math.floor(s.value / 60) * 60 + Math.round(v) }),
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
          parse: parseNumber,
          value: s.value,
          ghost: ghost?.value ?? null,
          change: (v) => change({ value: Math.round(v) }),
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
            parse: parseNumber,
            value: s.load,
            ghost: ghost?.load || null,
            change: (v) => change({ load: v }),
          },
        ];
      }
    }
  }
}
