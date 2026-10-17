# Peaches

A social fitness app! Every user is a **Peach**. Peaches log any workout
they do, solo, and belong to **Crates** (groups). Each Crate runs a
fantasy-football style **Season**: every week Peaches are paired in
head-to-head **Matchups**, and whoever's workouts that week earn more points
wins. Before each week Peaches set a **lineup**: pledges in a few categories,
which earn a bonus when hit and a battle against their opponent. Crate
members vote on the rules (what miles run, weight moved, reps and active
minutes are worth, and how lineups score), see every exercise their
crate-mates log, and can dispute dubious numbers by majority vote. The log
screen times the session itself, so logging is a few taps.

Built as an installable **Progressive Web App** with Angular 22 and Angular
Material (Material 3), on a pure-TypeScript domain core that is unit tested
independently of the UI. It works offline, installs to the home screen on
Android, iOS and desktop, and updates itself in the background.

## Status

| Area | State |
| --- | --- |
| Domain models and JSON | Done, tested |
| Exercise catalog (440 exercises) | Done, tested |
| Solo logging with a session clock, editable after, category scoring, plausibility checks | Done, tested |
| Weekly round-robin seasons, lineups (pledges and battles), rules voting, standings | Done, tested |
| Exercises shared with Crates as they are logged; disputes by majority vote | Done, tested |
| Angular UI (Material 3, light/dark, adaptive layout) | Done, unit + end-to-end tested |
| PWA (manifest, service worker, offline, install, update prompts) | Done |
| Persistence | In-memory demo backend and Firestore repositories (contract- and rules-tested on the Firestore emulator) |
| Auth | Firebase Auth (Google, Apple, email) behind an `AuthService`; demo mode auto-signs in |
| CI (format, lint, type-check, unit, emulator, e2e, builds) | Done |
| CD (Firebase Hosting with PR previews) | Workflows done; Hosting needs two secrets (`scripts/setup-ci.sh`) |

## Hosting

The app is served from Firebase Hosting only: every push to `main` deploys
the Firebase build to `https://<project-id>.web.app`, and every pull request
gets a 7-day preview channel (see [docs/RELEASING.md](docs/RELEASING.md)).

## Run it

Requires Node 24 (see `.nvmrc`).

```bash
npm ci
npm start                    # http://localhost:4200, seeded demo
```

The app starts in demo mode with a seeded Crate in the third week of a
Season, so there is a matchup to win on the Today tab straight away. The
demo runs entirely in the browser; nothing is saved between visits. Add
`?demo=signed-out` to the URL to start on the sign-in screen.

To run on Firebase, put your
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
npm run test:firestore       # Firestore contract, lifecycle and rules tests (needs Java)
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
docs/            architecture, scoring, decisions, releasing
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model,
[docs/SCORING.md](docs/SCORING.md) for how workouts become points,
[docs/DECISIONS.md](docs/DECISIONS.md) for product
decisions, and [docs/RELEASING.md](docs/RELEASING.md) for the CI/CD
pipelines and the secrets they need.
