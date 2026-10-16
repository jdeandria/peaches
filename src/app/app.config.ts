import {
  ApplicationConfig,
  inject,
  Injectable,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { Title } from '@angular/platform-browser';
import {
  provideRouter,
  RouterStateSnapshot,
  TitleStrategy,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';

/** "Crates · Peaches", or just "Peaches" for untitled routes. */
@Injectable({ providedIn: 'root' })
class PeachesTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · Peaches` : 'Peaches');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Cross-fades between pages (the M3 fade-through), where supported.
      withViewTransitions({ skipInitialTransition: true }),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
    ),
    { provide: TitleStrategy, useClass: PeachesTitleStrategy },
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: { duration: 4000, horizontalPosition: 'center', verticalPosition: 'bottom' },
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register once the app is idle so it never competes with first paint.
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
