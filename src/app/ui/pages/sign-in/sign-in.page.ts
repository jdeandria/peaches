import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';

import { AuthService, AuthUser } from '../../../application/auth-service';
import { errorMessage } from '../../../application/errors';
import { AppState } from '../../../state/app-state';
import { Card } from '../../layout/card';

/**
 * Sign in or create an account (port of `SignInScreen`). The providers
 * offered come from the auth service. Once signed in, the root component
 * moves on to Train by itself.
 */
@Component({
  selector: 'pch-sign-in-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButton, MatFormField, MatLabel, MatInput, Card],
  template: `
    <main class="column">
      <div class="peach" aria-hidden="true">🍑</div>
      <h1 class="pch-headline-medium">Peaches</h1>
      <p class="tagline pch-body-medium">Log workouts. Compete with your Crate.</p>

      <pch-card class="card">
        @if (providers.has('google')) {
          <button
            matButton="tonal"
            type="button"
            [disabled]="busy()"
            (click)="run(signInWithGoogle)"
          >
            Continue with Google
          </button>
        }
        @if (providers.has('apple')) {
          <button
            matButton="tonal"
            type="button"
            [disabled]="busy()"
            (click)="run(signInWithApple)"
          >
            Continue with Apple
          </button>
        }
        @if (providers.has('email')) {
          <form class="email" (submit)="$event.preventDefault(); submitEmail()">
            @if (creating()) {
              <mat-form-field appearance="outline">
                <mat-label>Display name</mat-label>
                <input
                  matInput
                  name="name"
                  autocomplete="name"
                  autocapitalize="words"
                  [value]="name()"
                  (input)="name.set($any($event.target).value)"
                />
              </mat-form-field>
            }
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input
                matInput
                type="email"
                name="email"
                autocomplete="email"
                autocapitalize="off"
                spellcheck="false"
                [value]="email()"
                (input)="email.set($any($event.target).value)"
              />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input
                matInput
                type="password"
                name="password"
                [attr.autocomplete]="creating() ? 'new-password' : 'current-password'"
                [value]="password()"
                (input)="password.set($any($event.target).value)"
              />
            </mat-form-field>
            <button matButton="filled" type="submit" [disabled]="busy()">
              {{ creating() ? 'Create account' : 'Sign in' }}
            </button>
            <button matButton="text" type="button" [disabled]="busy()" (click)="toggleMode()">
              {{ creating() ? 'Have an account? Sign in' : 'New here? Create an account' }}
            </button>
          </form>
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
    .card .material-symbols-rounded {
      margin-inline-end: 8px;
      font-size: 22px;
    }
    .email {
      display: flex;
      flex-direction: column;
      margin-top: 16px;
    }
    .email > button[type='submit'] {
      margin-top: 4px;
    }
  `,
})
export class SignInPage {
  private readonly state = inject(AppState);
  private readonly auth: AuthService = this.state.auth;

  protected readonly providers = this.auth.availableProviders;
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly name = signal('');

  protected readonly signInWithGoogle = (a: AuthService) => a.signInWithGoogle();
  protected readonly signInWithApple = (a: AuthService) => a.signInWithApple();

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

  protected async run(action: (auth: AuthService) => Promise<AuthUser>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action(this.auth);
    } catch (e) {
      this.state.toast(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected submitEmail(): Promise<void> {
    return this.run((a) =>
      this.creating()
        ? a.registerWithEmail(this.email(), this.password(), this.name())
        : a.signInWithEmail(this.email(), this.password()),
    );
  }

  protected toggleMode(): void {
    this.creating.update((c) => !c);
  }
}
