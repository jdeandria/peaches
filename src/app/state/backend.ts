import { AppContainer } from '../application/app-container';
import { AuthService, DemoAuthService } from '../application/auth-service';
import { RandomIdGenerator, SequentialIdGenerator } from '../domain/core/ids';
import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import { DEMO_PEACH_ID, DemoSeeder } from '../data/demo/demo-seeder';
import { inMemoryRepositories } from '../data/in-memory/in-memory-repositories';
import { deviceTimeZone, IntlZoneClock } from '../data/tz/intl-zone-clock';
import { Environment } from '../../environments/environment.model';

export interface Backend {
  readonly container: AppContainer;
  readonly auth: AuthService;
}

export interface DemoOptions {
  /** Start on the sign-in screen; any provider then signs in as the demo user. */
  readonly signedOut?: boolean;
  readonly now?: Date;
}

/**
 * The seeded, in-browser demo: nothing leaves the device and nothing is kept
 * between visits. Sequential ids keep the demo identical on every load.
 */
export async function startDemoBackend(options: DemoOptions = {}): Promise<Backend> {
  const zone = new IntlZoneClock();
  const container = new AppContainer(
    inMemoryRepositories(),
    ExerciseCatalog.standard(),
    new SequentialIdGenerator('demo'),
    zone,
  );
  await new DemoSeeder(container).seed(options.now ?? new Date(), deviceTimeZone());
  const auth = new DemoAuthService(
    { id: DEMO_PEACH_ID, displayName: 'You', email: null, photoUrl: null },
    !options.signedOut,
  );
  return { container, auth };
}

/**
 * Builds the backend the environment asks for. The Firebase SDK is loaded
 * lazily so the demo build never downloads it.
 */
export async function startBackend(env: Environment, demo: DemoOptions = {}): Promise<Backend> {
  if (env.backend === 'demo') return startDemoBackend(demo);
  const [{ startFirebaseBackend }, { firebaseConfig }] = await Promise.all([
    import('../data/firebase/firebase-backend'),
    import('../data/firebase/firebase-config'),
  ]);
  const firebase = await startFirebaseBackend({
    config: firebaseConfig,
    emulatorHost: env.firebaseEmulatorHost,
  });
  return {
    container: new AppContainer(
      firebase.repositories,
      ExerciseCatalog.standard(),
      new RandomIdGenerator(),
      new IntlZoneClock(),
    ),
    auth: firebase.auth,
  };
}
