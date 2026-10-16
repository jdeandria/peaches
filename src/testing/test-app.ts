import { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter, Routes } from '@angular/router';

import { AppContainer } from '../app/application/app-container';
import { DemoAuthService } from '../app/application/auth-service';
import { SequentialIdGenerator } from '../app/domain/core/ids';
import { UtcZoneClock } from '../app/domain/core/zone-clock';
import { ExerciseCatalog } from '../app/domain/exercises/exercise-catalog';
import { DEMO_PEACH_ID, DemoSeeder } from '../app/data/demo/demo-seeder';
import { inMemoryRepositories } from '../app/data/in-memory/in-memory-repositories';
import { APP_CONTAINER, AUTH_SERVICE, CLOCK } from '../app/state/tokens';

/** A fixed Monday morning (UTC) so seeded data is stable across runs. */
export const FIXED_NOW = new Date(Date.UTC(2026, 9, 12, 9));

export interface TestBackend {
  readonly container: AppContainer;
  readonly auth: DemoAuthService;
  readonly providers: (Provider | EnvironmentProviders)[];
}

/**
 * A freshly seeded in-memory backend (the demo data, in UTC, at
 * {@link FIXED_NOW}) and the providers that wire it into TestBed:
 *
 * ```ts
 * const backend = await seededBackend();
 * TestBed.configureTestingModule({ providers: backend.providers });
 * ```
 */
export async function seededBackend(
  options: { signedIn?: boolean; seed?: boolean; routes?: Routes } = {},
): Promise<TestBackend> {
  const container = new AppContainer(
    inMemoryRepositories(),
    ExerciseCatalog.standard(),
    new SequentialIdGenerator('x'),
    new UtcZoneClock(),
  );
  if (options.seed ?? true) await new DemoSeeder(container).seed(FIXED_NOW, 'UTC');
  const auth = new DemoAuthService(
    { id: DEMO_PEACH_ID, displayName: 'You', email: null, photoUrl: null },
    options.signedIn ?? true,
  );
  return {
    container,
    auth,
    providers: [
      { provide: APP_CONTAINER, useValue: container },
      { provide: AUTH_SERVICE, useValue: auth },
      { provide: CLOCK, useValue: () => FIXED_NOW },
      provideRouter(options.routes ?? []),
    ],
  };
}

/** Resolves after pending microtasks and a macrotask, letting async loaders settle. */
export function settle(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
