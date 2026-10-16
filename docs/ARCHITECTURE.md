# Architecture

## Layers

```
ui (Angular components)  ──►  state (signals, DI)  ──►  application  ──►  domain
                                                            ▲               ▲
                                        data (repositories) ┴───────────────┘
```

* **domain** is plain TypeScript with no framework imports (RxJS appears only
  as the `Observable` type on repository `watch*` methods). It holds
  models, the exercise catalog and the services that do the thinking:
  turning logs into points, tallying votes, scheduling, standings. Nothing
  here knows about Angular
  or a database, which is why it is where most tests live.
* **application** holds use cases (`CrateService`, `SeasonService`,
  `LoggingService`, `VotingService`, `LibraryService`, `SessionService`), the
  `AuthService` boundary with a `DemoAuthService`, and `AppContainer`, the
  single composition root. Also framework-free.
* **data** implements the repository interfaces twice: in memory (demo
  mode, tests) and on Firestore with the Firebase JS SDK. `startBackend` in
  `state/backend.ts` is the only place that knows which is which; the
  Firebase SDK is loaded lazily so the demo build never downloads it. The
  Firestore repositories are contract-tested against the Firestore emulator,
  and the whole application-level lifecycle suite (`src/testing/`) runs
  against both backends.
* **state** is the Angular glue: injection tokens for the container, auth
  and clock; `AppState`, which exposes the signed-in Peach's live data as
  signals and gives components `query()` (one-shot, refetched after every
  mutation) and `watch()` (live stream) helpers; router guards; and the
  `Pwa` service (update and install prompts).
* **ui** is Angular Material (M3) plus in-house Material 3 Expressive
  components. Pages read `AppState` and call services; they never touch
  repositories directly.

### Conventions

* Enums are string unions backed by `as const` lists, and their strings are
  the stored names, so documents stay readable as enums are added.
* Models are readonly interfaces with free functions for derived values
  (`isBye(m)`, `totalReps(e)`) and `xxxFromJson` / `xxxToJson` for
  storage. Instants are `Date`; calendar dates are `LocalDate`, a branded
  `yyyy-MM-dd` string that compares with `===` and sorts with `<`.
* Randomness that two devices must agree on uses `SeededRandom`
  (mulberry32) seeded from `stableHash` (FNV-1a), never `Math.random`.

## Data model

```
Exercise (catalog, versioned, shipped)
Peach ──< WorkoutLog (private; shared on submit) ──> copies under each Crate
  │
  └──< CrateMembership >── Crate ──< Season ──< Round (a week) ──< Matchup
                             ├──< RateBallot (one per member)
                             └──< LibraryEntry, CustomExercise, Routine
```

| Entity | Identity | Notes |
| --- | --- | --- |
| `Peach` | `id` | Global profile: time zone, units. |
| `Exercise` | slug `id` | Reference data. Classified by movement pattern, muscles, equipment, modality, measurement, difficulty, MET. `distanceKindOf` says which distance category it scores. |
| `Crate` | `id` | Group with `inviteCode`, time zone and `CrateSettings` (the grace period). |
| `CrateMembership` | `(crateId, peachId)` | Role and status. A Peach can be in many Crates. |
| `RateBallot` | `(crateId, peachId)` | A member's split of 100 points across the scoring categories. |
| `LibraryEntry` | `(crateId, exerciseId)` | A catalog exercise a member added to the Crate's library. |
| `CustomExercise` | `(crateId, id)` | A made-up exercise: name, how it is logged (reps, time or distance), whether it takes a load, which distance it counts as. Ids start `custom-`. |
| `Routine` | `(crateId, id)` | A named list of exercises with per-set targets, to start a log from. |
| `Season` | `id` | A tournament: a start Monday and a number of weeks, frozen `participantIds` and frozen category `weights`. |
| `Round` | `id` | One week (`weekStart`, a Monday in the Crate's zone). |
| `Matchup` | `id` | Home vs away for a week (away null = bye). Holds the `MatchupResult` once the week closes. |
| `WorkoutLog` | `id` | What a Peach did: entries per exercise (with the exercise's name and distance kind copied in), sets, session length, notes. Belongs to the Peach; `sharedWith` lists the Crates it was shared with on submit. |

Derived, never stored: category totals and points, live matchup scores,
the Crate's current weights (the tally of ballots), standings.

### Decisions worth knowing

* **Calendar dates are a value type (`LocalDate`)**, not `DateTime`, so a
  matchup week cannot drift across zones. Conversion happens at the edge
  using the Crate's time zone.
* **Logs belong to the Peach, not to a Crate or Matchup.** One log counts
  in every Crate the Peach is in, each Crate scoring it with its own
  weights. Matchups find their logs by Crate and week.
* **Scoring is raw totals per category**, weighted by the Crate's vote (see
  [SCORING.md](SCORING.md)).
* **Weights are frozen per Season**, so votes never re-score past weeks.
* **Standings are recomputed from matchups**, so they can never disagree
  with results.
* **Hand-written JSON**, no decorators or code generation: the domain stays
  plain TypeScript and the stored shape is explicit.

## Firestore layout

Each repository method maps onto one indexed query.

```
peaches/{peachId}
crates/{crateId}
crates/{crateId}/memberships/{peachId}        (+ collectionGroup on peachId)
crates/{crateId}/logs/{logId}                 (copies of submitted logs; range on startedAt)
crates/{crateId}/ballots/{peachId}
crates/{crateId}/library/{exerciseId}
crates/{crateId}/customExercises/{id}
crates/{crateId}/routines/{id}
seasons/{seasonId}                            (crateId field, indexed)
seasons/{seasonId}/rounds/{roundId}
seasons/{seasonId}/matchups/{matchupId}       (peachIds, weekStart; collectionGroup)
workoutLogs/{logId}                           (peachId)
```

Matchup documents carry denormalised `peachIds` and `weekStart` fields so
"my matchups" is a single collection-group query. A Peach's own
`workoutLogs` (drafts included) are readable only by them; submitting
writes the log and a copy under each Crate it is shared with in one batch,
and Crate members read those copies to score matchups and show activity.
`firestore.rules` follows membership: a Peach reads a Crate's Seasons,
shared logs, ballots and library only while their membership is active;
shared copies are written only by their Peach, only once submitted, and
never change; a member writes only their own ballot; library items are
removed by whoever added them or an owner/admin; only owners/admins write
schedules, and nobody changes a Season's participants or weights.
`src/app/data/firestore/firestore-rules.spec.ts` tests these rules on the
emulator.

### No server

Everything runs on the client against Firestore; there are no Cloud
Functions or Cloud Run services. Weeks open and close when any member's
device notices they are due (`syncPeach` on launch, on refresh, and when
the installed app returns to the foreground). That is safe because the work
is idempotent and convergent:

* opening a week only marks it and its matchups open;
* closing scores the logs shared with the Crate in that week with a pure
  function and the Season's frozen weights, so two devices closing the same
  week write identical results;
* security rules let any active member advance round, matchup and season
  state but never change who plays whom, when, or what counts.

The trade-off is trust: a member could hand-edit results through the API.
That matches the honour-system decision; if it ever matters, the
scoring step is the one piece that would move server-side.
