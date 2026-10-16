import { Environment } from './environment.model';

/** Firebase backend against `firebase emulators:start` on this machine. */
export const environment: Environment = {
  backend: 'firebase',
  firebaseEmulatorHost: 'localhost',
};
