import { addDays, LocalDate, monthOf, toUtcDate } from '../domain/core/local-date';
import { DistanceUnits, WeightUnits } from '../domain/core/units';
import { MovementPattern } from '../domain/exercises/taxonomy';
import { CATEGORY_INFO, ScoringCategory } from '../domain/models/scoring';
import { RoundStatus, SeasonStatus } from '../domain/models/season';
import { UnitSystem } from '../domain/models/training';
import {
  ExerciseLogEntry,
  totalMeters,
  totalReps,
  totalSeconds,
} from '../domain/models/workout-log';

/** Only English strings ship today; pinning the locale keeps output stable. */
const LOCALE = 'en-US';

const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const headerDayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});
const monthDayFormat = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * Human-readable labels for domain values. Kept in one place so the UI never
 * reaches into enum names.
 */
export const Fmt = {
  /** "Mon, Oct 12" */
  day(date: LocalDate): string {
    return dayFormat.format(toUtcDate(date));
  },

  /** "Monday, October 12" (page headers). */
  headerDay(date: LocalDate): string {
    return headerDayFormat.format(toUtcDate(date));
  },

  /** A Monday-to-Sunday week: "Oct 12 – 18", or "Oct 26 – Nov 1" across months. */
  week(monday: LocalDate): string {
    const sunday = addDays(monday, 6);
    const end =
      monthOf(sunday) === monthOf(monday)
        ? sunday.slice(8).replace(/^0/, '')
        : monthDayFormat.format(toUtcDate(sunday));
    return `${monthDayFormat.format(toUtcDate(monday))} – ${end}`;
  },

  /** A local wall-clock time, e.g. "6:00 AM". */
  time(instant: Date): string {
    return timeFormat.format(instant);
  },

  /** "closes in 5 h", "closes in 20 min" or "closed". */
  closesIn(remainingMs: number): string {
    if (remainingMs <= 0) return 'closed';
    if (remainingMs >= 48 * MS_PER_HOUR)
      return `closes in ${Math.floor(remainingMs / MS_PER_DAY)} d`;
    if (remainingMs >= MS_PER_HOUR) return `closes in ${Math.floor(remainingMs / MS_PER_HOUR)} h`;
    return `closes in ${Math.floor(remainingMs / MS_PER_MINUTE)} min`;
  },

  /** Whole points without decimals, otherwise one decimal. */
  points(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  },

  /** Total volume load (sets × reps × weight), e.g. "2,450 kg". */
  volume(kg: number, units: UnitSystem): string {
    const shown = Math.round(WeightUnits.toDisplay(kg, units));
    return `${integerFormat.format(shown)} ${WeightUnits.label(units)}`;
  },

  /**
   * The weights lifted across an entry's sets: "20 kg" when they all match,
   * otherwise the range "20–25 kg". Null when none was logged.
   */
  load(entry: ExerciseLogEntry, units: UnitSystem): string | null {
    const loads = entry.sets
      .map((s) => s.loadKg)
      .filter((kg): kg is number => kg !== null && kg > 0);
    if (loads.length === 0) return null;
    const shown = (kg: number) => WeightUnits.format(WeightUnits.toDisplay(kg, units));
    const low = shown(Math.min(...loads));
    const high = shown(Math.max(...loads));
    return `${low === high ? low : `${low}–${high}`} ${WeightUnits.label(units)}`;
  },

  /** A distance in km or miles, e.g. "5.2 km". */
  distance(meters: number, units: UnitSystem): string {
    return `${DistanceUnits.format(DistanceUnits.toDisplay(meters, units))} ${DistanceUnits.label(units)}`;
  },

  /** A duration as "45 s", "25:00" or "1:05:00". */
  duration(seconds: number): string {
    return seconds < 59.5 ? `${Math.round(seconds)} s` : Fmt.clock(seconds);
  },

  /** A clock reading: "0:07", "25:00" or "1:05:00". */
  clock(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rest = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
  },

  /** "Ada", "Ada and Ben", "Ada, Ben and Cho". */
  names(names: readonly string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  },

  /**
   * What an entry adds up to: "3 sets · 30 reps · 60 kg", "5.2 km · 26:00",
   * "3 × 45 s".
   */
  entrySummary(entry: ExerciseLogEntry, units: UnitSystem): string {
    const parts = [Fmt.count(entry.sets.length, 'set')];
    const distance = entryDistance(entry, units);
    const reps = totalReps(entry);
    const seconds = totalSeconds(entry);
    if (distance) parts.push(distance);
    if (reps > 0) parts.push(`${integerFormat.format(reps)} reps`);
    if (seconds > 0) parts.push(Fmt.duration(seconds));
    const load = Fmt.load(entry, units);
    if (load) parts.push(load);
    return parts.join(' · ');
  },

  /** The one number that sums an entry up: its distance, else its reps, else its time. */
  entryHeadline(entry: ExerciseLogEntry, units: UnitSystem): string {
    const distance = entryDistance(entry, units);
    if (distance) return distance;
    const reps = totalReps(entry);
    if (reps > 0) return `${integerFormat.format(reps)} reps`;
    return Fmt.duration(totalSeconds(entry));
  },

  category(c: ScoringCategory): string {
    return CATEGORY[c].label;
  },

  categoryIcon(c: ScoringCategory): string {
    return CATEGORY[c].icon;
  },

  /** A category amount in the Peach's units: "12.4 km", "8.1 mi", "2,450 kg", "120 reps". */
  amount(c: ScoringCategory, amount: number, units: UnitSystem): string {
    switch (c) {
      case 'runWalk':
      case 'ride':
        return Fmt.distance(amount * 1000, units);
      case 'swimRow':
        return `${integerFormat.format(amount)} m`;
      case 'weightMoved':
        return Fmt.volume(amount, units);
      case 'reps':
        return `${integerFormat.format(amount)} reps`;
      default:
        return `${integerFormat.format(amount)} min`;
    }
  },

  /** A category's display unit: "km", "mi", "m", "kg", "lb", "reps" or "min". */
  unit(c: ScoringCategory, units: UnitSystem): string {
    switch (c) {
      case 'runWalk':
      case 'ride':
        return DistanceUnits.label(units);
      case 'swimRow':
        return 'm';
      case 'weightMoved':
        return WeightUnits.label(units);
      default:
        return CATEGORY_INFO[c].unit;
    }
  },

  /** A category amount as a number in its display unit (for inputs). */
  toDisplay(c: ScoringCategory, amount: number, units: UnitSystem): number {
    if (c === 'runWalk' || c === 'ride') return DistanceUnits.toDisplay(amount * 1000, units);
    if (c === 'weightMoved') return WeightUnits.toDisplay(amount, units);
    return amount;
  },

  /** The inverse of {@link toDisplay}: a typed number back to the category's unit. */
  fromDisplay(c: ScoringCategory, shown: number, units: UnitSystem): number {
    if (c === 'runWalk' || c === 'ride') return DistanceUnits.toMeters(shown, units) / 1000;
    if (c === 'weightMoved') return WeightUnits.toKg(shown, units);
    return shown;
  },

  /** What a category's par is, for explaining weights: "per 5 km", "per 3.1 mi". */
  per(c: ScoringCategory, par: number, units: UnitSystem): string {
    return `per ${Fmt.amount(c, par, units)}`;
  },

  pattern(p: MovementPattern): string {
    return PATTERN[p];
  },

  seasonStatus(status: SeasonStatus): string {
    return SEASON_STATUS[status];
  },

  roundStatus(status: RoundStatus): string {
    return ROUND_STATUS[status];
  },

  /** "1 Crate", "3 Crates" */
  count(n: number, singular: string, plural = `${singular}s`): string {
    return `${n} ${n === 1 ? singular : plural}`;
  },
} as const;

/** An entry's distance: metres for swims, rows and the unclassified, else km or mi. Null if none. */
function entryDistance(entry: ExerciseLogEntry, units: UnitSystem): string | null {
  const meters = totalMeters(entry);
  if (meters <= 0) return null;
  return entry.distanceKind === 'swimRow' || entry.distanceKind === null
    ? `${integerFormat.format(meters)} m`
    : Fmt.distance(meters, units);
}

const CATEGORY: Record<ScoringCategory, { label: string; icon: string }> = {
  runWalk: { label: 'Run & walk', icon: 'directions_run' },
  ride: { label: 'Ride', icon: 'directions_bike' },
  swimRow: { label: 'Swim & row', icon: 'pool' },
  weightMoved: { label: 'Weight moved', icon: 'fitness_center' },
  reps: { label: 'Reps', icon: 'repeat' },
  activeMinutes: { label: 'Active minutes', icon: 'timer' },
};

const PATTERN: Record<MovementPattern, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Lunge',
  horizontalPush: 'Horizontal push',
  verticalPush: 'Vertical push',
  horizontalPull: 'Horizontal pull',
  verticalPull: 'Vertical pull',
  carry: 'Carry',
  coreFlexion: 'Core flexion',
  antiExtension: 'Anti-extension',
  rotation: 'Rotation',
  antiLateralFlexion: 'Anti-lateral flexion',
  plyometric: 'Plyometric',
  locomotion: 'Cardio',
  isolation: 'Isolation',
  mobility: 'Mobility',
  stretch: 'Stretch',
};

const SEASON_STATUS: Record<SeasonStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

const ROUND_STATUS: Record<RoundStatus, string> = {
  scheduled: 'Upcoming',
  open: 'Open',
  closed: 'Closed',
};
