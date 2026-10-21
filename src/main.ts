import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';
import { startBackend } from './app/state/backend';
import { APP_CONTAINER, AUTH_SERVICE, HEART_RATE_SOURCE } from './app/state/tokens';
import { environment } from './environments/environment';

/**
 * The backend is built before Angular starts (the demo seeds a whole season
 * in memory), behind the static splash in index.html.
 *
 * `?demo=signed-out` starts the demo on the sign-in screen, where any
 * provider signs in as the demo user.
 */
async function main(): Promise<void> {
  const signedOut = new URLSearchParams(location.search).get('demo') === 'signed-out';
  const backend = await startBackend(environment, { signedOut });
  await bootstrapApplication(App, {
    providers: [
      ...appConfig.providers,
      { provide: APP_CONTAINER, useValue: backend.container },
      { provide: AUTH_SERVICE, useValue: backend.auth },
      { provide: HEART_RATE_SOURCE, useValue: backend.heartRate },
    ],
  });
}

main().catch((err: unknown) => {
  console.error(err);
  const splash = document.getElementById('splash-message');
  if (splash) {
    splash.textContent = `Peaches could not start: ${err instanceof Error ? err.message : String(err)}`;
  }
});
