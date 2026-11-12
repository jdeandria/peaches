import { addDays, LocalDate, parseLocalDate, startOfWeek } from '../core/local-date';
import { SeededRandom } from '../core/random';
import { stableHash } from '../core/stable-hash';
import { ZoneClock } from '../core/zone-clock';
import { Exercise } from '../exercises/exercise';
import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { BotLevel, BotStyle, CrateBot, isActiveBot, isBotId } from '../models/bot';
import { Crate } from '../models/crate';
import { PlannedWorkout, WeekPlan } from '../models/week-plan';
import { ExerciseLogEntry, SetLog, WorkoutLog, workoutLog } from '../models/workout-log';
import { plannedSessionSeconds } from './scoring-service';
import { templateWorkout, WORKOUT_TEMPLATES, WorkoutTemplate } from './workout-templates';

/** How each level trains. */
interface LevelProfile {
  /** Workouts planned a week: one of these. */
  readonly workouts: readonly number[];
  /** Chance of doing each planned workout. */
  readonly reliability: number;
  /** How much of a planned workout gets done, from `effort[0]` to `effort[1]`. */
  readonly effort: readonly [number, number];
  /** Planned reps, holds and distances against a template's. */
  readonly volume: number;
  /** Sets of each strength exercise. */
  readonly sets: number;
  /** A barbell squat's working weight; other lifts scale from it. */
  readonly baseKg: number;
  /** Running pace, seconds a kilometre. */
  readonly paceSeconds: number;
}

export const BOT_LEVEL_PROFILES: Readonly<Record<BotLevel, LevelProfile>> = {
  easy: {
    workouts: [2, 3],
    reliability: 0.8,
    effort: [0.8, 1.2],
    volume: 0.8,
    sets: 3,
    baseKg: 25,
    paceSeconds: 420,
  },
  steady: {
    workouts: [3, 4],
    reliability: 0.88,
    effort: [0.9, 1.2],
    volume: 1,
    sets: 3,
    baseKg: 45,
    paceSeconds: 345,
  },
  strong: {
    workouts: [4, 5, 6],
    reliability: 0.93,
    effort: [0.95, 1.25],
    volume: 1.3,
    sets: 4,
    baseKg: 70,
    paceSeconds: 290,
  },
};

/** Which templates each style picks from; repeats make one likelier. */
const STYLE_TEMPLATES: Readonly<Record<BotStyle, readonly string[]>> = {
  lifter: ['full-body', 'upper-body', 'lower-body', 'upper-body', 'lower-body', 'core'],
  runner: ['easy-run', 'easy-run', 'easy-run', 'bodyweight', 'core'],
  allRounder: ['full-body', 'upper-body', 'lower-body', 'bodyweight', 'core', 'easy-run'],
};

/** Hours of the day (in the Crate's zone) a bot starts a workout. */
const START_HOURS = [6, 7, 7, 12, 17, 18, 18, 19, 20];

/** `bot_<crateId>_<n>_<yyyy-MM-dd>_<i>`: the i-th workout planned the week of that Monday. */
const BOT_LOG_ID = /^(bot_.+_\d+)_(\d{4}-\d{2}-\d{2})_(\d+)$/;

/** The bot and week a bot's log id comes from, or null for anyone else's. */
export function parseBotLogId(
  logId: string,
): { botId: string; weekStart: LocalDate; index: number } | null {
  const match = BOT_LOG_ID.exec(logId);
  if (!match || !isBotId(match[1])) return null;
  try {
    return { botId: match[1], weekStart: parseLocalDate(match[2]), index: Number(match[3]) };
  } catch {
    return null;
  }
}

/** Keeps the caches from growing without end over a long session. */
const CACHE_LIMIT = 400;

/**
 * Plays a Crate's bots (see {@link CrateBot}): what each plans every week
 * and the workouts it then does. Everything is a pure function of the bot
 * (id, level, style), the week and the Crate's time zone, seeded with
 * {@link stableHash}, so every device works out the same plans, the same
 * workouts at the same times and so the same matchup results, without
 * anything being stored.
 *
 * A bot plans from the same templates Peaches can (`workout-templates.ts`),
 * scaled to its level, then does each planned workout with its level's
 * reliability, some better than planned and some worse. A workout is
 * shared with the Crate once it's finished, so a matchup's live score
 * grows through the week, and a log only exists while the bot was in the
 * Crate.
 */
export class BotTrainer {
  private readonly plans = new Map<string, WeekPlan>();
  private readonly workouts = new Map<string, readonly WorkoutLog[]>();

  constructor(
    private readonly catalog: ExerciseCatalog,
    private readonly zone: ZoneClock,
  ) {}

  /** What `bot` plans for the week of `weekStart` (any day of it). */
  plan(bot: CrateBot, weekStart: LocalDate): WeekPlan {
    const monday = startOfWeek(weekStart);
    const key = `${bot.id}|${bot.level}|${bot.style}|${monday}`;
    const cached = this.plans.get(key);
    if (cached) return cached;
    const profile = BOT_LEVEL_PROFILES[bot.level];
    const random = randomFor(`${key}|plan`);
    const pick = <T>(items: readonly T[]): T => items[random.nextInt(items.length)];
    const count = pick(profile.workouts);
    const days = shuffled([0, 1, 2, 3, 4, 5, 6], random)
      .slice(0, count)
      .sort((a, b) => a - b);
    const workouts: PlannedWorkout[] = days.map((offset, i) => {
      const template = templateById(pick(STYLE_TEMPLATES[bot.style]));
      const exercises = templateWorkout(template, this.catalog, random.nextInt(0x7fffffff)).map(
        (e) => this.scaled(e, bot),
      );
      return {
        id: `${bot.id}_${monday}_${i}`,
        day: addDays(monday, offset),
        name: template.name,
        locationId: null,
        exercises,
        logId: null,
      };
    });
    const plan: WeekPlan = { peachId: bot.id, weekStart: monday, workouts, updatedAt: bot.addedAt };
    return remember(this.plans, key, plan);
  }

  /**
   * Every workout `bot` does in the week of `weekStart`, finished or not,
   * in order. Planned workouts it skips aren't there.
   */
  weekLogs(bot: CrateBot, crate: Pick<Crate, 'id' | 'timeZone'>, weekStart: LocalDate) {
    const plan = this.plan(bot, weekStart);
    const seed = `${bot.id}|${bot.level}|${bot.style}|${plan.weekStart}`;
    const key = `${seed}|${crate.id}|${crate.timeZone}`;
    const cached = this.workouts.get(key);
    if (cached) return cached;
    const profile = BOT_LEVEL_PROFILES[bot.level];
    const logs: WorkoutLog[] = [];
    // One stream for the week, drawn in the same order on every device.
    const random = randomFor(`${seed}|done`);
    for (const planned of plan.workouts) {
      const done = random.nextDouble() < profile.reliability;
      const [low, high] = profile.effort;
      const effort = low + random.nextDouble() * (high - low);
      const entries = planned.exercises.map((e) => ({
        ...e,
        sets: e.sets.map((s) => performed(s, effort)),
      }));
      const hour = START_HOURS[random.nextInt(START_HOURS.length)];
      const minute = 15 * random.nextInt(4);
      const startedAt = new Date(
        this.zone.startOfDay(planned.day, crate.timeZone).getTime() + (hour * 60 + minute) * 60_000,
      );
      const durationSeconds = Math.round(
        plannedSessionSeconds(entries) * (0.9 + 0.2 * random.nextDouble()),
      );
      if (!done) continue;
      logs.push(
        workoutLog({
          id: planned.id,
          peachId: bot.id,
          startedAt,
          completedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
          status: 'submitted',
          entries,
          durationSeconds,
          sharedWith: [crate.id],
        }),
      );
    }
    return remember(this.workouts, key, logs);
  }

  /**
   * The workouts `bot` started in `[from, to)` and had finished by `now`,
   * while it was in the Crate. Oldest first.
   */
  logs(
    bot: CrateBot,
    crate: Pick<Crate, 'id' | 'timeZone'>,
    from: Date,
    to: Date,
    now: Date,
  ): WorkoutLog[] {
    const end = new Date(Math.min(to.getTime(), now.getTime()));
    if (end <= from || end <= bot.addedAt) return [];
    const logs: WorkoutLog[] = [];
    // A day either side covers any time zone's week edges.
    const first = startOfWeek(this.zone.dateOf(new Date(from.getTime() - 86_400_000), 'UTC'));
    const last = this.zone.dateOf(new Date(end.getTime() + 86_400_000), 'UTC');
    for (let week = first; week <= last; week = addDays(week, 7)) {
      for (const log of this.weekLogs(bot, crate, week)) {
        if (log.startedAt < from || log.startedAt >= to) continue;
        if (log.completedAt! > now || !this.wasIn(bot, log)) continue;
        logs.push(log);
      }
    }
    return logs;
  }

  /** One of a bot's workouts by id, once it's finished; null if there's no such workout. */
  log(bot: CrateBot, crate: Pick<Crate, 'id' | 'timeZone'>, logId: string, now: Date) {
    const parsed = parseBotLogId(logId);
    if (!parsed || parsed.botId !== bot.id) return null;
    const log = this.weekLogs(bot, crate, parsed.weekStart).find((l) => l.id === logId);
    if (!log || log.completedAt! > now || !this.wasIn(bot, log)) return null;
    return log;
  }

  private wasIn(bot: CrateBot, log: WorkoutLog): boolean {
    return log.startedAt >= bot.addedAt && isActiveBot(bot, log.startedAt);
  }

  /** A template's exercise at the bot's level: its sets, weights and distances. */
  private scaled(entry: ExerciseLogEntry, bot: CrateBot): ExerciseLogEntry {
    const profile = BOT_LEVEL_PROFILES[bot.level];
    const exercise = this.catalog.byId(entry.exerciseId);
    if (entry.track === 'distance') {
      const runner = bot.style === 'runner' ? 1.3 : 1;
      return {
        ...entry,
        sets: entry.sets.map((s) => {
          const km = Math.max(1, roundTo(((s.meters ?? 0) / 1000) * profile.volume * runner, 0.5));
          return { ...s, meters: km * 1000, seconds: Math.round(km * profile.paceSeconds) };
        }),
      };
    }
    const sets = Array.from({ length: entry.track === 'reps' ? profile.sets : 3 }, () => {
      const s = entry.sets[0];
      if (entry.track === 'time') {
        return { ...s, seconds: Math.max(10, roundTo((s.seconds ?? 30) * profile.volume, 5)) };
      }
      if (entry.takesLoad) {
        return { ...s, loadKg: botLoadKg(exercise, bot.level) };
      }
      return { ...s, reps: Math.max(1, Math.round((s.reps ?? 10) * profile.volume)) };
    });
    return { ...entry, sets };
  }
}

/**
 * The weight a bot lifts on an exercise: its level's barbell squat, less
 * for kit held in one hand, for upper body and for single-joint moves.
 */
export function botLoadKg(exercise: Exercise | undefined, level: BotLevel): number {
  const kit = exercise?.equipment ?? [];
  let share = 0.3;
  if (kit.includes('barbell')) share = 1;
  else if (kit.includes('weightMachine')) share = 0.9;
  else if (kit.includes('cableMachine')) share = 0.5;
  else if (kit.includes('kettlebell')) share = 0.4;
  else if (kit.includes('dumbbell')) share = 0.35;
  switch (exercise?.pattern) {
    case 'squat':
    case 'hinge':
      break;
    case 'isolation':
      share *= 0.4;
      break;
    case 'lunge':
      share *= 0.7;
      break;
    default:
      share *= 0.6;
  }
  return Math.max(2.5, roundTo(BOT_LEVEL_PROFILES[level].baseKg * share, 2.5));
}

/** A planned set as done on a day the bot gave `effort` of what it planned. */
function performed(set: SetLog, effort: number): SetLog {
  const scale = (n: number | null, step: number) =>
    n === null ? null : Math.max(step, roundTo(n * effort, step));
  if (set.meters !== null) {
    // Further, at the same pace.
    const meters = scale(set.meters, 100)!;
    return { ...set, meters, seconds: Math.round(((set.seconds ?? 0) * meters) / set.meters) };
  }
  if (set.reps !== null) return { ...set, reps: scale(set.reps, 1) };
  return { ...set, seconds: scale(set.seconds, 5) };
}

/**
 * A generator seeded from `text`. Texts that differ only at the end (week
 * after week, bot after bot) hash to related seeds, and a generator's
 * first draws would follow them, so the hash is mixed first (MurmurHash3's
 * finaliser).
 */
function randomFor(text: string): SeededRandom {
  let h = stableHash(text);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return new SeededRandom((h ^ (h >>> 16)) >>> 0);
}

function templateById(id: string): WorkoutTemplate {
  return WORKOUT_TEMPLATES.find((t) => t.id === id) ?? WORKOUT_TEMPLATES[0];
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function shuffled<T>(items: readonly T[], random: SeededRandom): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function remember<T>(cache: Map<string, T>, key: string, value: T): T {
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, value);
  return value;
}
