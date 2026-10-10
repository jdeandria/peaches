import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'application/app_container.dart';
import 'application/providers.dart';
import 'data/demo/demo_seeder.dart';
import 'data/tz/tz_zone_clock.dart';

/// Set `--dart-define=PEACHES_BACKEND=firebase` once the Firebase
/// repositories exist; anything else runs the seeded in-memory demo.
const backend = String.fromEnvironment('PEACHES_BACKEND', defaultValue: 'demo');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final container = AppContainer.inMemory(zone: TzZoneClock());
  final now = DateTime.now().toUtc();
  await container.demoSeeder.seed(now: now);
  await container.seasonService.syncPeach(
    peachId: DemoSeeder.currentPeachId,
    now: now,
  );
  runApp(
    ProviderScope(
      overrides: [
        appContainerProvider.overrideWithValue(container),
        currentPeachIdProvider.overrideWith(
          () => CurrentPeachId(initial: DemoSeeder.currentPeachId),
        ),
      ],
      child: const PeachesApp(),
    ),
  );
}
