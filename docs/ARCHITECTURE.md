# Architecture

## Layers

```
presentation  ──►  application  ──►  domain
      │                 │               ▲
      └── Riverpod ─────┘               │
                        data (repositories) ──┘
```

* **domain** is plain Dart with two small dependencies (`equatable`,
  `collection`). It holds models, the exercise catalog and the services
  that do the thinking: generating workouts, scheduling, scoring. Nothing
  here knows about Flutter or a database, which is why it is where most
  tests live.
* **application** holds use cases (`CrateService`, `SeasonService`,
  `LoggingService`, `CapabilityService`) that coordinate repositories with
  domain services, the Riverpod providers, and `AppContainer`, the single
  composition root.
* **data** implements the repository interfaces twice: in memory (demo
  mode, tests) and on Firestore. `AppContainer.inMemory` and
  `AppContainer.firestore` are the only places that know which is which.
  The Firestore repositories are tested with `fake_cloud_firestore`, and
  the whole application-level lifecycle suite runs against both backends.
* **auth** is an `AuthService` interface (Google, Apple, email) with a
  Firebase implementation and a demo stub. `SessionService` guarantees one
  Peach per signed-in user, keyed by the auth uid.
* **presentation** is Flutter. Screens read providers and call services;
  they never touch repositories directly.

## Data model

```
Peach ──< ExerciseCapability >── Exercise (catalog, versioned, shipped)
  │
  └──< CrateMembership >── Crate ──< Season ──< Round ──< Matchup ──> Workout
                                                              │           │
                                               WorkoutLog ────┘ (0..1 per Peach per Matchup)
```

| Entity | Identity | Notes |
| --- | --- | --- |
| `Peach` | `id` | Global profile: fitness level 1..5, time zone, units. |
| `ExerciseCapability` | `(peachId, exerciseId)` | "I can do this." Global to the Peach, not per Crate. Only `able` exercises are ever prescribed. |
| `Exercise` | slug `id` | Reference data. Classified by movement pattern, muscles, equipment, modality, difficulty, MET, joint stress, progression family. |
| `Crate` | `id` | Group with `inviteCode`, time zone and `CrateSettings` (goal, workout length, scoring rules, exclusions). |
| `CrateMembership` | `(crateId, peachId)` | Role and status. A Peach can be in many Crates. |
| `Season` | `id` | A tournament: ordered `exerciseDays` (calendar dates in the Crate's zone) and frozen `participantIds`. |
| `Round` | `id` | One exercise day. Carries the `SessionFocus` every workout that day follows. |
| `Matchup` | `id` | Home vs away (away null = bye). Points to the one shared `Workout`. Holds the `MatchupResult` once closed. |
| `Workout` | `id` | Immutable generated session: blocks of items with prescriptions and scoring weights, plus `seed` and `generatorVersion` for reproducibility. |
| `WorkoutLog` | `id` | What a Peach did. Tied to a Matchup (scored) or free-standing (plain logging). Entries reference workout items by id. |

Derived, never stored: a Crate's exercise pool (intersection of member
capabilities minus Crate exclusions), scores, standings.

### Decisions worth knowing

* **Calendar dates are a value type (`LocalDate`)**, not `DateTime`, so an
  exercise "day" cannot drift across zones. Conversion happens at the edge
  using the Crate's time zone.
* **Workouts are per matchup, not per round.** Both Peaches in a matchup
  get the identical session drawn from the exercises *both* can do, which
  keeps competition fair. Different matchups in the same round may get
  different sessions; the round's focus keeps them comparable.
* **Scoring is relative to the prescription** (see the engine doc), so a
  level-2 Peach can beat a level-4 Peach by executing more completely.
* **Capabilities are global**, not per Crate, matching "able to do, in that
  Crate or elsewhere".
* **Standings are recomputed from matchups**, so they can never disagree
  with results.
* **Hand-written JSON**, no code generation: the domain stays buildable
  with `dart` alone and CI stays simple.

## Firestore layout

Each repository method maps onto one indexed query.

```
peaches/{peachId}
peaches/{peachId}/capabilities/{exerciseId}
crates/{crateId}
crates/{crateId}/memberships/{peachId}        (+ collectionGroup on peachId)
seasons/{seasonId}                            (crateId field, indexed)
seasons/{seasonId}/rounds/{roundId}
seasons/{seasonId}/matchups/{matchupId}       (homePeachId, awayPeachId, date; collectionGroup)
workouts/{workoutId}
workoutLogs/{logId}                           (peachId, matchupId; composite index)
```

Matchup documents carry denormalised `peachIds` and `date` fields so
"my matchups" and "matchups on a day" are single collection-group
queries. `firestore.rules` follows membership: a Peach reads a Crate's
Seasons only while their membership is active, logs are writable only by
their owner and frozen once submitted, and only owners/admins write
schedules. `firestore.indexes.json` declares the composite and
collection-group indexes the queries need.

### No server

Everything runs on the client against Firestore; there are no Cloud
Functions or Cloud Run services. Rounds open and close when any member's
device notices they are due (`syncPeach` on launch and on refresh). That
is safe because the work is idempotent and convergent:

* the workout for a matchup is generated from a seed derived from the
  matchup, with a deterministic document id (`w-<matchupId>`) and item
  ids, so two devices opening the same round write identical documents;
* closing scores only submitted logs with a pure function, so two devices
  closing the same round write identical results;
* security rules let any active member advance round, matchup and season
  state but never change who plays whom or when.

The trade-off is trust: a member could hand-edit results through the API.
That matches the honour-system decision; if it ever matters, the
scoring step is the one piece that would move server-side.
