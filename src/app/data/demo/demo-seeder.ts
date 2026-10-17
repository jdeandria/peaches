import { AppContainer } from '../../application/app-container';
import { addDays, LocalDate, startOfWeek } from '../../domain/core/local-date';
import { SeededRandom } from '../../domain/core/random';
import { stableHash } from '../../domain/core/stable-hash';
import { Exercise, takesLoad } from '../../domain/exercises/exercise';
import {
  customExercise,
  loggableFromCatalog,
  LoggableExercise,
} from '../../domain/exercises/loggable';
import { Equipment } from '../../domain/exercises/taxonomy';
import { Pledge } from '../../domain/models/lineup';
import { peach, Peach } from '../../domain/models/peach';
import { categoryWeights, LineupRules } from '../../domain/models/scoring';
import { Season } from '../../domain/models/season';
import { entryOf, SetLog, setLog } from '../../domain/models/workout-log';

/** The demo user's Peach id. */
export const DEMO_PEACH_ID = 'me';

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

/** How each demo Peach likes to train, so the categories they win differ. */
type Style = 'runner' | 'lifter' | 'mixed' | 'bodyweight' | 'rider';

const STYLES: Readonly<Record<string, Style>> = {
  [DEMO_PEACH_ID]: 'mixed',
  ada: 'runner',
  ben: 'lifter',
  cho: 'rider',
  dev: 'bodyweight',
};

/** What a session of each style looks like: exercise ids, in order. */
const SESSIONS: Readonly<Record<Style, readonly (readonly string[])[]>> = {
  runner: [['bw-run'], ['bw-run', 'bw-walking-lunge'], ['bw-jog']],
  lifter: [
    ['bb-back-squat', 'bb-bench-press'],
    ['bb-deadlift', 'db-bent-over-row'],
  ],
  mixed: [['db-goblet-squat', 'db-bench-press', 'bw-forearm-plank'], ['bw-run'], ['kb-swing']],
  bodyweight: [
    ['bw-push-up', 'bw-air-squat', 'bw-burpee'],
    ['bw-pull-up', 'bw-push-up'],
  ],
  rider: [['outdoor-cycling'], ['row-steady', 'bw-push-up'], ['outdoor-cycling']],
};

/** What each style pledges in a week. */
const LINEUPS: Readonly<Record<Style, readonly Pledge[]>> = {
  runner: [
    { category: 'runWalk', target: 15 },
    { category: 'activeMinutes', target: 120 },
  ],
  lifter: [
    { category: 'weightMoved', target: 8000 },
    { category: 'reps', target: 150 },
  ],
  mixed: [
    { category: 'runWalk', target: 5 },
    { category: 'weightMoved', target: 3000 },
    { category: 'activeMinutes', target: 90 },
  ],
  bodyweight: [
    { category: 'reps', target: 300 },
    { category: 'activeMinutes', target: 90 },
  ],
  rider: [
    { category: 'ride', target: 40 },
    { category: 'swimRow', target: 2000 },
  ],
};

/**
 * Populates an in-memory backend with believable Crates mid-season so the
 * app is explorable without a server. Also used by end-to-end tests.
 *
 * Everything is seeded (ids, logs, effort), so a given day always produces
 * the same demo. Dates are taken in `timeZone`, which the app sets to the
 * device's zone so "this week" in the demo is the visitor's week.
 */
export class DemoSeeder {
  constructor(private readonly app: AppContainer) {}

  async seed(now: Date, timeZone = 'UTC'): Promise<void> {
    const { app } = this;
    const today = app.zone.dateOf(now, timeZone);
    const thisWeek = startOfWeek(today);
    const created = new Date(now.getTime() - 30 * MS_PER_DAY);

    const roster: Peach[] = [
      peach({
        id: DEMO_PEACH_ID,
        displayName: 'You',
        fitnessLevel: 3,
        timeZone,
        createdAt: created,
      }),
      peach({ id: 'ada', displayName: 'Ada', fitnessLevel: 4, timeZone, createdAt: created }),
      peach({ id: 'ben', displayName: 'Ben', timeZone, createdAt: created }),
      peach({ id: 'cho', displayName: 'Cho', fitnessLevel: 3, timeZone, createdAt: created }),
      peach({ id: 'dev', displayName: 'Dev', timeZone, createdAt: created }),
    ];
    for (const p of roster) await app.peaches.save(p);

    const crate = await app.crateService.createCrate({
      ownerPeachId: 'ada',
      name: 'Weekend Warriors',
      description: 'Every workout counts. Most points each week wins.',
      timeZone,
      now: created,
    });
    for (const id of [DEMO_PEACH_ID, 'ben', 'cho', 'dev']) {
      await app.crateService.joinByInviteCode(crate.inviteCode, id, created);
    }

    // A second, smaller crate so the multi-crate case is visible.
    const second = await app.crateService.createCrate({
      ownerPeachId: DEMO_PEACH_ID,
      name: 'Lunch Break Lifters',
      description: 'Heavy things at noon.',
      timeZone,
      now: created,
    });
    await app.crateService.joinByInviteCode(second.inviteCode, 'cho', created);

    // The Crate argued about what counts: Ada wants miles, Ben wants plates.
    const vote = (
      crateId: string,
      peachId: string,
      weights: Parameters<typeof categoryWeights>[0],
      lineup: LineupRules = { slots: 3, pledgeBonus: 50, battlePars: 1 },
    ) =>
      app.votingService.castBallot(
        crateId,
        peachId,
        { weights: categoryWeights(weights), lineup },
        created,
      );
    await vote(crate.id, 'ada', {
      runWalk: 40,
      ride: 10,
      swimRow: 10,
      reps: 15,
      activeMinutes: 25,
    });
    await vote(
      crate.id,
      'ben',
      { weightMoved: 45, reps: 25, runWalk: 10, activeMinutes: 20 },
      { slots: 2, pledgeBonus: 75, battlePars: 1 },
    );
    await vote(
      crate.id,
      'dev',
      { reps: 40, runWalk: 20, weightMoved: 10, activeMinutes: 30 },
      { slots: 3, pledgeBonus: 50, battlePars: 2 },
    );
    await vote(second.id, DEMO_PEACH_ID, { weightMoved: 60, reps: 30, activeMinutes: 10 });

    // Season: started two weeks ago, six weeks long, so two weeks are
    // final and this week is live.
    const season = await app.seasonService.createSeason({
      crate,
      name: 'Autumn Kick-off',
      startWeek: addDays(thisWeek, -14),
      weeks: 6,
      now: created,
    });

    await this.pledge(season, now, timeZone);

    // Everyone trains a few times a week, in their own style, up to now. Ada
    // made up a loop of her own, which the Crate sees as hers.
    const random = new SeededRandom(2026);
    const hillLoop = customExercise({
      id: 'reservoir-loop',
      name: 'Reservoir hill loop',
      track: 'distance',
      distanceKind: 'runWalk',
    });
    const custom = new Map([[hillLoop.id, hillLoop]]);
    for (const p of roster) {
      for (let day = addDays(thisWeek, -14); day <= today; day = addDays(day, 1)) {
        if (random.nextDouble() > 0.5) continue;
        const at = new Date(app.zone.startOfDay(day, timeZone).getTime() + 7 * MS_PER_HOUR);
        if (at > now) continue;
        const sessions = SESSIONS[STYLES[p.id]];
        let ids = sessions[random.nextInt(sessions.length)];
        if (p.id === 'ada' && random.nextDouble() < 0.3) ids = [hillLoop.id];
        await this.logSession(p.id, ids, custom, random, at, day < thisWeek ? 0 : 1);
      }
    }

    // Close the finished weeks and open this one.
    await app.seasonService.syncSeason(season.id, now);
    await this.dispute(crate.id, thisWeek, now, timeZone);

    await app.seasonService.createSeason({
      crate: second,
      name: 'Strength Block 1',
      startWeek: addDays(thisWeek, 7),
      weeks: 4,
      now: created,
    });
  }

  /**
   * Everyone set a lineup the day before each week so far; for next week,
   * everyone but you has, so there's a lineup waiting to be set.
   */
  private async pledge(season: Season, now: Date, timeZone: string): Promise<void> {
    const { app } = this;
    const rounds = await app.seasons.roundsOf(season.id);
    const thisWeek = startOfWeek(app.zone.dateOf(now, timeZone));
    for (const round of rounds.filter((r) => r.weekStart <= addDays(thisWeek, 7))) {
      const dayBefore = new Date(
        app.zone.startOfDay(round.weekStart, timeZone).getTime() - MS_PER_DAY,
      );
      for (const peachId of season.participantIds) {
        if (round.weekStart > thisWeek && peachId === DEMO_PEACH_ID) continue;
        await app.lineupService.setLineup({
          roundId: round.id,
          peachId,
          pledges: LINEUPS[STYLES[peachId]],
          now: dayBefore,
        });
      }
    }
  }

  /** Ben thinks one of Ada's sessions this week was generous, and wants your vote. */
  private async dispute(
    crateId: string,
    thisWeek: LocalDate,
    now: Date,
    timeZone: string,
  ): Promise<void> {
    const { app } = this;
    const from = app.zone.startOfDay(thisWeek, timeZone);
    const log = (await app.logs.sharedWith(crateId, from, now)).find((l) => l.peachId === 'ada');
    if (!log) return;
    await app.disputeService.open({
      crateId,
      logId: log.id,
      target: log.entries[0].exerciseId,
      peachId: 'ben',
      now,
    });
  }

  private async logSession(
    peachId: string,
    exerciseIds: readonly string[],
    custom: ReadonlyMap<string, LoggableExercise>,
    random: SeededRandom,
    at: Date,
    weekIndex: number,
  ): Promise<void> {
    const { app } = this;
    const log = await app.loggingService.startLog(peachId, at);
    for (const id of exerciseIds) {
      const catalogExercise = app.catalog.byId(id);
      const exercise = custom.get(id) ?? (catalogExercise && loggableFromCatalog(catalogExercise));
      if (!exercise) continue;
      const effort = 0.75 + random.nextDouble() * 0.5;
      const loadKg =
        catalogExercise && takesLoad(catalogExercise)
          ? workingWeightKg(catalogExercise, peachId, weekIndex)
          : null;
      await app.loggingService.recordEntry(
        log.id,
        entryOf(exercise, {
          sets: plausibleSets(exercise, effort, loadKg),
          rpe: 5 + random.nextInt(5),
        }),
      );
    }
    const minutes = 30 + random.nextInt(4) * 10;
    await app.loggingService.submit(log.id, new Date(at.getTime() + minutes * MS_PER_MINUTE));
  }
}

/** A few sets of what a Peach might do: a steady effort for cardio, sets for the rest. */
function plausibleSets(e: LoggableExercise, effort: number, loadKg: number | null): SetLog[] {
  switch (e.track) {
    case 'distance': {
      // About 5 km on foot, 20 km on a bike, 2 km rowing; pace stays human.
      const metres =
        e.distanceKind === 'ride' ? 20_000 : e.distanceKind === 'swimRow' ? 2000 : 5000;
      const speed = e.distanceKind === 'ride' ? 7 : e.distanceKind === 'swimRow' ? 3.5 : 2.8;
      const meters = Math.round((metres * effort) / 10) * 10;
      return [setLog({ meters, seconds: Math.round(meters / speed) })];
    }
    case 'time':
      return [1, 2, 3].map(() => setLog({ seconds: Math.round(45 * effort) }));
    default:
      return [1, 2, 3].map(() => setLog({ reps: Math.round(12 * effort), loadKg }));
  }
}

/**
 * A believable working weight: a base for the implement and movement, scaled
 * per Peach, rising a little each week so history shows progression.
 * Rounded to 2.5 kg like real plates.
 */
export function workingWeightKg(exercise: Exercise, peachId: string, weekIndex: number): number {
  const has = (e: Equipment) => exercise.equipment.includes(e);
  const implement = has('barbell')
    ? 40
    : has('sled')
      ? 50
      : has('cableMachine') || has('weightMachine')
        ? 30
        : has('sandbag')
          ? 20
          : has('kettlebell')
            ? 16
            : has('dumbbell')
              ? 12
              : 8;
  const pattern =
    exercise.pattern === 'squat' || exercise.pattern === 'hinge'
      ? 1.5
      : exercise.pattern === 'lunge' || exercise.pattern === 'horizontalPush'
        ? 1.1
        : 1.0;
  const strength = 0.8 + (stableHash(peachId) % 50) / 100;
  const progress = 1 + 0.03 * weekIndex;
  return Math.round((implement * pattern * strength * progress) / 2.5) * 2.5;
}
