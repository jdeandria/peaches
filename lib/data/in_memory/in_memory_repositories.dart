import 'dart:async';

import '../../domain/core/local_date.dart';
import '../../domain/models/capability.dart';
import '../../domain/models/crate.dart';
import '../../domain/models/peach.dart';
import '../../domain/models/season.dart';
import '../../domain/models/workout.dart';
import '../../domain/models/workout_log.dart';
import '../../domain/repositories/repositories.dart';
import 'in_memory_store.dart';

final class InMemoryPeachRepository implements PeachRepository {
  final _store = InMemoryStore<Peach>((p) => p.id);

  @override
  Future<Peach?> getById(String id) async => _store.get(id);

  @override
  Future<List<Peach>> getByIds(Iterable<String> ids) async =>
      ids.map(_store.get).nonNulls.toList();

  @override
  Future<void> save(Peach peach) async => _store.put(peach);

  @override
  Stream<Peach?> watch(String id) =>
      _store.watch((_) => _store.get(id)).distinct();
}

final class InMemoryCrateRepository implements CrateRepository {
  final _crates = InMemoryStore<Crate>((c) => c.id);
  final _memberships = InMemoryStore<CrateMembership>(
    (m) => '${m.crateId}:${m.peachId}',
  );

  @override
  Future<Crate?> getById(String id) async => _crates.get(id);

  @override
  Future<Crate?> getByInviteCode(String inviteCode) async {
    final code = inviteCode.trim().toUpperCase();
    for (final crate in _crates.values) {
      if (crate.inviteCode.toUpperCase() == code) return crate;
    }
    return null;
  }

  @override
  Future<void> save(Crate crate) async => _crates.put(crate);

  @override
  Future<List<CrateMembership>> membershipsOf(String crateId) async =>
      _memberships.where((m) => m.crateId == crateId).toList();

  @override
  Future<List<CrateMembership>> membershipsFor(String peachId) async =>
      _memberships.where((m) => m.peachId == peachId).toList();

  @override
  Future<void> saveMembership(CrateMembership membership) async =>
      _memberships.put(membership);

  @override
  Stream<List<Crate>> watchCratesFor(String peachId) {
    List<Crate> query() {
      final ids = _memberships
          .where((m) => m.peachId == peachId && m.isActive)
          .map((m) => m.crateId)
          .toSet();
      return _crates.where((c) => ids.contains(c.id)).toList()
        ..sort((a, b) => a.name.compareTo(b.name));
    }

    // Re-run the query whenever either store changes.
    return _merge([
      _crates.watch((_) => query()),
      _memberships.watch((_) => query()),
    ]);
  }
}

final class InMemoryCapabilityRepository implements CapabilityRepository {
  final _store = InMemoryStore<ExerciseCapability>(
    (c) => '${c.peachId}:${c.exerciseId}',
  );

  @override
  Future<List<ExerciseCapability>> forPeach(String peachId) async =>
      _store.where((c) => c.peachId == peachId).toList();

  @override
  Future<List<ExerciseCapability>> forPeaches(Iterable<String> peachIds) async {
    final ids = peachIds.toSet();
    return _store.where((c) => ids.contains(c.peachId)).toList();
  }

  @override
  Future<void> save(ExerciseCapability capability) async =>
      _store.put(capability);

  @override
  Future<void> saveAll(Iterable<ExerciseCapability> capabilities) async =>
      _store.putAll(capabilities);

  @override
  Stream<List<ExerciseCapability>> watchForPeach(String peachId) =>
      _store.watch((all) => all.where((c) => c.peachId == peachId).toList());
}

final class InMemorySeasonRepository implements SeasonRepository {
  final _seasons = InMemoryStore<Season>((s) => s.id);
  final _rounds = InMemoryStore<Round>((r) => r.id);
  final _matchups = InMemoryStore<Matchup>((m) => m.id);

  @override
  Future<Season?> getById(String id) async => _seasons.get(id);

  @override
  Future<List<Season>> forCrate(String crateId) async =>
      _seasons.where((s) => s.crateId == crateId).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

  @override
  Future<void> save(Season season) async => _seasons.put(season);

  @override
  Stream<List<Season>> watchForCrate(String crateId) => _seasons.watch(
    (all) =>
        all.where((s) => s.crateId == crateId).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt)),
  );

  @override
  Future<Round?> getRound(String id) async => _rounds.get(id);

  @override
  Future<List<Round>> roundsOf(String seasonId) async =>
      _rounds.where((r) => r.seasonId == seasonId).toList()
        ..sort((a, b) => a.index.compareTo(b.index));

  @override
  Future<void> saveRound(Round round) async => _rounds.put(round);

  @override
  Future<Matchup?> getMatchup(String id) async => _matchups.get(id);

  @override
  Future<List<Matchup>> matchupsOf(String seasonId) async =>
      _matchups.where((m) => m.seasonId == seasonId).toList();

  @override
  Future<List<Matchup>> matchupsInRound(String roundId) async =>
      _matchups.where((m) => m.roundId == roundId).toList();

  @override
  Future<List<Matchup>> matchupsFor(String peachId, {LocalDate? on}) async {
    final mine = _matchups.where((m) => m.involves(peachId));
    if (on == null) return mine.toList();
    return mine.where((m) => _rounds.get(m.roundId)?.date == on).toList();
  }

  @override
  Future<void> saveMatchup(Matchup matchup) async => _matchups.put(matchup);

  @override
  Future<void> saveSchedule(List<Round> rounds, List<Matchup> matchups) async {
    _rounds.putAll(rounds);
    _matchups.putAll(matchups);
  }

  @override
  Stream<List<Matchup>> watchMatchupsFor(String peachId) =>
      _matchups.watch((all) => all.where((m) => m.involves(peachId)).toList());
}

final class InMemoryWorkoutRepository implements WorkoutRepository {
  final _store = InMemoryStore<Workout>((w) => w.id);

  @override
  Future<Workout?> getById(String id) async => _store.get(id);

  @override
  Future<List<Workout>> getByIds(Iterable<String> ids) async =>
      ids.map(_store.get).nonNulls.toList();

  @override
  Future<void> save(Workout workout) async => _store.put(workout);
}

final class InMemoryWorkoutLogRepository implements WorkoutLogRepository {
  final _store = InMemoryStore<WorkoutLog>((l) => l.id);

  @override
  Future<WorkoutLog?> getById(String id) async => _store.get(id);

  @override
  Future<WorkoutLog?> forMatchup(String matchupId, String peachId) async {
    for (final log in _store.values) {
      if (log.matchupId == matchupId && log.peachId == peachId) return log;
    }
    return null;
  }

  @override
  Future<List<WorkoutLog>> forPeach(String peachId) async =>
      _store.where((l) => l.peachId == peachId).toList()
        ..sort((a, b) => b.startedAt.compareTo(a.startedAt));

  @override
  Future<void> save(WorkoutLog log) async => _store.put(log);

  @override
  Stream<WorkoutLog?> watch(String id) =>
      _store.watch((_) => _store.get(id)).distinct();

  @override
  Stream<List<WorkoutLog>> watchForPeach(String peachId) => _store.watch(
    (all) =>
        all.where((l) => l.peachId == peachId).toList()
          ..sort((a, b) => b.startedAt.compareTo(a.startedAt)),
  );
}

/// Merges several streams into one that emits whenever any source emits.
/// Each source emits its current snapshot on listen, so subscribers always
/// receive an initial value.
Stream<T> _merge<T>(List<Stream<T>> sources) {
  late final StreamController<T> controller;
  final subscriptions = <StreamSubscription<T>>[];
  controller = StreamController<T>(
    onListen: () {
      for (final source in sources) {
        subscriptions.add(
          source.listen(controller.add, onError: controller.addError),
        );
      }
    },
    onCancel: () async {
      for (final sub in subscriptions) {
        await sub.cancel();
      }
    },
  );
  return controller.stream;
}
