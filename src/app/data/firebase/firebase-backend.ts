/**
 * Starts the Firebase backend: Auth plus the Firestore repositories.
 *
 * Kept free of Angular so the composition root decides how to wire the
 * result into its container.
 */
import { FirebaseApp, FirebaseOptions, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  Firestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

import { Repositories } from '../../application/app-container';
import { firestoreRepositories } from '../firestore/firestore-repositories';
import { isFirebaseConfigured } from './firebase-config';
import { FirebaseAuthService } from './firebase-auth-service';

/** Ports of the local emulator suite; must match `firebase.json`. */
export const EMULATOR_PORTS = { firestore: 8080, auth: 9099 } as const;

export interface FirebaseBackendOptions {
  readonly config: FirebaseOptions;
  /** Host of the local emulator suite (e.g. `localhost`); omit for production. */
  readonly emulatorHost?: string | null;
}

export interface FirebaseBackend {
  readonly app: FirebaseApp;
  readonly firestore: Firestore;
  readonly repositories: Repositories;
  /** Also exposes `redirectResult` for the sign-in screen. */
  readonly auth: FirebaseAuthService;
}

/**
 * Initialises Firebase and builds the repositories and auth service. Call
 * it once: Firestore cannot be initialised twice in the same app.
 *
 * In production Firestore keeps a persistent IndexedDB cache shared across
 * tabs, so the PWA opens with the last-seen data and queues writes while
 * offline. Against the emulator the cache is in memory, so restarting the
 * emulator never leaves stale documents behind in the browser.
 */
export function startFirebaseBackend(options: FirebaseBackendOptions): FirebaseBackend {
  const { config, emulatorHost } = options;
  if (!isFirebaseConfigured(config)) {
    throw new Error(
      'Firebase is not configured. Put the web app config from the Firebase console in ' +
        'src/app/data/firebase/firebase-config.ts, or start the app in demo mode.',
    );
  }
  const app = initializeApp(config);
  const firestore = initializeFirestore(app, {
    localCache: emulatorHost
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const auth = getAuth(app);
  if (emulatorHost) {
    connectFirestoreEmulator(firestore, emulatorHost, EMULATOR_PORTS.firestore);
    connectAuthEmulator(auth, `http://${emulatorHost}:${EMULATOR_PORTS.auth}`, {
      disableWarnings: true,
    });
  }
  return {
    app,
    firestore,
    repositories: firestoreRepositories(firestore),
    auth: new FirebaseAuthService(auth),
  };
}
