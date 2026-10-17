import { FormatError, JsonMap } from '../core/json';
import { localDate } from '../core/local-date';
import { ballotFromJson, ballotToJson, RateBallot } from './ballot';
import {
  canManage,
  Crate,
  crateFromJson,
  CrateMembership,
  crateSettings,
  crateSettingsFromJson,
  crateToJson,
  DEFAULT_CRATE_SETTINGS,
  isActiveMembership,
  membershipFromJson,
  membershipToJson,
} from './crate';
import {
  CustomExercise,
  customExerciseFromJson,
  customExerciseToJson,
  isCustomExerciseId,
  LibraryEntry,
  libraryEntryFromJson,
  libraryEntryToJson,
  loggableFromCustom,
  Routine,
  routineFromJson,
  routineToJson,
} from './library';
import { fitnessLevelLabel, peach, peachFromJson, peachToJson } from './peach';
import {
  addTotals,
  categoryWeights,
  DEFAULT_WEIGHTS,
  weightsFromJson,
  weightsToJson,
  weightsTotal,
  ZERO_TOTALS,
} from './scoring';
import {
  involves,
  isBye,
  isSeasonOpen,
  matchup,
  matchupFromJson,
  matchupPeachIds,
  matchupToJson,
  opponentOf,
  Round,
  roundEndDate,
  roundFromJson,
  roundToJson,
  Season,
  seasonEndDate,
  seasonFromJson,
  seasonStartDate,
  seasonToJson,
  winnerId,
} from './season';
import {
  entryFor,
  exerciseLogEntry,
  isSubmitted,
  removeEntry,
  setLog,
  totalMeters,
  totalReps,
  totalSeconds,
  totalSets,
  upsertEntry,
  volumeLoadKg,
  workoutLog,
  workoutLogFromJson,
  workoutLogToJson,
} from './workout-log';

/** Simulates storage: whatever toJson produced must survive real JSON. */
function viaJson(json: JsonMap): JsonMap {
  return JSON.parse(JSON.stringify(json)) as JsonMap;
}

describe('model JSON round trips', () => {
  const now = new Date(Date.UTC(2026, 9, 10, 12));

  it('Peach', () => {
    const p = peach({
      id: 'p1',
      displayName: 'Ada',
      email: 'ada@example.com',
      fitnessLevel: 4,
      timeZone: 'Europe/London',
      units: 'imperial',
      createdAt: now,
    });
    expect(peachFromJson(viaJson(peachToJson(p)))).toEqual(p);
    expect(peachToJson(p)['createdAt']).toBe('2026-10-10T12:00:00.000Z');
  });

  it('Peach builder applies defaults and validates the level', () => {
    const p = peach({ id: 'p', displayName: 'P', createdAt: now });
    expect(p).toEqual({
      id: 'p',
      displayName: 'P',
      email: null,
      avatarUrl: null,
      fitnessLevel: 2,
      timeZone: 'UTC',
      units: 'metric',
      createdAt: now,
    });
    expect(() => peach({ id: 'p', displayName: 'P', createdAt: now, fitnessLevel: 0 })).toThrow();
    expect(() => peach({ id: 'p', displayName: 'P', createdAt: now, fitnessLevel: 6 })).toThrow();
    expect(fitnessLevelLabel(1)).toBe('Getting started');
    expect(fitnessLevelLabel(5)).toBe('Advanced');
  });

  it('Crate with settings', () => {
    const crate: Crate = {
      id: 'c1',
      name: 'Morning Crew',
      description: '',
      ownerPeachId: 'p1',
      inviteCode: 'PEACH1',
      timeZone: 'America/New_York',
      settings: crateSettings({ loggingGraceHours: 12 }),
      createdAt: now,
    };
    expect(crateFromJson(viaJson(crateToJson(crate)))).toEqual(crate);
  });

  it('Crate falls back to defaults for missing settings', () => {
    const crate = crateFromJson({
      id: 'c1',
      name: 'x',
      ownerPeachId: 'p1',
      inviteCode: 'ABC',
      createdAt: now.toISOString(),
    });
    expect(crate.settings).toEqual(DEFAULT_CRATE_SETTINGS);
    expect(crate.timeZone).toBe('UTC');
    expect(crate.description).toBe('');
  });

  it('CrateMembership', () => {
    const m: CrateMembership = {
      crateId: 'c1',
      peachId: 'p1',
      role: 'admin',
      status: 'invited',
      joinedAt: now,
    };
    expect(membershipFromJson(viaJson(membershipToJson(m)))).toEqual(m);
    expect(canManage(m)).toBe(true);
    expect(isActiveMembership(m)).toBe(false);
  });

  it('Season, Round and Matchup', () => {
    const season: Season = {
      id: 's1',
      crateId: 'c1',
      name: 'Autumn',
      startWeek: localDate(2026, 10, 12),
      weeks: 3,
      participantIds: ['p1', 'p2', 'p3'],
      weights: categoryWeights({ runWalk: 50, reps: 50 }),
      status: 'active',
      createdAt: now,
    };
    expect(seasonFromJson(viaJson(seasonToJson(season)))).toEqual(season);
    expect(seasonStartDate(season)).toBe(localDate(2026, 10, 12));
    expect(seasonEndDate(season)).toBe(localDate(2026, 11, 1));
    expect(isSeasonOpen(season)).toBe(true);

    const round: Round = {
      id: 'r1',
      seasonId: 's1',
      index: 0,
      weekStart: localDate(2026, 10, 12),
      status: 'open',
    };
    expect(roundFromJson(viaJson(roundToJson(round)))).toEqual(round);
    expect(roundEndDate(round)).toBe(localDate(2026, 10, 18));

    const m = matchup({
      id: 'm1',
      seasonId: 's1',
      roundId: 'r1',
      homePeachId: 'p1',
      awayPeachId: 'p2',
      status: 'complete',
      result: { homePoints: 55.5, awayPoints: 40 },
    });
    expect(matchupFromJson(viaJson(matchupToJson(m)))).toEqual(m);
    expect(winnerId(m)).toBe('p1');
    expect(opponentOf(m, 'p2')).toBe('p1');
    expect(opponentOf(m, 'p9')).toBeNull();
    expect(involves(m, 'p2')).toBe(true);
    expect(involves(m, 'p9')).toBe(false);

    const bye = matchup({
      id: 'm2',
      seasonId: 's1',
      roundId: 'r1',
      homePeachId: 'p3',
      result: { homePoints: 30, awayPoints: 0 },
    });
    expect(matchupFromJson(viaJson(matchupToJson(bye)))).toEqual(bye);
    expect(isBye(bye)).toBe(true);
    expect(winnerId(bye)).toBeNull();
    expect(matchupPeachIds(bye)).toEqual(['p3']);
    expect(opponentOf(bye, 'p3')).toBeNull();
  });

  it('winnerId handles away wins, ties and unfinished matchups', () => {
    const base = matchup({
      id: 'm',
      seasonId: 's',
      roundId: 'r',
      homePeachId: 'h',
      awayPeachId: 'a',
    });
    expect(winnerId(base)).toBeNull();
    expect(winnerId({ ...base, result: { homePoints: 1, awayPoints: 2 } })).toBe('a');
    expect(winnerId({ ...base, result: { homePoints: 2, awayPoints: 2 } })).toBeNull();
  });

  it('WorkoutLog and entries', () => {
    const log = workoutLog({
      id: 'l1',
      peachId: 'p1',
      routineId: 'rt1',
      startedAt: now,
      completedAt: new Date(now.getTime() + 3_600_000),
      status: 'submitted',
      durationMinutes: 50,
      notes: 'felt good',
      sharedWith: ['c1', 'c2'],
      entries: [
        exerciseLogEntry({
          exerciseId: 'bw-run',
          exerciseName: 'Run',
          distanceKind: 'runWalk',
          sets: [setLog({ meters: 5000, seconds: 1500 })],
        }),
        exerciseLogEntry({
          exerciseId: 'db-bench-press',
          exerciseName: 'Dumbbell Bench Press',
          sets: [setLog({ reps: 10, loadKg: 22.5 }), setLog({ reps: 8, loadKg: 25 })],
          rpe: 8,
          notes: 'last rep slow',
        }),
      ],
    });
    expect(workoutLogFromJson(viaJson(workoutLogToJson(log)))).toEqual(log);
    expect(isSubmitted(log)).toBe(true);
    expect(totalSets(log)).toBe(3);
    expect(entryFor(log, 'bw-run')?.distanceKind).toBe('runWalk');
    expect(entryFor(log, 'nope')).toBeUndefined();
  });

  it('entry totals add each unit separately', () => {
    const e = exerciseLogEntry({
      exerciseId: 'x',
      sets: [setLog({ reps: 10, loadKg: 20 }), setLog({ seconds: 30 }), setLog({ meters: 40 })],
    });
    expect(totalReps(e)).toBe(10);
    expect(totalSeconds(e)).toBe(30);
    expect(totalMeters(e)).toBe(40);
    expect(volumeLoadKg(e)).toBe(200);
    expect(e.exerciseName).toBe('x');
  });

  it('set and entry builders validate', () => {
    expect(() => setLog({ loadKg: 20 })).toThrow(RangeError);
    expect(() => exerciseLogEntry({ exerciseId: 'x', sets: [], rpe: 11 })).toThrow(RangeError);
  });

  it('upsertEntry replaces the entry for the same exercise in place; removeEntry drops it', () => {
    let log = workoutLog({ id: 'l', peachId: 'p', startedAt: now });
    const a = exerciseLogEntry({ exerciseId: 'a', sets: [setLog({ reps: 1 })] });
    const b = exerciseLogEntry({ exerciseId: 'b', sets: [setLog({ reps: 2 })] });
    log = upsertEntry(upsertEntry(log, a), b);
    const a2 = exerciseLogEntry({ exerciseId: 'a', sets: [setLog({ reps: 9 })] });
    log = upsertEntry(log, a2);
    expect(log.entries.map((e) => e.exerciseId)).toEqual(['a', 'b']);
    expect(entryFor(log, 'a')).toBe(a2);
    expect(removeEntry(log, 'a').entries).toEqual([b]);
  });

  it('RateBallot', () => {
    const b: RateBallot = {
      crateId: 'c1',
      peachId: 'p1',
      weights: categoryWeights({ ride: 70, activeMinutes: 30 }),
      updatedAt: now,
    };
    expect(ballotFromJson(viaJson(ballotToJson(b)))).toEqual(b);
  });

  it('Library entries, custom exercises and routines', () => {
    const entry: LibraryEntry = {
      crateId: 'c1',
      exerciseId: 'kb-swing',
      addedBy: 'p1',
      addedAt: now,
    };
    expect(libraryEntryFromJson(viaJson(libraryEntryToJson(entry)))).toEqual(entry);

    const custom: CustomExercise = {
      id: 'custom-1',
      crateId: 'c1',
      name: 'Hill loop',
      track: 'distance',
      takesLoad: false,
      distanceKind: 'runWalk',
      createdBy: 'p1',
      createdAt: now,
    };
    expect(customExerciseFromJson(viaJson(customExerciseToJson(custom)))).toEqual(custom);
    expect(isCustomExerciseId(custom.id)).toBe(true);
    expect(isCustomExerciseId('kb-swing')).toBe(false);
    expect(loggableFromCustom(custom)).toEqual({
      id: 'custom-1',
      name: 'Hill loop',
      track: 'distance',
      takesLoad: false,
      distanceKind: 'runWalk',
      cues: null,
    });
    // Distance only scores on distance-tracked exercises.
    expect(loggableFromCustom({ ...custom, track: 'reps' }).distanceKind).toBeNull();

    const routine: Routine = {
      id: 'rt1',
      crateId: 'c1',
      name: 'Saturday sweat',
      items: [
        {
          exerciseId: 'bw-burpee',
          exerciseName: 'Burpee',
          sets: 3,
          reps: 15,
          seconds: null,
          meters: null,
        },
      ],
      createdBy: 'p1',
      createdAt: now,
    };
    expect(routineFromJson(viaJson(routineToJson(routine)))).toEqual(routine);
  });

  it('category weights and totals', () => {
    expect(weightsTotal(DEFAULT_WEIGHTS)).toBe(100);
    expect(() => categoryWeights({ runWalk: 50 })).toThrow(RangeError);
    expect(() => categoryWeights({ runWalk: 101, reps: -1 })).toThrow(RangeError);
    expect(() => categoryWeights({ runWalk: 50.5, reps: 49.5 })).toThrow(RangeError);
    const w = categoryWeights({ swimRow: 100 });
    expect(weightsFromJson(viaJson(weightsToJson(w)))).toEqual(w);
    expect(addTotals({ ...ZERO_TOTALS, reps: 3 }, { ...ZERO_TOTALS, reps: 4, ride: 2 })).toEqual({
      ...ZERO_TOTALS,
      reps: 7,
      ride: 2,
    });
  });

  it('crateSettings validates its range', () => {
    expect(() => crateSettings({ loggingGraceHours: -1 })).toThrow();
    expect(() => crateSettings({ loggingGraceHours: 49 })).toThrow();
    expect(crateSettings()).toEqual(DEFAULT_CRATE_SETTINGS);
  });
});

describe('forward compatibility and garbage input', () => {
  const iso = '2026-10-10T12:00:00.000Z';
  const season = { id: 's', crateId: 'c', name: 'n', startWeek: '2026-10-12', createdAt: iso };

  it('unknown enum names fall back to defaults', () => {
    expect(peachFromJson({ id: 'p', displayName: 'P', createdAt: iso, units: 'stone' }).units).toBe(
      'metric',
    );
    const m = membershipFromJson({
      crateId: 'c',
      peachId: 'p',
      role: 'emperor',
      status: 'banished',
      joinedAt: iso,
    });
    expect(m.role).toBe('member');
    expect(m.status).toBe('active');
    expect(seasonFromJson({ ...season, status: 'paused' }).status).toBe('draft');
    const r = roundFromJson({ id: 'r', seasonId: 's', weekStart: '2026-10-12', status: 'x' });
    expect(r.status).toBe('scheduled');
    expect(
      matchupFromJson({
        id: 'm',
        seasonId: 's',
        roundId: 'r',
        homePeachId: 'h',
        status: 'abandoned',
      }).status,
    ).toBe('scheduled');
    const log = workoutLogFromJson({
      id: 'l',
      peachId: 'p',
      startedAt: iso,
      status: 'archived',
      entries: [{ exerciseId: 'e', distanceKind: 'teleport', sets: [] }],
    });
    expect(log.status).toBe('inProgress');
    // A distance kind from a newer client simply doesn't score here.
    expect(log.entries[0].distanceKind).toBeNull();
    expect(
      customExerciseFromJson({
        id: 'custom-x',
        crateId: 'c',
        name: 'X',
        track: 'vibes',
        createdBy: 'p',
        createdAt: iso,
      }).track,
    ).toBe('reps');
  });

  it('unknown list entries are dropped', () => {
    const s = seasonFromJson({ ...season, participantIds: ['p1', 42, 'p2'] });
    expect(s.participantIds).toEqual(['p1', 'p2']);
    const log = workoutLogFromJson({
      id: 'l',
      peachId: 'p',
      startedAt: iso,
      sharedWith: ['c1', 5, null],
      entries: [
        'junk',
        null,
        [1, 2],
        { exerciseId: 'e', sets: [{ reps: 5 }, 'bad', { reps: 3, loadKg: 20.5 }] },
      ],
    });
    expect(log.sharedWith).toEqual(['c1']);
    expect(log.entries.length).toBe(1);
    expect(log.entries[0].sets).toEqual([
      { reps: 5, loadKg: null, seconds: null, meters: null },
      { reps: 3, loadKg: 20.5, seconds: null, meters: null },
    ]);
  });

  it('missing optional fields take their defaults', () => {
    const p = peachFromJson({ id: 'p', displayName: 'P', createdAt: iso });
    expect(p.email).toBeNull();
    expect(p.avatarUrl).toBeNull();
    expect(p.fitnessLevel).toBe(2);
    expect(p.timeZone).toBe('UTC');
    const m = matchupFromJson({ id: 'm', seasonId: 's', roundId: 'r', homePeachId: 'h' });
    expect(m).toEqual(matchup({ id: 'm', seasonId: 's', roundId: 'r', homePeachId: 'h' }));
    const log = workoutLogFromJson({ id: 'l', peachId: 'p', startedAt: iso });
    expect(log).toEqual(workoutLog({ id: 'l', peachId: 'p', startedAt: new Date(iso) }));
    const s = seasonFromJson(season);
    expect(s.weeks).toBe(1);
    expect(s.weights).toEqual(DEFAULT_WEIGHTS);
    // Old entries without a stored name show their id.
    const entry = workoutLogFromJson({
      id: 'l',
      peachId: 'p',
      startedAt: iso,
      entries: [{ exerciseId: 'bw-push-up', sets: [] }],
    }).entries[0];
    expect(entry.exerciseName).toBe('bw-push-up');
  });

  it('wrongly-typed scalars fall back instead of leaking through', () => {
    const p = peachFromJson({
      id: 'p',
      displayName: 'P',
      createdAt: iso,
      email: 42,
      fitnessLevel: '4',
      timeZone: false,
    });
    expect(p.email).toBeNull();
    expect(p.fitnessLevel).toBe(2);
    expect(p.timeZone).toBe('UTC');
    expect(crateSettingsFromJson({ loggingGraceHours: 'six' }).loggingGraceHours).toBe(6);
  });

  it('weights that do not spend exactly the budget fall back to the defaults', () => {
    expect(weightsFromJson({ runWalk: 100, reps: 100 })).toEqual(DEFAULT_WEIGHTS);
    expect(weightsFromJson({ runWalk: '100' })).toEqual(DEFAULT_WEIGHTS);
    expect(weightsFromJson(null)).toEqual(DEFAULT_WEIGHTS);
    expect(seasonFromJson({ ...season, weights: [1, 2] }).weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('integers are truncated toward zero', () => {
    expect(
      peachFromJson({ id: 'p', displayName: 'P', createdAt: iso, fitnessLevel: 4.99 }).fitnessLevel,
    ).toBe(4);
    const set = workoutLogFromJson({
      id: 'l',
      peachId: 'p',
      startedAt: iso,
      entries: [{ exerciseId: 'e', sets: [{ reps: -2.5, seconds: 30.7 }] }],
    }).entries[0].sets[0];
    expect(set.reps).toBe(-2);
    expect(set.seconds).toBe(30);
  });

  it('required fields and timestamps must be present and valid', () => {
    expect(() => peachFromJson({ displayName: 'P', createdAt: iso })).toThrow(FormatError);
    expect(() => peachFromJson({ id: 'p', displayName: 'P' })).toThrow(FormatError);
    expect(() => peachFromJson({ id: 'p', displayName: 'P', createdAt: 'not a date' })).toThrow(
      FormatError,
    );
    expect(() => peachFromJson({ id: 'p', displayName: 'P', createdAt: 12345 })).toThrow(
      FormatError,
    );
    expect(() => roundFromJson({ id: 'r', seasonId: 's', weekStart: '10/12/2026' })).toThrow();
    expect(() => seasonFromJson({ ...season, startWeek: 'soon' })).toThrow();
    expect(() =>
      routineFromJson({ id: 'r', crateId: 'c', createdBy: 'p', createdAt: iso }),
    ).toThrow(FormatError);
  });

  it('timestamps are normalised to UTC ISO strings', () => {
    const p = peachFromJson({ id: 'p', displayName: 'P', createdAt: '2026-10-10T14:00:00+02:00' });
    expect(peachToJson(p)['createdAt']).toBe('2026-10-10T12:00:00.000Z');
  });

  it('a corrupt settings or result map is treated as absent', () => {
    const crate = crateFromJson({
      id: 'c',
      name: 'n',
      ownerPeachId: 'p',
      inviteCode: 'X',
      createdAt: iso,
      settings: 'oops',
    });
    expect(crate.settings).toEqual(DEFAULT_CRATE_SETTINGS);
    expect(
      matchupFromJson({ id: 'm', seasonId: 's', roundId: 'r', homePeachId: 'h', result: [] })
        .result,
    ).toBeNull();
  });
});
