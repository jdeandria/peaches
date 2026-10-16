/**
 * Build-time configuration, chosen per build: `environment.ts` (the
 * in-browser demo) is swapped for `environment.firebase.ts` or
 * `environment.emulator.ts` by the angular.json configurations of the same
 * names. Kept apart from those files because file replacement swaps them out.
 */
export interface Environment {
  /**
   * `demo` runs the seeded in-memory backend entirely in the browser;
   * `firebase` runs on Firebase Auth and Firestore (configure
   * `src/app/data/firebase/firebase-config.ts` first).
   */
  readonly backend: 'demo' | 'firebase';
  /** Point Auth and Firestore at the local emulator suite, e.g. `localhost`. */
  readonly firebaseEmulatorHost: string | null;
}
