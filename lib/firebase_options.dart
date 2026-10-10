// Placeholder Firebase configuration.
//
// Run `flutterfire configure` once the Firebase project exists; it
// overwrites this file with real values for every platform. The web API
// key it writes is not a secret (it is shipped to browsers) but the
// placeholders below make it obvious when configuration has not happened:
// the app refuses to start the Firebase backend while they are present.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static const String placeholderProjectId = 'peaches-not-configured';

  static bool get isConfigured =>
      currentPlatform.projectId != placeholderProjectId;

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'placeholder',
    appId: '1:0:web:placeholder',
    messagingSenderId: '0',
    projectId: placeholderProjectId,
    authDomain: 'peaches-not-configured.firebaseapp.com',
    storageBucket: 'peaches-not-configured.appspot.com',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'placeholder',
    appId: '1:0:android:placeholder',
    messagingSenderId: '0',
    projectId: placeholderProjectId,
    storageBucket: 'peaches-not-configured.appspot.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'placeholder',
    appId: '1:0:ios:placeholder',
    messagingSenderId: '0',
    projectId: placeholderProjectId,
    storageBucket: 'peaches-not-configured.appspot.com',
    iosBundleId: 'com.peaches.peaches',
  );

  static const FirebaseOptions macos = ios;
}
