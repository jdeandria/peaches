import { AppContainer } from '../application/app-container';
import { AuthService, DemoAuthService } from '../application/auth-service';
import { HeartRateSource } from '../application/heart-rate';
import { RandomIdGenerator, SequentialIdGenerator } from '../domain/core/ids';
import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import { DemoHeartRateSource } from '../data/demo/demo-heart-rate';
import { DEMO_PEACH_ID, DemoSeeder } from '../data/demo/demo-seeder';
import { inMemoryRepositories } from '../data/in-memory/in-memory-repositories';
import { deviceTimeZone, IntlZoneClock } from '../data/tz/intl-zone-clock';
import { Environment } from '../../environments/environment.model';

export interface Backend {
  readonly container: AppContainer;
  readonly auth: AuthService;
  /** Where heart rate comes from while logging; null when none is set up. */
  readonly heartRate: HeartRateSource | null;
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
  return { container, auth, heartRate: new DemoHeartRateSource() };
}

/**
 * Builds the backend the environment asks for. The Firebase SDK (and the
 * Google Health client) are loaded lazily so the demo build never
 * downloads them.
 */
export async function startBackend(env: Environment, demo: DemoOptions = {}): Promise<Backend> {
  if (env.backend === 'demo') return startDemoBackend(demo);
  const [{ startFirebaseBackend }, { firebaseConfig }, heartRate] = await Promise.all([
    import('../data/firebase/firebase-backend'),
    import('../data/firebase/firebase-config'),
    googleHealth(),
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
    heartRate,
  };
}

/** Heart rate from Google Health, once its OAuth client is configured. */
async function googleHealth(): Promise<HeartRateSource | null> {
  const { googleHealthClientId, isGoogleHealthConfigured } =
    await import('../data/google-health/google-health-config');
  if (!isGoogleHealthConfigured(googleHealthClientId)) return null;
  const { GoogleHealthHeartRateSource } =
    await import('../data/google-health/google-health-source');
  return new GoogleHealthHeartRateSource({ clientId: googleHealthClientId });
}
