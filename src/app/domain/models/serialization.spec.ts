import { FormatError, JsonMap } from '../core/json';
import { localDate } from '../core/local-date';
import { Ballot, ballotFromJson, ballotToJson } from './ballot';
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
import { customExercise } from '../exercises/loggable';
import {
  SharedExercise,
  sharedExerciseFromJson,
  sharedExercisesOf,
  sharedExerciseToJson,
} from './crate-exercise';
import { Dispute, disputeFromJson, disputeToJson } from './dispute';
import { Lineup, lineupFromJson, lineupToJson } from './lineup';
import { peach, peachFromJson, peachToJson } from './peach';
import {
  addTotals,
  categoryWeights,
  DEFAULT_LINEUP_RULES,
  DEFAULT_RULES,
  DEFAULT_WEIGHTS,
  lineupRules,
  rulesFromJson,
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
  entryOf,
  exerciseLogEntry,
  isSubmitted,
  loggableFromEntry,
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
      rules: {
        weights: categoryWeights({ runWalk: 50, reps: 50 }),
        lineup: lineupRules({ slots: 2, pledgeBonus: 30, battlePars: 0 }),
      },
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
      startedAt: now,
      completedAt: new Date(now.getTime() + 3_600_000),
      status: 'submitted',
      durationSeconds: 3000,
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
    const running = { ...log, timerStartedAt: now };
    expect(workoutLogFromJson(viaJson(workoutLogToJson(running)))).toEqual(running);
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

  it('Ballot', () => {
    const b: Ballot = {
      crateId: 'c1',
      peachId: 'p1',
      rules: {
        weights: categoryWeights({ ride: 70, activeMinutes: 30 }),
        lineup: lineupRules({ slots: 1 }),
      },
      updatedAt: now,
    };
    expect(ballotFromJson(viaJson(ballotToJson(b)))).toEqual(b);
  });

  it('Lineup', () => {
    const l: Lineup = {
      seasonId: 's1',
      roundId: 'r1',
      peachId: 'p1',
      pledges: [
        { category: 'runWalk', target: 15 },
        { category: 'weightMoved', target: 8000 },
      ],
      locksAt: now,
      updatedAt: now,
    };
    const json = viaJson(lineupToJson(l));
    expect(lineupFromJson(json)).toEqual(l);
    // The rules compare lock times with the request time, so they are numbers.
    expect(json['locksAt']).toBe(now.getTime());
    // Pledges in categories a newer client added are dropped.
    const newer = {
      ...json,
      pledges: [{ category: 'climb', target: 3 }, ...(json['pledges'] as [])],
    };
    expect(lineupFromJson(newer).pledges).toEqual(l.pledges);
  });

  it('Dispute', () => {
    const d: Dispute = {
      id: 'l1~bw-run~abc',
      crateId: 'c1',
      logId: 'l1',
      peachId: 'p1',
      target: 'bw-run',
      label: 'Run',
      snapshot: 'bw-run~abc',
      openedBy: 'p2',
      openedAt: now,
      votes: { p2: 'strike', p3: 'keep' },
    };
    expect(disputeFromJson(viaJson(disputeToJson(d)))).toEqual(d);
    // Unknown votes are ignored.
    expect(disputeFromJson({ ...disputeToJson(d), votes: { p4: 'maybe' } }).votes).toEqual({});
  });

  it('shared exercises carry how they are logged and who logged them', () => {
    const hill = customExercise({
      id: '1',
      name: ' Hill loop ',
      track: 'distance',
      distanceKind: 'runWalk',
    });
    expect(hill).toEqual({
      id: 'custom-1',
      name: 'Hill loop',
      track: 'distance',
      takesLoad: false,
      distanceKind: 'runWalk',
      cues: null,
    });
    // Only reps take a load, and only distance has a kind.
    expect(customExercise({ id: '2', name: 'X', track: 'time', takesLoad: true }).takesLoad).toBe(
      false,
    );
    expect(
      customExercise({ id: '3', name: 'X', track: 'reps', distanceKind: 'ride' }).distanceKind,
    ).toBeNull();
    expect(() => customExercise({ id: '4', name: '  ', track: 'reps' })).toThrow(RangeError);

    const log = workoutLog({
      id: 'l',
      peachId: 'p1',
      startedAt: now,
      status: 'submitted',
      sharedWith: ['c1', 'c2'],
      entries: [entryOf(hill, { sets: [setLog({ meters: 3000 })] })],
    });
    const shared = sharedExercisesOf(log);
    expect(shared.map((e) => [e.crateId, e.peachId, e.exercise.id])).toEqual([
      ['c1', 'p1', 'custom-1'],
      ['c2', 'p1', 'custom-1'],
    ]);
    const one: SharedExercise = shared[0];
    expect(sharedExerciseFromJson(viaJson(sharedExerciseToJson(one)))).toEqual(one);
    expect(loggableFromEntry(log.entries[0])).toEqual(hill);
  });

  it('scoring rules', () => {
    expect(rulesFromJson(null)).toEqual(DEFAULT_RULES);
    expect(() => lineupRules({ slots: 7 })).toThrow(RangeError);
    expect(() => lineupRules({ pledgeBonus: 12.5 })).toThrow(RangeError);
    // Invalid lineup rules fall back as a whole; weights fall back separately.
    const json = { weights: weightsToJson(DEFAULT_WEIGHTS), lineup: { slots: 99 } };
    expect(rulesFromJson(json).lineup).toEqual(DEFAULT_LINEUP_RULES);
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
      workoutLogFromJson({
        id: 'l',
        peachId: 'p',
        startedAt: iso,
        entries: [{ exerciseId: 'e', track: 'vibes', sets: [] }],
      }).entries[0].track,
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
    expect(s.rules).toEqual(DEFAULT_RULES);
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
    expect(seasonFromJson({ ...season, rules: [1, 2] }).rules).toEqual(DEFAULT_RULES);
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
    expect(() => lineupFromJson({ seasonId: 's', roundId: 'r', updatedAt: iso })).toThrow(
      FormatError,
    );
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
