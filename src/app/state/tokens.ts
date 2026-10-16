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
