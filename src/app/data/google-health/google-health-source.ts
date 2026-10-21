import { DomainError } from '../../application/errors';
import { HeartRateAccessLost, HeartRateSource } from '../../application/heart-rate';
import { HeartRateWindow } from '../../domain/models/heart-rate';
import { GoogleHealthClient, HEART_RATE_SCOPE } from './google-health-client';

/** Google Identity Services, which hands browser apps OAuth access tokens. */
export const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

/** The slice of the Google Identity Services token model Peaches uses. */
export interface TokenResponse {
  readonly access_token?: string;
  readonly expires_in?: number | string;
  readonly error?: string;
}

export interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; login_hint?: string }): void;
}

export interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
  revoke(token: string, done?: () => void): void;
}

interface GoogleIdentityWindow {
  google?: { accounts?: { oauth2?: GoogleOAuth2 } };
}

let loading: Promise<GoogleOAuth2> | null = null;

/** Loads Google Identity Services once, on first use. */
export function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  const loaded = () => (window as GoogleIdentityWindow).google?.accounts?.oauth2;
  const ready = loaded();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.onload = () => {
      const oauth2 = loaded();
      if (oauth2) resolve(oauth2);
      else reject(new Error('Google Identity Services did not load'));
    };
    script.onerror = () => reject(new Error('Google Identity Services did not load'));
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    loading = null;
    console.error(err);
    throw new DomainError('Couldn’t reach Google. Check your connection.');
  });
  return loading;
}

/** Refresh access this long before Google says it expires. */
const EXPIRY_MARGIN_MS = 60_000;

/**
 * Heart rate from Google Health: whatever the Peach's Fitbit or Pixel Watch
 * (or anything else syncing to Google Health) recorded.
 *
 * There is no server, so access is a short-lived OAuth token from Google
 * Identity Services' token model, held in memory only, for read access to
 * health metrics alone. Tokens last about an hour; connecting again (one
 * tap, with no consent screen once allowed) gets a fresh one. Separate
 * from signing in, so it works however the Peach signed in.
 */
export class GoogleHealthHeartRateSource implements HeartRateSource {
  readonly name = 'Google Health';

  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly deps: {
      clientId: string;
      client?: GoogleHealthClient;
      identity?: () => Promise<GoogleOAuth2>;
      now?: () => Date;
    },
  ) {}

  private get client(): GoogleHealthClient {
    return (this.deps.client ??= new GoogleHealthClient());
  }

  private identity(): Promise<GoogleOAuth2> {
    return (this.deps.identity ?? loadGoogleIdentity)();
  }

  private now(): number {
    return (this.deps.now?.() ?? new Date()).getTime();
  }

  get connected(): boolean {
    return this.token !== null && this.now() < this.token.expiresAt - EXPIRY_MARGIN_MS;
  }

  async prepare(): Promise<void> {
    await this.identity();
  }

  async connect(hint?: string | null): Promise<void> {
    const oauth2 = await this.identity();
    const response = await new Promise<TokenResponse>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: this.deps.clientId,
        scope: HEART_RATE_SCOPE,
        callback: resolve,
        error_callback: (error) =>
          reject(
            new DomainError(
              error.type === 'popup_failed_to_open'
                ? 'Your browser blocked the Google window. Allow pop-ups and try again.'
                : 'Google Health wasn’t connected.',
            ),
          ),
      });
      // No consent screen when the Peach has already allowed it.
      client.requestAccessToken({ prompt: '', ...(hint ? { login_hint: hint } : {}) });
    });
    if (response.error || !response.access_token) {
      throw new DomainError('Google Health wasn’t connected.');
    }
    if (!oauth2.hasGrantedAllScopes(response, HEART_RATE_SCOPE)) {
      throw new DomainError('To track heart rate, allow Peaches to see your health metrics.');
    }
    const seconds = Number(response.expires_in) || 3600;
    this.token = { value: response.access_token, expiresAt: this.now() + seconds * 1000 };
  }

  async disconnect(): Promise<void> {
    const token = this.token?.value;
    this.token = null;
    if (!token) return;
    const oauth2 = await this.identity();
    await new Promise<void>((resolve) => oauth2.revoke(token, resolve));
  }

  async windows(from: Date, to: Date): Promise<HeartRateWindow[]> {
    if (!this.token || !this.connected) {
      this.token = null;
      throw new HeartRateAccessLost('Connect Google Health again to keep tracking heart rate.');
    }
    try {
      return await this.client.heartRateWindows(this.token.value, from, to);
    } catch (err) {
      if (err instanceof HeartRateAccessLost) this.token = null;
      throw err;
    }
  }
}
