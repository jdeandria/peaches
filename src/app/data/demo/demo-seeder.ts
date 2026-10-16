import { AppContainer } from '../../application/app-container';
import { addDays, ISO_WEEKDAYS, weekday } from '../../domain/core/local-date';
import { SeededRandom } from '../../domain/core/random';
import { stableHash } from '../../domain/core/stable-hash';
import { Exercise, takesLoad } from '../../domain/exercises/exercise';
import { Equipment } from '../../domain/exercises/taxonomy';
import { crateSettings } from '../../domain/models/crate';
import { peach, Peach } from '../../domain/models/peach';
import { Matchup, matchupPeachIds } from '../../domain/models/season';
import { workoutItems } from '../../domain/models/workout';
import { exerciseLogEntry, setLog } from '../../domain/models/workout-log';
import { ExerciseDayPlanner } from '../../domain/services/round-robin-scheduler';

/** The demo user's Peach id. */
export const DEMO_PEACH_ID = 'me';

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

/**
 * Populates an in-memory backend with a believable Crate mid-season so the
 * app is explorable without a server. Also used by end-to-end tests.
 *
 * Everything is seeded (ids, logs, effort), so a given day always produces
 * the same demo. Dates are taken in `timeZone`, which the app sets to the
 * device's zone so "today" in the demo is the visitor's today.
 */
export class DemoSeeder {
  constructor(private readonly app: AppContainer) {}

  async seed(now: Date, timeZone = 'UTC'): Promise<void> {
    const { app } = this;
    const today = app.zone.dateOf(now, timeZone);
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

    // Everyone can do easy bodyweight work; most have dumbbells, Ben doesn't,
    // so his matchups show the shared-equipment rule.
    const enable = (peachId: string, equipment: Equipment[], maxDifficulty: number) =>
      app.capabilityService.enableForEquipment({
        peachId,
        equipment: new Set(equipment),
        maxDifficulty,
        now: created,
      });
    for (const p of roster) await enable(p.id, ['wall', 'chair'], p.fitnessLevel);
    for (const id of [DEMO_PEACH_ID, 'ada', 'cho', 'dev']) {
      await enable(id, ['dumbbell', 'bench', 'resistanceBand'], 3);
    }
    await enable('ada', ['pullUpBar', 'kettlebell'], 4);

    const crate = await app.crateService.createCrate({
      ownerPeachId: 'ada',
      name: 'Weekend Warriors',
      description: 'Three days a week, forty minutes, no excuses.',
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
      description: 'Tuesdays and Thursdays at noon.',
      timeZone,
      now: created,
      settings: crateSettings({ workoutDurationMinutes: 30, goal: 'strength' }),
    });
    await app.crateService.joinByInviteCode(second.inviteCode, 'cho', created);

    // Season: three days a week including today, started ten days ago,
    // running four weeks, so the demo always opens on an exercise day.
    const planner = new ExerciseDayPlanner();
    const start = addDays(today, -10);
    const todayWeekday = weekday(today);
    const days = planner.weekdaysBetween(
      start,
      addDays(start, 27),
      new Set([0, 2, 4].map((offset) => ((todayWeekday - 1 + offset) % 7) + 1)),
    );
    const season = await app.seasonService.createSeason({
      crate,
      name: 'Autumn Kick-off',
      exerciseDays: days,
      now: created,
    });

    // Play out past rounds with plausible logs, open today's round if any.
    const random = new SeededRandom(2026);
    let roundIndex = 0;
    for (const round of await app.seasons.roundsOf(season.id)) {
      if (round.date > today) break;
      await app.seasonService.openRound(round.id, now);
      if (round.date === today) break;
      // Log on the round's own evening so history reads naturally.
      const loggedAt = new Date(
        app.zone.startOfDay(round.date, timeZone).getTime() + 18 * MS_PER_HOUR,
      );
      for (const matchup of await app.seasons.matchupsInRound(round.id)) {
        for (const peachId of matchupPeachIds(matchup)) {
          await this.logPlausibly(matchup, peachId, random, loggedAt, roundIndex);
        }
      }
      await app.seasonService.closeRound(round.id);
      roundIndex++;
    }

    await app.seasonService.createSeason({
      crate: second,
      name: 'Strength Block 1',
      exerciseDays: planner.weekdaysBetween(
        addDays(today, 1),
        addDays(today, 21),
        new Set([ISO_WEEKDAYS.tuesday, ISO_WEEKDAYS.thursday]),
      ),
      now: created,
    });
  }

  private async logPlausibly(
    matchup: Matchup,
    peachId: string,
    random: SeededRandom,
    now: Date,
    roundIndex: number,
  ): Promise<void> {
    const { app } = this;
    const workout = matchup.workoutId ? await app.workouts.getById(matchup.workoutId) : null;
    if (!workout) return;
    // Some Peaches skip a round entirely.
    if (random.nextDouble() < 0.12) return;
    const log = await app.loggingService.logForMatchup(matchup, peachId, now);
    for (const item of workoutItems(workout)) {
      const p = item.prescription;
      const effort = 0.6 + random.nextDouble() * 0.6;
      const sides = p.perSide ? 2 : 1;
      const exercise = app.catalog.byId(item.exerciseId);
      const loadKg =
        exercise && takesLoad(exercise) ? workingWeightKg(exercise, peachId, roundIndex) : null;
      const scaled = (v: number | null) => (v === null ? null : Math.round(v * effort));
      const sets = Array.from({ length: p.sets * sides }, () =>
        setLog({
          reps: scaled(p.reps),
          seconds: scaled(p.seconds),
          meters: scaled(p.meters),
          loadKg,
        }),
      );
      await app.loggingService.recordEntry(
        log.id,
        exerciseLogEntry({
          exerciseId: item.exerciseId,
          workoutItemId: item.id,
          sets,
          rpe: 5 + random.nextInt(5),
        }),
      );
    }
    await app.loggingService.submit(log.id, now);
  }
}

/**
 * A believable working weight: a base for the implement and movement, scaled
 * per Peach, rising a little each round so history shows progression.
 * Rounded to 2.5 kg like real plates.
 */
export function workingWeightKg(exercise: Exercise, peachId: string, roundIndex: number): number {
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
  const progress = 1 + 0.03 * roundIndex;
  return Math.round((implement * pattern * strength * progress) / 2.5) * 2.5;
}
