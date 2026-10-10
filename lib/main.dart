import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'application/app_container.dart';
import 'application/auth_service.dart';
import 'application/providers.dart';
import 'data/demo/demo_seeder.dart';
import 'data/firebase/firebase_bootstrap.dart';
import 'data/tz/tz_zone_clock.dart';

/// `--dart-define=PEACHES_BACKEND=firebase` runs on Firebase Auth and
/// Firestore (after `flutterfire configure`); anything else runs the
/// seeded in-memory demo.
const backend = String.fromEnvironment('PEACHES_BACKEND', defaultValue: 'demo');

/// `--dart-define=FIREBASE_EMULATOR_HOST=localhost` targets the emulators.
const emulatorHost = String.fromEnvironment('FIREBASE_EMULATOR_HOST');

/// Android needs the web OAuth client id to obtain Google id tokens.
const googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final AppContainer container;
  final AuthService auth;
  if (backend == 'firebase') {
    final firebase = await FirebaseBackend.start(
      emulatorHost: emulatorHost.isEmpty ? null : emulatorHost,
      googleServerClientId: googleServerClientId.isEmpty
          ? null
          : googleServerClientId,
    );
    container = firebase.container;
    auth = firebase.auth;
  } else {
    container = AppContainer.inMemory(zone: TzZoneClock());
    await container.demoSeeder.seed(now: DateTime.now().toUtc());
    auth = DemoAuthService(
      user: const AuthUser(id: DemoSeeder.currentPeachId, displayName: 'You'),
    );
  }
  runApp(
    ProviderScope(
      overrides: [
        appContainerProvider.overrideWithValue(container),
        authServiceProvider.overrideWithValue(auth),
      ],
      child: const PeachesApp(),
    ),
  );
}
