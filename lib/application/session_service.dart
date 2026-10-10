import '../domain/models/peach.dart';
import '../domain/repositories/repositories.dart';
import 'auth_service.dart';

/// Bridges authentication and the Peach profile: every signed-in user has
/// exactly one Peach whose id is the auth uid.
final class SessionService {
  const SessionService({required this._auth, required this._peaches});

  final AuthService _auth;
  final PeachRepository _peaches;

  AuthService get auth => _auth;

  /// Returns the Peach for [user], creating it on first sign-in.
  Future<Peach> ensurePeach(AuthUser user, {required DateTime now}) async {
    final existing = await _peaches.getById(user.id);
    if (existing != null) return existing;
    final name = (user.displayName ?? '').trim();
    final peach = Peach(
      id: user.id,
      displayName: name.isEmpty ? _nameFromEmail(user.email) : name,
      email: user.email,
      avatarUrl: user.photoUrl,
      createdAt: now,
    );
    await _peaches.save(peach);
    return peach;
  }

  static String _nameFromEmail(String? email) {
    final local = email?.split('@').first.trim() ?? '';
    return local.isEmpty ? 'Peach' : local;
  }
}
