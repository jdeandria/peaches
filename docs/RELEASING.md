# CI / CD

All pipelines live in `.github/workflows/` and pin Flutter `3.47.7`.

## ci.yml (every push to `main`, every PR)

1. `quality`: `dart format` check, `flutter analyze --fatal-infos`,
   `flutter test --coverage` (coverage uploaded as an artifact).
2. `integration-web`: runs `integration_test/app_test.dart` in headless
   Chrome via `flutter drive` and chromedriver.
3. `build-web`, `build-android` (debug APK), `build-ios` (unsigned):
   prove each target still compiles. Artifacts kept 7 days.

No secrets are needed for CI.

## deploy-web.yml (Firebase Hosting)

* Push to `main` → `flutter build web --release` → live channel.
* Pull request from this repo → preview channel (7-day expiry), URL
  commented on the PR.

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | JSON key for a service account with the **Firebase Hosting Admin** role (the Firebase CLI `firebase init hosting:github` creates one) |
| `FIREBASE_PROJECT_ID` | e.g. `peaches-prod` |

`firebase.json` serves `build/web` as a single-page app with long cache
headers on hashed assets.

## release-android.yml (Google Play)

Trigger: push a tag `vX.Y.Z` (or run manually and pick a track). Builds a
signed App Bundle with `--build-name=X.Y.Z --build-number=<run number>`
and uploads it to the chosen track (default **internal**).

| Secret | How to produce it |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload` then `base64 -w0 upload-keystore.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `upload` |
| `ANDROID_KEY_PASSWORD` | key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play Console → Setup → API access → service account with **Release manager** on the app; its JSON key |

One-time: create the app in Play Console with package
`com.peaches.peaches` and upload the first bundle manually (Play requires
a manual first upload before the API can publish).

`android/app/build.gradle.kts` reads `android/key.properties`; CI writes
that file from the secrets. Locally, release builds fall back to the debug
key so nothing needs configuring to run.

## release-ios.yml (TestFlight → App Store)

Trigger: the same `vX.Y.Z` tag. Imports the distribution certificate,
downloads the App Store provisioning profile via the App Store Connect
API, builds the IPA and uploads it to TestFlight.

| Secret | How to produce it |
| --- | --- |
| `IOS_CERTIFICATE_P12_BASE64` | Export the **Apple Distribution** certificate + private key from Keychain as `.p12`, then `base64 -i cert.p12` |
| `IOS_CERTIFICATE_PASSWORD` | the p12 password |
| `APPLE_TEAM_ID` | Apple Developer → Membership |
| `APPSTORE_ISSUER_ID` | App Store Connect → Users and Access → Integrations → App Store Connect API |
| `APPSTORE_API_KEY_ID` | same page, the key id |
| `APPSTORE_API_PRIVATE_KEY` | contents of the downloaded `.p8` |

One-time: register bundle id `com.peaches.peaches` and create the app in
App Store Connect. `ios/ExportOptions.template.plist` has the team id
substituted at build time; `ios/ExportOptions.plist` is git-ignored.

## Versioning

`pubspec.yaml` holds the development version. Release workflows take the
marketing version from the tag and the build number from the GitHub run
number, so every tag build is unique and monotonically increasing on both
stores.

## Firebase (Auth + Firestore) in the app

One-time setup, in order:

1. Create the Firebase project and enable **Authentication** providers:
   Google, Apple, Email/Password. Enable **Firestore**.
2. `dart pub global activate flutterfire_cli` then, in the repo,
   `flutterfire configure` and choose web, android, ios. It overwrites
   `lib/firebase_options.dart` (committed; the placeholder values there
   make the app refuse to start the Firebase backend until replaced).
3. Deploy rules and indexes: `firebase deploy --only firestore`.
   `deploy-web.yml` also does this on every push to `main`; the service
   account needs **Firebase Rules Admin** and **Cloud Datastore Index
   Admin** for that step.
4. Google sign-in: add the Android app's SHA-1 and SHA-256 (debug and
   upload key) in Firebase console. On Android the app needs the *web*
   OAuth client id to mint id tokens: pass
   `--dart-define=GOOGLE_SERVER_CLIENT_ID=...` (set the `GOOGLE_SERVER_CLIENT_ID`
   repository variable; the release workflows forward it). On iOS add the
   reversed client id URL scheme to `ios/Runner/Info.plist` as the
   `google_sign_in` README describes.
5. Apple sign-in: enable the "Sign in with Apple" capability on the iOS
   target in Xcode, and configure the Services ID + key in Firebase
   console for web.
6. Flip the `PEACHES_BACKEND` repository variable to `firebase` so
   `deploy-web.yml` builds against Firebase instead of demo mode. Locally:
   `flutter run --dart-define=PEACHES_BACKEND=firebase`.

Local emulators: `firebase emulators:start` (Auth 9099, Firestore 8080,
Hosting 5000; see `firebase.json`) then run with
`--dart-define=PEACHES_BACKEND=firebase --dart-define=FIREBASE_EMULATOR_HOST=localhost`.

## Not yet wired

* A scheduled Cloud Function to open and close rounds server-side.
* Crash reporting and analytics.
