/**
 * The application lifecycle suite (the same one `ng test` runs in memory),
 * run against the Firestore emulator. See `vitest.firestore.config.mts`.
 */
import { deleteApp, FirebaseApp, initializeApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  Firestore,
  initializeFirestore,
  terminate,
} from 'firebase/firestore';
import { afterEach, beforeAll, describe, expect } from 'vitest';

import { runLifecycleSuite } from '../../../testing/lifecycle-suite';
import { AppContainer } from '../../application/app-container';
import { SequentialIdGenerator } from '../../domain/core/ids';
import { UtcZoneClock } from '../../domain/core/zone-clock';
import { ExerciseCatalog } from '../../domain/exercises/exercise-catalog';
import { firestoreRepositories } from './firestore-repositories';

const PROJECT_ID = 'demo-peaches';
/** Set by `firebase emulators:exec`. Read via globalThis: specs have no Node typings. */
const EMULATOR_HOST = (globalThis as { process?: { env: Record<string, string | undefined> } })
  .process?.env['FIRESTORE_EMULATOR_HOST'];
const emulatorUrl = `http://${EMULATOR_HOST}`;

describe.skipIf(!EMULATOR_HOST)('Firestore lifecycle (emulator)', () => {
  const open: { app: FirebaseApp; db: Firestore }[] = [];
  let instance = 0;

  beforeAll(async () => {
    // Behaviour, not access control: the suite writes as no particular user.
    const rules = `rules_version = '2';
service cloud.firestore { match /{document=**} { allow read, write: if true; } }`;
    const res = await fetch(`${emulatorUrl}/emulator/v1/projects/${PROJECT_ID}:securityRules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: { files: [{ name: 'lifecycle.rules', content: rules }] } }),
    });
    expect(res.ok).toBe(true);
  });

  afterEach(async () => {
    for (const { app, db } of open.splice(0)) {
      await terminate(db);
      await deleteApp(app);
    }
  });

  runLifecycleSuite('firestore', async () => {
    // Each container gets a wiped database and a fresh client (a client's
    // cache would otherwise serve documents the wipe removed).
    await fetch(`${emulatorUrl}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
      method: 'DELETE',
    });
    const [host, port] = (EMULATOR_HOST ?? '').split(':');
    const app = initializeApp(
      { projectId: PROJECT_ID, apiKey: 'fake-api-key' },
      `lc-${++instance}`,
    );
    const db = initializeFirestore(app, {});
    connectFirestoreEmulator(db, host || '127.0.0.1', Number(port));
    open.push({ app, db });
    return new AppContainer(
      firestoreRepositories(db),
      ExerciseCatalog.standard(),
      new SequentialIdGenerator(`t${instance}`),
      new UtcZoneClock(),
    );
  });
});
