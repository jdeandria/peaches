import 'dart:async';

/// A signed-in identity, independent of the auth provider.
final class AuthUser {
  const AuthUser({
    required this.id,
    this.displayName,
    this.email,
    this.photoUrl,
  });

  final String id;
  final String? displayName;
  final String? email;
  final String? photoUrl;
}

enum AuthProvider { google, apple, email }

/// Sign-in boundary. The Firebase implementation lives in the data layer;
/// demo mode uses [DemoAuthService].
abstract interface class AuthService {
  /// Emits the current user on listen and again on every change.
  Stream<AuthUser?> authState();

  AuthUser? get currentUser;

  Set<AuthProvider> get availableProviders;

  Future<AuthUser> signInWithGoogle();

  Future<AuthUser> signInWithApple();

  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  });

  Future<AuthUser> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  });

  Future<void> signOut();
}

/// Signs in as one fixed user; used by demo mode and tests.
///
/// With [signedIn] false the demo starts on the sign-in screen and every
/// provider button signs in as [user], which lets the sign-in flow be
/// exercised without a backend.
final class DemoAuthService implements AuthService {
  DemoAuthService({required this.user, bool signedIn = true})
    : _current = signedIn ? user : null;

  final AuthUser user;
  AuthUser? _current;
  final _changes = StreamController<AuthUser?>.broadcast();

  @override
  Stream<AuthUser?> authState() async* {
    yield _current;
    yield* _changes.stream;
  }

  @override
  AuthUser? get currentUser => _current;

  @override
  Set<AuthProvider> get availableProviders => _current == null
      ? const {AuthProvider.google, AuthProvider.apple, AuthProvider.email}
      : const {};

  Future<AuthUser> _signIn() async {
    _current = user;
    _changes.add(user);
    return user;
  }

  @override
  Future<AuthUser> signInWithGoogle() => _signIn();

  @override
  Future<AuthUser> signInWithApple() => _signIn();

  @override
  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  }) => _signIn();

  @override
  Future<AuthUser> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) => _signIn();

  @override
  Future<void> signOut() async {
    _current = null;
    _changes.add(null);
  }
}
