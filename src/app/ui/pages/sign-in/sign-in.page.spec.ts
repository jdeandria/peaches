import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';

import { App } from '../../../app';
import { routes } from '../../../app.routes';
import { AuthProvider, AuthService, AuthUser } from '../../../application/auth-service';
import { DomainError } from '../../../application/errors';
import { AUTH_SERVICE } from '../../../state/tokens';
import { seededBackend, settle, TestBackend } from '../../../../testing/test-app';
import { SignInPage } from './sign-in.page';

/** An auth service that starts signed out and signs in with Google. */
class FakeAuth implements AuthService {
  private readonly state = new BehaviorSubject<AuthUser | null>(null);
  readonly authState = this.state.asObservable();
  attempts = 0;
  /** Rejects the next sign-in with this message. */
  failNext: string | null = null;
  /** When set, sign-in waits for this before finishing. */
  gate: Promise<void> | null = null;

  constructor(readonly availableProviders: ReadonlySet<AuthProvider> = new Set(['google'])) {}

  get currentUser(): AuthUser | null {
    return this.state.value;
  }

  async signInWithGoogle(): Promise<AuthUser> {
    this.attempts++;
    if (this.gate) await this.gate;
    const failure = this.failNext;
    this.failNext = null;
    if (failure) throw new DomainError(failure);
    const user: AuthUser = {
      id: 'u1',
      email: 'uma@example.com',
      displayName: 'Uma',
      photoUrl: null,
    };
    this.state.next(user);
    return user;
  }

  async signOut(): Promise<void> {
    this.state.next(null);
  }
}

describe('SignInPage', () => {
  let backend: TestBackend;
  let auth: FakeAuth;

  async function setUp(fake = new FakeAuth()) {
    auth = fake;
    backend = await seededBackend({ seed: false, signedIn: false });
    TestBed.configureTestingModule({
      providers: [...backend.providers, { provide: AUTH_SERVICE, useValue: auth }],
    });
  }

  async function stable(f: ComponentFixture<unknown>): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await settle();
      await f.whenStable();
    }
  }

  const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim();
  const button = (root: ParentNode, name: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => text(b.querySelector('.mdc-button__label')) === name,
    );
  const buttons = (root: ParentNode) =>
    Array.from(root.querySelectorAll('button .mdc-button__label')).map(text);

  it('shows the brand and only Google sign-in', async () => {
    await setUp();
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Peaches');
    expect(text(el)).toContain('Log workouts. Compete with your Crate.');
    expect(buttons(el)).toEqual(['Continue with Google']);
    expect(el.querySelectorAll('input')).toHaveLength(0);
  });

  it('offers nothing when no provider is available', async () => {
    await setUp(new FakeAuth(new Set()));
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    expect(buttons(f.nativeElement)).toEqual([]);
  });

  it('shows sign-in errors and disables the button while busy', async () => {
    await setUp();
    let open!: () => void;
    auth.gate = new Promise((resolve) => (open = resolve));
    auth.failNext = 'Sign in cancelled.';
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    button(el, 'Continue with Google')!.click();
    await stable(f);
    expect(button(el, 'Continue with Google')!.disabled).toBe(true);
    open();
    await stable(f);
    expect(document.body.textContent).toContain('Sign in cancelled.');
    expect(auth.attempts).toBe(1);
    expect(button(el, 'Continue with Google')!.disabled).toBe(false);
  });

  it('toasts a failed redirect sign-in', async () => {
    const fake = Object.assign(new FakeAuth(), {
      redirectResult: Promise.reject(new DomainError('Sign-in was cancelled.')),
    });
    fake.redirectResult.catch(() => undefined);
    await setUp(fake);
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    expect(document.body.textContent).toContain('Sign-in was cancelled.');
  });
});

/** The app-level sign-in journey: sign in, land on Train, sign out. */
describe('Sign-in journey', () => {
  it('signed-out users see sign in; signing in creates a Peach', async () => {
    const auth = new FakeAuth();
    const backend = await seededBackend({ seed: false, signedIn: false });
    TestBed.configureTestingModule({
      providers: [
        ...backend.providers,
        { provide: AUTH_SERVICE, useValue: auth },
        provideRouter(routes),
        provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ],
    });
    const f = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const stable = async () => {
      for (let i = 0; i < 6; i++) {
        await settle(5);
        await f.whenStable();
      }
    };
    await router.navigateByUrl('/');
    await stable();
    const el: HTMLElement = f.nativeElement;
    expect(router.url).toBe('/sign-in');
    const signIn = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => b.textContent?.trim() === 'Continue with Google',
      )!;
    expect(signIn()).toBeDefined();
    expect(el.querySelector('h1')?.textContent).toBe('Peaches');

    auth.failNext = 'Sign in cancelled.';
    signIn().click();
    await stable();
    expect(document.body.textContent).toContain('Sign in cancelled.');
    expect(router.url).toBe('/sign-in');

    signIn().click();
    await stable();
    expect(auth.attempts).toBe(2);
    expect(router.url).toBe('/');
    expect(el.querySelector('h1')?.textContent).toBe('Plan');
    const peach = await backend.container.peaches.getById('u1');
    expect(peach?.displayName).toBe('Uma');
    expect(peach?.email).toBe('uma@example.com');

    // Signing out returns to the sign-in page.
    await auth.signOut();
    await stable();
    expect(router.url).toBe('/sign-in');
    expect(signIn()).toBeDefined();
  });
});
