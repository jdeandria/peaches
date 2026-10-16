import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  resource,
  ResourceRef,
  signal,
  untracked,
} from '@angular/core';
import { rxResource, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  catchError,
  distinctUntilChanged,
  from,
  map,
  Observable,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { AppContainer } from '../application/app-container';
import { AuthUser } from '../application/auth-service';
import { errorMessage } from '../application/errors';
import { localDateOfLocal } from '../domain/core/local-date';
import { UnitSystem } from '../domain/models/training';
import { deviceTimeZone } from '../data/tz/intl-zone-clock';
import { APP_CONTAINER, AUTH_SERVICE, CLOCK } from './tokens';

/** Where the signed-in session is. */
export type SessionStatus = 'loading' | 'signedOut' | 'ready' | 'error';

/** How often time-based views (countdowns, "today") refresh. */
const TICK_MS = 30_000;

/**
 * App-wide reactive state: the signed-in Peach and their live data as
 * signals, plus helpers that let components declare one-shot queries and
 * live streams against the backend.
 *
 * Live data (the
 * Peach, their Crates, matchups and logs) streams from the
 * repositories; one-shot queries made with {@link query} re-run whenever
 * {@link bump} is called after a mutation.
 */
@Injectable({ providedIn: 'root' })
export class AppState {
  readonly app: AppContainer = inject(APP_CONTAINER);
  readonly auth = inject(AUTH_SERVICE);
  readonly catalog = this.app.catalog;
  private readonly clock = inject(CLOCK);
  private readonly snackBar = inject(MatSnackBar);

  /** Bumped after every mutation so one-shot queries refetch. */
  readonly revision = signal(0);

  /** "Now", refreshed every {@link TICK_MS} so countdowns and "today" stay current. */
  readonly nowTick = signal(this.clock());

  /** Today's date on this device. */
  readonly today = computed(() => localDateOfLocal(this.nowTick()));

  readonly authUser = toSignal(this.auth.authState, { initialValue: undefined });

  /** The signed-in Peach's id (the auth uid), or null. */
  readonly peachId = computed(() => this.authUser()?.id ?? null);

  /**
   * `loading` until auth is known and, once signed in, the Peach profile
   * exists and Seasons are brought up to date.
   */
  readonly status = toSignal(
    this.auth.authState.pipe(
      distinctUntilChanged((a, b) => a?.id === b?.id && (a === undefined) === (b === undefined)),
      switchMap((user): Observable<SessionStatus> => {
        if (user === undefined) return of('loading');
        if (user === null) return of('signedOut');
        return from(this.bootstrap(user)).pipe(
          map((): SessionStatus => 'ready'),
          catchError((e: unknown) => {
            console.error('Session bootstrap failed', e);
            return of<SessionStatus>('error');
          }),
          startWith<SessionStatus>('loading'),
        );
      }),
    ),
    { initialValue: 'loading' as SessionStatus },
  );

  readonly peach = this.watch(
    () => this.peachId() ?? undefined,
    (id, app) => app.peaches.watch(id),
  );
  readonly myCrates = this.watch(
    () => this.peachId() ?? undefined,
    (id, app) => app.crates.watchCratesFor(id),
  );
  readonly myMatchups = this.watch(
    () => this.peachId() ?? undefined,
    (id, app) => app.seasons.watchMatchupsFor(id),
  );
  readonly myLogs = this.watch(
    () => this.peachId() ?? undefined,
    (id, app) => app.logs.watchForPeach(id),
  );

  /** The current Peach's display units (metric until the profile loads). */
  readonly units = computed<UnitSystem>(() => this.peach.value()?.units ?? 'metric');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const timer = setInterval(() => this.nowTick.set(this.clock()), TICK_MS);
    destroyRef.onDestroy(() => clearInterval(timer));

    // An installed PWA can sit in the background for days: bring rounds up
    // to date whenever it comes back to the foreground.
    if (typeof document !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return;
        this.nowTick.set(this.clock());
        if (this.status() === 'ready') void this.syncSeasons();
      };
      document.addEventListener('visibilitychange', onVisible);
      destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
    }
  }

  now(): Date {
    return this.clock();
  }

  /** Marks data as changed so every {@link query} refetches. */
  bump(): void {
    this.revision.update((r) => r + 1);
  }

  /**
   * Opens and closes rounds that are due for the current Peach, then bumps
   * the revision so every screen refetches.
   */
  async syncSeasons(): Promise<void> {
    const id = this.peachId();
    if (!id) return;
    try {
      await this.app.seasonService.syncPeach(id, this.now());
    } catch (e) {
      this.toast(errorMessage(e));
    }
    this.nowTick.set(this.clock());
    this.bump();
  }

  /**
   * Runs a mutation: on success bumps the revision (and shows `success` if
   * given) and returns the result; on failure shows the error and returns
   * undefined.
   */
  async run<T>(
    action: (app: AppContainer) => Promise<T>,
    success?: string,
  ): Promise<T | undefined> {
    try {
      const result = await action(this.app);
      this.bump();
      if (success) this.toast(success);
      return result;
    } catch (e) {
      this.toast(errorMessage(e));
      return undefined;
    }
  }

  toast(message: string): void {
    this.snackBar.open(message, undefined, { duration: 4000 });
  }

  /**
   * A one-shot query that re-runs when `params` changes or after any
   * {@link bump}, keeping its previous value while it reloads. Return
   * `undefined` from `params` to leave the query idle. Call from an
   * injection context (a component field initializer).
   */
  query<P, T>(
    params: () => P | undefined,
    loader: (params: P, app: AppContainer) => Promise<T>,
  ): ResourceRef<T | undefined> {
    const ref = resource({
      params: () => params(),
      loader: ({ params: p }) => loader(p as P, this.app),
    });
    let first = true;
    effect(() => {
      this.revision();
      if (first) {
        first = false;
        return;
      }
      untracked(() => ref.reload());
    });
    return ref;
  }

  /**
   * A live stream from the backend, re-subscribed when `params` changes.
   * Return `undefined` from `params` to leave it idle.
   */
  watch<P, T>(
    params: () => P | undefined,
    stream: (params: P, app: AppContainer) => Observable<T>,
  ): ResourceRef<T | undefined> {
    return rxResource({
      params: () => params(),
      stream: ({ params: p }) => stream(p as P, this.app),
    });
  }

  /** Emits the session status as an Observable (for router guards). */
  readonly status$ = toObservable(this.status);

  private async bootstrap(user: AuthUser): Promise<void> {
    const peach = await this.app.sessionService.ensurePeach(user, this.now(), deviceTimeZone());
    await this.app.seasonService.syncPeach(peach.id, this.now());
    this.bump();
  }
}
