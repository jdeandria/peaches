import 'package:cloud_firestore/cloud_firestore.dart';

import '../../domain/core/json.dart';
import '../../domain/core/local_date.dart';
import '../../domain/models/capability.dart';
import '../../domain/models/crate.dart';
import '../../domain/models/peach.dart';
import '../../domain/models/season.dart';
import '../../domain/models/workout.dart';
import '../../domain/models/workout_log.dart';
import '../../domain/repositories/repositories.dart';

/// Firestore collection names, in one place so rules and indexes can be
/// cross-checked against the code.
abstract final class Collections {
  static const peaches = 'peaches';
  static const capabilities = 'capabilities';
  static const crates = 'crates';
  static const memberships = 'memberships';
  static const seasons = 'seasons';
  static const rounds = 'rounds';
  static const matchups = 'matchups';
  static const workouts = 'workouts';
  static const workoutLogs = 'workoutLogs';
}

typedef _Doc = DocumentSnapshot<Map<String, dynamic>>;
typedef _Query = Query<Map<String, dynamic>>;

JsonMap _data(_Doc doc) => (doc.data() ?? const {}).cast<String, Object?>();

List<T> _parse<T>(
  QuerySnapshot<Map<String, dynamic>> snap,
  T Function(JsonMap) from,
) => [for (final d in snap.docs) from(_data(d))];

/// Firestore `whereIn` accepts at most 30 values; split larger id lists.
Iterable<List<String>> _chunks(Iterable<String> ids, [int size = 30]) sync* {
  final list = ids.toList();
  for (var i = 0; i < list.length; i += size) {
    yield list.sublist(i, i + size > list.length ? list.length : i + size);
  }
}

final class FirestorePeachRepository implements PeachRepository {
  FirestorePeachRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _col =>
      _db.collection(Collections.peaches);

  @override
  Future<Peach?> getById(String id) async {
    final doc = await _col.doc(id).get();
    return doc.exists ? Peach.fromJson(_data(doc)) : null;
  }

  @override
  Future<List<Peach>> getByIds(Iterable<String> ids) async {
    final out = <Peach>[];
    for (final chunk in _chunks(ids)) {
      final snap = await _col.where(FieldPath.documentId, whereIn: chunk).get();
      out.addAll(_parse(snap, Peach.fromJson));
    }
    return out;
  }

  @override
  Future<void> save(Peach peach) => _col.doc(peach.id).set(peach.toJson());

  @override
  Stream<Peach?> watch(String id) => _col
      .doc(id)
      .snapshots()
      .map((d) => d.exists ? Peach.fromJson(_data(d)) : null);
}

final class FirestoreCrateRepository implements CrateRepository {
  FirestoreCrateRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _crates =>
      _db.collection(Collections.crates);

  CollectionReference<Map<String, dynamic>> _members(String crateId) =>
      _crates.doc(crateId).collection(Collections.memberships);

  @override
  Future<Crate?> getById(String id) async {
    final doc = await _crates.doc(id).get();
    return doc.exists ? Crate.fromJson(_data(doc)) : null;
  }

  @override
  Future<Crate?> getByInviteCode(String inviteCode) async {
    final snap = await _crates
        .where('inviteCode', isEqualTo: inviteCode.trim().toUpperCase())
        .limit(1)
        .get();
    return snap.docs.isEmpty ? null : Crate.fromJson(_data(snap.docs.first));
  }

  @override
  Future<void> save(Crate crate) => _crates.doc(crate.id).set(crate.toJson());

  @override
  Future<List<CrateMembership>> membershipsOf(String crateId) async =>
      _parse(await _members(crateId).get(), CrateMembership.fromJson);

  @override
  Future<List<CrateMembership>> membershipsFor(String peachId) async =>
      _parse(await _membershipsQuery(peachId).get(), CrateMembership.fromJson);

  _Query _membershipsQuery(String peachId) => _db
      .collectionGroup(Collections.memberships)
      .where('peachId', isEqualTo: peachId);

  @override
  Future<void> saveMembership(CrateMembership membership) =>
      _members(membership.crateId)
          .doc(membership.peachId)
          .set(membership.toJson());

  @override
  Stream<List<Crate>> watchCratesFor(String peachId) =>
      _membershipsQuery(peachId).snapshots().asyncMap((snap) async {
        final ids = _parse(
          snap,
          CrateMembership.fromJson,
        ).where((m) => m.isActive).map((m) => m.crateId);
        final crates = <Crate>[];
        for (final chunk in _chunks(ids)) {
          final s = await _crates
              .where(FieldPath.documentId, whereIn: chunk)
              .get();
          crates.addAll(_parse(s, Crate.fromJson));
        }
        return crates..sort((a, b) => a.name.compareTo(b.name));
      });
}

final class FirestoreCapabilityRepository implements CapabilityRepository {
  FirestoreCapabilityRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _col(String peachId) => _db
      .collection(Collections.peaches)
      .doc(peachId)
      .collection(Collections.capabilities);

  @override
  Future<List<ExerciseCapability>> forPeach(String peachId) async =>
      _parse(await _col(peachId).get(), ExerciseCapability.fromJson);

  @override
  Future<List<ExerciseCapability>> forPeaches(Iterable<String> peachIds) async {
    final results = await Future.wait(peachIds.toSet().map(forPeach));
    return [for (final r in results) ...r];
  }

  @override
  Future<void> save(ExerciseCapability capability) =>
      _col(capability.peachId)
          .doc(capability.exerciseId)
          .set(capability.toJson());

  @override
  Future<void> saveAll(Iterable<ExerciseCapability> capabilities) async {
    // Batches are capped at 500 writes.
    final list = capabilities.toList();
    for (var i = 0; i < list.length; i += 450) {
      final batch = _db.batch();
      for (final c in list.skip(i).take(450)) {
        batch.set(_col(c.peachId).doc(c.exerciseId), c.toJson());
      }
      await batch.commit();
    }
  }

  @override
  Stream<List<ExerciseCapability>> watchForPeach(String peachId) =>
      _col(peachId)
          .snapshots()
          .map((s) => _parse(s, ExerciseCapability.fromJson));
}

final class FirestoreSeasonRepository implements SeasonRepository {
  FirestoreSeasonRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _seasons =>
      _db.collection(Collections.seasons);

  CollectionReference<Map<String, dynamic>> _rounds(String seasonId) =>
      _seasons.doc(seasonId).collection(Collections.rounds);

  CollectionReference<Map<String, dynamic>> _matchups(String seasonId) =>
      _seasons.doc(seasonId).collection(Collections.matchups);

  @override
  Future<Season?> getById(String id) async {
    final doc = await _seasons.doc(id).get();
    return doc.exists ? Season.fromJson(_data(doc)) : null;
  }

  @override
  Future<List<Season>> forCrate(String crateId) async =>
      _sortSeasons(_parse(await _crateQuery(crateId).get(), Season.fromJson));

  _Query _crateQuery(String crateId) =>
      _seasons.where('crateId', isEqualTo: crateId);

  static List<Season> _sortSeasons(List<Season> list) =>
      list..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  @override
  Future<void> save(Season season) =>
      _seasons.doc(season.id).set(season.toJson());

  @override
  Stream<List<Season>> watchForCrate(String crateId) =>
      _crateQuery(crateId)
          .snapshots()
          .map((s) => _sortSeasons(_parse(s, Season.fromJson)));

  @override
  Future<Round?> getRound(String id) async {
    final snap = await _db
        .collectionGroup(Collections.rounds)
        .where('id', isEqualTo: id)
        .limit(1)
        .get();
    return snap.docs.isEmpty ? null : Round.fromJson(_data(snap.docs.first));
  }

  @override
  Future<List<Round>> roundsOf(String seasonId) async =>
      _parse(await _rounds(seasonId).get(), Round.fromJson)
        ..sort((a, b) => a.index.compareTo(b.index));

  @override
  Future<void> saveRound(Round round) =>
      _rounds(round.seasonId).doc(round.id).set(round.toJson());

  @override
  Future<Matchup?> getMatchup(String id) async {
    final snap = await _db
        .collectionGroup(Collections.matchups)
        .where('id', isEqualTo: id)
        .limit(1)
        .get();
    return snap.docs.isEmpty ? null : Matchup.fromJson(_data(snap.docs.first));
  }

  @override
  Future<List<Matchup>> matchupsOf(String seasonId) async =>
      _parse(await _matchups(seasonId).get(), Matchup.fromJson);

  @override
  Future<List<Matchup>> matchupsInRound(String roundId) async {
    final snap = await _db
        .collectionGroup(Collections.matchups)
        .where('roundId', isEqualTo: roundId)
        .get();
    return _parse(snap, Matchup.fromJson);
  }

  @override
  Future<List<Matchup>> matchupsFor(String peachId, {LocalDate? on}) async {
    var query = _db
        .collectionGroup(Collections.matchups)
        .where('peachIds', arrayContains: peachId);
    if (on != null) query = query.where('date', isEqualTo: on.toIso());
    return _parse(await query.get(), Matchup.fromJson);
  }

  /// Matchup documents carry denormalised `peachIds` and `date` fields so
  /// "my matchups" and "matchups on a day" are single indexed queries.
  /// Updates merge so those fields survive a plain [saveMatchup].
  @override
  Future<void> saveMatchup(Matchup matchup) => _matchups(matchup.seasonId)
      .doc(matchup.id)
      .set({
        ...matchup.toJson(),
        'peachIds': matchup.peachIds,
      }, SetOptions(merge: true));

  @override
  Future<void> saveSchedule(List<Round> rounds, List<Matchup> matchups) async {
    final dates = {for (final r in rounds) r.id: r.date.toIso()};
    final batch = _db.batch();
    for (final r in rounds) {
      batch.set(_rounds(r.seasonId).doc(r.id), r.toJson());
    }
    for (final m in matchups) {
      batch.set(_matchups(m.seasonId).doc(m.id), {
        ...m.toJson(),
        'peachIds': m.peachIds,
        'date': dates[m.roundId],
      });
    }
    await batch.commit();
  }

  @override
  Stream<List<Matchup>> watchMatchupsFor(String peachId) => _db
      .collectionGroup(Collections.matchups)
      .where('peachIds', arrayContains: peachId)
      .snapshots()
      .map((s) => _parse(s, Matchup.fromJson));
}

final class FirestoreWorkoutRepository implements WorkoutRepository {
  FirestoreWorkoutRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _col =>
      _db.collection(Collections.workouts);

  @override
  Future<Workout?> getById(String id) async {
    final doc = await _col.doc(id).get();
    return doc.exists ? Workout.fromJson(_data(doc)) : null;
  }

  @override
  Future<List<Workout>> getByIds(Iterable<String> ids) async {
    final out = <Workout>[];
    for (final chunk in _chunks(ids)) {
      final snap = await _col.where(FieldPath.documentId, whereIn: chunk).get();
      out.addAll(_parse(snap, Workout.fromJson));
    }
    return out;
  }

  @override
  Future<void> save(Workout workout) =>
      _col.doc(workout.id).set(workout.toJson());
}

final class FirestoreWorkoutLogRepository implements WorkoutLogRepository {
  FirestoreWorkoutLogRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _col =>
      _db.collection(Collections.workoutLogs);

  @override
  Future<WorkoutLog?> getById(String id) async {
    final doc = await _col.doc(id).get();
    return doc.exists ? WorkoutLog.fromJson(_data(doc)) : null;
  }

  @override
  Future<WorkoutLog?> forMatchup(String matchupId, String peachId) async {
    final snap = await _col
        .where('matchupId', isEqualTo: matchupId)
        .where('peachId', isEqualTo: peachId)
        .limit(1)
        .get();
    return snap.docs.isEmpty
        ? null
        : WorkoutLog.fromJson(_data(snap.docs.first));
  }

  _Query _forPeach(String peachId) => _col.where('peachId', isEqualTo: peachId);

  static List<WorkoutLog> _newestFirst(List<WorkoutLog> list) =>
      list..sort((a, b) => b.startedAt.compareTo(a.startedAt));

  @override
  Future<List<WorkoutLog>> forPeach(String peachId) async =>
      _newestFirst(_parse(await _forPeach(peachId).get(), WorkoutLog.fromJson));

  @override
  Future<void> save(WorkoutLog log) => _col.doc(log.id).set(log.toJson());

  @override
  Stream<WorkoutLog?> watch(String id) => _col
      .doc(id)
      .snapshots()
      .map((d) => d.exists ? WorkoutLog.fromJson(_data(d)) : null);

  @override
  Stream<List<WorkoutLog>> watchForPeach(String peachId) =>
      _forPeach(peachId)
          .snapshots()
          .map((s) => _newestFirst(_parse(s, WorkoutLog.fromJson)));
}
