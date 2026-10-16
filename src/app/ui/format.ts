import { LocalDate, toUtcDate } from '../domain/core/local-date';
import { WeightUnits } from '../domain/core/units';
import { Equipment, MovementPattern } from '../domain/exercises/taxonomy';
import { MatchupStatus, RoundStatus, SeasonStatus } from '../domain/models/season';
import { SessionFocus, TrainingGoal, UnitSystem } from '../domain/models/training';
import { BlockType, Prescription, prescriptionUnit, targetPerSet } from '../domain/models/workout';
import { ExerciseLogEntry } from '../domain/models/workout-log';

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

  /** "3 × 10 reps / side · rest 60 s · RPE 7" */
  prescription(p: Prescription): string {
    const target = targetPerSet(p);
    const unit = prescriptionUnit(p);
    const amount =
      unit === 'duration' ? `${target} s` : unit === 'distance' ? `${target} m` : `${target} reps`;
    const side = p.perSide ? ' / side' : '';
    const rest = p.restSeconds > 0 ? ` · rest ${p.restSeconds} s` : '';
    const load = p.load ? ` · RPE ${p.load.rpe}` : '';
    return `${p.sets} × ${amount}${side}${rest}${load}`;
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

  focus(focus: SessionFocus): string {
    return FOCUS[focus];
  },

  goal(goal: TrainingGoal): string {
    return GOAL[goal];
  },

  block(type: BlockType): string {
    return BLOCK[type];
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

const FOCUS: Record<SessionFocus, string> = {
  fullBody: 'Full body',
  upperBody: 'Upper body',
  lowerBody: 'Lower body',
  conditioning: 'Conditioning',
  coreAndMobility: 'Core & mobility',
};

const GOAL: Record<TrainingGoal, string> = {
  strength: 'Strength',
  hypertrophy: 'Muscle',
  endurance: 'Endurance',
  generalFitness: 'General fitness',
};

const BLOCK: Record<BlockType, string> = {
  warmUp: 'Warm-up',
  strength: 'Main work',
  conditioning: 'Conditioning',
  coolDown: 'Cool-down',
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
