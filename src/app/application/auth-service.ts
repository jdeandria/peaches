import { BehaviorSubject, Observable } from 'rxjs';

/** A signed-in identity, independent of the auth provider. */
export interface AuthUser {
  readonly id: string;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly photoUrl: string | null;
}

export type AuthProvider = 'google' | 'apple' | 'email';

/**
 * Sign-in boundary. The Firebase implementation lives in the data layer;
 * demo mode uses {@link DemoAuthService}.
 *
 * Failures reject with a `DomainError` whose message can be shown as-is.
 */
export interface AuthService {
  /**
   * Emits the current user on subscribe (once known) and again on every
   * change. `undefined` means the state is still being restored.
   */
  readonly authState: Observable<AuthUser | null | undefined>;

  readonly currentUser: AuthUser | null;

  /** Providers to offer on the sign-in screen; empty when sign-out is impossible. */
  readonly availableProviders: ReadonlySet<AuthProvider>;

  signInWithGoogle(): Promise<AuthUser>;
  signInWithApple(): Promise<AuthUser>;
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  registerWithEmail(email: string, password: string, displayName: string): Promise<AuthUser>;
  signOut(): Promise<void>;
}

/**
 * Signs in as one fixed user; used by demo mode and tests.
 *
 * With `signedIn` false the demo starts on the sign-in screen and every
 * provider button signs in as `user`, which lets the sign-in flow be
 * exercised without a backend.
 */
export class DemoAuthService implements AuthService {
  private readonly state: BehaviorSubject<AuthUser | null>;

  constructor(
    readonly user: AuthUser,
    signedIn = true,
  ) {
    this.state = new BehaviorSubject<AuthUser | null>(signedIn ? user : null);
  }

  readonly authState = new Observable<AuthUser | null | undefined>((subscriber) =>
    this.state.subscribe(subscriber),
  );

  get currentUser(): AuthUser | null {
    return this.state.value;
  }

  get availableProviders(): ReadonlySet<AuthProvider> {
    return this.state.value === null
      ? new Set<AuthProvider>(['google', 'apple', 'email'])
      : new Set<AuthProvider>();
  }

  private async signIn(): Promise<AuthUser> {
    this.state.next(this.user);
    return this.user;
  }

  signInWithGoogle(): Promise<AuthUser> {
    return this.signIn();
  }

  signInWithApple(): Promise<AuthUser> {
    return this.signIn();
  }

  signInWithEmail(): Promise<AuthUser> {
    return this.signIn();
  }

  registerWithEmail(): Promise<AuthUser> {
    return this.signIn();
  }

  async signOut(): Promise<void> {
    this.state.next(null);
  }
}
