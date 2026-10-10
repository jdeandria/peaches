import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../../application/app_container.dart';
import '../../application/auth_service.dart';
import '../../domain/core/ids.dart';
import '../../domain/exercises/exercise_catalog.dart';
import '../../firebase_options.dart';
import '../tz/tz_zone_clock.dart';
import 'firebase_auth_service.dart';

/// Everything needed to run the app on Firebase.
final class FirebaseBackend {
  const FirebaseBackend({required this.container, required this.auth});

  final AppContainer container;
  final AuthService auth;

  /// Initialises Firebase and builds the container. Pass [emulatorHost] to
  /// point Auth and Firestore at the local emulator suite.
  static Future<FirebaseBackend> start({
    String? emulatorHost,
    String? googleServerClientId,
  }) async {
    if (!DefaultFirebaseOptions.isConfigured) {
      throw StateError(
        'Firebase is not configured. Run `flutterfire configure` first or '
        'start the app without PEACHES_BACKEND=firebase.',
      );
    }
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    final firestore = FirebaseFirestore.instance;
    final auth = FirebaseAuth.instance;
    if (emulatorHost != null) {
      firestore.useFirestoreEmulator(emulatorHost, 8080);
      await auth.useAuthEmulator(emulatorHost, 9099);
    }
    return FirebaseBackend(
      container: AppContainer.firestore(
        firestore,
        catalog: ExerciseCatalog.standard(),
        ids: RandomIdGenerator(),
        zone: TzZoneClock(),
      ),
      auth: FirebaseAuthService(
        auth,
        googleServerClientId: googleServerClientId,
      ),
    );
  }
}
