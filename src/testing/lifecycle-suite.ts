import { firstValueFrom } from 'rxjs';

import { AppContainer } from '../app/application/app-container';
import { DomainError } from '../app/application/errors';
import { localDate } from '../app/domain/core/local-date';
import { Crate } from '../app/domain/models/crate';
import { peach } from '../app/domain/models/peach';
import { SESSION_TIME } from '../app/domain/models/dispute';
import {
  categoryWeights,
  DEFAULT_LINEUP_RULES,
  DEFAULT_RULES,
  ScoringRules,
} from '../app/domain/models/scoring';
import { involves, isBye, winnerId } from '../app/domain/models/season';
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

  /** Logs and submits one hour-long session at `at`. */
  async function logSession(peachId: string, at: Date, ...entries: ReturnType<typeof run>[]) {
    const log = await app.loggingService.startLog(peachId, at);
    for (const e of entries) await app.loggingService.recordEntry(log.id, e);
    return app.loggingService.submit(log.id, new Date(at.getTime() + 3_600_000));
  }

  /** A ballot of `weights` with the default lineup rules. */
  const rules = (weights: Parameters<typeof categoryWeights>[0]): ScoringRules => ({
    weights: categoryWeights(weights),
    lineup: DEFAULT_LINEUP_RULES,
  });

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

  describe(`${backend} RoutineService`, () => {
    const squat = squats(5, 100);

    it('saves a plan as a routine, renames, updates and deletes it', async () => {
      const rated = { ...squat, rpe: 8, notes: 'heavy' };
      const legs = await app.routineService.create('a', '  Leg   day ', [rated, run(5)], now);
      expect(legs.name).toBe('Leg day');
      // Only what to do is kept.
      expect(legs.exercises[0]).toMatchObject({ rpe: null, notes: null });
      await app.routineService.create('a', 'arms', [squat], now);
      await app.routineService.create('b', 'Theirs', [squat], now);
      expect((await app.routines.forPeach('a')).map((r) => r.name)).toEqual(['arms', 'Leg day']);
      const watched = await firstValueFrom(app.routines.watchForPeach('a'));
      expect(watched).toHaveLength(2);

      const renamed = await app.routineService.update('a', legs.id, { name: 'Legs' }, utc(10, 11));
      expect(renamed).toMatchObject({ name: 'Legs', updatedAt: utc(10, 11) });
      const replaced = await app.routineService.update('a', legs.id, { exercises: [run(10)] }, now);
      expect(replaced.exercises).toEqual([run(10)]);
      // Someone else's routine is out of reach.
      await expect(app.routineService.update('b', legs.id, { name: 'Mine' }, now)).rejects.toThrow(
        DomainError,
      );

      const removed = await app.routineService.remove('a', legs.id);
      expect((await app.routines.forPeach('a')).map((r) => r.name)).toEqual(['arms']);
      await app.routineService.restore(removed);
      expect(await app.routines.getById(legs.id)).toEqual(removed);
    });

    it('needs a name and at least one sensible exercise', async () => {
      await expect(app.routineService.create('a', ' ', [squat], now)).rejects.toThrow(DomainError);
      await expect(app.routineService.create('a', 'x'.repeat(41), [squat], now)).rejects.toThrow(
        DomainError,
      );
      await expect(app.routineService.create('a', 'Empty', [], now)).rejects.toThrow(DomainError);
      await expect(
        app.routineService.create('a', 'Silly', [squats(5000, 20)], now),
      ).rejects.toThrow(DomainError);
    });

    it('plans a session from a routine', async () => {
      const routine = await app.routineService.create('a', 'Legs', [squat, run(5)], now);
      const draft = await app.loggingService.openDraft('a', now);
      await app.loggingService.planExercise(draft.id, run(3));
      const planned = await app.loggingService.addToPlan(draft.id, routine.exercises);
      // Already-planned exercises keep their targets.
      expect(planned.plan).toEqual([run(3), squat]);
    });
  });

  describe(`${backend} LoggingService`, () => {
    it('logs solo and shares the submitted log, and its exercises, with every active crate', async () => {
      const one = await crateWithMembers(['a', 'b'], 'One');
      const two = await crateWithMembers(['a'], 'Two');
      const three = await crateWithMembers(['b', 'a'], 'Three');
      await app.crateService.leave(three.id, 'a');

      const log = await app.loggingService.startLog('a', now);
      expect(await app.loggingService.currentLog('a')).toEqual(log);
      await app.loggingService.recordEntry(log.id, run(5));
      const submitted = await app.loggingService.submit(log.id, utc(10, 10, 10));
      expect(isSubmitted(submitted)).toBe(true);
      expect(submitted.completedAt).toEqual(utc(10, 10, 10));
      // The clock ran from 09:00 to 10:00 and stopped.
      expect(submitted.durationSeconds).toBe(3600);
      expect(submitted.timerStartedAt).toBeNull();
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
      expect((await app.logs.getShared(one.id, log.id))?.id).toBe(log.id);
      expect(await app.logs.getShared(three.id, log.id)).toBeNull();

      // Its exercises are shared too, tagged with who logged them.
      const shared = await app.logs.exercisesSharedWith(one.id);
      expect(shared.map((e) => [e.peachId, e.exercise.id, e.exercise.track])).toEqual([
        ['a', 'bw-run', 'distance'],
      ]);
      expect((await app.loggingService.crateExercises('b')).map((e) => e.exercise.id)).toEqual([
        'bw-run',
      ]);
      expect(await app.loggingService.crateExercises('c')).toEqual([]);
    });

    it('the clock starts with the workout and runs while the log screen is open', async () => {
      const opened = await app.loggingService.openDraft('a', utc(10, 6, 7));
      // Planning doesn't count: the clock waits for the workout to start.
      expect(opened.timerStartedAt).toBeNull();
      await app.loggingService.planExercise(opened.id, run(3));
      // Reopening a draft not started yet, days later, takes the new day.
      const reopened = await app.loggingService.openDraft('a', utc(10, 8, 18));
      expect(reopened.id).toBe(opened.id);
      expect(reopened.startedAt).toEqual(utc(10, 8, 18));
      expect(reopened.plan).toEqual([run(3)]);
      expect(reopened.timerStartedAt).toBeNull();
      const started = await app.loggingService.startSession(opened.id, utc(10, 8, 18));
      expect(started.timerStartedAt).toEqual(utc(10, 8, 18));
      await app.loggingService.recordEntry(opened.id, run(3));
      // Leaving the screen for an hour pauses it; coming back resumes it.
      const paused = await app.loggingService.pauseTimer(
        opened.id,
        new Date(utc(10, 8, 18).getTime() + 600_000),
      );
      expect(paused.durationSeconds).toBe(600);
      const resumed = await app.loggingService.openDraft('a', utc(10, 8, 20));
      expect(resumed.startedAt).toEqual(utc(10, 8, 18));
      const done = await app.loggingService.submit(
        opened.id,
        new Date(utc(10, 8, 20).getTime() + 300_000),
      );
      expect(done.durationSeconds).toBe(900);
    });

    it('plans a session, then ticks it off a set at a time', async () => {
      const draft = await app.loggingService.openDraft('a', utc(10, 10, 8));
      const plan = exerciseLogEntry({
        exerciseId: 'bb-back-squat',
        exerciseName: 'Back Squat',
        sets: [setLog({ reps: 5, loadKg: 100 }), setLog({ reps: 5, loadKg: 100 })],
      });
      await app.loggingService.planExercise(draft.id, plan);
      await app.loggingService.addToPlan(draft.id, [plan, run(5)]);
      expect((await app.logs.getById(draft.id))!.plan.map((e) => e.exerciseId)).toEqual([
        'bb-back-squat',
        'bw-run',
      ]);
      await expect(
        app.loggingService.planExercise(draft.id, { ...plan, sets: [] }),
      ).rejects.toBeInstanceOf(DomainError);

      // The first set logged starts the clock.
      const first = await app.loggingService.logSet(
        draft.id,
        'bb-back-squat',
        setLog({ reps: 5, loadKg: 100 }),
        utc(10, 10, 9),
      );
      expect(first.startedAt).toEqual(utc(10, 10, 9));
      expect(first.timerStartedAt).toEqual(utc(10, 10, 9));
      await app.loggingService.logSet(
        draft.id,
        'bb-back-squat',
        setLog({ reps: 3, loadKg: 100 }),
        now,
      );
      await app.loggingService.undoSet(draft.id, 'bb-back-squat');
      await app.loggingService.logSet(
        draft.id,
        'bb-back-squat',
        setLog({ reps: 4, loadKg: 100 }),
        now,
      );
      await app.loggingService.rateExercise(draft.id, 'bb-back-squat', 9);
      await app.loggingService.skipSet(draft.id, 'bb-back-squat');
      await app.loggingService.skipSet(draft.id, 'bw-run');
      await expect(
        app.loggingService.logSet(draft.id, 'bw-run', setLog({ reps: 1 }), now),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        app.loggingService.logSet(draft.id, 'bb-back-squat', setLog({ reps: 5000 }), now),
      ).rejects.toBeInstanceOf(DomainError);

      const log = (await app.logs.getById(draft.id))!;
      expect(log.entries).toHaveLength(1);
      expect(log.entries[0].sets.map((s) => s.reps)).toEqual([5, 4]);
      expect(log.entries[0].rpe).toBe(9);
      expect(log.plan.map((e) => [e.exerciseId, e.sets.length])).toEqual([['bb-back-squat', 2]]);

      // Only what was done is shared; the plan stays behind.
      await crateWithMembers(['a', 'b']);
      const submitted = await app.loggingService.submit(draft.id, utc(10, 10, 10));
      expect(submitted.plan).toEqual([]);
      const [shared] = await app.logs.recentlySharedWith(submitted.sharedWith[0], 1);
      expect(shared.plan).toEqual([]);
      expect(shared.entries[0].sets).toHaveLength(2);
      await expect(app.loggingService.skipSet(draft.id, 'bb-back-squat')).rejects.toBeInstanceOf(
        DomainError,
      );
    });

    it('removing an exercise from a draft takes its plan too', async () => {
      const draft = await app.loggingService.openDraft('a', now);
      await app.loggingService.planExercise(draft.id, run(5));
      await app.loggingService.logSet(draft.id, 'bw-run', run(5).sets[0], now);
      const removed = await app.loggingService.removeEntry(draft.id, 'bw-run');
      expect(removed.plan).toEqual([]);
      expect(removed.entries).toEqual([]);
    });

    it('rejects implausible entries and empty logs', async () => {
      const log = await app.loggingService.startLog('a', now);
      await expect(app.loggingService.submit(log.id, now)).rejects.toBeInstanceOf(DomainError);
      await expect(app.loggingService.recordEntry(log.id, squats(5000, 20))).rejects.toBeInstanceOf(
        DomainError,
      );
      await app.loggingService.recordEntry(log.id, squats(5, 100));
      await app.loggingService.submit(log.id, now);
      await expect(app.loggingService.submit(log.id, now)).rejects.toBeInstanceOf(DomainError);
    });

    it('submitted workouts stay editable, and the shared copies follow', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const log = await logSession('a', utc(10, 9, 7), run(5));
      await app.loggingService.recordEntry(log.id, squats(10, 60));
      const edited = await app.loggingService.editDetails(
        log.id,
        { startedAt: utc(10, 8, 6), durationSeconds: 2700, notes: ' hills ' },
        now,
      );
      expect(edited).toMatchObject({ durationSeconds: 2700, notes: 'hills', status: 'submitted' });
      const copy = (await app.logs.getShared(crate.id, log.id))!;
      expect(copy.entries.map((e) => e.exerciseId)).toEqual(['bw-run', 'bb-back-squat']);
      expect(copy.startedAt).toEqual(utc(10, 8, 6));
      expect(copy.durationSeconds).toBe(2700);

      await expect(
        app.loggingService.editDetails(
          log.id,
          { startedAt: utc(10, 11), durationSeconds: 60, notes: '' },
          now,
        ),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        app.loggingService.editDetails(
          log.id,
          { startedAt: utc(10, 8), durationSeconds: 11 * 3600, notes: '' },
          now,
        ),
      ).rejects.toBeInstanceOf(DomainError);
      await app.loggingService.removeEntry(log.id, 'bw-run');
      await expect(app.loggingService.removeEntry(log.id, 'bb-back-squat')).rejects.toBeInstanceOf(
        DomainError,
      );
    });
  });

  describe(`${backend} VotingService`, () => {
    it('tallies active members’ ballots into the next season’s rules', async () => {
      const crate = await crateWithMembers(['a', 'b', 'c']);
      expect(await app.votingService.currentRules(crate.id)).toEqual(DEFAULT_RULES);

      await app.votingService.castBallot(crate.id, 'a', rules({ runWalk: 100 }), now);
      await app.votingService.castBallot(
        crate.id,
        'b',
        { ...rules({ reps: 100 }), lineup: { slots: 1, pledgeBonus: 20, battlePars: 0 } },
        now,
      );
      const tally = await app.votingService.currentRules(crate.id);
      expect(tally.weights).toEqual(categoryWeights({ runWalk: 50, reps: 50 }));
      // The lower middle vote of two.
      expect(tally.lineup).toEqual({ slots: 1, pledgeBonus: 20, battlePars: 0 });

      // Changing a vote replaces it.
      await app.votingService.castBallot(crate.id, 'b', rules({ runWalk: 100 }), now);
      expect((await app.votingService.currentRules(crate.id)).weights.runWalk).toBe(100);

      // A member who leaves stops counting.
      await app.votingService.castBallot(crate.id, 'c', rules({ ride: 100 }), now);
      await app.crateService.leave(crate.id, 'c');
      expect(await app.votingService.ballotsOf(crate.id)).toHaveLength(2);
      expect((await app.votingService.currentRules(crate.id)).weights.ride).toBe(0);
    });

    it('only members vote, and only with a full budget and rules in range', async () => {
      const crate = await crateWithMembers(['a']);
      await expect(
        app.votingService.castBallot(crate.id, 'b', DEFAULT_RULES, now),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        app.votingService.castBallot(
          crate.id,
          'a',
          { ...DEFAULT_RULES, weights: { ...DEFAULT_RULES.weights, reps: 99 } },
          now,
        ),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(
        app.votingService.castBallot(
          crate.id,
          'a',
          { ...DEFAULT_RULES, lineup: { ...DEFAULT_LINEUP_RULES, slots: 9 } },
          now,
        ),
      ).rejects.toBeInstanceOf(DomainError);
    });
  });

  describe(`${backend} Lineups`, () => {
    it('are set before the week, carry over, and score pledges and battles', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      await app.votingService.castBallot(crate.id, 'a', rules({ runWalk: 50, reps: 50 }), now);
      // Starts Monday 12 October; now is Saturday the 10th.
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S',
        startWeek: localDate(2026, 10, 12),
        weeks: 2,
        now,
      });
      const [week1, week2] = await app.seasons.roundsOf(season.id);
      const set = (
        peachId: string,
        roundId: string,
        pledges: { category: 'runWalk' | 'reps'; target: number }[],
        at = now,
      ) => app.lineupService.setLineup({ roundId, peachId, pledges, now: at });

      const lineup = await set('a', week1.id, [{ category: 'runWalk', target: 8 }]);
      expect(lineup.locksAt).toEqual(utc(10, 12));
      await set('b', week1.id, [
        { category: 'runWalk', target: 20 },
        { category: 'reps', target: 50 },
      ]);
      // Changing it before the week starts replaces it.
      await set('a', week1.id, [
        { category: 'runWalk', target: 10 },
        { category: 'reps', target: 100 },
      ]);
      // Too many, too early, too late, or not playing: refused.
      const four = (['runWalk', 'reps', 'ride', 'swimRow'] as const).map((category) => ({
        category,
        target: 1,
      }));
      await expect(
        app.lineupService.setLineup({ roundId: week1.id, peachId: 'a', pledges: four, now }),
      ).rejects.toBeInstanceOf(DomainError);
      await expect(set('a', week2.id, [])).rejects.toBeInstanceOf(DomainError);
      await expect(set('a', week1.id, [], utc(10, 12, 1))).rejects.toBeInstanceOf(DomainError);
      await expect(set('c', week1.id, [])).rejects.toBeInstanceOf(DomainError);

      // a runs 10 km and does 120 reps; b runs 5 km and does 60 reps.
      const pushUps = (reps: number) =>
        exerciseLogEntry({ exerciseId: 'bw-push-up', sets: [setLog({ reps })] });
      await logSession('a', utc(10, 13, 7), run(10), pushUps(120));
      await logSession('b', utc(10, 14, 7), run(5), pushUps(60));
      await app.seasonService.syncSeason(season.id, utc(10, 19, 7));

      const [m] = await app.seasons.matchupsInRound(week1.id);
      const board = (await app.seasonService.board(m.id))!;
      const side = (id: string) => (board.home.peachId === id ? board.home : board.away!);
      const a = side('a').score;
      // Workouts: 10 km = 2 pars × 50 = 100; 120 reps = 0.8 par × 50 = 40.
      expect(a.workouts.total).toBe(140);
      // 10 km hit (+50% of 100); 120 of 100 reps hit (+50% of 33.33).
      expect(a.pledges.map((p) => p.points)).toEqual([50, 16.67]);
      // Out-ran and out-repped b: a par (50) each.
      expect(a.battles.map((x) => x.points)).toEqual([50, 50]);
      const b = side('b').score;
      // 5 of 20 km missed; 60 of 50 reps hit (+50% of 16.67); both battles lost.
      expect(b.pledges.map((p) => p.hit)).toEqual([false, true]);
      expect(b.total).toBeCloseTo(78.33, 2);
      const result = (await app.seasons.getMatchup(m.id))!.result!;
      expect(m.homePeachId === 'a' ? result.homePoints : result.awayPoints).toBe(a.total);

      // Nobody set a week-two lineup: week one's carries over.
      const [m2] = await app.seasons.matchupsInRound(week2.id);
      const board2 = (await app.seasonService.board(m2.id))!;
      expect(board2.home.lineup?.roundId).toBe(week1.id);
    });
  });

  describe(`${backend} Disputes`, () => {
    it('a majority of the Crate strikes a metric, and it stops scoring there', async () => {
      const crate = await crateWithMembers(['a', 'b', 'c']);
      await app.votingService.castBallot(crate.id, 'a', rules({ runWalk: 50, reps: 50 }), now);
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S',
        startWeek: localDate(2026, 10, 5),
        weeks: 1,
        now,
      });
      await app.seasonService.syncSeason(season.id, now);
      const log = await logSession('b', utc(10, 9, 7), run(40), squats(10, 50));
      const open = (peachId: string, target = 'bw-run') =>
        app.disputeService.open({ crateId: crate.id, logId: log.id, target, peachId, now });

      await expect(open('b')).rejects.toBeInstanceOf(DomainError);
      await expect(open('z')).rejects.toBeInstanceOf(DomainError);
      await expect(open('a', 'nope')).rejects.toBeInstanceOf(DomainError);
      const dispute = await open('a');
      // Opening again is the same dispute.
      expect((await open('c')).id).toBe(dispute.id);
      let [view] = await app.disputeService.views(crate.id, [log]);
      expect(view).toMatchObject({ outcome: 'open', strike: 1, keep: 1, needed: 2 });
      expect(
        (await app.disputeService.awaitingVote(crate.id, 'c', now)).map((v) => v.dispute.id),
      ).toEqual([dispute.id]);
      expect(await app.disputeService.awaitingVote(crate.id, 'b', now)).toEqual([]);

      await expect(
        app.disputeService.vote({
          crateId: crate.id,
          disputeId: dispute.id,
          peachId: 'b',
          vote: 'strike',
        }),
      ).rejects.toBeInstanceOf(DomainError);
      await app.disputeService.vote({
        crateId: crate.id,
        disputeId: dispute.id,
        peachId: 'c',
        vote: 'strike',
      });
      [view] = await app.disputeService.views(crate.id, [log]);
      expect(view.outcome).toBe('struck');
      await expect(
        app.disputeService.vote({
          crateId: crate.id,
          disputeId: dispute.id,
          peachId: 'c',
          vote: 'keep',
        }),
      ).rejects.toBeInstanceOf(DomainError);

      // The run no longer scores; the squats and the session time do.
      const m = (await app.seasons.matchupsOf(season.id)).find((x) => involves(x, 'b'))!;
      const side = async () => {
        const board = (await app.seasonService.board(m.id))!;
        return [board.home, board.away].find((s) => s?.peachId === 'b')!;
      };
      expect((await side()).logs[0].entries.map((e) => e.exerciseId)).toEqual(['bb-back-squat']);
      expect((await side()).score.workouts.total).toBeCloseTo(3.33, 2);

      // Correcting the run ends the dispute: 4 km counts again.
      const corrected = await app.loggingService.recordEntry(log.id, run(4));
      [view] = await app.disputeService.views(crate.id, [corrected]);
      expect(view.applies).toBe(false);
      expect((await side()).score.workouts.total).toBeCloseTo(43.33, 2);

      // Once the week is over, its scores are final.
      await app.seasonService.syncSeason(season.id, utc(10, 13));
      await expect(
        app.disputeService.open({
          crateId: crate.id,
          logId: log.id,
          target: SESSION_TIME,
          peachId: 'a',
          now: utc(10, 13),
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
        rules({ runWalk: 50, weightMoved: 50 }),
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
      expect(season.rules).toEqual(rules({ runWalk: 50, weightMoved: 50 }));
      await app.votingService.castBallot(crate.id, 'a', rules({ ride: 100 }), now);
      expect((await app.seasons.getById(season.id))!.rules.weights.runWalk).toBe(50);

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
      await app.loggingService.recordEntry(draft.id, squats(100, 100));

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

    it('one workout scores in every crate, each with its own rules', async () => {
      const runners = await crateWithMembers(['a', 'b'], 'Runners');
      const lifters = await crateWithMembers(['a', 'b'], 'Lifters');
      await app.votingService.castBallot(runners.id, 'a', rules({ runWalk: 100 }), now);
      await app.votingService.castBallot(lifters.id, 'a', rules({ reps: 100 }), now);
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
      expect(season.rules.weights).not.toEqual(DEFAULT_RULES.weights);
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
      // Everyone's exercises are shared with the Crate, Ada's made-up loop included.
      const shared = await demo.logs.exercisesSharedWith(warriors.id);
      expect(new Set(shared.map((e) => e.peachId)).size).toBe(5);
      expect(shared.some((e) => e.peachId === 'ada' && e.exercise.id.startsWith('custom-'))).toBe(
        true,
      );
      // Everyone but you has set next week's lineup.
      const next = rounds[3];
      expect(await demo.seasons.getLineup(season.id, next.id, 'me')).toBeNull();
      expect(await demo.seasons.getLineup(season.id, next.id, 'ada')).not.toBeNull();
    });
  });
}
