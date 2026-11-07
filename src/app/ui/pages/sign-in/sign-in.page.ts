import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { AuthService, AuthUser } from '../../../application/auth-service';
import { errorMessage } from '../../../application/errors';
import { AppState } from '../../../state/app-state';
import { Card } from '../../layout/card';

/**
 * Sign in with Google (port of `SignInScreen`). A first sign-in creates the
 * account. Once signed in, the root component moves on to Train by itself.
 */
@Component({
  selector: 'pch-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, Card],
  template: `
    <main class="column">
      <div class="peach" aria-hidden="true">🍑</div>
      <h1 class="pch-headline-medium">Peaches</h1>
      <p class="tagline pch-body-medium">Log workouts. Compete with your Crate.</p>

      <pch-card class="card">
        @if (providers.has('google')) {
          <button matButton="tonal" type="button" [disabled]="busy()" (click)="signInWithGoogle()">
            Continue with Google
          </button>
        }
      </pch-card>
    </main>
  `,
  styles: `
    :host {
      display: grid;
      min-height: 100dvh;
      place-items: center;
      box-sizing: border-box;
      padding: 24px;
    }
    .column {
      display: flex;
      flex-direction: column;
      width: 100%;
      max-width: 400px;
      text-align: center;
    }
    .peach {
      font-size: 64px;
      line-height: 1.2;
    }
    h1 {
      margin: 16px 0 0;
    }
    .tagline {
      margin: 0 0 32px;
      color: var(--mat-sys-on-surface-variant);
    }
    .card {
      --pch-card-padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: start;
    }
  `,
})
export class SignInPage {
  private readonly state = inject(AppState);
  private readonly auth: AuthService = this.state.auth;

  protected readonly providers = this.auth.availableProviders;
  protected readonly busy = signal(false);

  constructor() {
    // A redirect sign-in (Firebase on some browsers) finishes after the page
    // reloads; surface its failure here.
    const auth = this.auth as AuthService & { redirectResult?: Promise<AuthUser | null> };
    if ('redirectResult' in auth && auth.redirectResult) {
      this.busy.set(true);
      auth.redirectResult
        .catch((e: unknown) => this.state.toast(errorMessage(e)))
        .finally(() => this.busy.set(false));
    }
  }

  protected async signInWithGoogle(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.signInWithGoogle();
    } catch (e) {
      this.state.toast(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
