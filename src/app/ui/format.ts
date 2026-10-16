import { addDays, LocalDate, monthOf, toUtcDate } from '../domain/core/local-date';
import { DistanceUnits, WeightUnits } from '../domain/core/units';
import { Equipment, MovementPattern } from '../domain/exercises/taxonomy';
import { ScoringCategory } from '../domain/models/scoring';
import { MatchupStatus, RoundStatus, SeasonStatus } from '../domain/models/season';
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
const longDayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
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

  /** "Monday, October 12, 2026" */
  longDay(date: LocalDate): string {
    return longDayFormat.format(toUtcDate(date));
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

  /** A weight in the Peach's units, e.g. "22.5 kg" or "50 lb". */
  weight(kg: number, units: UnitSystem): string {
    return `${WeightUnits.format(WeightUnits.toDisplay(kg, units))} ${WeightUnits.label(units)}`;
  },

  /** Total volume load (sets × reps × weight), e.g. "2,450 kg". */
  volume(kg: number, units: UnitSystem): string {
    const shown = Math.round(WeightUnits.toDisplay(kg, units));
    return `${integerFormat.format(shown)} ${WeightUnits.label(units)}`;
  },

  /**
   * The weights lifted across an entry's sets: "Lifted 20 kg" when they all
   * match, otherwise the range "Lifted 20–25 kg". Null when none was logged.
   */
  loggedLoad(entry: ExerciseLogEntry, units: UnitSystem): string | null {
    const loads = entry.sets
      .map((s) => s.loadKg)
      .filter((kg): kg is number => kg !== null && kg > 0);
    if (loads.length === 0) return null;
    const shown = (kg: number) => WeightUnits.format(WeightUnits.toDisplay(kg, units));
    const low = shown(Math.min(...loads));
    const high = shown(Math.max(...loads));
    return `Lifted ${low === high ? low : `${low}–${high}`} ${WeightUnits.label(units)}`;
  },

  /** A distance in km or miles, e.g. "5.2 km". */
  distance(meters: number, units: UnitSystem): string {
    return `${DistanceUnits.format(DistanceUnits.toDisplay(meters, units))} ${DistanceUnits.label(units)}`;
  },

  /** A duration as "45 s", "25:00" or "1:05:00". */
  duration(seconds: number): string {
    const s = Math.round(seconds);
    if (s < 60) return `${s} s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rest = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
  },

  /**
   * What an entry adds up to: "3 sets · 30 reps · 60 kg", "5.2 km · 26:00",
   * "3 × 45 s".
   */
  entrySummary(entry: ExerciseLogEntry, units: UnitSystem): string {
    const parts = [Fmt.count(entry.sets.length, 'set')];
    const meters = totalMeters(entry);
    const reps = totalReps(entry);
    const seconds = totalSeconds(entry);
    if (meters > 0) {
      parts.push(
        entry.distanceKind === 'swimRow' || entry.distanceKind === null
          ? `${integerFormat.format(meters)} m`
          : Fmt.distance(meters, units),
      );
    }
    if (reps > 0) parts.push(`${integerFormat.format(reps)} reps`);
    if (seconds > 0) parts.push(Fmt.duration(seconds));
    const load = Fmt.loggedLoad(entry, units);
    if (load) parts.push(load.replace(/^Lifted /, ''));
    return parts.join(' · ');
  },

  /** The one number that sums an entry up: its distance, else its reps, else its time. */
  entryHeadline(entry: ExerciseLogEntry, units: UnitSystem): string {
    const meters = totalMeters(entry);
    if (meters > 0) {
      return entry.distanceKind === 'swimRow' || entry.distanceKind === null
        ? `${integerFormat.format(meters)} m`
        : Fmt.distance(meters, units);
    }
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

  /** What a category's par is, for explaining weights: "per 5 km", "per 3.1 mi". */
  per(c: ScoringCategory, par: number, units: UnitSystem): string {
    return `per ${Fmt.amount(c, par, units)}`;
  },

  pattern(p: MovementPattern): string {
    return PATTERN[p];
  },

  equipment(e: Equipment): string {
    return EQUIPMENT[e];
  },

  matchupStatus(status: MatchupStatus): string {
    return MATCHUP_STATUS[status];
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

const EQUIPMENT: Record<Equipment, string> = {
  dumbbell: 'Dumbbell',
  barbell: 'Barbell',
  kettlebell: 'Kettlebell',
  resistanceBand: 'Band',
  pullUpBar: 'Pull-up bar',
  dipStation: 'Dip station',
  bench: 'Bench',
  box: 'Box',
  medicineBall: 'Medicine ball',
  slamBall: 'Slam ball',
  jumpRope: 'Jump rope',
  cableMachine: 'Cable machine',
  weightMachine: 'Machine',
  treadmill: 'Treadmill',
  stationaryBike: 'Bike',
  rowingMachine: 'Rower',
  elliptical: 'Elliptical',
  stairClimber: 'Stair climber',
  suspensionTrainer: 'Suspension trainer',
  abWheel: 'Ab wheel',
  foamRoller: 'Foam roller',
  wall: 'Wall',
  chair: 'Chair',
  stairs: 'Stairs',
  pool: 'Pool',
  bicycle: 'Bicycle',
  sled: 'Sled',
  battleRope: 'Battle rope',
  sandbag: 'Sandbag',
  plate: 'Plate',
};

const MATCHUP_STATUS: Record<MatchupStatus, string> = {
  scheduled: 'Scheduled',
  inProgress: 'Open',
  complete: 'Final',
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
