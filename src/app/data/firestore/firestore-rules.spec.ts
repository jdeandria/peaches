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
  where,
} from 'firebase/firestore';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { categoryWeights, DEFAULT_WEIGHTS, weightsToJson } from '../../domain/models/scoring';
import {
  exerciseLogEntry,
  setLog,
  workoutLog,
  workoutLogToJson,
} from '../../domain/models/workout-log';
import { COLLECTIONS } from './firestore-repositories';

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

    // Shared copies never change.
    await expect(
      setDoc(sharedRef(client('b')), { ...submitted('b'), notes: 'edited' }),
    ).rejects.toThrow();
    await expect(deleteDoc(sharedRef(client('b')))).rejects.toThrow();
    // Nobody shares in someone else's name, a draft, or into a Crate they're not in.
    await expect(setDoc(sharedRef(client('a'), 'l2'), submitted('b', 'l2'))).rejects.toThrow();
    await expect(
      setDoc(sharedRef(client('b'), 'l3'), { ...submitted('b', 'l3'), status: 'inProgress' }),
    ).rejects.toThrow();
    await expect(setDoc(sharedRef(client('c'), 'l4'), submitted('c', 'l4'))).rejects.toThrow();
  });

  it('members vote with their own ballot only', async () => {
    const ballot = (peachId: string) => ({
      crateId: 'c1',
      peachId,
      weights: weightsToJson(DEFAULT_WEIGHTS),
      updatedAt: now.toISOString(),
    });
    const ref = (db: Firestore, peachId: string) =>
      doc(db, COLLECTIONS.crates, 'c1', COLLECTIONS.ballots, peachId);
    await setDoc(ref(client('b'), 'b'), ballot('b'));
    await setDoc(ref(client('b'), 'b'), {
      ...ballot('b'),
      weights: weightsToJson(categoryWeights({ reps: 100 })),
    });
    expect((await getDoc(ref(client('a'), 'b'))).data()?.['weights']['reps']).toBe(100);
    await expect(setDoc(ref(client('a'), 'b'), ballot('b'))).rejects.toThrow();
    await expect(setDoc(ref(client('c'), 'c'), ballot('c'))).rejects.toThrow();
    await expect(getDoc(ref(client('c'), 'b'))).rejects.toThrow();
  });

  it('members add to the library; whoever added it, or the owner, removes it', async () => {
    const ref = (db: Firestore, id: string) =>
      doc(db, COLLECTIONS.crates, 'c1', COLLECTIONS.library, id);
    const entry = (exerciseId: string, addedBy: string) => ({
      crateId: 'c1',
      exerciseId,
      addedBy,
      addedAt: now.toISOString(),
    });
    await setDoc(ref(client('b'), 'kb-swing'), entry('kb-swing', 'b'));
    await setDoc(ref(client('b'), 'bw-burpee'), entry('bw-burpee', 'b'));
    // Not in someone else's name, and not by outsiders.
    await expect(setDoc(ref(client('b'), 'bw-run'), entry('bw-run', 'a'))).rejects.toThrow();
    await expect(setDoc(ref(client('c'), 'bw-run'), entry('bw-run', 'c'))).rejects.toThrow();
    await expect(getDoc(ref(client('c'), 'kb-swing'))).rejects.toThrow();

    await deleteDoc(ref(client('b'), 'kb-swing'));
    await deleteDoc(ref(client('a'), 'bw-burpee'));
    await setDoc(ref(client('a'), 'bw-run'), entry('bw-run', 'a'));
    await expect(deleteDoc(ref(client('b'), 'bw-run'))).rejects.toThrow();

    const routine = doc(client('b'), COLLECTIONS.crates, 'c1', COLLECTIONS.routines, 'rt1');
    await setDoc(routine, {
      id: 'rt1',
      crateId: 'c1',
      name: 'Sweat',
      items: [],
      createdBy: 'b',
      createdAt: now.toISOString(),
    });
    await expect(setDoc(routine, { name: 'Renamed' }, { merge: true })).rejects.toThrow();
  });

  it('a Season’s frozen weights cannot change', async () => {
    const season = {
      id: 's1',
      crateId: 'c1',
      name: 'S',
      startWeek: '2026-10-12',
      weeks: 2,
      participantIds: ['a', 'b'],
      weights: weightsToJson(DEFAULT_WEIGHTS),
      status: 'scheduled',
      createdAt: now.toISOString(),
    };
    await setDoc(doc(client('a'), COLLECTIONS.seasons, 's1'), season);
    // Any member advances the status...
    await setDoc(doc(client('b'), COLLECTIONS.seasons, 's1'), { ...season, status: 'active' });
    // ...but nobody rewrites the weights.
    await expect(
      setDoc(doc(client('a'), COLLECTIONS.seasons, 's1'), {
        ...season,
        weights: weightsToJson(categoryWeights({ ride: 100 })),
      }),
    ).rejects.toThrow();
  });
});
