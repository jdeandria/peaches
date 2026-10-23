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
import { Crate, CrateMembership, crateSettings } from '../../domain/models/crate';
import { Dispute } from '../../domain/models/dispute';
import { Lineup } from '../../domain/models/lineup';
import { peach } from '../../domain/models/peach';
import { Routine } from '../../domain/models/routine';
import { categoryWeights, DEFAULT_LINEUP_RULES, DEFAULT_RULES } from '../../domain/models/scoring';
import { matchup, Round, Season } from '../../domain/models/season';
import { exerciseLogEntry, setLog, workoutLog } from '../../domain/models/workout-log';
import {
  COLLECTIONS,
  FirestoreBallotRepository,
  FirestoreCrateRepository,
  FirestoreDisputeRepository,
  FirestorePeachRepository,
  FirestoreRoutineRepository,
  FirestoreSeasonRepository,
  FirestoreWorkoutLogRepository,
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

function season(id: string, crateId: string, createdAt = now): Season {
  return {
    id,
    crateId,
    name: id,
    startWeek: localDate(2026, 10, 5),
    weeks: 2,
    participantIds: ['a', 'b'],
    rules: { weights: categoryWeights({ runWalk: 60, reps: 40 }), lineup: DEFAULT_LINEUP_RULES },
    status: 'scheduled',
    createdAt,
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
        settings: crateSettings({ loggingGraceHours: 2 }),
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

  describe('FirestoreSeasonRepository', () => {
    let repo: FirestoreSeasonRepository;
    beforeEach(() => (repo = new FirestoreSeasonRepository(db)));

    const r1: Round = {
      id: 'r1',
      seasonId: 's1',
      index: 0,
      weekStart: localDate(2026, 10, 5),
      status: 'scheduled',
    };
    const r2: Round = { ...r1, id: 'r2', index: 1, weekStart: localDate(2026, 10, 12) };
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

    it('schedule denormalises the week and peachIds for matchup queries', async () => {
      await repo.save(season('s1', 'c1'));
      // Out of order, to check roundsOf sorts by index.
      await repo.saveSchedule([r2, r1], [m1, m2, bye]);

      expect(ids(await repo.roundsOf('s1'))).toEqual(['r1', 'r2']);
      expect(await repo.getRound('r2')).toEqual(r2);
      expect(await repo.getRound('nope')).toBeNull();
      expect(await repo.matchupsOf('s1')).toHaveLength(3);
      expect(new Set(ids(await repo.matchupsInRound('r2')))).toEqual(new Set(['m2', 'm3']));
      expect(new Set(ids(await repo.matchupsFor('a')))).toEqual(new Set(['m1', 'm2']));
      expect(ids(await repo.matchupsFor('c'))).toEqual(['m3']);

      const raw = (
        await getDoc(doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.matchups, 'm3'))
      ).data();
      expect(raw?.['peachIds']).toEqual(['c']);
      expect(raw?.['weekStart']).toBe('2026-10-12');

      // Updating a matchup keeps the denormalised week.
      await repo.saveMatchup({ ...m2, status: 'inProgress' });
      const updated = (
        await getDoc(doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.matchups, 'm2'))
      ).data();
      expect(updated?.['weekStart']).toBe('2026-10-12');
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

    it('saveMatchup writes peachIds and merges, keeping the schedule week', async () => {
      await repo.saveMatchup(m1);
      const ref = doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.matchups, 'm1');
      expect((await getDoc(ref)).data()?.['peachIds']).toEqual(['a', 'b']);
      expect(ids(await repo.matchupsFor('b'))).toEqual(['m1']);

      await repo.saveSchedule([r1], [m1]);
      await repo.saveMatchup({ ...m1, awayPeachId: null });
      const raw = (await getDoc(ref)).data();
      expect(raw?.['peachIds']).toEqual(['a']);
      expect(raw?.['weekStart']).toBe('2026-10-05');
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

  describe('FirestoreWorkoutLogRepository', () => {
    let repo: FirestoreWorkoutLogRepository;
    beforeEach(() => (repo = new FirestoreWorkoutLogRepository(db)));

    const full = workoutLog({
      id: 'l1',
      peachId: 'a',
      startedAt: now,
      completedAt: later(40),
      status: 'submitted',
      durationSeconds: 2400,
      sharedWith: ['c1', 'c2'],
      entries: [
        exerciseLogEntry({
          exerciseId: 'push_up',
          exerciseName: 'Push Up',
          sets: [setLog({ reps: 10 }), setLog({ reps: 8, loadKg: 12.5 })],
          rpe: 8,
          notes: 'Tough',
        }),
        exerciseLogEntry({
          exerciseId: 'run',
          exerciseName: 'Run',
          distanceKind: 'runWalk',
          sets: [setLog({ meters: 5000, seconds: 1500 })],
        }),
      ],
      notes: 'Good session',
    });

    it('round-trips a WorkoutLog and returns null when missing', async () => {
      await repo.save(full);
      expect(await repo.getById('l1')).toEqual(full);
      expect(await repo.getById('missing')).toBeNull();
    });

    it('saveSubmitted copies the log under every Crate it is shared with', async () => {
      await repo.saveSubmitted(full);
      expect(await repo.getById('l1')).toEqual(full);
      const copy = await getDoc(doc(db, COLLECTIONS.crates, 'c2', COLLECTIONS.sharedLogs, 'l1'));
      expect(copy.exists()).toBe(true);

      await repo.saveSubmitted({ ...full, id: 'l2', startedAt: later(60 * 24 * 7) });
      await repo.saveSubmitted({ ...full, id: 'l3', sharedWith: ['c2'], startedAt: later(10) });
      // [from, to) on startedAt.
      expect(ids(await repo.sharedWith('c1', now, later(60 * 24 * 7)))).toEqual(['l1']);
      expect(ids(await repo.sharedWith('c2', now, later(60 * 24 * 7)))).toEqual(['l3', 'l1']);
      expect(await repo.sharedWith('c1', later(1), later(2))).toEqual([]);
      expect(await repo.sharedWith('c9', now, later(60 * 24 * 7))).toEqual([]);
      expect(ids(await repo.recentlySharedWith('c2', 2))).toEqual(['l2', 'l3']);
      expect((await repo.sharedWith('c1', now, later(1)))[0]).toEqual(full);
      expect(await repo.getShared('c2', 'l1')).toEqual(full);
      expect(await repo.getShared('c9', 'l1')).toBeNull();
    });

    it('keeps a draft’s plan, but never puts it in the Crates’ copies', async () => {
      const plan = [full.entries[0]];
      await repo.save({ ...full, status: 'inProgress', completedAt: null, plan });
      expect((await repo.getById('l1'))?.plan).toEqual(plan);
      await repo.saveSubmitted({ ...full, plan });
      expect((await repo.getShared('c1', 'l1'))?.plan).toEqual([]);
    });

    it('saveSubmitted shares each exercise, one per exercise per Peach, and edits overwrite', async () => {
      await repo.saveSubmitted(full);
      await repo.saveSubmitted({ ...full, id: 'l2', peachId: 'b', sharedWith: ['c1'] });
      const shared = await repo.exercisesSharedWith('c1');
      expect(shared.map((e) => `${e.exercise.id}/${e.peachId}`).sort()).toEqual([
        'push_up/a',
        'push_up/b',
        'run/a',
        'run/b',
      ]);
      expect(shared.find((e) => e.exercise.id === 'run')?.exercise).toEqual({
        id: 'run',
        name: 'Run',
        track: 'distance',
        takesLoad: false,
        distanceKind: 'runWalk',
      });
      // Re-sharing an edited log rewrites the same documents.
      await repo.saveSubmitted({ ...full, notes: 'edited' });
      expect(await repo.exercisesSharedWith('c1')).toHaveLength(4);
      expect((await repo.getShared('c1', 'l1'))?.notes).toBe('edited');
    });

    it('delete removes the log and every Crate copy at once', async () => {
      await repo.saveSubmitted(full);
      await repo.delete(full);
      expect(await repo.getById('l1')).toBeNull();
      expect(await repo.getShared('c1', 'l1')).toBeNull();
      expect(await repo.getShared('c2', 'l1')).toBeNull();
      // Its exercises stay shared: they say what a member has logged.
      expect(await repo.exercisesSharedWith('c1')).toHaveLength(2);
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

  describe('FirestoreRoutineRepository', () => {
    const routine = (id: string, peachId: string, name: string): Routine => ({
      id,
      peachId,
      name,
      exercises: [
        exerciseLogEntry({
          exerciseId: 'bb-back-squat',
          exerciseName: 'Back Squat',
          sets: [setLog({ reps: 5, loadKg: 100 }), setLog({ reps: 5, loadKg: 100 })],
        }),
      ],
      updatedAt: now,
    });

    it('round-trips, lists a Peach’s routines by name, follows changes and deletes', async () => {
      const repo = new FirestoreRoutineRepository(db);
      await repo.save(routine('r1', 'a', 'Push'));
      await repo.save(routine('r2', 'a', 'legs'));
      await repo.save(routine('r3', 'b', 'Arms'));
      expect(await repo.getById('r1')).toEqual(routine('r1', 'a', 'Push'));
      expect(await repo.getById('missing')).toBeNull();
      expect((await repo.forPeach('a')).map((r) => r.name)).toEqual(['legs', 'Push']);

      const watched = record(repo.watchForPeach('a'));
      expect(ids(await watched.next())).toEqual(['r2', 'r1']);
      await repo.delete('r2');
      expect(ids(await watched.next((rs) => rs.length === 1))).toEqual(['r1']);
      watched.stop();
    });
  });

  describe('FirestoreBallotRepository', () => {
    it('keeps one ballot per member per Crate', async () => {
      const repo = new FirestoreBallotRepository(db);
      await repo.save({ crateId: 'c1', peachId: 'a', rules: DEFAULT_RULES, updatedAt: now });
      const changed = { ...DEFAULT_RULES, weights: categoryWeights({ ride: 100 }) };
      await repo.save({ crateId: 'c1', peachId: 'a', rules: changed, updatedAt: later(5) });
      await repo.save({ crateId: 'c2', peachId: 'a', rules: DEFAULT_RULES, updatedAt: now });
      expect(await repo.forCrate('c1')).toEqual([
        { crateId: 'c1', peachId: 'a', rules: changed, updatedAt: later(5) },
      ]);
      expect(await repo.forCrate('c3')).toEqual([]);
    });
  });

  describe('FirestoreDisputeRepository', () => {
    const dispute = (id: string, logId: string, openedAt = now): Dispute => ({
      id,
      crateId: 'c1',
      logId,
      peachId: 'a',
      target: 'run',
      label: 'Run',
      snapshot: 'run~x',
      openedBy: 'b',
      openedAt,
      votes: { b: 'strike' },
    });

    it('finds disputes by log and by when they were opened', async () => {
      const repo = new FirestoreDisputeRepository(db);
      await repo.create(dispute('d1', 'l1'));
      await repo.create(dispute('d2', 'l2', later(60)));
      expect(await repo.get('c1', 'd1')).toEqual(dispute('d1', 'l1'));
      expect(await repo.get('c1', 'nope')).toBeNull();
      expect((await repo.forLogs('c1', ['l2', 'l9'])).map((d) => d.id)).toEqual(['d2']);
      expect((await repo.openedSince('c1', now)).map((d) => d.id)).toEqual(['d2', 'd1']);
      expect(await repo.openedSince('c1', later(61))).toEqual([]);
    });

    it('records a vote without touching anyone else’s', async () => {
      const repo = new FirestoreDisputeRepository(db);
      await repo.create(dispute('d1', 'l1'));
      await repo.vote('c1', 'd1', 'c', 'keep');
      await repo.vote('c1', 'd1', 'd', 'strike');
      await repo.vote('c1', 'd1', 'c', 'strike');
      expect((await repo.get('c1', 'd1'))?.votes).toEqual({
        b: 'strike',
        c: 'strike',
        d: 'strike',
      });
    });
  });

  describe('FirestoreSeasonRepository lineups', () => {
    it('keeps one lineup per Peach per week', async () => {
      const repo = new FirestoreSeasonRepository(db);
      const lineup: Lineup = {
        seasonId: 's1',
        roundId: 'r1',
        peachId: 'a',
        pledges: [{ category: 'runWalk', target: 15 }],
        locksAt: later(60),
        updatedAt: now,
      };
      await repo.saveLineup(lineup);
      const changed = { ...lineup, pledges: [{ category: 'reps' as const, target: 300 }] };
      await repo.saveLineup(changed);
      expect(await repo.getLineup('s1', 'r1', 'a')).toEqual(changed);
      expect(await repo.getLineup('s1', 'r1', 'b')).toBeNull();
    });
  });
});
