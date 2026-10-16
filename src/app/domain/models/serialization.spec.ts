import { FormatError, JsonMap } from '../core/json';
import { localDate } from '../core/local-date';
import { capabilityFromJson, capabilityToJson, ExerciseCapability, isAble } from './capability';
import {
  canManage,
  Crate,
  crateFromJson,
  CrateMembership,
  crateSettings,
  crateSettingsFromJson,
  crateSettingsToJson,
  crateToJson,
  DEFAULT_CRATE_SETTINGS,
  isActiveMembership,
  membershipFromJson,
  membershipToJson,
} from './crate';
import { fitnessLevelLabel, peach, peachFromJson, peachToJson } from './peach';
import {
  scoringRules,
  scoringRulesFromJson,
  scoringRulesToJson,
  STANDARD_SCORING_RULES,
} from './scoring-rules';
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
  itemById,
  prescription,
  prescriptionFromJson,
  prescriptionUnit,
  scoredItems,
  targetPerSet,
  totalTarget,
  Workout,
  workoutFromJson,
  workoutItems,
  workoutToJson,
} from './workout';
import {
  entryForItem,
  exerciseLogEntry,
  isSubmitted,
  setLog,
  totalMeters,
  totalReps,
  totalSeconds,
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

  it('ExerciseCapability', () => {
    const c: ExerciseCapability = {
      peachId: 'p1',
      exerciseId: 'bw-push-up',
      status: 'unable',
      updatedAt: now,
      notes: 'wrist',
    };
    expect(capabilityFromJson(viaJson(capabilityToJson(c)))).toEqual(c);
    expect(isAble(c)).toBe(false);
  });

  it('Crate with settings and scoring rules', () => {
    const crate: Crate = {
      id: 'c1',
      name: 'Morning Crew',
      description: '',
      ownerPeachId: 'p1',
      inviteCode: 'PEACH1',
      timeZone: 'America/New_York',
      settings: crateSettings({
        workoutDurationMinutes: 30,
        goal: 'endurance',
        scoringRules: scoringRules({ completionBonus: 5 }),
        loggingGraceHours: 12,
        excludedExerciseIds: ['bw-burpee'],
        excludedJointStress: ['knee'],
      }),
      createdAt: now,
    };
    expect(crateFromJson(viaJson(crateToJson(crate)))).toEqual(crate);
  });

  it('Crate settings id sets are written sorted and read back de-duplicated', () => {
    const s = crateSettings({ excludedExerciseIds: ['c', 'a', 'b'] });
    expect(viaJson(crateSettingsToJson(s))['excludedExerciseIds']).toEqual(['a', 'b', 'c']);
    const back = crateSettingsFromJson({
      excludedExerciseIds: ['b', 'a', 'b'],
      excludedJointStress: ['knee', 'wrist', 'knee'],
    });
    expect(back.excludedExerciseIds).toEqual(['b', 'a']);
    expect(back.excludedJointStress).toEqual(['knee', 'wrist']);
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
      exerciseDays: [localDate(2026, 10, 12), localDate(2026, 10, 14)],
      participantIds: ['p1', 'p2', 'p3'],
      status: 'active',
      createdAt: now,
    };
    expect(seasonFromJson(viaJson(seasonToJson(season)))).toEqual(season);
    expect(seasonStartDate(season)).toBe(localDate(2026, 10, 12));
    expect(seasonEndDate(season)).toBe(localDate(2026, 10, 14));
    expect(isSeasonOpen(season)).toBe(true);
    expect(seasonStartDate({ ...season, exerciseDays: [] })).toBeNull();
    expect(seasonEndDate({ ...season, exerciseDays: [] })).toBeNull();

    const round: Round = {
      id: 'r1',
      seasonId: 's1',
      index: 0,
      date: localDate(2026, 10, 12),
      focus: 'lowerBody',
      status: 'open',
    };
    expect(roundFromJson(viaJson(roundToJson(round)))).toEqual(round);

    const m = matchup({
      id: 'm1',
      seasonId: 's1',
      roundId: 'r1',
      homePeachId: 'p1',
      awayPeachId: 'p2',
      workoutId: 'w1',
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

  it('Workout with nested blocks and prescriptions', () => {
    const workout: Workout = {
      id: 'w1',
      title: 'Round 1',
      blocks: [
        {
          type: 'strength',
          items: [
            {
              id: 'i1',
              exerciseId: 'db-goblet-squat',
              prescription: prescription({
                sets: 3,
                reps: 10,
                restSeconds: 60,
                load: { rpe: 7, note: 'Moderate' },
              }),
              scoringWeight: 1,
            },
            {
              id: 'i2',
              exerciseId: 'bw-side-plank',
              prescription: prescription({ sets: 2, seconds: 30, restSeconds: 30, perSide: true }),
              scoringWeight: 0.5,
            },
          ],
        },
      ],
      focus: 'fullBody',
      goal: 'generalFitness',
      targetDifficulty: 2.5,
      estimatedMinutes: 12,
      seed: 42,
      generatorVersion: 1,
      createdAt: now,
    };
    expect(workoutFromJson(viaJson(workoutToJson(workout)))).toEqual(workout);
    expect(totalTarget(itemById(workout, 'i2')!.prescription)).toBe(120);
    expect(totalTarget(itemById(workout, 'i1')!.prescription)).toBe(30);
    expect(itemById(workout, 'zz')).toBeUndefined();
    expect(workoutItems(workout).map((i) => i.id)).toEqual(['i1', 'i2']);
    expect(scoredItems(workout).length).toBe(2);
  });

  it('Prescription enforces exactly one unit', () => {
    expect(() => prescription({ sets: 1, restSeconds: 0, reps: 5, seconds: 5 })).toThrow();
    expect(() => prescription({ sets: 1, restSeconds: 0 })).toThrow();
    expect(() => prescription({ sets: 0, restSeconds: 0, reps: 5 })).toThrow();
    expect(() => prescription({ sets: 1, restSeconds: -1, reps: 5 })).toThrow();
  });

  it('Prescription derived values', () => {
    const p = prescription({ sets: 3, meters: 40, restSeconds: 60 });
    expect(targetPerSet(p)).toBe(40);
    expect(totalTarget(p)).toBe(120);
    expect(prescriptionUnit(p)).toBe('distance');
    expect(prescriptionUnit(prescription({ sets: 1, seconds: 5, restSeconds: 0 }))).toBe(
      'duration',
    );
    expect(prescriptionUnit(prescription({ sets: 1, reps: 5, restSeconds: 0 }))).toBe('reps');
  });

  it('WorkoutLog and entries', () => {
    const log = workoutLog({
      id: 'l1',
      peachId: 'p1',
      workoutId: 'w1',
      matchupId: 'm1',
      startedAt: now,
      completedAt: new Date(now.getTime() + 40 * 60_000),
      status: 'submitted',
      entries: [
        exerciseLogEntry({
          exerciseId: 'db-goblet-squat',
          workoutItemId: 'i1',
          sets: [
            setLog({ reps: 10, loadKg: 16 }),
            setLog({ reps: 10, loadKg: 16 }),
            setLog({ reps: 8, loadKg: 16 }),
          ],
          rpe: 8,
        }),
      ],
      notes: 'Felt good',
    });
    expect(workoutLogFromJson(viaJson(workoutLogToJson(log)))).toEqual(log);
    expect(isSubmitted(log)).toBe(true);
    expect(totalReps(log.entries[0])).toBe(28);
    expect(volumeLoadKg(log.entries[0])).toBe(448);
  });

  it('entry totals add each unit separately', () => {
    const e = exerciseLogEntry({
      exerciseId: 'x',
      sets: [setLog({ seconds: 30 }), setLog({ meters: 40 }), setLog({ seconds: 15, meters: 10 })],
    });
    expect(totalSeconds(e)).toBe(45);
    expect(totalMeters(e)).toBe(50);
    expect(totalReps(e)).toBe(0);
    expect(volumeLoadKg(e)).toBe(0);
  });

  it('set and entry builders validate', () => {
    expect(() => setLog({ loadKg: 20 })).toThrow();
    expect(() => exerciseLogEntry({ exerciseId: 'x', sets: [], rpe: 11 })).toThrow();
    expect(() => exerciseLogEntry({ exerciseId: 'x', sets: [], rpe: 0 })).toThrow();
  });

  it('WorkoutLog.upsertEntry replaces the entry for the same item', () => {
    const log = workoutLog({
      id: 'l1',
      peachId: 'p1',
      startedAt: now,
      entries: [
        exerciseLogEntry({ exerciseId: 'a', workoutItemId: 'i1', sets: [setLog({ reps: 1 })] }),
        exerciseLogEntry({ exerciseId: 'b', sets: [setLog({ reps: 1 })] }),
      ],
    });
    const updated = upsertEntry(
      upsertEntry(
        log,
        exerciseLogEntry({ exerciseId: 'a', workoutItemId: 'i1', sets: [setLog({ reps: 9 })] }),
      ),
      exerciseLogEntry({ exerciseId: 'b', sets: [setLog({ reps: 7 })] }),
    );
    expect(updated.entries.length).toBe(2);
    expect(totalReps(entryForItem(updated, 'i1')!)).toBe(9);
    expect(totalReps(updated.entries.find((e) => e.exerciseId === 'b')!)).toBe(7);
    // The original is untouched.
    expect(totalReps(entryForItem(log, 'i1')!)).toBe(1);
  });

  it('upsertEntry keeps a free entry and an item entry for the same exercise apart', () => {
    const log = workoutLog({
      id: 'l',
      peachId: 'p',
      startedAt: now,
      entries: [
        exerciseLogEntry({ exerciseId: 'a', workoutItemId: 'i1', sets: [setLog({ reps: 1 })] }),
      ],
    });
    const updated = upsertEntry(
      log,
      exerciseLogEntry({ exerciseId: 'a', sets: [setLog({ reps: 2 })] }),
    );
    expect(updated.entries.length).toBe(2);
  });

  it('ScoringRules', () => {
    const r = scoringRules({ pointsPerItem: 20, completionThreshold: 0.9 });
    expect(scoringRulesFromJson(viaJson(scoringRulesToJson(r)))).toEqual(r);
    expect(scoringRulesFromJson({})).toEqual(STANDARD_SCORING_RULES);
    expect(() => scoringRules({ pointsPerItem: 0 })).toThrow();
    expect(() => scoringRules({ maxAchievementRatio: 0.9 })).toThrow();
    expect(() => scoringRules({ completionThreshold: 1.1 })).toThrow();
    expect(() => scoringRules({ completionBonus: -1 })).toThrow();
  });

  it('crateSettings validates its ranges', () => {
    expect(() => crateSettings({ workoutDurationMinutes: 10 })).toThrow();
    expect(() => crateSettings({ workoutDurationMinutes: 121 })).toThrow();
    expect(() => crateSettings({ loggingGraceHours: -1 })).toThrow();
    expect(crateSettings()).toEqual(DEFAULT_CRATE_SETTINGS);
  });
});

describe('forward compatibility and garbage input', () => {
  const iso = '2026-10-10T12:00:00.000Z';

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
    expect(crateSettingsFromJson({ goal: 'yoga' }).goal).toBe('generalFitness');
    expect(
      seasonFromJson({ id: 's', crateId: 'c', name: 'n', status: 'paused', createdAt: iso }).status,
    ).toBe('draft');
    const r = roundFromJson({
      id: 'r',
      seasonId: 's',
      date: '2026-10-10',
      focus: 'cardio',
      status: 'x',
    });
    expect(r.focus).toBe('fullBody');
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
    expect(
      workoutLogFromJson({ id: 'l', peachId: 'p', startedAt: iso, status: 'archived' }).status,
    ).toBe('inProgress');
  });

  it('unknown enum names without a safe default are rejected', () => {
    expect(() =>
      capabilityFromJson({ peachId: 'p', exerciseId: 'e', status: 'maybe', updatedAt: iso }),
    ).toThrow(FormatError);
    const workout = {
      id: 'w',
      blocks: [],
      focus: 'fullBody',
      goal: 'generalFitness',
      createdAt: iso,
    };
    expect(() => workoutFromJson({ ...workout, focus: 'zen' })).toThrow(FormatError);
    expect(() => workoutFromJson({ ...workout, goal: 'zen' })).toThrow(FormatError);
    expect(() =>
      workoutFromJson({ ...workout, blocks: [{ type: 'superset', items: [] }] }),
    ).toThrow(FormatError);
  });

  it('unknown list entries are dropped', () => {
    const s = crateSettingsFromJson({
      excludedJointStress: ['knee', 'tail', 3, null, 'wrist'],
      excludedExerciseIds: ['a', 7, null, 'b'],
    });
    expect(s.excludedJointStress).toEqual(['knee', 'wrist']);
    expect(s.excludedExerciseIds).toEqual(['a', 'b']);
    const season = seasonFromJson({
      id: 's',
      crateId: 'c',
      name: 'n',
      createdAt: iso,
      participantIds: ['p1', 42, 'p2'],
    });
    expect(season.participantIds).toEqual(['p1', 'p2']);
    expect(season.exerciseDays).toEqual([]);
    const log = workoutLogFromJson({
      id: 'l',
      peachId: 'p',
      startedAt: iso,
      entries: [
        'junk',
        null,
        [1, 2],
        { exerciseId: 'e', sets: [{ reps: 5 }, 'bad', { reps: 3, loadKg: 20.5 }] },
      ],
    });
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
    const w = workoutFromJson({ id: 'w', focus: 'fullBody', goal: 'strength', createdAt: iso });
    expect(w.blocks).toEqual([]);
    expect(w.targetDifficulty).toBe(2);
    expect(w.title).toBeNull();
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
    const rules = scoringRulesFromJson({ pointsPerItem: '20', completionBonus: null });
    expect(rules.pointsPerItem).toBe(10);
    expect(rules.completionBonus).toBe(10);
    const pr = prescriptionFromJson({ sets: 'three', reps: 10, perSide: 'yes' });
    expect(pr.sets).toBe(1);
    expect(pr.perSide).toBe(false);
  });

  it('integers are truncated toward zero', () => {
    const pr = prescriptionFromJson({ sets: 3.9, restSeconds: 59.9, reps: 10.5 });
    expect(pr.sets).toBe(3);
    expect(pr.restSeconds).toBe(59);
    expect(pr.reps).toBe(10);
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
    expect(() => roundFromJson({ id: 'r', seasonId: 's', date: '10/10/2026' })).toThrow();
    expect(() =>
      seasonFromJson({ id: 's', crateId: 'c', name: 'n', createdAt: iso, exerciseDays: ['soon'] }),
    ).toThrow();
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
    expect(crateSettingsFromJson({ scoringRules: [1, 2] }).scoringRules).toEqual(
      STANDARD_SCORING_RULES,
    );
    expect(
      matchupFromJson({ id: 'm', seasonId: 's', roundId: 'r', homePeachId: 'h', result: [] })
        .result,
    ).toBeNull();
  });
});
