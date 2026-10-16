import { firstValueFrom } from 'rxjs';

import { AppContainer } from '../app/application/app-container';
import { DomainError } from '../app/application/errors';
import { localDate } from '../app/domain/core/local-date';
import { Crate } from '../app/domain/models/crate';
import { peach } from '../app/domain/models/peach';
import { isBye, matchupPeachIds, Round, winnerId } from '../app/domain/models/season';
import { played } from '../app/domain/models/score';
import { scoredItems, workoutItems } from '../app/domain/models/workout';
import { exerciseLogEntry, isSubmitted, setLog } from '../app/domain/models/workout-log';
import { DemoSeeder } from '../app/data/demo/demo-seeder';

/**
 * The full application-level behaviour, run against every backend.
 * `create` must return a fresh, empty container each time.
 */
export function runLifecycleSuite(
  backend: string,
  create: () => AppContainer | Promise<AppContainer>,
) {
  const now = new Date(Date.UTC(2026, 9, 10, 9));
  let app: AppContainer;

  beforeEach(async () => {
    app = await create();
    for (const [id, level] of [
      ['a', 2],
      ['b', 3],
      ['c', 4],
    ] as const) {
      await app.peaches.save(peach({ id, displayName: id, fitnessLevel: level, createdAt: now }));
      await app.capabilityService.enableForEquipment({
        peachId: id,
        equipment: new Set(['dumbbell']),
        maxDifficulty: level,
        now,
      });
    }
  });

  async function crateWithMembers(ids: string[]): Promise<Crate> {
    const crate = await app.crateService.createCrate({
      ownerPeachId: ids[0],
      name: 'Test Crate',
      now,
    });
    for (const id of ids.slice(1))
      await app.crateService.joinByInviteCode(crate.inviteCode, id, now);
    return crate;
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

  describe(`${backend} Season lifecycle`, () => {
    it('create -> open -> log -> close -> standings', async () => {
      const crate = await crateWithMembers(['a', 'b', 'c']);
      const days = [localDate(2026, 10, 12), localDate(2026, 10, 14), localDate(2026, 10, 16)];
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S1',
        exerciseDays: days,
        now,
      });
      expect(season.status).toBe('scheduled');
      expect(season.participantIds).toEqual(['a', 'b', 'c']);

      const rounds = await app.seasons.roundsOf(season.id);
      expect(rounds).toHaveLength(3);
      expect(rounds.every((r) => r.status === 'scheduled')).toBe(true);

      // Opening generates one workout per matchup, including the bye.
      const opened = await app.seasonService.openRound(rounds[0].id, now);
      expect(opened.status).toBe('open');
      expect((await app.seasons.getById(season.id))?.status).toBe('active');
      const matchups = await app.seasons.matchupsInRound(opened.id);
      expect(matchups).toHaveLength(2);
      for (const m of matchups) {
        expect(m.workoutId).not.toBeNull();
        expect(m.status).toBe('inProgress');
        const workout = (await app.workouts.getById(m.workoutId!))!;
        expect(scoredItems(workout).length).toBeGreaterThan(0);
        expect(workout.focus).toBe(opened.focus);
        // Everything prescribed must be doable by every Peach in the matchup.
        const ids = matchupPeachIds(m);
        const shared = app.pool.sharedIds(ids, await app.capabilities.forPeaches(ids));
        for (const item of workoutItems(workout)) expect(shared.has(item.exerciseId)).toBe(true);
        // Workout ids derive from the matchup so any device converges.
        expect(m.workoutId).toBe(`w-${m.id}`);
      }

      // Re-opening is idempotent.
      const before = matchups.map((m) => m.workoutId);
      await app.seasonService.openRound(rounds[0].id, now);
      const after = (await app.seasons.matchupsInRound(opened.id)).map((m) => m.workoutId);
      expect(after).toEqual(before);

      // The home Peach of the real matchup completes everything; away does nothing.
      const real = matchups.find((m) => !isBye(m))!;
      const workout = (await app.workouts.getById(real.workoutId!))!;
      const log = await app.loggingService.logForMatchup(real, real.homePeachId, now);
      for (const item of scoredItems(workout)) {
        const p = item.prescription;
        await app.loggingService.recordEntry(
          log.id,
          exerciseLogEntry({
            exerciseId: item.exerciseId,
            workoutItemId: item.id,
            sets: Array.from({ length: p.sets * (p.perSide ? 2 : 1) }, () =>
              setLog({ reps: p.reps, seconds: p.seconds, meters: p.meters }),
            ),
          }),
        );
      }
      const live = await app.loggingService.scoreFor((await app.logs.getById(log.id))!);
      expect(live.completionBonus).toBeGreaterThan(0);
      // Submit inside the round's window (its day is Oct 12).
      await app.loggingService.submit(log.id, new Date(Date.UTC(2026, 9, 12, 12)));

      // A log that was never submitted does not count.
      const awayLog = await app.loggingService.logForMatchup(real, real.awayPeachId!, now);
      const firstScored = scoredItems(workout)[0];
      await app.loggingService.recordEntry(
        awayLog.id,
        exerciseLogEntry({
          exerciseId: firstScored.exerciseId,
          workoutItemId: firstScored.id,
          sets: [setLog({ reps: 100 })],
        }),
      );

      const closed = await app.seasonService.closeRound(opened.id);
      expect(closed.status).toBe('closed');
      const resolved = (await app.seasons.getMatchup(real.id))!;
      expect(resolved.status).toBe('complete');
      expect(winnerId(resolved)).toBe(real.homePeachId);
      expect(resolved.result?.awayPoints).toBe(0);

      const standings = await app.seasonService.standings(season.id);
      expect(standings).toHaveLength(3);
      expect(standings[0].peachId).toBe(real.homePeachId);
      expect(standings[0].wins).toBe(1);
      expect(standings.find((s) => s.peachId === real.awayPeachId)?.losses).toBe(1);
      const byeHolder = matchups.find(isBye)!.homePeachId;
      expect(standings.find((s) => s.peachId === byeHolder)?.byes).toBe(1);

      // Submitted logs are frozen.
      await expect(
        app.loggingService.recordEntry(
          log.id,
          exerciseLogEntry({ exerciseId: 'x', sets: [setLog({ reps: 1 })] }),
        ),
      ).rejects.toBeInstanceOf(DomainError);
    });

    it('season completes when the last round closes', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const season = await app.seasonService.createSeason({
        crate,
        name: 'Short',
        exerciseDays: [localDate(2026, 10, 12)],
        now,
      });
      const [round] = await app.seasons.roundsOf(season.id);
      await app.seasonService.openRound(round.id, now);
      await app.seasonService.closeRound(round.id);
      expect((await app.seasons.getById(season.id))?.status).toBe('complete');
    });

    it('syncSeason opens due rounds and closes expired ones', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S',
        exerciseDays: [localDate(2026, 10, 8), localDate(2026, 10, 10), localDate(2026, 10, 12)],
        now,
      });
      // Oct 8 has closed (end of day + 6 h grace), Oct 10 is in progress,
      // Oct 12 has not started.
      await app.seasonService.syncSeason(season.id, now);
      const statuses = async () => (await app.seasons.roundsOf(season.id)).map((r) => r.status);
      const first = await statuses();
      expect(first).toEqual(['closed', 'open', 'scheduled']);
      // Idempotent.
      await app.seasonService.syncSeason(season.id, now);
      expect(await statuses()).toEqual(first);
      // A closed round has results even when nobody logged.
      const [closedRound] = await app.seasons.roundsOf(season.id);
      const [m] = await app.seasons.matchupsInRound(closedRound.id);
      expect(m.status).toBe('complete');
      expect(m.result).toEqual({ homePoints: 0, awayPoints: 0 });
      // syncPeach reaches the same season through the membership.
      await app.seasonService.syncPeach('b', now);
      expect(await statuses()).toEqual(first);
    });

    it('submissions after the window closes are rejected', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S',
        exerciseDays: [localDate(2026, 10, 10)],
        now,
      });
      const [round] = await app.seasons.roundsOf(season.id);
      await app.seasonService.openRound(round.id, now);
      const [matchup] = await app.seasons.matchupsInRound(round.id);
      const window = (await app.seasonService.windowFor(round.id))!;
      expect(window.opensAt).toEqual(new Date(Date.UTC(2026, 9, 10)));
      expect(window.closesAt).toEqual(new Date(Date.UTC(2026, 9, 11, 6)));
      const log = await app.loggingService.logForMatchup(matchup, 'a', now);
      await expect(
        app.loggingService.submit(log.id, new Date(Date.UTC(2026, 9, 11, 7))),
      ).rejects.toBeInstanceOf(DomainError);
      await app.loggingService.submit(log.id, new Date(Date.UTC(2026, 9, 11, 5, 59)));
      expect(isSubmitted((await app.logs.getById(log.id))!)).toBe(true);
    });

    it('later rounds avoid exercises from recent rounds', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S',
        exerciseDays: [localDate(2026, 10, 12), localDate(2026, 10, 14)],
        now,
      });
      const rounds = await app.seasons.roundsOf(season.id);
      await app.seasonService.openRound(rounds[0].id, now);
      await app.seasonService.openRound(rounds[1].id, now);
      const scoredIds = async (r: Round) => {
        const [m] = await app.seasons.matchupsInRound(r.id);
        const w = (await app.workouts.getById(m.workoutId!))!;
        return new Set(scoredItems(w).map((i) => i.exerciseId));
      };
      const first = await scoredIds(rounds[0]);
      const second = await scoredIds(rounds[1]);
      // Rounds have different focuses and the recency penalty is strong, so
      // overlap of scored exercises should be small.
      expect([...first].filter((id) => second.has(id)).length).toBeLessThanOrEqual(1);
    });

    it('rejects a season with no exercise days', async () => {
      const crate = await crateWithMembers(['a']);
      await expect(
        app.seasonService.createSeason({ crate, name: 'x', exerciseDays: [], now }),
      ).rejects.toBeInstanceOf(DomainError);
    });

    it('logging requires an opened matchup and membership', async () => {
      const crate = await crateWithMembers(['a', 'b']);
      const season = await app.seasonService.createSeason({
        crate,
        name: 'S',
        exerciseDays: [localDate(2026, 10, 12)],
        now,
      });
      const [matchup] = await app.seasons.matchupsOf(season.id);
      await expect(app.loggingService.logForMatchup(matchup, 'a', now)).rejects.toBeInstanceOf(
        DomainError,
      );
      await expect(app.loggingService.logForMatchup(matchup, 'c', now)).rejects.toBeInstanceOf(
        DomainError,
      );
    });
  });

  describe(`${backend} DemoSeeder`, () => {
    it('seeds a playable mid-season state', async () => {
      const demo = await create();
      await new DemoSeeder(demo).seed(now);
      expect(await demo.peaches.getById('me')).not.toBeNull();
      const crates = await firstValueFrom(demo.crates.watchCratesFor('me'));
      expect(crates).toHaveLength(2);
      const [season] = await demo.seasons.forCrate(
        crates.find((c) => c.name === 'Weekend Warriors')!.id,
      );
      expect(season.status).toBe('active');
      const rounds = await demo.seasons.roundsOf(season.id);
      expect(rounds.some((r) => r.status === 'closed')).toBe(true);
      expect(rounds.some((r) => r.status === 'scheduled')).toBe(true);
      const standings = await demo.seasonService.standings(season.id);
      expect(standings.some((s) => played(s) > 0)).toBe(true);
      expect((await demo.logs.forPeach('me')).length).toBeGreaterThan(0);
    });
  });
}
