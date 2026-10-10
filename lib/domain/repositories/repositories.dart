/// Persistence boundaries for the domain.
///
/// The domain never touches a database. Each repository is an interface
/// implemented once in memory (tests, demo mode) and once for the real
/// backend. Keeping these narrow and query-shaped (rather than generic
/// CRUD) is what lets a Firestore implementation map each method onto a
/// single indexed query.
library;

import '../core/local_date.dart';
import '../models/capability.dart';
import '../models/crate.dart';
import '../models/peach.dart';
import '../models/season.dart';
import '../models/workout.dart';
import '../models/workout_log.dart';

abstract interface class PeachRepository {
  Future<Peach?> getById(String id);
  Future<List<Peach>> getByIds(Iterable<String> ids);
  Future<void> save(Peach peach);
  Stream<Peach?> watch(String id);
}

abstract interface class CrateRepository {
  Future<Crate?> getById(String id);
  Future<Crate?> getByInviteCode(String inviteCode);
  Future<void> save(Crate crate);
  Future<List<CrateMembership>> membershipsOf(String crateId);
  Future<List<CrateMembership>> membershipsFor(String peachId);
  Future<void> saveMembership(CrateMembership membership);

  /// Crates in which [peachId] has an active membership.
  Stream<List<Crate>> watchCratesFor(String peachId);
}

abstract interface class CapabilityRepository {
  Future<List<ExerciseCapability>> forPeach(String peachId);
  Future<List<ExerciseCapability>> forPeaches(Iterable<String> peachIds);
  Future<void> save(ExerciseCapability capability);
  Future<void> saveAll(Iterable<ExerciseCapability> capabilities);
  Stream<List<ExerciseCapability>> watchForPeach(String peachId);
}

abstract interface class SeasonRepository {
  Future<Season?> getById(String id);
  Future<List<Season>> forCrate(String crateId);
  Future<void> save(Season season);
  Stream<List<Season>> watchForCrate(String crateId);

  Future<Round?> getRound(String id);
  Future<List<Round>> roundsOf(String seasonId);
  Future<void> saveRound(Round round);

  Future<Matchup?> getMatchup(String id);
  Future<List<Matchup>> matchupsOf(String seasonId);
  Future<List<Matchup>> matchupsInRound(String roundId);

  /// Every matchup involving [peachId], optionally only on [date].
  Future<List<Matchup>> matchupsFor(String peachId, {LocalDate? on});
  Future<void> saveMatchup(Matchup matchup);
  Future<void> saveSchedule(List<Round> rounds, List<Matchup> matchups);
  Stream<List<Matchup>> watchMatchupsFor(String peachId);
}

abstract interface class WorkoutRepository {
  Future<Workout?> getById(String id);
  Future<List<Workout>> getByIds(Iterable<String> ids);
  Future<void> save(Workout workout);
}

abstract interface class WorkoutLogRepository {
  Future<WorkoutLog?> getById(String id);
  Future<WorkoutLog?> forMatchup(String matchupId, String peachId);
  Future<List<WorkoutLog>> forPeach(String peachId);
  Future<void> save(WorkoutLog log);
  Stream<WorkoutLog?> watch(String id);
  Stream<List<WorkoutLog>> watchForPeach(String peachId);
}
