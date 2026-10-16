# CI / CD

All pipelines live in `.github/workflows/` and use the Node version in
`.nvmrc` (24).

## ci.yml (every push to `main`, every PR)

1. `quality`: Prettier check, ESLint (`ng lint`), TypeScript type-check of
   app and specs, unit tests with coverage (`ng test`, Vitest). Coverage is
   uploaded as an artifact.
2. `firestore`: starts the Firestore emulator (`firebase emulators:exec`,
   Java 21) and runs the repository contract tests and the application
   lifecycle suite against it (`npm run test:firestore`).
3. `build`: production build of the demo, plus the Firebase configuration
   to prove it compiles. The demo build is kept as an artifact for 7 days.
4. `e2e`: Playwright journeys (phone and desktop viewports) against the
   production build served with an SPA fallback and the service worker on.

No secrets are needed for CI.

## pages.yml (GitHub Pages demo)

Every push to `main` or `feat/**` builds the demo with the repository's
base href and force-pushes it to the `gh-pages` branch, with `404.html`
copied from `index.html` so deep links reach the Angular router. Enable it
once under Settings → Pages → Deploy from a branch → `gh-pages`, root.

## deploy-web.yml (Firebase Hosting)

* Push to `main` → production build → live channel, then Firestore rules
  and indexes are deployed.
* Pull request from this repo → preview channel (7-day expiry), URL
  commented on the PR.

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | JSON key for a service account with **Firebase Hosting Admin**, **Firebase Rules Admin** and **Cloud Datastore Index Admin** (the Firebase CLI `firebase init hosting:github` creates one with the first) |
| `FIREBASE_PROJECT_ID` | e.g. `peaches-prod` |

`firebase.json` serves `dist/peaches/browser` as a single-page app. Hashed
JS, CSS and font files are cached for a year; `index.html`, the service
worker scripts, `ngsw.json` and the manifest are always revalidated so a
deploy reaches installed apps on their next launch.

## Releasing a version

There is no store release any more: merging to `main` deploys. Installed
copies of the PWA download the new version in the background and show
"A new version of Peaches is ready — Reload". Bump `version` in
`package.json` for a user-visible release; it is shown on the Profile page.

## Firebase (Auth + Firestore) in the app

One-time setup, in order:

1. Create the Firebase project and enable **Authentication** providers:
   Google, Apple, Email/Password. Enable **Firestore**.
2. Register a **Web app** (Project settings → Your apps) and copy its
   config object into `src/app/data/firebase/firebase-config.ts` (the API
   key is not a secret; it ships to browsers). The placeholder values there
   make the app refuse to start the Firebase backend until replaced.
3. Add your Hosting domains (and `localhost` for development) under
   Authentication → Settings → Authorized domains.
4. Deploy rules and indexes: `npx firebase deploy --only firestore`.
   `deploy-web.yml` also does this on every push to `main`.
5. Apple sign-in: configure the Services ID, key and return URL in the
   Apple developer portal and in the Firebase console's Apple provider.
6. Set the `PEACHES_BACKEND` repository variable to `firebase` so
   `deploy-web.yml` builds against Firebase instead of the demo. Locally:
   `npm run build:firebase`.

Sign-in uses popups, falling back to a full-page redirect where popups are
blocked (common in installed iOS PWAs).

Local emulators: `npx firebase emulators:start` (Auth 9099, Firestore 8080,
Hosting 5000; see `firebase.json`) then `npm run start:emulator`.

## Not yet wired

* Crash reporting and analytics.
* Web push notifications for "your round is open" (the service worker is
  ready for it; it needs Firebase Cloud Messaging and a sender).

There is deliberately no server component (no Cloud Functions, no Cloud
Run): the app runs entirely on the client against Firestore.
