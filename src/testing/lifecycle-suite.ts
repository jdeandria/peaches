import { firstValueFrom } from 'rxjs';

import { AppContainer } from '../app/application/app-container';
import { DomainError } from '../app/application/errors';
import { localDate } from '../app/domain/core/local-date';
import { Crate } from '../app/domain/models/crate';
import { peach } from '../app/domain/models/peach';
import { categoryWeights, DEFAULT_WEIGHTS } from '../app/domain/models/scoring';
import { isBye, winnerId } from '../app/domain/models/season';
import { played } from '../app/domain/models/score';
import {
  exerciseLogEntry,
  isSubmitted,
  setLog,
  WorkoutLog,
} from '../app/domain/models/workout-log';
import { DemoSeeder } from '../app/data/demo/demo-seeder';

/**
 * The full application-level behaviour, run against every backend.
 * `create` must return a fresh, empty container each time.
 */
export function runLifecycleSuite(
  backend: string,
  create: () => AppContainer | Promise<AppContainer>,
) {
  /** Saturday 10 October 2026, 09:00 UTC. */
  const now = new Date(Date.UTC(2026, 9, 10, 9));
  const utc = (month: number, day: number, hour = 0) =>
    new Date(Date.UTC(2026, month - 1, day, hour));
  let app: AppContainer;

  beforeEach(async () => {
    app = await create();
    for (const id of ['a', 'b', 'c']) {
      await app.peaches.save(peach({ id, displayName: id, createdAt: now }));
    }
  });

  async function crateWithMembers(ids: string[], name = 'Test Crate'): Promise<Crate> {
    const crate = await app.crateService.createCrate({ ownerPeachId: ids[0], name, now });
    for (const id of ids.slice(1))
      await app.crateService.joinByInviteCode(crate.inviteCode, id, now);
    return crate;
  }

  const run = (km: number) =>
    exerciseLogEntry({
      exerciseId: 'bw-run',
      exerciseName: 'Run',
      distanceKind: 'runWalk',
      sets: [setLog({ meters: km * 1000, seconds: km * 330 })],
    });
  const squats = (reps: number, loadKg: number) =>
    exerciseLogEntry({
      exerciseId: 'bb-back-squat',
      exerciseName: 'Back Squat',
      sets: [setLog({ reps, loadKg })],
    });

  /** Logs and submits one session at `at`. */
  async function logSession(peachId: string, at: Date, ...entries: ReturnType<typeof run>[]) {
    const log = await app.loggingService.startLog(peachId, at);
    for (const e of entries) await app.loggingService.recordEntry(log.id, e, at);
    return app.loggingService.submit(log.id, new Date(at.getTime() + 3_600_000));
  }

  describe(`${backend} CrateService`, () => {
    it('creates a crate with the owner as a member and an invite code', async () => {
      const crate = await crateWithMembers(['a']);
      expect(crate.inviteCode).toHaveLength(6);
      const members = await app.crateService.activeMembers(crate.id);
      expect(members.map((m) => [m.peachId, m.role])).toEqual([['a', 'owner']]);
    });

    it('joining is idempotent and case-insensitive', async () => {
      const crate = await crateWithMembers(['a']);
      await app.crateService.joinByInviteCode(crate.inviteCode.toLowerCase(), 'b', now);
      await app.crateService.joinByInviteCode(crate.inviteCode, 'b', now);
      expect(await app.crateService.activeMembers(crate.id)).toHaveLength(2);
    });

    it('rejects unknown invite codes and blank names', async () => {
      await expect(app.crateService.joinByInviteCode('NOPE', 'a', now)).rejects.toBeInstanceOf(
        DomainError,
      );
      await expect(
        app.crateService.createCrate({ ownerPeachId: 'a', name: '  ', now }),
      ).rejects.toBeInstanceOf(DomainError);
    });

    it('members can leave and rejoin; owners cannot leave', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      await app.crateService.leave(crate.id, 'b');
      expect(await app.crateService.activeMembers(crate.id)).toHaveLength(1);
      await app.crateService.joinByInviteCode(crate.inviteCode, 'b', now);
      expect(await app.crateService.activeMembers(crate.id)).toHaveLength(2);
      await expect(app.crateService.leave(crate.id, 'a')).rejects.toBeInstanceOf(DomainError);
    });

    it('watchCratesFor reflects memberships', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const first = await firstValueFrom(app.crates.watchCratesFor('b'));
      expect(first.map((c) => c.id)).toEqual([crate.id]);
      expect(await firstValueFrom(app.crates.watchCratesFor('c'))).toEqual([]);
    });
  });

  describe(`${backend} LoggingService`, () => {
    it('logs solo and shares the submitted log with every active crate', async () => {
      const one = await crateWithMembers(['a', 'b'], 'One');
      const two = await crateWithMembers(['a'], 'Two');
      const three = await crateWithMembers(['b', 'a'], 'Three');
      await app.crateService.leave(three.id, 'a');

      const log = await app.loggingService.startLog('a', now);
      expect(await app.loggingService.currentLog('a')).toEqual(log);
      await app.loggingService.recordEntry(log.id, run(5), now);
      const submitted = await app.loggingService.submit(log.id, utc(10, 10, 10), {
        durationMinutes: 35,
        notes: ' easy ',
      });
      expect(isSubmitted(submitted)).toBe(true);
      expect(submitted.completedAt).toEqual(utc(10, 10, 10));
      expect(submitted.durationMinutes).toBe(35);
      expect(submitted.notes).toBe('easy');
      expect(submitted.sharedWith).toEqual([one.id, two.id].sort());
      expect(await app.loggingService.currentLog('a')).toBeNull();

      const week = (crateId: string) =>
        app.logs.sharedWith(crateId, utc(10, 5), utc(10, 12)).then((ls) => ls.map((l) => l.id));
      expect(await week(one.id)).toEqual([log.id]);
      expect(await week(two.id)).toEqual([log.id]);
      expect(await week(three.id)).toEqual([]);
      // Outside the range nothing is returned.
      expect(await app.logs.sharedWith(one.id, utc(10, 12), utc(10, 19))).toEqual([]);
      expect((await app.logs.recentlySharedWith(one.id, 5)).map((l) => l.id)).toEqual([log.id]);
    });

    it('the clock starts with the first exercise, not when the log was opened', async () => {
      const log = await app.loggingService.startLog('a', utc(10, 4, 22));
      const recorded = await app.loggingService.recordEntry(log.id, run(3), utc(10, 6, 7));
      expect(recorded.startedAt).toEqual(utc(10, 6, 7));
      const second = await app.loggingService.recordEntry(log.id, squats(10, 60), utc(10, 6, 8));
      expect(second.startedAt).toEqual(utc(10, 6, 7));
      expect(second.entries.map((e) => e.exerciseId)).toEqual(['bw-run', 'bb-back-squat']);
      const removed = await app.loggingService.removeEntry(log.id, 'bw-run');
      expect(removed.entries.map((e) => e.exerciseId)).toEqual(['bb-back-squat']);
    });

    it('rejects implausible entries, empty logs and edits after submitting', async () => {
      const log = await app.loggingService.startLog('a', now);
      await expect(app.loggingService.submit(log.id, now)).rejects.toBeInstanceOf(DomainError);
      await expect(
        app.loggingService.recordEntry(log.id, squats(5000, 20), now),
      ).rejects.toBeInstanceOf(DomainError);
      await app.loggingService.recordEntry(log.id, squats(5, 100), now);
      await expect(
        app.loggingService.submit(log.id, now, { durationMinutes: 900 }),
      ).rejects.toBeInstanceOf(DomainError);
      await app.loggingService.submit(log.id, now);
      await expect(
        app.loggingService.recordEntry(log.id, squats(5, 100), now),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(app.loggingService.submit(log.id, now)).rejects.toBeInstanceOf(DomainError);
    });
  });

  describe(`${backend} VotingService`, () => {
    it('tallies active members’ ballots into the next season’s weights', async () => {
      const crate = await crateWithMembers(['a', 'b', 'c']);
      expect(await app.votingService.currentWeights(crate.id)).toEqual(DEFAULT_WEIGHTS);

      await app.votingService.castBallot(crate.id, 'a', categoryWeights({ runWalk: 100 }), now);
      await app.votingService.castBallot(crate.id, 'b', categoryWeights({ reps: 100 }), now);
      expect(await app.votingService.currentWeights(crate.id)).toEqual(
        categoryWeights({ runWalk: 50, reps: 50 }),
      );

      // Changing a vote replaces it.
      await app.votingService.castBallot(crate.id, 'b', categoryWeights({ runWalk: 100 }), now);
      expect((await app.votingService.currentWeights(crate.id)).runWalk).toBe(100);

      // A member who leaves stops counting.
      await app.votingService.castBallot(crate.id, 'c', categoryWeights({ ride: 100 }), now);
      await app.crateService.leave(crate.id, 'c');
      expect(await app.votingService.ballotsOf(crate.id)).toHaveLength(2);
      expect((await app.votingService.currentWeights(crate.id)).ride).toBe(0);
    });

    it('only members vote, and only with a full budget', async () => {
      const crate = await crateWithMembers(['a']);
      await expect(
        app.votingService.castBallot(crate.id, 'b', DEFAULT_WEIGHTS, now),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        app.votingService.castBallot(crate.id, 'a', { ...DEFAULT_WEIGHTS, reps: 99 }, now),
      ).rejects.toBeInstanceOf(DomainError);
    });
  });

  describe(`${backend} LibraryService`, () => {
    it('members add catalog exercises, custom exercises and routines', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      await app.libraryService.addCatalogExercise(crate.id, 'kb-swing', 'b', now);
      await app.libraryService.addCatalogExercise(crate.id, 'kb-swing', 'a', now);
      await expect(
        app.libraryService.addCatalogExercise(crate.id, 'no-such-thing', 'a', now),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        app.libraryService.addCatalogExercise(crate.id, 'kb-swing', 'c', now),
      ).rejects.toBeInstanceOf(DomainError);

      const loop = await app.libraryService.createCustomExercise({
        crateId: crate.id,
        peachId: 'b',
        name: ' Hill loop ',
        track: 'distance',
        takesLoad: true,
        distanceKind: 'runWalk',
        now,
      });
      expect(loop.name).toBe('Hill loop');
      expect(loop.id.startsWith('custom-')).toBe(true);
      // Only rep-tracked exercises take a load.
      expect(loop.takesLoad).toBe(false);

      const log = await logSession('b', now, run(4), squats(10, 50));
      const routine = await app.libraryService.saveLogAsRoutine({
        crateId: crate.id,
        log,
        name: 'Run and squat',
        now,
      });
      expect(routine.items).toEqual([
        {
          exerciseId: 'bw-run',
          exerciseName: 'Run',
          sets: 1,
          reps: null,
          seconds: 1320,
          meters: 4000,
        },
        {
          exerciseId: 'bb-back-squat',
          exerciseName: 'Back Squat',
          sets: 1,
          reps: 10,
          seconds: null,
          meters: null,
        },
      ]);

      const library = await app.libraryService.libraryOf(crate.id);
      expect(library.entries.map((e) => [e.exerciseId, e.addedBy])).toEqual([['kb-swing', 'b']]);
      expect(library.customExercises.map((e) => e.id)).toEqual([loop.id]);
      expect(library.routines.map((r) => r.id)).toEqual([routine.id]);

      // Custom exercises reach the log picker of every member, and resolve.
      const customs = await app.libraryService.customExercisesFor('a');
      expect(customs.map((c) => c.id)).toEqual([loop.id]);
      expect(app.libraryService.loggable(loop.id, customs)?.distanceKind).toBe('runWalk');
      expect(app.libraryService.loggable('bw-run', customs)?.track).toBe('distance');
      expect(await app.libraryService.customExercisesFor('c')).toEqual([]);
    });

    it('whoever added an item, or the owner, can remove it', async () => {
      const crate = await crateWithMembers(['a', 'b', 'c']);
      await app.libraryService.addCatalogExercise(crate.id, 'kb-swing', 'b', now);
      const routine = await app.libraryService.createRoutine({
        crateId: crate.id,
        peachId: 'b',
        name: 'Swings',
        items: [
          {
            exerciseId: 'kb-swing',
            exerciseName: 'Swing',
            sets: 5,
            reps: 20,
            seconds: null,
            meters: null,
          },
        ],
        now,
      });
      await expect(
        app.libraryService.removeCatalogExercise(crate.id, 'kb-swing', 'c'),
      ).rejects.toBeInstanceOf(DomainError);
      await app.libraryService.removeCatalogExercise(crate.id, 'kb-swing', 'b');
      await expect(
        app.libraryService.removeRoutine(crate.id, routine.id, 'c'),
      ).rejects.toBeInstanceOf(DomainError);
      await app.libraryService.removeRoutine(crate.id, routine.id, 'a');
      const library = await app.libraryService.libraryOf(crate.id);
      expect(library.entries).toEqual([]);
      expect(library.routines).toEqual([]);
      await expect(
        app.libraryService.createRoutine({
          crateId: crate.id,
          peachId: 'a',
          name: 'x',
          items: [],
          now,
        }),
      ).rejects.toBeInstanceOf(DomainError);
    });
  });

  describe(`${backend} Season lifecycle`, () => {
    it('create -> sync -> log -> close -> standings', async () => {
      const crate = await crateWithMembers(['a', 'b', 'c']);
      await app.votingService.castBallot(
        crate.id,
        'a',
        categoryWeights({ runWalk: 50, weightMoved: 50 }),
        now,
      );
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S1',
        startWeek: localDate(2026, 10, 5),
        weeks: 3,
        now,
      });
      expect(season.status).toBe('scheduled');
      expect(season.participantIds).toEqual(['a', 'b', 'c']);
      // The vote is frozen into the season.
      expect(season.weights).toEqual(categoryWeights({ runWalk: 50, weightMoved: 50 }));
      await app.votingService.castBallot(crate.id, 'a', categoryWeights({ ride: 100 }), now);
      expect((await app.seasons.getById(season.id))!.weights.runWalk).toBe(50);

      const rounds = await app.seasons.roundsOf(season.id);
      expect(rounds.map((r) => r.weekStart)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);

      // Saturday of week one: it is open, the rest are not.
      await app.seasonService.syncSeason(season.id, now);
      const statuses = async () => (await app.seasons.roundsOf(season.id)).map((r) => r.status);
      expect(await statuses()).toEqual(['open', 'scheduled', 'scheduled']);
      expect((await app.seasons.getById(season.id))?.status).toBe('active');
      const matchups = await app.seasons.matchupsInRound(rounds[0].id);
      expect(matchups).toHaveLength(2);
      expect(matchups.every((m) => m.status === 'inProgress')).toBe(true);

      const real = matchups.find((m) => !isBye(m))!;
      const home = real.homePeachId;
      const away = real.awayPeachId!;
      // Home runs twice; away squats once; a log from before the week and
      // an unsubmitted one don't count.
      await logSession(home, utc(10, 6, 7), run(5));
      await logSession(home, utc(10, 8, 7), run(5));
      await logSession(away, utc(10, 9, 18), squats(20, 100));
      await logSession(away, utc(10, 4, 18), squats(200, 100));
      const draft = await app.loggingService.startLog(away, utc(10, 9));
      await app.loggingService.recordEntry(draft.id, squats(100, 100), utc(10, 9));

      const board = (await app.seasonService.board(real.id))!;
      expect(board.home.logs).toHaveLength(2);
      // 10 km = two pars at 50 points; no active minutes weight.
      expect(board.home.score.total).toBe(100);
      // 2,000 kg = 0.4 par at 50 points.
      expect(board.away!.score.total).toBe(20);
      expect(board.window.endsAt).toEqual(utc(10, 12));

      // Monday 03:00 is within the 6 h grace: still open.
      await app.seasonService.syncSeason(season.id, utc(10, 12, 3));
      expect(await statuses()).toEqual(['open', 'open', 'scheduled']);
      // A late Sunday-night session submitted now still counts for week one.
      await logSession(away, utc(10, 11, 23), squats(100, 100));
      await app.seasonService.syncSeason(season.id, utc(10, 12, 7));
      expect(await statuses()).toEqual(['closed', 'open', 'scheduled']);

      const resolved = (await app.seasons.getMatchup(real.id))!;
      expect(resolved.status).toBe('complete');
      expect(resolved.result).toEqual({ homePoints: 100, awayPoints: 120 });
      expect(winnerId(resolved)).toBe(away);

      const standings = await app.seasonService.standings(season.id);
      expect(standings[0].peachId).toBe(away);
      expect(standings[0].wins).toBe(1);
      expect(standings.find((s) => s.peachId === home)?.losses).toBe(1);
      const byeHolder = matchups.find(isBye)!.homePeachId;
      expect(standings.find((s) => s.peachId === byeHolder)?.byes).toBe(1);

      // Closing is final: a week-one log submitted after close changes nothing.
      await logSession(home, utc(10, 11, 12), run(20));
      await app.seasonService.syncSeason(season.id, utc(10, 12, 8));
      expect((await app.seasons.getMatchup(real.id))!.result).toEqual(resolved.result);

      // The last week closing completes the season.
      await app.seasonService.syncSeason(season.id, utc(10, 27));
      expect(await statuses()).toEqual(['closed', 'closed', 'closed']);
      expect((await app.seasons.getById(season.id))?.status).toBe('complete');
    });

    it('one workout scores in every crate, each with its own weights', async () => {
      const runners = await crateWithMembers(['a', 'b'], 'Runners');
      const lifters = await crateWithMembers(['a', 'b'], 'Lifters');
      await app.votingService.castBallot(runners.id, 'a', categoryWeights({ runWalk: 100 }), now);
      await app.votingService.castBallot(lifters.id, 'a', categoryWeights({ reps: 100 }), now);
      const seasonOf = (crate: Crate) =>
        app.seasonService.createSeason({
          crate,
          name: crate.name,
          startWeek: localDate(2026, 10, 5),
          weeks: 1,
          now,
        });
      const [r, l] = [await seasonOf(runners), await seasonOf(lifters)];
      await logSession('a', utc(10, 6), run(5));
      await logSession('b', utc(10, 6), squats(150, 20));
      await app.seasonService.syncPeach('a', utc(10, 13));

      const result = async (seasonId: string) => {
        const [m] = await app.seasons.matchupsOf(seasonId);
        return m.homePeachId === 'a'
          ? m.result
          : { homePoints: m.result!.awayPoints, awayPoints: m.result!.homePoints };
      };
      // The same two logs: a wins the runners' crate, b the lifters'.
      expect(await result(r.id)).toEqual({ homePoints: 100, awayPoints: 0 });
      expect(await result(l.id)).toEqual({ homePoints: 0, awayPoints: 100 });
    });

    it('validates the season shape', async () => {
      const crate = await crateWithMembers(['a']);
      const create = (startWeek: string, weeks: number) =>
        app.seasonService.createSeason({
          crate,
          name: 'x',
          startWeek: startWeek as ReturnType<typeof localDate>,
          weeks,
          now,
        });
      await expect(create('2026-10-06', 2)).rejects.toBeInstanceOf(DomainError);
      await expect(create('2026-10-05', 0)).rejects.toBeInstanceOf(DomainError);
      await expect(create('2026-10-05', 13)).rejects.toBeInstanceOf(DomainError);
      await create('2026-10-05', 2);
      // One season at a time.
      await expect(create('2026-11-02', 2)).rejects.toBeInstanceOf(DomainError);
    });

    it('a week nobody logged in closes with zero points', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S',
        startWeek: localDate(2026, 9, 28),
        weeks: 2,
        now,
      });
      await app.seasonService.syncSeason(season.id, now);
      const statuses = async () => (await app.seasons.roundsOf(season.id)).map((r) => r.status);
      expect(await statuses()).toEqual(['closed', 'open']);
      const [closedRound] = await app.seasons.roundsOf(season.id);
      const [m] = await app.seasons.matchupsInRound(closedRound.id);
      expect(m.status).toBe('complete');
      expect(m.result).toEqual({ homePoints: 0, awayPoints: 0 });
      // Idempotent, and syncPeach reaches it through the membership.
      await app.seasonService.syncPeach('b', now);
      expect(await statuses()).toEqual(['closed', 'open']);
    });
  });

  describe(`${backend} DemoSeeder`, () => {
    it('seeds a playable mid-season state', async () => {
      const demo = await create();
      await new DemoSeeder(demo).seed(now);
      expect(await demo.peaches.getById('me')).not.toBeNull();
      const crates = await firstValueFrom(demo.crates.watchCratesFor('me'));
      expect(crates).toHaveLength(2);
      const warriors = crates.find((c) => c.name === 'Weekend Warriors')!;
      const [season] = await demo.seasons.forCrate(warriors.id);
      expect(season.status).toBe('active');
      // The members' votes, not the defaults.
      expect(season.weights).not.toEqual(DEFAULT_WEIGHTS);
      const rounds = await demo.seasons.roundsOf(season.id);
      expect(rounds.map((r) => r.status)).toEqual([
        'closed',
        'closed',
        'open',
        'scheduled',
        'scheduled',
        'scheduled',
      ]);
      const standings = await demo.seasonService.standings(season.id);
      expect(standings.some((s) => played(s) > 0 && s.pointsFor > 0)).toBe(true);
      const mine: WorkoutLog[] = await demo.logs.forPeach('me');
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((l) => l.sharedWith.length === 2)).toBe(true);
      const library = await demo.libraryService.libraryOf(warriors.id);
      expect(library.routines.length).toBeGreaterThan(0);
      expect(library.customExercises.length).toBeGreaterThan(0);
    });
  });
}
