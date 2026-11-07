import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AppState } from './state/app-state';
import { Pwa } from './state/pwa';
import { Splash } from './ui/layout/splash';

/**
 * The root: a splash while the session settles, then the router. Follows
 * auth changes so signing in or out lands on the right page.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Splash],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state.status()) {
      @case ('loading') {
        <pch-splash role="status" aria-live="polite">
          <span class="pch-visually-hidden">Loading Peaches</span>
        </pch-splash>
      }
      @case ('error') {
        <pch-splash role="alert">
          <p>Peaches could not load your profile. Check your connection and try again.</p>
          <button type="button" (click)="reload()">Try again</button>
        </pch-splash>
      }
      @default {
        <router-outlet />
      }
    }
  `,
})
export class App {
  protected readonly state = inject(AppState);
  private readonly router = inject(Router);

  constructor() {
    // Created eagerly so update and install prompts are caught early.
    inject(Pwa);

    effect(() => {
      const status = this.state.status();
      const onSignIn = this.router.url.startsWith('/sign-in');
      if (status === 'signedOut' && !onSignIn) void this.router.navigateByUrl('/sign-in');
      if (status === 'ready' && onSignIn) void this.router.navigateByUrl('/');
    });
  }

  protected reload(): void {
    location.reload();
  }
}
