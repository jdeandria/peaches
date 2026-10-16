/**
 * Contract tests for the Firestore repositories against the Firestore
 * emulator. Run with `vitest.firestore.config.mts` (see there); they skip
 * when FIRESTORE_EMULATOR_HOST is not set.
 */
import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  Firestore,
  getDoc,
  initializeFirestore,
  setDoc,
  terminate,
} from 'firebase/firestore';
import { firstValueFrom, Observable, Subscription } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FormatError } from '../../domain/core/json';
import { localDate } from '../../domain/core/local-date';
import { ExerciseCapability } from '../../domain/models/capability';
import { Crate, CrateMembership, crateSettings } from '../../domain/models/crate';
import { peach } from '../../domain/models/peach';
import { scoringRules } from '../../domain/models/scoring-rules';
import { matchup, Round, Season } from '../../domain/models/season';
import { prescription, Workout } from '../../domain/models/workout';
import { exerciseLogEntry, setLog, workoutLog } from '../../domain/models/workout-log';
import {
  COLLECTIONS,
  FirestoreCapabilityRepository,
  FirestoreCrateRepository,
  FirestorePeachRepository,
  FirestoreSeasonRepository,
  FirestoreWorkoutLogRepository,
  FirestoreWorkoutRepository,
} from './firestore-repositories';

const PROJECT_ID = 'demo-peaches';
/** Set by `firebase emulators:exec`. Read via globalThis: specs have no Node typings. */
const EMULATOR_HOST = (globalThis as { process?: { env: Record<string, string | undefined> } })
  .process?.env['FIRESTORE_EMULATOR_HOST'];
const emulatorUrl = `http://${EMULATOR_HOST}`;

const OPEN_RULES = `rules_version = '2';
service cloud.firestore {
  match /{document=**} {
    allow read, write: if true;
  }
}`;

const now = new Date('2026-10-10T00:00:00.000Z');
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

const recorders: Subscription[] = [];

/**
 * Records every emission of `source`. `next(predicate)` resolves with the
 * next emission (after any already matched) that satisfies `predicate`, so
 * a test can step through "initial value, then this change, then that one"
 * without caring how many intermediate snapshots Firestore sends.
 */
function record<T>(source: Observable<T>) {
  const values: T[] = [];
  const checks = new Set<() => void>();
  let cursor = 0;
  let failure: { readonly error: unknown } | null = null;
  const notify = () => checks.forEach((check) => check());
  const subscription = source.subscribe({
    next: (v) => {
      values.push(v);
      notify();
    },
    error: (error: unknown) => {
      failure = { error };
      notify();
    },
  });
  recorders.push(subscription);

  const next = (predicate: (value: T) => boolean = () => true, ms = 10_000): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        checks.delete(check);
      };
      const check = () => {
        while (cursor < values.length) {
          const value = values[cursor++] as T;
          if (predicate(value)) {
            done();
            resolve(value);
            return;
          }
        }
        if (failure) {
          done();
          reject(failure.error);
        }
      };
      const timer = setTimeout(() => {
        done();
        reject(new Error(`No matching emission; saw ${JSON.stringify(values)}`));
      }, ms);
      checks.add(check);
      check();
    });

  return { values, next, stop: () => subscription.unsubscribe() };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ids = <T extends { readonly id: string }>(items: readonly T[]) => items.map((i) => i.id);

function crate(id: string, init: Partial<Crate> = {}): Crate {
  return {
    id,
    name: id,
    description: '',
    ownerPeachId: 'a',
    inviteCode: id.toUpperCase(),
    timeZone: 'UTC',
    settings: crateSettings(),
    createdAt: now,
    ...init,
  };
}

function membership(crateId: string, peachId: string, init: Partial<CrateMembership> = {}) {
  return { crateId, peachId, role: 'member', status: 'active', joinedAt: now, ...init } as const;
}

function capability(peachId: string, exerciseId: string): ExerciseCapability {
  return { peachId, exerciseId, status: 'able', updatedAt: now, notes: null };
}

function season(id: string, crateId: string, createdAt = now): Season {
  return {
    id,
    crateId,
    name: id,
    exerciseDays: [localDate(2026, 10, 10), localDate(2026, 10, 12)],
    participantIds: ['a', 'b'],
    status: 'scheduled',
    createdAt,
  };
}

function workout(id: string): Workout {
  return {
    id,
    title: 'Full body',
    blocks: [
      {
        type: 'strength',
        items: [
          {
            id: 'i1',
            exerciseId: 'push_up',
            prescription: prescription({
              sets: 3,
              restSeconds: 60,
              reps: 10,
              load: { rpe: 7, note: null },
            }),
            scoringWeight: 1,
          },
          {
            id: 'i2',
            exerciseId: 'plank',
            prescription: prescription({ sets: 2, restSeconds: 30, seconds: 45, perSide: true }),
            scoringWeight: 0.5,
          },
        ],
      },
    ],
    focus: 'fullBody',
    goal: 'generalFitness',
    targetDifficulty: 2.5,
    estimatedMinutes: 40,
    seed: 12345,
    generatorVersion: 3,
    createdAt: now,
  };
}

describe.skipIf(!EMULATOR_HOST)('Firestore repositories (emulator)', () => {
  let app: FirebaseApp;
  let db: Firestore;

  beforeAll(async () => {
    // These tests pin down repository behaviour, not access control, so
    // replace `firestore.rules` in the emulator with allow-all rules.
    const res = await fetch(`${emulatorUrl}/emulator/v1/projects/${PROJECT_ID}:securityRules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: { files: [{ name: 'contract.rules', content: OPEN_RULES }] } }),
    });
    expect(res.ok).toBe(true);
  });

  // A fresh client per test: a client's cache would otherwise serve
  // documents from earlier tests that the wipe below removed on the server.
  let instance = 0;
  beforeEach(async () => {
    const res = await fetch(
      `${emulatorUrl}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    );
    expect(res.ok).toBe(true);

    const [host, port] = (EMULATOR_HOST ?? '').split(':');
    app = initializeApp(
      { projectId: PROJECT_ID, apiKey: 'fake-api-key' },
      `contract-${++instance}`,
    );
    db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, host ?? '127.0.0.1', Number(port));
  });

  afterEach(async () => {
    // Detach listeners left behind by a failed test before the next one.
    recorders.splice(0).forEach((s) => s.unsubscribe());
    await terminate(db);
    await deleteApp(app);
  });

  describe('FirestorePeachRepository', () => {
    let repo: FirestorePeachRepository;
    beforeEach(() => (repo = new FirestorePeachRepository(db)));

    it('round-trips a Peach and returns null when missing', async () => {
      const p = peach({
        id: 'a',
        displayName: 'Ann',
        email: 'ann@example.com',
        avatarUrl: 'https://example.com/a.png',
        fitnessLevel: 4,
        timeZone: 'Europe/London',
        units: 'imperial',
        createdAt: now,
      });
      await repo.save(p);
      expect(await repo.getById('a')).toEqual(p);
      expect(await repo.getById('missing')).toBeNull();
    });

    it('getByIds handles more than one whereIn chunk', async () => {
      const all = Array.from({ length: 45 }, (_, i) => `p${i}`);
      await Promise.all(all.map((id) => repo.save(peach({ id, displayName: id, createdAt: now }))));
      const found = await repo.getByIds([...all, 'missing', 'p0']);
      expect(new Set(ids(found))).toEqual(new Set(all));
      expect(found).toHaveLength(45);
      expect(await repo.getByIds([])).toEqual([]);
    });

    it('watch emits the initial value, then every change, until unsubscribed', async () => {
      const watched = record(repo.watch('a'));
      expect(await watched.next()).toBeNull();

      await repo.save(peach({ id: 'a', displayName: 'A', createdAt: now }));
      await watched.next((p) => p?.displayName === 'A');
      await repo.save(peach({ id: 'a', displayName: 'A2', createdAt: now }));
      await watched.next((p) => p?.displayName === 'A2');

      watched.stop();
      const seen = watched.values.length;
      await repo.save(peach({ id: 'a', displayName: 'A3', createdAt: now }));
      await delay(300);
      expect(watched.values).toHaveLength(seen);
    });

    it('watch errors on a document that cannot be decoded', async () => {
      await setDoc(doc(db, COLLECTIONS.peaches, 'bad'), { id: 'bad' });
      await expect(firstValueFrom(repo.watch('bad'))).rejects.toBeInstanceOf(FormatError);
    });
  });

  describe('FirestoreCrateRepository', () => {
    let repo: FirestoreCrateRepository;
    beforeEach(() => (repo = new FirestoreCrateRepository(db)));

    it('round-trips a Crate with non-default settings', async () => {
      const c = crate('c1', {
        name: 'Crate',
        description: 'Morning crew',
        inviteCode: 'ABC123',
        timeZone: 'America/New_York',
        settings: crateSettings({
          workoutDurationMinutes: 30,
          goal: 'strength',
          scoringRules: scoringRules({ pointsPerItem: 5, completionBonus: 0 }),
          loggingGraceHours: 2,
          excludedExerciseIds: ['burpee', 'pull_up'],
          excludedJointStress: ['knee'],
        }),
      });
      await repo.save(c);
      expect(await repo.getById('c1')).toEqual(c);
      expect(await repo.getById('missing')).toBeNull();
    });

    it('invite code lookup is case-insensitive and memberships query', async () => {
      await repo.save(crate('c1', { name: 'Crate', inviteCode: 'ABC123' }));
      await repo.saveMembership(membership('c1', 'a'));
      await repo.saveMembership(membership('c1', 'b', { status: 'left' }));

      expect((await repo.getByInviteCode(' abc123 '))?.id).toBe('c1');
      expect(await repo.getByInviteCode('ZZZ')).toBeNull();
      expect(await repo.membershipsOf('c1')).toHaveLength(2);
      const [left] = await repo.membershipsFor('b');
      expect(left?.status).toBe('left');
      expect(ids(await firstValueFrom(repo.watchCratesFor('a')))).toEqual(['c1']);
      expect(await firstValueFrom(repo.watchCratesFor('b'))).toEqual([]);
    });

    it('membershipsFor finds memberships across Crates (collection group)', async () => {
      const m1 = membership('c1', 'a', { role: 'owner' });
      const m2 = membership('c2', 'a', { status: 'invited' });
      await repo.saveMembership(m1);
      await repo.saveMembership(m2);
      await repo.saveMembership(membership('c2', 'b'));

      const found = await repo.membershipsFor('a');
      expect(found.sort((x, y) => x.crateId.localeCompare(y.crateId))).toEqual([m1, m2]);
      expect(await repo.membershipsOf('c2')).toHaveLength(2);
      expect(await repo.membershipsFor('nobody')).toEqual([]);
    });

    it('saveMembership keeps one document per Peach per Crate', async () => {
      await repo.saveMembership(membership('c1', 'a'));
      await repo.saveMembership(membership('c1', 'a', { role: 'admin' }));
      const all = await repo.membershipsOf('c1');
      expect(all).toHaveLength(1);
      expect(all[0]?.role).toBe('admin');
    });

    it('watchCratesFor sorts by name and follows membership changes', async () => {
      await repo.save(crate('c1', { name: 'Zebras' }));
      await repo.save(crate('c2', { name: 'Apples' }));
      await repo.save(crate('c3', { name: 'Mangoes' }));
      await repo.saveMembership(membership('c1', 'a'));
      await repo.saveMembership(membership('c2', 'a'));
      await repo.saveMembership(membership('c3', 'a', { status: 'invited' }));

      const watched = record(repo.watchCratesFor('a'));
      expect(ids(await watched.next())).toEqual(['c2', 'c1']);

      await repo.saveMembership(membership('c3', 'a'));
      expect(ids(await watched.next((cs) => cs.length === 3))).toEqual(['c2', 'c3', 'c1']);

      await repo.saveMembership(membership('c1', 'a', { status: 'left' }));
      expect(ids(await watched.next((cs) => cs.length === 2))).toEqual(['c2', 'c3']);
      watched.stop();
    });

    it('watchCratesFor handles more than 30 active memberships', async () => {
      const crateIds = Array.from({ length: 33 }, (_, i) => `c${String(i).padStart(2, '0')}`);
      for (const id of crateIds) {
        await repo.save(crate(id));
        await repo.saveMembership(membership(id, 'a'));
      }
      expect(ids(await firstValueFrom(repo.watchCratesFor('a')))).toEqual(crateIds);
    });
  });

  describe('FirestoreCapabilityRepository', () => {
    let repo: FirestoreCapabilityRepository;
    beforeEach(() => (repo = new FirestoreCapabilityRepository(db)));

    it('round-trips capabilities keyed by exercise', async () => {
      const c = { ...capability('a', 'squat'), status: 'unable', notes: 'Knee' } as const;
      await repo.save(c);
      await repo.save(capability('a', 'push_up'));
      await repo.save({ ...capability('a', 'push_up'), notes: 'Updated' });

      const found = await repo.forPeach('a');
      expect(found).toHaveLength(2);
      expect(found.find((x) => x.exerciseId === 'squat')).toEqual(c);
      expect(found.find((x) => x.exerciseId === 'push_up')?.notes).toBe('Updated');
      expect(await repo.forPeach('nobody')).toEqual([]);
    });

    it('forPeaches merges several Peaches and ignores duplicates', async () => {
      await repo.save(capability('a', 'squat'));
      await repo.save(capability('b', 'squat'));
      await repo.save(capability('b', 'lunge'));
      await repo.save(capability('c', 'squat'));
      const found = await repo.forPeaches(['a', 'b', 'a']);
      expect(found.map((c) => `${c.peachId}/${c.exerciseId}`).sort()).toEqual([
        'a/squat',
        'b/lunge',
        'b/squat',
      ]);
    });

    it('saveAll writes more than one batch', async () => {
      const many = Array.from({ length: 1000 }, (_, i) => capability(`p${i % 2}`, `e${i}`));
      await repo.saveAll(many);
      expect(await repo.forPeach('p0')).toHaveLength(500);
      expect(await repo.forPeach('p1')).toHaveLength(500);
      await repo.saveAll([]);
    });

    it('watchForPeach emits the initial value, then every change', async () => {
      const watched = record(repo.watchForPeach('a'));
      expect(await watched.next()).toEqual([]);
      await repo.save(capability('a', 'squat'));
      await watched.next((cs) => cs.length === 1);
      await repo.saveAll([capability('a', 'lunge'), capability('b', 'row')]);
      const last = await watched.next((cs) => cs.length === 2);
      expect(last.map((c) => c.exerciseId).sort()).toEqual(['lunge', 'squat']);
      watched.stop();
    });
  });

  describe('FirestoreSeasonRepository', () => {
    let repo: FirestoreSeasonRepository;
    beforeEach(() => (repo = new FirestoreSeasonRepository(db)));

    const r1: Round = {
      id: 'r1',
      seasonId: 's1',
      index: 0,
      date: localDate(2026, 10, 10),
      focus: 'fullBody',
      status: 'scheduled',
    };
    const r2: Round = {
      ...r1,
      id: 'r2',
      index: 1,
      date: localDate(2026, 10, 12),
      focus: 'upperBody',
    };
    const m1 = matchup({
      id: 'm1',
      seasonId: 's1',
      roundId: 'r1',
      homePeachId: 'a',
      awayPeachId: 'b',
    });
    const m2 = matchup({
      id: 'm2',
      seasonId: 's1',
      roundId: 'r2',
      homePeachId: 'b',
      awayPeachId: 'a',
    });
    const bye = matchup({ id: 'm3', seasonId: 's1', roundId: 'r2', homePeachId: 'c' });

    it('schedule denormalises date and peachIds for matchup queries', async () => {
      await repo.save(season('s1', 'c1'));
      // Out of order, to check roundsOf sorts by index.
      await repo.saveSchedule([r2, r1], [m1, m2, bye]);

      expect(ids(await repo.roundsOf('s1'))).toEqual(['r1', 'r2']);
      expect(await repo.getRound('r2')).toEqual(r2);
      expect(await repo.getRound('nope')).toBeNull();
      expect(await repo.matchupsOf('s1')).toHaveLength(3);
      expect(new Set(ids(await repo.matchupsInRound('r2')))).toEqual(new Set(['m2', 'm3']));
      expect(new Set(ids(await repo.matchupsFor('a')))).toEqual(new Set(['m1', 'm2']));
      expect(ids(await repo.matchupsFor('a', localDate(2026, 10, 12)))).toEqual(['m2']);
      expect(await repo.matchupsFor('a', localDate(2026, 10, 11))).toEqual([]);
      expect(ids(await repo.matchupsFor('c'))).toEqual(['m3']);

      const raw = (
        await getDoc(doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.matchups, 'm3'))
      ).data();
      expect(raw?.['peachIds']).toEqual(['c']);
      expect(raw?.['date']).toBe('2026-10-12');

      // Updating a matchup keeps the denormalised date.
      await repo.saveMatchup({ ...m2, workoutId: 'w', status: 'inProgress' });
      const updated = await repo.matchupsFor('a', localDate(2026, 10, 12));
      expect(updated).toHaveLength(1);
      expect(updated[0]?.workoutId).toBe('w');
      expect((await repo.getMatchup('m2'))?.status).toBe('inProgress');
      expect(await repo.getMatchup('nope')).toBeNull();

      expect(ids(await repo.forCrate('c1'))).toEqual(['s1']);
      expect(ids(await firstValueFrom(repo.watchForCrate('c1')))).toEqual(['s1']);
      expect(await firstValueFrom(repo.watchMatchupsFor('b'))).toHaveLength(2);
    });

    it('round-trips Seasons, Rounds and Matchups with results', async () => {
      const s = season('s1', 'c1');
      await repo.save(s);
      expect(await repo.getById('s1')).toEqual(s);
      expect(await repo.getById('nope')).toBeNull();

      await repo.saveRound({ ...r1, status: 'open' });
      expect(await repo.getRound('r1')).toEqual({ ...r1, status: 'open' });

      const done = {
        ...m1,
        status: 'complete',
        result: { homePoints: 42.5, awayPoints: 40 },
      } as const;
      await repo.saveMatchup(done);
      expect(await repo.getMatchup('m1')).toEqual(done);
      expect(await repo.matchupsOf('s1')).toEqual([done]);
    });

    it('saveMatchup writes peachIds and merges, keeping the schedule date', async () => {
      await repo.saveMatchup(m1);
      const ref = doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.matchups, 'm1');
      expect((await getDoc(ref)).data()?.['peachIds']).toEqual(['a', 'b']);
      expect(ids(await repo.matchupsFor('b'))).toEqual(['m1']);

      await repo.saveSchedule([r1], [m1]);
      await repo.saveMatchup({ ...m1, awayPeachId: null });
      const raw = (await getDoc(ref)).data();
      expect(raw?.['peachIds']).toEqual(['a']);
      expect(raw?.['date']).toBe('2026-10-10');
      expect(await repo.matchupsFor('b')).toEqual([]);
    });

    it('forCrate and watchForCrate list newest first', async () => {
      await repo.save(season('old', 'c1', now));
      await repo.save(season('new', 'c1', later(60)));
      await repo.save(season('other', 'c2', later(120)));
      expect(ids(await repo.forCrate('c1'))).toEqual(['new', 'old']);

      const watched = record(repo.watchForCrate('c1'));
      expect(ids(await watched.next())).toEqual(['new', 'old']);
      await repo.save(season('newest', 'c1', later(90)));
      expect(ids(await watched.next((ss) => ss.length === 3))).toEqual(['newest', 'new', 'old']);
      watched.stop();
    });

    it('watchMatchupsFor emits the initial value, then every change', async () => {
      const watched = record(repo.watchMatchupsFor('a'));
      expect(await watched.next()).toEqual([]);
      await repo.saveSchedule([r1, r2], [m1, m2, bye]);
      await watched.next((ms) => ms.length === 2);
      await repo.saveMatchup({
        ...m1,
        status: 'complete',
        result: { homePoints: 1, awayPoints: 2 },
      });
      await watched.next((ms) => ms.some((m) => m.id === 'm1' && m.status === 'complete'));
      watched.stop();
    });
  });

  describe('FirestoreWorkoutRepository', () => {
    let repo: FirestoreWorkoutRepository;
    beforeEach(() => (repo = new FirestoreWorkoutRepository(db)));

    it('round-trips a Workout and returns null when missing', async () => {
      const w = workout('w1');
      await repo.save(w);
      expect(await repo.getById('w1')).toEqual(w);
      expect(await repo.getById('missing')).toBeNull();
    });

    it('getByIds handles more than one whereIn chunk', async () => {
      const all = Array.from({ length: 35 }, (_, i) => `w${i}`);
      await Promise.all(all.map((id) => repo.save(workout(id))));
      const found = await repo.getByIds([...all, 'missing']);
      expect(new Set(ids(found))).toEqual(new Set(all));
    });
  });

  describe('FirestoreWorkoutLogRepository', () => {
    let repo: FirestoreWorkoutLogRepository;
    beforeEach(() => (repo = new FirestoreWorkoutLogRepository(db)));

    const full = workoutLog({
      id: 'l1',
      peachId: 'a',
      workoutId: 'w1',
      matchupId: 'm1',
      startedAt: now,
      completedAt: later(40),
      status: 'submitted',
      entries: [
        exerciseLogEntry({
          exerciseId: 'push_up',
          workoutItemId: 'i1',
          sets: [setLog({ reps: 10 }), setLog({ reps: 8, loadKg: 12.5 })],
          rpe: 8,
          notes: 'Tough',
        }),
        exerciseLogEntry({ exerciseId: 'plank', sets: [setLog({ seconds: 45 })] }),
      ],
      notes: 'Good session',
    });

    it('round-trips a WorkoutLog and returns null when missing', async () => {
      await repo.save(full);
      expect(await repo.getById('l1')).toEqual(full);
      expect(await repo.getById('missing')).toBeNull();
    });

    it('forMatchup finds the Peach’s log for a matchup', async () => {
      await repo.save(full);
      await repo.save(workoutLog({ id: 'l2', peachId: 'b', matchupId: 'm1', startedAt: now }));
      expect((await repo.forMatchup('m1', 'a'))?.id).toBe('l1');
      expect((await repo.forMatchup('m1', 'b'))?.id).toBe('l2');
      expect(await repo.forMatchup('m1', 'c')).toBeNull();
      expect(await repo.forMatchup('m2', 'a')).toBeNull();
    });

    it('forPeach and watchForPeach list newest first', async () => {
      await repo.save(workoutLog({ id: 'old', peachId: 'a', startedAt: now }));
      await repo.save(workoutLog({ id: 'new', peachId: 'a', startedAt: later(60) }));
      await repo.save(workoutLog({ id: 'theirs', peachId: 'b', startedAt: later(30) }));
      expect(ids(await repo.forPeach('a'))).toEqual(['new', 'old']);

      const watched = record(repo.watchForPeach('a'));
      expect(ids(await watched.next())).toEqual(['new', 'old']);
      await repo.save(workoutLog({ id: 'mid', peachId: 'a', startedAt: later(30) }));
      expect(ids(await watched.next((ls) => ls.length === 3))).toEqual(['new', 'mid', 'old']);
      watched.stop();
    });

    it('watch emits the initial value, then every change', async () => {
      const watched = record(repo.watch('l1'));
      expect(await watched.next()).toBeNull();
      await repo.save({ ...full, status: 'inProgress', completedAt: null });
      await watched.next((l) => l?.status === 'inProgress');
      await repo.save(full);
      expect(await watched.next((l) => l?.status === 'submitted')).toEqual(full);
      watched.stop();
    });
  });
});
