/**
 * Placeholder Firebase web configuration.
 *
 * Replace {@link firebaseConfig} with the real web app config once the
 * Firebase project exists: Firebase console → Project settings → Your apps
 * → Web app → "SDK setup and configuration" → Config. The API key in it is
 * not a secret (it is shipped to every browser; access is governed by
 * `firestore.rules` and the Auth settings), so the file is committed.
 *
 * The placeholder project id makes it obvious when configuration has not
 * happened: {@link startFirebaseBackend} refuses to start while it is
 * present, and the app stays in demo mode.
 */
import { FirebaseOptions } from 'firebase/app';

export const PLACEHOLDER_PROJECT_ID = 'peaches-not-configured';

export const firebaseConfig: FirebaseOptions = {
  apiKey: 'placeholder',
  appId: '1:0:web:placeholder',
  messagingSenderId: '0',
  projectId: PLACEHOLDER_PROJECT_ID,
  authDomain: 'peaches-not-configured.firebaseapp.com',
  storageBucket: 'peaches-not-configured.appspot.com',
};

/** False while `config` still holds the placeholder values. */
export function isFirebaseConfigured(config: FirebaseOptions): boolean {
  return !!config.projectId && config.projectId !== PLACEHOLDER_PROJECT_ID;
}
