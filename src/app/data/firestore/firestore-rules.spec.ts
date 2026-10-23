/// <reference types="node" />
/**
 * Access-control tests for `firestore.rules`, against the Firestore
 * emulator. Run with `vitest.firestore.config.mts`; they skip when
 * FIRESTORE_EMULATOR_HOST is not set.
 *
 * Each test seeds its documents with open rules, then loads the real rules
 * and acts as particular signed-in Peaches (the emulator accepts mock auth
 * tokens), so what is checked is exactly what production enforces.
 */
import { readFileSync } from 'node:fs';
import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  initializeFirestore,
  query,
  setDoc,
  terminate,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sharedExercisesOf, sharedExerciseToJson } from '../../domain/models/crate-exercise';
import { routineFromJson, routineToJson } from '../../domain/models/routine';
import { categoryWeights, DEFAULT_RULES, rulesToJson } from '../../domain/models/scoring';
import {
  exerciseLogEntry,
  setLog,
  workoutLog,
  workoutLogFromJson,
  workoutLogToJson,
} from '../../domain/models/workout-log';
import {
  COLLECTIONS,
  FirestoreCrateRepository,
  FirestoreRoutineRepository,
  FirestoreSeasonRepository,
  FirestoreWorkoutLogRepository,
} from './firestore-repositories';

const PROJECT_ID = 'demo-peaches';
const EMULATOR_HOST = process.env['FIRESTORE_EMULATOR_HOST'];
const emulatorUrl = `http://${EMULATOR_HOST}`;
const RULES = readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8');
const OPEN_RULES = `rules_version = '2';
service cloud.firestore { match /{document=**} { allow read, write: if true; } }`;

const now = new Date('2026-10-12T09:00:00.000Z');

async function loadRules(content: string): Promise<void> {
  const res = await fetch(`${emulatorUrl}/emulator/v1/projects/${PROJECT_ID}:securityRules`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content }] } }),
  });
  expect(res.ok).toBe(true);
}

describe.skipIf(!EMULATOR_HOST)('firestore.rules (emulator)', () => {
  const open: { app: FirebaseApp; db: Firestore }[] = [];
  let instance = 0;

  /** A client signed in as `uid`, or anonymous (signed out) when null. */
  function client(uid: string | null): Firestore {
    const [host, port] = (EMULATOR_HOST ?? '').split(':');
    const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake' }, `rules-${++instance}`);
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(
      db,
      host || '127.0.0.1',
      Number(port),
      uid === null ? {} : { mockUserToken: { user_id: uid } },
    );
    open.push({ app, db });
    return db;
  }

  /** Writes documents with open rules, then switches to the real rules. */
  async function seed(write: (db: Firestore) => Promise<void>): Promise<void> {
    await loadRules(OPEN_RULES);
    await write(client(null));
    await loadRules(RULES);
  }

  beforeEach(async () => {
    const res = await fetch(
      `${emulatorUrl}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' },
    );
    expect(res.ok).toBe(true);
    // A Crate with members a (owner) and b; c is not a member.
    await seed(async (db) => {
      await setDoc(doc(db, COLLECTIONS.crates, 'c1'), {
        id: 'c1',
        name: 'Crate',
        ownerPeachId: 'a',
        inviteCode: 'ABC123',
        createdAt: now.toISOString(),
      });
      for (const [peachId, role] of [
        ['a', 'owner'],
        ['b', 'member'],
      ]) {
        await setDoc(doc(db, COLLECTIONS.crates, 'c1', COLLECTIONS.memberships, peachId), {
          crateId: 'c1',
          peachId,
          role,
          status: 'active',
          joinedAt: now.toISOString(),
        });
      }
    });
  });

  afterEach(async () => {
    for (const { app, db } of open.splice(0)) {
      await terminate(db);
      await deleteApp(app);
    }
  });

  const submitted = (peachId: string, id = 'l1') =>
    workoutLogToJson(
      workoutLog({
        id,
        peachId,
        startedAt: now,
        completedAt: now,
        status: 'submitted',
        sharedWith: ['c1'],
        entries: [exerciseLogEntry({ exerciseId: 'bw-run', sets: [setLog({ meters: 5000 })] })],
      }),
    );
  const sharedRef = (db: Firestore, id = 'l1') =>
    doc(db, COLLECTIONS.crates, 'c1', COLLECTIONS.sharedLogs, id);

  it('the collection-group queries the app runs are allowed for signed-in Peaches', async () => {
    // Seasons, rounds and matchups are found across Crates by collection-group
    // queries, which only rules matching `{path=**}` can allow.
    await seed(async (db) => {
      await setDoc(doc(db, COLLECTIONS.seasons, 's1'), {
        id: 's1',
        crateId: 'c1',
        name: 'S',
        startWeek: '2026-10-12',
        weeks: 1,
        participantIds: ['a', 'b'],
        status: 'active',
        createdAt: now.toISOString(),
      });
      await setDoc(doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.rounds, 'r1'), {
        id: 'r1',
        seasonId: 's1',
        index: 0,
        weekStart: '2026-10-12',
        status: 'open',
      });
      await setDoc(doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.matchups, 'm1'), {
        id: 'm1',
        seasonId: 's1',
        roundId: 'r1',
        homePeachId: 'a',
        awayPeachId: 'b',
        peachIds: ['a', 'b'],
        weekStart: '2026-10-12',
        status: 'inProgress',
        result: null,
      });
    });
    const crates = new FirestoreCrateRepository(client('b'));
    expect((await crates.membershipsFor('b')).map((m) => m.crateId)).toEqual(['c1']);
    expect(await crates.membershipsFor('c')).toEqual([]);
    const seasons = new FirestoreSeasonRepository(client('b'));
    expect((await seasons.matchupsFor('b')).map((m) => m.id)).toEqual(['m1']);
    expect((await seasons.getMatchup('m1'))?.homePeachId).toBe('a');
    expect((await seasons.matchupsInRound('r1')).map((m) => m.id)).toEqual(['m1']);
    expect((await seasons.getRound('r1'))?.weekStart).toBe('2026-10-12');
    // The other queries a session starts with: Seasons by Crate (members
    // only) and the Peach's own logs.
    expect((await seasons.forCrate('c1')).map((x) => x.id)).toEqual(['s1']);
    await expect(new FirestoreSeasonRepository(client('c')).forCrate('c1')).rejects.toThrow();
    expect(await new FirestoreWorkoutLogRepository(client('b')).forPeach('b')).toEqual([]);
    // Signed out, nothing.
    await expect(new FirestoreCrateRepository(client(null)).membershipsFor('b')).rejects.toThrow();
  });

  it('a Peach’s own logs, drafts included, are private', async () => {
    await seed((db) => setDoc(doc(db, COLLECTIONS.workoutLogs, 'l1'), submitted('b')));
    await expect(getDoc(doc(client('b'), COLLECTIONS.workoutLogs, 'l1'))).resolves.toBeTruthy();
    await expect(getDoc(doc(client('a'), COLLECTIONS.workoutLogs, 'l1'))).rejects.toThrow();
    const mine = await getDocs(
      query(collection(client('b'), COLLECTIONS.workoutLogs), where('peachId', '==', 'b')),
    );
    expect(mine.size).toBe(1);
    await expect(
      getDocs(query(collection(client('a'), COLLECTIONS.workoutLogs), where('peachId', '==', 'b'))),
    ).rejects.toThrow();
  });

  it('members share their own submitted logs with the Crate and read each other’s', async () => {
    // b shares a submitted log; a reads it; c (not a member) can't.
    await setDoc(sharedRef(client('b')), submitted('b'));
    expect((await getDoc(sharedRef(client('a')))).exists()).toBe(true);
    await expect(getDoc(sharedRef(client('c')))).rejects.toThrow();
    const week = await getDocs(
      query(
        collection(client('a'), COLLECTIONS.crates, 'c1', COLLECTIONS.sharedLogs),
        where('startedAt', '>=', now.toISOString()),
      ),
    );
    expect(week.size).toBe(1);

    // Only their Peach edits shared copies, and only they delete them.
    await setDoc(sharedRef(client('b')), { ...submitted('b'), notes: 'edited' });
    await expect(
      setDoc(sharedRef(client('a')), { ...submitted('b'), notes: 'hacked' }),
    ).rejects.toThrow();
    await expect(setDoc(sharedRef(client('a')), submitted('a'))).rejects.toThrow();
    // Others can't delete it (its Peach can: see below).
    await expect(deleteDoc(sharedRef(client('a')))).rejects.toThrow();
    // Nobody shares in someone else's name, a draft, or into a Crate they're not in.
    await expect(setDoc(sharedRef(client('a'), 'l2'), submitted('b', 'l2'))).rejects.toThrow();
    await expect(
      setDoc(sharedRef(client('b'), 'l3'), { ...submitted('b', 'l3'), status: 'inProgress' }),
    ).rejects.toThrow();
    await expect(setDoc(sharedRef(client('c'), 'l4'), submitted('c', 'l4'))).rejects.toThrow();
    // A session's plan stays private.
    const planned = submitted('b', 'l5');
    await expect(
      setDoc(sharedRef(client('b'), 'l5'), { ...planned, plan: planned['entries'] }),
    ).rejects.toThrow();
  });

  it('a Peach deletes their own workouts and their Crate copies, nobody else’s', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, COLLECTIONS.workoutLogs, 'l1'), submitted('b'));
      await setDoc(sharedRef(db), submitted('b'));
    });
    await expect(deleteDoc(doc(client('a'), COLLECTIONS.workoutLogs, 'l1'))).rejects.toThrow();
    await expect(deleteDoc(sharedRef(client('a')))).rejects.toThrow();
    const repo = new FirestoreWorkoutLogRepository(client('b'));
    await repo.delete(workoutLogFromJson(submitted('b')));
    // Gone reads as missing, not refused, so screens watching it can say so.
    expect(await repo.getById('l1')).toBeNull();
    expect((await getDoc(sharedRef(client('a')))).exists()).toBe(false);
    await expect(getDoc(doc(client(null), COLLECTIONS.workoutLogs, 'l1'))).rejects.toThrow();
  });

  it('a Peach’s routines are theirs alone', async () => {
    const routine = (peachId: string, id = 'r1') =>
      routineToJson({
        id,
        peachId,
        name: 'Leg day',
        exercises: [exerciseLogEntry({ exerciseId: 'bb-back-squat', sets: [setLog({ reps: 5 })] })],
        updatedAt: now,
      });
    const mine = new FirestoreRoutineRepository(client('b'));
    await mine.save(routineFromJson(routine('b')));
    expect((await mine.forPeach('b')).map((r) => r.name)).toEqual(['Leg day']);
    await mine.save(routineFromJson({ ...routine('b'), name: 'Legs' }));
    expect((await mine.getById('r1'))?.name).toBe('Legs');

    // Nobody else reads, changes, takes over or deletes it.
    const ref = (db: Firestore, id = 'r1') => doc(db, COLLECTIONS.routines, id);
    await expect(getDoc(ref(client('a')))).rejects.toThrow();
    await expect(new FirestoreRoutineRepository(client('a')).forPeach('b')).rejects.toThrow();
    await expect(setDoc(ref(client('a')), routine('a'))).rejects.toThrow();
    await expect(setDoc(ref(client('b')), routine('a'))).rejects.toThrow();
    await expect(deleteDoc(ref(client('a')))).rejects.toThrow();
    // Nor saves one in someone else's name, or under another id.
    await expect(setDoc(ref(client('a'), 'r2'), routine('b', 'r2'))).rejects.toThrow();
    await expect(setDoc(ref(client('b'), 'r3'), routine('b', 'r4'))).rejects.toThrow();

    await mine.delete('r1');
    expect(await mine.forPeach('b')).toEqual([]);
  });

  it('members vote with their own ballot only', async () => {
    const ballot = (peachId: string) => ({
      crateId: 'c1',
      peachId,
      rules: rulesToJson(DEFAULT_RULES),
      updatedAt: now.toISOString(),
    });
    const ref = (db: Firestore, peachId: string) =>
      doc(db, COLLECTIONS.crates, 'c1', COLLECTIONS.ballots, peachId);
    await setDoc(ref(client('b'), 'b'), ballot('b'));
    await setDoc(ref(client('b'), 'b'), {
      ...ballot('b'),
      rules: rulesToJson({ ...DEFAULT_RULES, weights: categoryWeights({ reps: 100 }) }),
    });
    expect((await getDoc(ref(client('a'), 'b'))).data()?.['rules']['weights']['reps']).toBe(100);
    await expect(setDoc(ref(client('a'), 'b'), ballot('b'))).rejects.toThrow();
    await expect(setDoc(ref(client('c'), 'c'), ballot('c'))).rejects.toThrow();
    await expect(getDoc(ref(client('c'), 'b'))).rejects.toThrow();
  });

  it('members share their exercises in their own name only', async () => {
    const log = workoutLog({
      id: 'l1',
      peachId: 'b',
      startedAt: now,
      status: 'submitted',
      sharedWith: ['c1'],
      entries: [exerciseLogEntry({ exerciseId: 'bw-run', sets: [setLog({ meters: 5000 })] })],
    });
    const [shared] = sharedExercisesOf(log);
    const ref = (db: Firestore, key: string) =>
      doc(db, COLLECTIONS.crates, 'c1', COLLECTIONS.sharedExercises, key);
    await setDoc(ref(client('b'), 'bw-run__b'), sharedExerciseToJson(shared));
    // Again (an edited log) is fine.
    await setDoc(ref(client('b'), 'bw-run__b'), sharedExerciseToJson(shared));
    expect((await getDoc(ref(client('a'), 'bw-run__b'))).exists()).toBe(true);
    await expect(getDoc(ref(client('c'), 'bw-run__b'))).rejects.toThrow();
    // Not under someone else's key or name, and not by outsiders.
    await expect(
      setDoc(ref(client('a'), 'bw-run__b'), sharedExerciseToJson(shared)),
    ).rejects.toThrow();
    await expect(
      setDoc(ref(client('a'), 'bw-run__a'), sharedExerciseToJson(shared)),
    ).rejects.toThrow();
    await expect(
      setDoc(ref(client('c'), 'bw-run__c'), sharedExerciseToJson({ ...shared, peachId: 'c' })),
    ).rejects.toThrow();
    await expect(deleteDoc(ref(client('b'), 'bw-run__b'))).rejects.toThrow();
  });

  it('members dispute others’ workouts, and each sets only their own vote', async () => {
    const dispute = (openedBy: string, peachId: string) => ({
      id: 'd1',
      crateId: 'c1',
      logId: 'l1',
      peachId,
      target: 'bw-run',
      label: 'Run',
      snapshot: 'bw-run~x',
      openedBy,
      openedAt: now.toISOString(),
      votes: { [openedBy]: 'strike' },
    });
    const ref = (db: Firestore) => doc(db, COLLECTIONS.crates, 'c1', COLLECTIONS.disputes, 'd1');
    // Not your own workout, not with a vote to keep, not by outsiders.
    await expect(setDoc(ref(client('b')), dispute('b', 'b'))).rejects.toThrow();
    await expect(
      setDoc(ref(client('a')), { ...dispute('a', 'b'), votes: { a: 'keep', b: 'strike' } }),
    ).rejects.toThrow();
    await expect(setDoc(ref(client('c')), dispute('c', 'b'))).rejects.toThrow();
    await setDoc(ref(client('a')), dispute('a', 'b'));
    expect((await getDoc(ref(client('b')))).exists()).toBe(true);
    await expect(getDoc(ref(client('c')))).rejects.toThrow();

    // The opener changes their vote; the owner can't vote; nobody touches
    // another's vote or anything else.
    await updateDoc(ref(client('a')), { 'votes.a': 'keep' });
    await expect(updateDoc(ref(client('b')), { 'votes.b': 'keep' })).rejects.toThrow();
    await expect(updateDoc(ref(client('a')), { 'votes.b': 'strike' })).rejects.toThrow();
    await expect(updateDoc(ref(client('a')), { 'votes.a': 'maybe' })).rejects.toThrow();
    await expect(updateDoc(ref(client('a')), { label: 'Walk' })).rejects.toThrow();
    await expect(deleteDoc(ref(client('a')))).rejects.toThrow();
  });

  it('lineups are secret until they lock, and frozen after', async () => {
    const hour = 3_600_000;
    const lineup = (peachId: string, locksAt: number) => ({
      seasonId: 's1',
      roundId: 'r1',
      peachId,
      pledges: [{ category: 'runWalk', target: 10 }],
      locksAt,
      updatedAt: now.toISOString(),
    });
    const ref = (db: Firestore, peachId: string, roundId = 'r1') =>
      doc(db, COLLECTIONS.seasons, 's1', COLLECTIONS.lineups, `${roundId}_${peachId}`);
    const future = Date.now() + 48 * hour;
    await seed(async (db) => {
      await setDoc(doc(db, COLLECTIONS.seasons, 's1'), { id: 's1', crateId: 'c1' });
      await setDoc(ref(db, 'a', 'r0'), { ...lineup('a', Date.now() - hour), roundId: 'r0' });
    });

    // b sets and changes a lineup for next week; a can't see it yet.
    await setDoc(ref(client('b'), 'b'), lineup('b', future));
    await setDoc(ref(client('b'), 'b'), { ...lineup('b', future), pledges: [] });
    expect((await getDoc(ref(client('b'), 'b'))).exists()).toBe(true);
    await expect(getDoc(ref(client('a'), 'b'))).rejects.toThrow();
    // A lineup that doesn't exist reads as missing, not as a refusal.
    expect((await getDoc(ref(client('a'), 'z'))).exists()).toBe(false);
    // A locked one is readable by members, not outsiders, and can't change.
    expect((await getDoc(ref(client('b'), 'a', 'r0'))).exists()).toBe(true);
    await expect(getDoc(ref(client('c'), 'a', 'r0'))).rejects.toThrow();
    await expect(
      setDoc(ref(client('a'), 'a', 'r0'), {
        ...lineup('a', Date.now() - hour),
        roundId: 'r0',
        pledges: [],
      }),
    ).rejects.toThrow();

    // Nobody sets a lineup for someone else, past its lock, moves the lock,
    // or locks it more than a week away.
    await expect(setDoc(ref(client('a'), 'b'), lineup('b', future))).rejects.toThrow();
    await expect(setDoc(ref(client('a'), 'a'), lineup('a', Date.now() - hour))).rejects.toThrow();
    await expect(setDoc(ref(client('b'), 'b'), lineup('b', future + hour))).rejects.toThrow();
    await expect(
      setDoc(ref(client('a'), 'a'), lineup('a', Date.now() + 9 * 24 * hour)),
    ).rejects.toThrow();
    await expect(setDoc(ref(client('c'), 'c'), lineup('c', future))).rejects.toThrow();
  });

  it('a Season’s frozen rules cannot change', async () => {
    const season = {
      id: 's1',
      crateId: 'c1',
      name: 'S',
      startWeek: '2026-10-12',
      weeks: 2,
      participantIds: ['a', 'b'],
      rules: rulesToJson(DEFAULT_RULES),
      status: 'scheduled',
      createdAt: now.toISOString(),
    };
    await setDoc(doc(client('a'), COLLECTIONS.seasons, 's1'), season);
    // Any member advances the status...
    await setDoc(doc(client('b'), COLLECTIONS.seasons, 's1'), { ...season, status: 'active' });
    // ...but nobody rewrites the rules.
    await expect(
      setDoc(doc(client('a'), COLLECTIONS.seasons, 's1'), {
        ...season,
        rules: rulesToJson({ ...DEFAULT_RULES, weights: categoryWeights({ ride: 100 }) }),
      }),
    ).rejects.toThrow();
  });
});
