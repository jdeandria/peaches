import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { AppState } from './state/app-state';
import { Pwa } from './state/pwa';

/**
 * The root: a splash while the session settles, then the router. Follows
 * auth changes so signing in or out lands on the right page.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state.status()) {
      @case ('loading') {
        <div class="splash" role="status" aria-live="polite">
          <span class="peach" aria-hidden="true">🍑</span>
          <span class="visually-hidden">Loading Peaches</span>
        </div>
      }
      @case ('error') {
        <div class="splash" role="alert">
          <span class="peach" aria-hidden="true">🍑</span>
          <p>Peaches could not load your profile. Check your connection and try again.</p>
          <button type="button" (click)="reload()">Try again</button>
        </div>
      }
      @default {
        <router-outlet />
      }
    }
  `,
  styles: `
    .splash {
      min-height: 100dvh;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 16px;
      padding: 24px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .peach {
      font-size: 64px;
      animation: breathe 1.6s ease-in-out infinite;
    }
    @keyframes breathe {
      50% {
        transform: scale(0.92);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .peach {
        animation: none;
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
