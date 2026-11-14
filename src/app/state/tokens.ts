import { InjectionToken } from '@angular/core';

import { AppContainer } from '../application/app-container';
import { AuthService } from '../application/auth-service';

/** The wired backend, built before bootstrap (see `main.ts`). */
export const APP_CONTAINER = new InjectionToken<AppContainer>('APP_CONTAINER');

/** The sign-in boundary for the chosen backend. */
export const AUTH_SERVICE = new InjectionToken<AuthService>('AUTH_SERVICE');

/** Wall-clock source so screens and tests agree on "now". */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

/**
 * How long the splash waits for the session to load before offering to try
 * again (ms). Longer than Firestore takes to give up on the server and read
 * its cache (about 10 s), so only a write that never reaches the server
 * trips it.
 */
export const STARTUP_TIMEOUT_MS = new InjectionToken<number>('STARTUP_TIMEOUT_MS', {
  providedIn: 'root',
  factory: () => 20_000,
});
