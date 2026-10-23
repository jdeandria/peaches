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

/** An auth service that starts signed out and signs in with email only. */
class FakeAuth implements AuthService {
  private readonly state = new BehaviorSubject<AuthUser | null>(null);
  readonly authState = this.state.asObservable();
  emailAttempts = 0;
  registered: string[] = [];
  /** When set, sign-in waits for this before finishing. */
  gate: Promise<void> | null = null;

  constructor(readonly availableProviders: ReadonlySet<AuthProvider> = new Set(['email'])) {}

  get currentUser(): AuthUser | null {
    return this.state.value;
  }

  signInWithGoogle(): Promise<AuthUser> {
    throw new Error('unimplemented');
  }

  signInWithApple(): Promise<AuthUser> {
    throw new Error('unimplemented');
  }

  async signInWithEmail(email: string, password: string): Promise<AuthUser> {
    this.emailAttempts++;
    if (this.gate) await this.gate;
    if (password !== 'secret') throw new DomainError('Email or password is incorrect.');
    const user: AuthUser = { id: 'u1', email, displayName: 'Uma', photoUrl: null };
    this.state.next(user);
    return user;
  }

  async registerWithEmail(email: string, password: string, displayName: string) {
    this.registered.push(displayName);
    return this.signInWithEmail(email, password);
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
  const fields = (root: ParentNode) => Array.from(root.querySelectorAll<HTMLInputElement>('input'));
  const labels = (root: ParentNode) => Array.from(root.querySelectorAll('mat-label')).map(text);
  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('shows the brand and only the providers on offer', async () => {
    await setUp();
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    expect(text(el.querySelector('h1'))).toBe('Peaches');
    expect(text(el)).toContain('Log workouts. Compete with your Crate.');
    expect(button(el, 'Continue with Google')).toBeUndefined();
    expect(button(el, 'Continue with Apple')).toBeUndefined();
    expect(labels(el)).toEqual(['Email', 'Password']);
    expect(button(el, 'Sign in')).toBeDefined();
  });

  it('offers Google and Apple when available', async () => {
    await setUp(new FakeAuth(new Set<AuthProvider>(['google', 'apple'])));
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    expect(button(el, 'Continue with Google')).toBeDefined();
    expect(button(el, 'Continue with Apple')).toBeDefined();
    expect(fields(el)).toHaveLength(0);
  });

  it('shows sign-in errors and disables buttons while busy', async () => {
    await setUp();
    let open!: () => void;
    auth.gate = new Promise((resolve) => (open = resolve));
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    const [email, password] = fields(el);
    type(email, 'uma@example.com');
    type(password, 'wrong');
    button(el, 'Sign in')!.click();
    await stable(f);
    expect(button(el, 'Sign in')!.disabled).toBe(true);
    expect(button(el, 'New here? Create an account')!.disabled).toBe(true);
    open();
    await stable(f);
    expect(document.body.textContent).toContain('Email or password is incorrect.');
    expect(auth.emailAttempts).toBe(1);
    expect(button(el, 'Sign in')!.disabled).toBe(false);
  });

  it('creates an account with a display name', async () => {
    await setUp();
    const f = TestBed.createComponent(SignInPage);
    await stable(f);
    const el: HTMLElement = f.nativeElement;
    button(el, 'New here? Create an account')!.click();
    await stable(f);
    expect(labels(el)).toEqual(['Display name', 'Email', 'Password']);
    expect(button(el, 'Have an account? Sign in')).toBeDefined();
    const [name, email, password] = fields(el);
    type(name, 'Uma');
    type(email, 'uma@example.com');
    type(password, 'secret');
    // Enter in a field submits the form.
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await stable(f);
    expect(auth.registered).toEqual(['Uma']);
    expect(auth.currentUser?.email).toBe('uma@example.com');
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
        (b) => b.textContent?.trim() === 'Sign in',
      )!;
    expect(signIn()).toBeDefined();
    expect(el.querySelector('h1')?.textContent).toBe('Peaches');

    const [email, password] = Array.from(el.querySelectorAll<HTMLInputElement>('input'));
    email.value = 'uma@example.com';
    email.dispatchEvent(new Event('input'));
    password.value = 'wrong';
    password.dispatchEvent(new Event('input'));
    signIn().click();
    await stable();
    expect(document.body.textContent).toContain('Email or password is incorrect.');
    expect(auth.emailAttempts).toBe(1);

    password.value = 'secret';
    password.dispatchEvent(new Event('input'));
    signIn().click();
    await stable();
    expect(router.url).toBe('/');
    expect(el.querySelector('h1')?.textContent).toBe('Train');
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
