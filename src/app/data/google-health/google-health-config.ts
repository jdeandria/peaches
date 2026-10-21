/**
 * The OAuth client Peaches reads Google Health with.
 *
 * Create it in the Google Cloud console of the Firebase project: enable
 * the Google Health API, then APIs & Services → Credentials → Create OAuth
 * client ID → Web application, with the Hosting domains (and
 * `http://localhost:4200` for development) as authorized JavaScript
 * origins. Like the Firebase config, the client id is not a secret, so the
 * file is committed. See docs/RELEASING.md.
 *
 * While it is empty, Firebase builds offer no heart rate tracking.
 */
export const googleHealthClientId = '';

export function isGoogleHealthConfigured(clientId: string): boolean {
  return /^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId);
}
