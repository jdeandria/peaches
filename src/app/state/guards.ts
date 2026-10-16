import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';

import { AppState } from './app-state';

/**
 * Waits until the session has settled, then lets signed-in Peaches into the
 * app and sends everyone else to sign in.
 */
export const signedInGuard: CanMatchFn = () => {
  const state = inject(AppState);
  const router = inject(Router);
  return state.status$.pipe(
    filter((s) => s !== 'loading'),
    take(1),
    map((s) => (s === 'signedOut' ? router.parseUrl('/sign-in') : true)),
  );
};

/** The sign-in page is only for signed-out visitors. */
export const signedOutGuard: CanMatchFn = () => {
  const state = inject(AppState);
  const router = inject(Router);
  return state.status$.pipe(
    filter((s) => s !== 'loading'),
    take(1),
    map((s) => (s === 'signedOut' ? true : router.parseUrl('/'))),
  );
};
