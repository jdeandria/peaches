/**
 * {@link AuthService} on Firebase Auth with Google sign-in, for the web.
 *
 * Sign-in uses Firebase's popup flow. Browsers that block the popup
 * (notably installed PWAs on iOS) fall back to the redirect flow, whose
 * result is collected by {@link FirebaseAuthService.redirectResult} when
 * the app loads again.
 */
import { FirebaseError } from 'firebase/app';
import {
  Auth,
  AuthProvider as FirebaseAuthProvider,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { BehaviorSubject, Observable } from 'rxjs';

import { AuthProvider, AuthService, AuthUser } from '../../application/auth-service';
import { DomainError } from '../../application/errors';

const PROVIDERS: ReadonlySet<AuthProvider> = new Set<AuthProvider>(['google']);

export class FirebaseAuthService implements AuthService {
  /** `undefined` until Firebase has restored the persisted session. */
  private readonly state = new BehaviorSubject<AuthUser | null | undefined>(undefined);

  readonly authState: Observable<AuthUser | null | undefined> = this.state.asObservable();

  /**
   * Resolves with the user signed in by a redirect flow started on a
   * previous page load, or null when there was none. Rejects with a
   * {@link DomainError} when that sign-in failed, so the sign-in screen can
   * show why.
   */
  readonly redirectResult: Promise<AuthUser | null>;

  constructor(private readonly auth: Auth) {
    // The service lives as long as the app, so the listener is never removed.
    onAuthStateChanged(auth, (user) => this.state.next(toUser(user)));
    this.redirectResult = guard(async () => (await getRedirectResult(auth))?.user ?? null);
    // Mark as handled; callers that care await `redirectResult` themselves.
    this.redirectResult.catch(() => undefined);
  }

  get currentUser(): AuthUser | null {
    return toUser(this.auth.currentUser);
  }

  get availableProviders(): ReadonlySet<AuthProvider> {
    return PROVIDERS;
  }

  async signInWithGoogle(): Promise<AuthUser> {
    return requireUser(await guard(() => this.popupOrRedirect(new GoogleAuthProvider())));
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  /**
   * Signs in with a popup, or navigates away to the provider when the
   * browser blocks popups. In that case the returned promise never settles:
   * the page unloads and {@link redirectResult} picks up on return.
   */
  private async popupOrRedirect(provider: FirebaseAuthProvider): Promise<User> {
    try {
      return (await signInWithPopup(this.auth, provider)).user;
    } catch (e) {
      if (e instanceof FirebaseError && e.code === 'auth/popup-blocked') {
        return signInWithRedirect(this.auth, provider);
      }
      throw e;
    }
  }
}

function toUser(user: User | null): AuthUser | null {
  return user === null
    ? null
    : {
        id: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoUrl: user.photoURL,
      };
}

function requireUser(user: AuthUser | null): AuthUser {
  if (user === null) throw new DomainError('Sign in failed.');
  return user;
}

/** Runs a Firebase call, translating its errors into user-facing messages. */
async function guard(action: () => Promise<User | null>): Promise<AuthUser | null> {
  try {
    return toUser(await action());
  } catch (e) {
    if (e instanceof FirebaseError) throw new DomainError(authErrorMessage(e.code));
    throw e;
  }
}

/** A message fit to show the user for a Firebase Auth error code. */
export function authErrorMessage(code: string): string {
  switch (code.replace(/^auth\//, '')) {
    case 'user-disabled':
      return 'This account has been disabled.';
    case 'unauthorized-domain':
      // This site's domain is missing from Firebase console → Authentication
      // → Settings → Authorized domains.
      return `Sign in is not set up for ${globalThis.location?.hostname ?? 'this site'} yet.`;
    case 'popup-closed-by-user':
    case 'cancelled-popup-request':
    case 'user-cancelled':
      return 'Sign in cancelled.';
    case 'network-request-failed':
      return 'No network connection.';
    case 'too-many-requests':
      return 'Too many attempts. Try again later.';
    default:
      // Firebase's own messages ("Firebase: Error (auth/...).") are not
      // written for people, so only the code is shown.
      return `Sign in failed (${code}).`;
  }
}
