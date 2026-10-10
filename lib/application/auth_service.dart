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

/// Always signed in as one fixed user; used by demo mode and tests.
final class DemoAuthService implements AuthService {
  DemoAuthService({required this.user});

  final AuthUser user;

  @override
  Stream<AuthUser?> authState() => Stream.value(user);

  @override
  AuthUser? get currentUser => user;

  @override
  Set<AuthProvider> get availableProviders => const {};

  @override
  Future<AuthUser> signInWithGoogle() async => user;

  @override
  Future<AuthUser> signInWithApple() async => user;

  @override
  Future<AuthUser> signInWithEmail({
    required String email,
    required String password,
  }) async => user;

  @override
  Future<AuthUser> registerWithEmail({
    required String email,
    required String password,
    required String displayName,
  }) async => user;

  @override
  Future<void> signOut() async {}
}
