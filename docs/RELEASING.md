# CI / CD

All pipelines live in `.github/workflows/` and use the Node version in
`.nvmrc` (24). Credentials live in repository secrets.

| Workflow | Runs on | What it does |
| --- | --- | --- |
| `ci.yml` | every push except `main` (and fork PRs) | Format, lint, type-check, unit tests, Firestore emulator tests, builds, end-to-end journeys |
| `deploy.yml` | push to `main`, manual run | Runs CI, then deploys the Firebase build to Hosting plus Firestore rules and indexes |
| `preview.yml` | pull requests | Deploys a 7-day Hosting preview channel and comments its URL on the PR |

## ci.yml

1. `quality`: Prettier check, ESLint (`ng lint`), TypeScript type-check of
   app and specs, unit tests with coverage (`npm run test:ci`, Vitest).
   Coverage is uploaded as an artifact.
2. `firestore`: starts the Firestore emulator (`firebase emulators:exec`,
   Java 21) and runs the repository contract tests and the application
   lifecycle suite against it (`npm run test:firestore`).
3. `build`: production build of the demo, plus the Firebase configuration
   to prove it compiles. The demo build is kept as an artifact for 7 days.
4. `e2e`: Playwright journeys (phone and desktop viewports) against the
   production build served with an SPA fallback and the service worker on.

Branches in this repository are verified by their pushes, so a pull request
from one does not run CI twice; pull requests from forks run it on the
`pull_request` event. `main` is verified by `deploy.yml`, which calls this
workflow before it deploys. No secrets are needed for CI.

## Continuous deployment (deploy.yml, preview.yml)

* Push to `main` → CI → `npm run firebase:config` → `npm run build:firebase`
  → `firebase deploy --only hosting,firestore`. Deploys run one at a time
  in a GitHub environment named `production`; add required reviewers there
  to approve each deploy.
* Pull request from this repository → Firebase build → preview channel
  (7-day expiry), URL commented on the PR. Skipped until
  `FIREBASE_SERVICE_ACCOUNT` is set.

### One-time setup

Add two **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | JSON key of a service account that can deploy (roles below) |
| `FIREBASE_WEB_CONFIG` | The web app config as JSON, e.g. `{"apiKey":"…","authDomain":"…","projectId":"…","appId":"…"}` |

The fastest way is the setup script. It needs `gcloud`, `gh` and `node`,
all signed in:

```bash
scripts/setup-ci.sh <firebase-project-id>
```

It creates a `github-deploy` service account with only these roles, then
saves both secrets:

* Firebase Hosting Admin
* Firebase Rules Admin
* Cloud Datastore Index Admin
* Service Usage Consumer
* API Keys Viewer

To do it by hand instead:

1. In Google Cloud console → IAM → Service accounts, create an account with
   those roles.
2. Create a JSON key for it and paste the whole file into
   `FIREBASE_SERVICE_ACCOUNT`.
3. Copy the `firebaseConfig` object from Firebase console → Project
   settings → Your apps into `FIREBASE_WEB_CONFIG`, quoting the keys so it
   is valid JSON.

`npm run firebase:config` writes `FIREBASE_WEB_CONFIG` into the
`firebaseConfig` object in `src/app/data/firebase/firebase-config.ts` at
build time and reads the project id from it, so `.firebaserc` doesn't need
editing for CI. The secret is optional if you commit your real config to
that file instead; without either, the deploy fails rather than shipping a
build that cannot start. The values are public by design; access is
enforced by `firestore.rules`.

Notes:

* **Sign-in on previews:** sign-in only works on authorized domains. Add a
  preview's domain (`<project>--pr-…web.app`) under Authentication →
  Settings → Authorized domains to sign in there.
* **Keyless option:** if your organization blocks service account keys, use
  [Workload Identity Federation](https://github.com/google-github-actions/auth)
  instead and drop the key secret.

### Hosting

`firebase.json` serves `dist/peaches/browser` as a single-page app. Hashed
JS, CSS and font files are cached for a year; `index.html`, the service
worker scripts, `ngsw.json` and the manifest are always revalidated so a
deploy reaches installed apps on their next launch. Every response also
carries `X-Content-Type-Options: nosniff`, a
`strict-origin-when-cross-origin` referrer policy and
`Cross-Origin-Opener-Policy: same-origin-allow-popups` (which keeps popup
sign-in working).

## Releasing a version

There is no store release any more: merging to `main` deploys. Installed
copies of the PWA download the new version in the background and show
"A new version of Peaches is ready — Reload". Bump `version` in
`package.json` for a user-visible release; it is shown on the Profile page.

## Firebase (Auth + Firestore) in the app

One-time setup, in order:

1. Create the Firebase project and enable **Authentication** providers:
   Google, Apple, Email/Password. Enable **Firestore**.
2. Register a **Web app** (Project settings → Your apps). CI injects its
   config from the `FIREBASE_WEB_CONFIG` secret; for local Firebase builds,
   copy it into `src/app/data/firebase/firebase-config.ts` (the API key is
   not a secret; it ships to browsers). The placeholder values there make
   the app refuse to start the Firebase backend until replaced.
3. Add your Hosting domains (and `localhost` for development) under
   Authentication → Settings → Authorized domains.
4. Deploy rules and indexes: `npx firebase deploy --only firestore`.
   `deploy.yml` also does this on every push to `main`.
5. Apple sign-in: configure the Services ID, key and return URL in the
   Apple developer portal and in the Firebase console's Apple provider.
6. Set up continuous deployment (above). Locally, `npm run build:firebase`
   builds against Firebase and `npm run deploy` builds and deploys
   (set your project id in `.firebaserc` first).

Sign-in uses popups, falling back to a full-page redirect where popups are
blocked (common in installed iOS PWAs).

Local emulators: `npx firebase emulators:start` (Auth 9099, Firestore 8080,
Hosting 5000; see `firebase.json`) then `npm run start:emulator`.

## Google Health (heart rate) in the app

Heart rate tracking is off on Firebase builds until an OAuth client is
configured. One-time setup, in the Google Cloud project behind the
Firebase project:

1. APIs & Services → Library → enable the **Google Health API**.
2. OAuth consent screen (Google Auth Platform): add the scope
   `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`.
   It is a **restricted** scope: until the app passes Google's verification
   (and, past 100 users, its annual security assessment), only the test
   users listed there can connect.
3. Credentials → Create OAuth client ID → **Web application**. Add every
   Hosting domain (`https://<project-id>.web.app`, custom domains, any
   preview channels to try it on) and `http://localhost:4200` as
   **authorized JavaScript origins**. No redirect URI is needed.
4. Put the client id in `src/app/data/google-health/google-health-config.ts`
   and commit it (like the Firebase config, it is not a secret).

The app loads `https://accounts.google.com/gsi/client` and calls
`https://health.googleapis.com` from the browser; keep both allowed if a
Content-Security-Policy is ever added. Hosting already sends
`Cross-Origin-Opener-Policy: same-origin-allow-popups`, which the Google
window needs.

## Not yet wired

* Crash reporting and analytics.
* Web push notifications for "your round is open" (the service worker is
  ready for it; it needs Firebase Cloud Messaging and a sender).

There is deliberately no server component (no Cloud Functions, no Cloud
Run): the app runs entirely on the client against Firestore.
