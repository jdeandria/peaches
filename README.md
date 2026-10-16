# Peaches

A social fitness app. Every user is a **Peach**. Peaches join **Crates**
(groups) and log workouts. On pre-agreed exercise days a Crate runs a
fantasy-football style **Season**: the app generates a workout for each
head-to-head **Matchup**, both Peaches do the same session, and the one
who executes it more completely wins the round.

Built as an installable **Progressive Web App** with Angular 22 and Angular
Material (Material 3), on a pure-TypeScript domain core that is unit tested
independently of the UI. It works offline, installs to the home screen on
Android, iOS and desktop, and updates itself in the background.

## Status

| Area | State |
| --- | --- |
| Domain models and JSON | Done, tested |
| Exercise catalog (440 exercises) | Done, tested |
| Workout generation engine | Done, tested, deterministic |
| Round-robin seasons, scoring, standings | Done, tested |
| Angular UI (Material 3, light/dark, adaptive layout) | Done, unit + end-to-end tested |
| PWA (manifest, service worker, offline, install, update prompts) | Done |
| Persistence | In-memory demo backend and Firestore repositories (contract-tested on the Firestore emulator) |
| Auth | Firebase Auth (Google, Apple, email) behind an `AuthService`; demo mode auto-signs in |
| CI (format, lint, type-check, unit, emulator, e2e, builds) | Done |
| CD (Firebase Hosting, GitHub Pages demo) | Workflows done; Hosting needs secrets |

## Live demo

Every push to `main` or a `feat/**` branch publishes the demo build to the
`gh-pages` branch (see `.github/workflows/pages.yml`). Once Pages is enabled
(Settings → Pages → Deploy from a branch → `gh-pages`, root) it is served at
**https://jdeandria.github.io/peaches/**. The demo runs entirely in the
browser with seeded data; nothing is saved between visits. Add
`?demo=signed-out` to the URL to start on the sign-in screen.

## Run it

Requires Node 24 (see `.nvmrc`).

```bash
npm ci
npm start                    # http://localhost:4200, seeded demo
```

The app starts in demo mode with a seeded Crate mid-season, so there is
something to do on the Today tab straight away. To run on Firebase, put your
web app config in `src/app/data/firebase/firebase-config.ts` and build with
`npm run build:firebase` (see docs/RELEASING.md). `npm run start:emulator`
runs against `firebase emulators:start` on this machine.

The service worker is only active in production builds; to try offline and
install locally, `npm run build` and serve `dist/peaches/browser` (for
example `node e2e/serve.mjs dist/peaches/browser 4300`).

## Test it

```bash
npm run format:check
npm run lint
npm test -- --watch=false    # unit tests (Vitest)
npm run test:firestore       # Firestore contract + lifecycle tests (needs Java)
npm run e2e                  # Playwright journeys against the production build
npm run icons:check          # the subset icon font covers every icon used
```

Icons come from a subset of Material Symbols Rounded (a few KB instead of
5 MB, so it is precached for offline use). After using a new icon, run
`npm run icons` (needs Python with `pip install fonttools brotli`) and
commit the regenerated `src/assets/fonts/` files; CI fails until you do.

## Layout

```
src/app/
  domain/        pure TypeScript: models, exercise catalog, services (no Angular)
  application/   use cases, auth boundary, composition root (no Angular)
  data/          in-memory and Firestore repositories, Firebase auth, time zones, demo seeder
  state/         Angular glue: DI tokens, AppState signals, guards, PWA service
  ui/            theme, Expressive components, layout primitives, shell and pages
                 (see src/app/ui/README.md for the component catalogue)
src/environments/ demo (default), firebase and emulator build configurations
src/testing/     the lifecycle suite shared by both backends, TestBed helpers
scripts/         theme palette generator, icon font subsetter
e2e/             Playwright journeys
docs/            architecture, workout engine, decisions, releasing
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model,
[docs/WORKOUT_ENGINE.md](docs/WORKOUT_ENGINE.md) for how workouts are
generated and scored, [docs/DECISIONS.md](docs/DECISIONS.md) for product
decisions, and [docs/RELEASING.md](docs/RELEASING.md) for the CI/CD
pipelines and the secrets they need.
