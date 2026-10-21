import { InjectionToken } from '@angular/core';

import { AppContainer } from '../application/app-container';
import { AuthService } from '../application/auth-service';
import { HeartRateSource } from '../application/heart-rate';

/** The wired backend, built before bootstrap (see `main.ts`). */
export const APP_CONTAINER = new InjectionToken<AppContainer>('APP_CONTAINER');

/** The sign-in boundary for the chosen backend. */
export const AUTH_SERVICE = new InjectionToken<AuthService>('AUTH_SERVICE');

/** Wall-clock source so screens and tests agree on "now". */
export const CLOCK = new InjectionToken<() => Date>('CLOCK', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

/** Where heart rate comes from while logging; null (the default) when none is set up. */
export const HEART_RATE_SOURCE = new InjectionToken<HeartRateSource | null>('HEART_RATE_SOURCE', {
  providedIn: 'root',
  factory: () => null,
});
