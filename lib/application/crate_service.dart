import 'dart:math';

import '../domain/core/ids.dart';
import '../domain/models/crate.dart';
import '../domain/repositories/repositories.dart';

/// Thrown when a user action cannot be completed; the message is shown
/// as-is in the UI.
final class DomainException implements Exception {
  const DomainException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Crate lifecycle: creation, joining and leaving.
final class CrateService {
  CrateService({required this._crates, required this._ids, Random? random})
    : _random = random ?? Random.secure();

  static const _codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  final CrateRepository _crates;
  final IdGenerator _ids;
  final Random _random;

  Future<Crate> createCrate({
    required String ownerPeachId,
    required String name,
    required DateTime now,
    String description = '',
    String timeZone = 'UTC',
    CrateSettings settings = CrateSettings.defaults,
  }) async {
    final trimmed = name.trim();
    if (trimmed.isEmpty) throw const DomainException('Give your Crate a name.');
    final crate = Crate(
      id: _ids.newId(),
      name: trimmed,
      description: description.trim(),
      ownerPeachId: ownerPeachId,
      inviteCode: await _uniqueInviteCode(),
      timeZone: timeZone,
      settings: settings,
      createdAt: now,
    );
    await _crates.save(crate);
    await _crates.saveMembership(
      CrateMembership(
        crateId: crate.id,
        peachId: ownerPeachId,
        role: CrateRole.owner,
        joinedAt: now,
      ),
    );
    return crate;
  }

  /// Joins (or re-joins) a Crate by invite code. Idempotent for members.
  Future<Crate> joinByInviteCode({
    required String inviteCode,
    required String peachId,
    required DateTime now,
  }) async {
    final crate = await _crates.getByInviteCode(inviteCode);
    if (crate == null) {
      throw const DomainException('No Crate matches that invite code.');
    }
    final existing = (await _crates.membershipsFor(peachId))
        .where((m) => m.crateId == crate.id)
        .firstOrNull;
    if (existing == null) {
      await _crates.saveMembership(
        CrateMembership(crateId: crate.id, peachId: peachId, joinedAt: now),
      );
    } else if (!existing.isActive) {
      await _crates.saveMembership(
        existing.copyWith(status: MembershipStatus.active),
      );
    }
    return crate;
  }

  Future<void> leave({required String crateId, required String peachId}) async {
    final membership = (await _crates.membershipsFor(peachId))
        .where((m) => m.crateId == crateId)
        .firstOrNull;
    if (membership == null) return;
    if (membership.role == CrateRole.owner) {
      throw const DomainException(
        'Owners cannot leave their Crate. Transfer ownership first.',
      );
    }
    await _crates.saveMembership(
      membership.copyWith(status: MembershipStatus.left),
    );
  }

  Future<List<CrateMembership>> activeMembers(String crateId) async =>
      (await _crates.membershipsOf(crateId)).where((m) => m.isActive).toList();

  Future<String> _uniqueInviteCode() async {
    for (var attempt = 0; attempt < 20; attempt++) {
      final code = String.fromCharCodes(
        List.generate(
          6,
          (_) =>
              _codeAlphabet.codeUnitAt(_random.nextInt(_codeAlphabet.length)),
        ),
      );
      if (await _crates.getByInviteCode(code) == null) return code;
    }
    throw StateError('Could not allocate a unique invite code');
  }
}
