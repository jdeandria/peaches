# Peaches

A social fitness app. Every user is a **Peach**. Peaches join **Crates**
(groups) and log workouts. On pre-agreed exercise days a Crate runs a
fantasy-football style **Season**: the app generates a workout for each
head-to-head **Matchup**, both Peaches do the same session, and the one
who executes it more completely wins the round.

Built with Flutter (web, Android, iOS), Material Design 3, and a pure-Dart
domain core that is unit tested independently of the UI.

## Status

| Area | State |
| --- | --- |
| Domain models and JSON | Done, tested |
| Exercise catalog (440 exercises) | Done, tested |
| Workout generation engine | Done, tested, deterministic |
| Round-robin seasons, scoring, standings | Done, tested |
| Flutter UI (Material 3, light/dark) | Done, widget + integration tested |
| Persistence | In-memory demo backend; Firebase repositories next |
| Auth | Not yet; demo pins a seeded user |
| CI (format, analyze, test, builds) | Done |
| CD (Firebase Hosting, Play, App Store) | Workflows done; need secrets |

## Run it

```bash
flutter pub get
flutter run -d chrome        # or any device
```

The app starts in demo mode with a seeded Crate mid-season, so there is
something to do on the Today tab straight away.

## Test it

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze --fatal-infos
flutter test                 # unit + widget tests
# integration test in Chrome (needs chromedriver on :4444)
flutter drive --driver=test_driver/integration_test.dart \
  --target=integration_test/app_test.dart -d web-server
```

## Layout

```
lib/
  domain/        pure Dart: models, exercise catalog, services (no Flutter)
  application/   use cases + Riverpod providers + composition root
  data/          repository implementations (in-memory today)
  app/           MaterialApp, theme, router
  presentation/  screens and widgets
test/            mirrors lib/; test/support holds the shared UI journey
integration_test/  the same journey on a real engine
docs/            architecture, workout engine, releasing
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model,
[docs/WORKOUT_ENGINE.md](docs/WORKOUT_ENGINE.md) for how workouts are
generated and scored, and [docs/RELEASING.md](docs/RELEASING.md) for the
CI/CD pipelines and the secrets they need.
