import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/application/app_container.dart';
import 'package:peaches/application/crate_service.dart';
import 'package:peaches/domain/core/local_date.dart';
import 'package:peaches/domain/exercises/taxonomy.dart';
import 'package:peaches/domain/models/crate.dart';
import 'package:peaches/domain/models/peach.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/models/workout_log.dart';

/// The full application-level behaviour, run against every backend.
/// [create] must return a fresh, empty container each time.
void runLifecycleSuite(String backend, AppContainer Function() create) {
  final now = DateTime.utc(2026, 10, 10, 9);
  late AppContainer app;

  setUp(() async {
    app = create();
    for (final (id, level) in [('a', 2), ('b', 3), ('c', 4)]) {
      await app.peaches.save(
        Peach(id: id, displayName: id, fitnessLevel: level, createdAt: now),
      );
      await app.capabilityService.enableForEquipment(
        peachId: id,
        equipment: const {Equipment.dumbbell},
        maxDifficulty: level,
        now: now,
      );
    }
  });

  Future<Crate> crateWithMembers(List<String> ids) async {
    final crate = await app.crateService.createCrate(
      ownerPeachId: ids.first,
      name: 'Test Crate',
      now: now,
    );
    for (final id in ids.skip(1)) {
      await app.crateService.joinByInviteCode(
        inviteCode: crate.inviteCode,
        peachId: id,
        now: now,
      );
    }
    return crate;
  }

  group('$backend CrateService', () {
    test(
      'creates a crate with the owner as a member and an invite code',
      () async {
        final crate = await crateWithMembers(['a']);
        expect(crate.inviteCode.length, 6);
        final members = await app.crateService.activeMembers(crate.id);
        expect(members.single.peachId, 'a');
        expect(members.single.role, CrateRole.owner);
      },
    );

    test('joining is idempotent and case-insensitive', () async {
      final crate = await crateWithMembers(['a']);
      await app.crateService.joinByInviteCode(
        inviteCode: crate.inviteCode.toLowerCase(),
        peachId: 'b',
        now: now,
      );
      await app.crateService.joinByInviteCode(
        inviteCode: crate.inviteCode,
        peachId: 'b',
        now: now,
      );
      expect((await app.crateService.activeMembers(crate.id)).length, 2);
    });

    test('rejects unknown invite codes and blank names', () async {
      expect(
        () => app.crateService.joinByInviteCode(
          inviteCode: 'NOPE',
          peachId: 'a',
          now: now,
        ),
        throwsA(isA<DomainException>()),
      );
      expect(
        () => app.crateService.createCrate(
          ownerPeachId: 'a',
          name: '  ',
          now: now,
        ),
        throwsA(isA<DomainException>()),
      );
    });

    test('members can leave and rejoin; owners cannot leave', () async {
      final crate = await crateWithMembers(['a', 'b']);
      await app.crateService.leave(crateId: crate.id, peachId: 'b');
      expect((await app.crateService.activeMembers(crate.id)).length, 1);
      await app.crateService.joinByInviteCode(
        inviteCode: crate.inviteCode,
        peachId: 'b',
        now: now,
      );
      expect((await app.crateService.activeMembers(crate.id)).length, 2);
      expect(
        () => app.crateService.leave(crateId: crate.id, peachId: 'a'),
        throwsA(isA<DomainException>()),
      );
    });

    test('watchCratesFor reflects memberships', () async {
      final crate = await crateWithMembers(['a', 'b']);
      final first = await app.crates.watchCratesFor('b').first;
      expect(first.map((c) => c.id), [crate.id]);
      expect(await app.crates.watchCratesFor('c').first, isEmpty);
    });
  });

  group('$backend Season lifecycle', () {
    test('create -> open -> log -> close -> standings', () async {
      final crate = await crateWithMembers(['a', 'b', 'c']);
      final days = [
        const LocalDate(2026, 10, 12),
        const LocalDate(2026, 10, 14),
        const LocalDate(2026, 10, 16),
      ];
      final season = await app.seasonService.createSeason(
        crate: crate,
        name: 'S1',
        exerciseDays: days,
        now: now,
      );
      expect(season.status, SeasonStatus.scheduled);
      expect(season.participantIds, ['a', 'b', 'c']);

      final rounds = await app.seasons.roundsOf(season.id);
      expect(rounds.length, 3);
      expect(rounds.every((r) => r.status == RoundStatus.scheduled), isTrue);

      // Opening generates one workout per matchup, including the bye.
      final opened = await app.seasonService.openRound(
        roundId: rounds.first.id,
        now: now,
      );
      expect(opened.status, RoundStatus.open);
      expect(
        (await app.seasons.getById(season.id))!.status,
        SeasonStatus.active,
      );
      final matchups = await app.seasons.matchupsInRound(opened.id);
      expect(matchups.length, 2);
      for (final m in matchups) {
        expect(m.workoutId, isNotNull);
        expect(m.status, MatchupStatus.inProgress);
        final workout = (await app.workouts.getById(m.workoutId!))!;
        expect(workout.scoredItems, isNotEmpty);
        expect(workout.focus, opened.focus);
        // Everything prescribed must be doable by every Peach in the matchup.
        final caps = await app.capabilities.forPeaches(m.peachIds);
        final shared = app.pool.sharedIds(m.peachIds, caps);
        for (final item in workout.items) {
          expect(shared, contains(item.exerciseId));
        }
      }

      // Workout ids derive from the matchup so any device converges.
      for (final m in matchups) {
        expect(m.workoutId, 'w-${m.id}');
      }

      // Re-opening is idempotent.
      final before = matchups.map((m) => m.workoutId).toList();
      await app.seasonService.openRound(roundId: rounds.first.id, now: now);
      final after = (await app.seasons.matchupsInRound(opened.id))
          .map((m) => m.workoutId)
          .toList();
      expect(after, before);

      // The home Peach of the real matchup completes everything; away does nothing.
      final real = matchups.firstWhere((m) => !m.isBye);
      final workout = (await app.workouts.getById(real.workoutId!))!;
      final log = await app.loggingService.logForMatchup(
        matchup: real,
        peachId: real.homePeachId,
        now: now,
      );
      for (final item in workout.scoredItems) {
        final p = item.prescription;
        final sides = p.perSide ? 2 : 1;
        await app.loggingService.recordEntry(
          logId: log.id,
          entry: ExerciseLogEntry(
            exerciseId: item.exerciseId,
            workoutItemId: item.id,
            sets: List.filled(
              p.sets * sides,
              SetLog(reps: p.reps, seconds: p.seconds, meters: p.meters),
            ),
          ),
        );
      }
      final live = await app.loggingService.scoreFor(
        await app.logs.getById(log.id) as WorkoutLog,
      );
      expect(live.completionBonus, greaterThan(0));
      // Submit inside the round's window (its day is Oct 12).
      final duringRound = DateTime.utc(2026, 10, 12, 12);
      await app.loggingService.submit(logId: log.id, now: duringRound);

      // A log that was never submitted does not count.
      final awayLog = await app.loggingService.logForMatchup(
        matchup: real,
        peachId: real.awayPeachId!,
        now: now,
      );
      await app.loggingService.recordEntry(
        logId: awayLog.id,
        entry: ExerciseLogEntry(
          exerciseId: workout.scoredItems.first.exerciseId,
          workoutItemId: workout.scoredItems.first.id,
          sets: const [SetLog(reps: 100)],
        ),
      );

      final closed = await app.seasonService.closeRound(roundId: opened.id);
      expect(closed.status, RoundStatus.closed);
      final resolved = (await app.seasons.getMatchup(real.id))!;
      expect(resolved.status, MatchupStatus.complete);
      expect(resolved.winnerId, real.homePeachId);
      expect(resolved.result!.awayPoints, 0);

      final standings = await app.seasonService.standings(season.id);
      expect(standings.length, 3);
      expect(standings.first.peachId, real.homePeachId);
      expect(standings.first.wins, 1);
      expect(
        standings.firstWhere((s) => s.peachId == real.awayPeachId).losses,
        1,
      );
      final byeHolder = matchups.firstWhere((m) => m.isBye).homePeachId;
      expect(standings.firstWhere((s) => s.peachId == byeHolder).byes, 1);

      // Submitted logs are frozen.
      expect(
        () => app.loggingService.recordEntry(
          logId: log.id,
          entry: const ExerciseLogEntry(
            exerciseId: 'x',
            sets: [SetLog(reps: 1)],
          ),
        ),
        throwsA(isA<DomainException>()),
      );
    });

    test('season completes when the last round closes', () async {
      final crate = await crateWithMembers(['a', 'b']);
      final season = await app.seasonService.createSeason(
        crate: crate,
        name: 'Short',
        exerciseDays: const [LocalDate(2026, 10, 12)],
        now: now,
      );
      final round = (await app.seasons.roundsOf(season.id)).single;
      await app.seasonService.openRound(roundId: round.id, now: now);
      await app.seasonService.closeRound(roundId: round.id);
      expect(
        (await app.seasons.getById(season.id))!.status,
        SeasonStatus.complete,
      );
    });

    test('syncSeason opens due rounds and closes expired ones', () async {
      final crate = await crateWithMembers(['a', 'b']);
      final season = await app.seasonService.createSeason(
        crate: crate,
        name: 'S',
        exerciseDays: const [
          LocalDate(2026, 10, 8),
          LocalDate(2026, 10, 10),
          LocalDate(2026, 10, 12),
        ],
        now: now,
      );
      // Oct 8 has closed (end of day + 6 h grace), Oct 10 is in progress,
      // Oct 12 has not started.
      await app.seasonService.syncSeason(seasonId: season.id, now: now);
      final first = (await app.seasons.roundsOf(season.id))
          .map((r) => r.status)
          .toList();
      expect(first, [
        RoundStatus.closed,
        RoundStatus.open,
        RoundStatus.scheduled,
      ]);
      // Idempotent.
      await app.seasonService.syncSeason(seasonId: season.id, now: now);
      final second = (await app.seasons.roundsOf(season.id))
          .map((r) => r.status)
          .toList();
      expect(second, first);
      // A closed round has results even when nobody logged.
      final closedRound = (await app.seasons.roundsOf(season.id)).first;
      final m = (await app.seasons.matchupsInRound(closedRound.id)).single;
      expect(m.status, MatchupStatus.complete);
      expect(m.result, const MatchupResult(homePoints: 0, awayPoints: 0));
      // syncPeach reaches the same season through the membership.
      await app.seasonService.syncPeach(peachId: 'b', now: now);
    });

    test('submissions after the window closes are rejected', () async {
      final crate = await crateWithMembers(['a', 'b']);
      final season = await app.seasonService.createSeason(
        crate: crate,
        name: 'S',
        exerciseDays: const [LocalDate(2026, 10, 10)],
        now: now,
      );
      final round = (await app.seasons.roundsOf(season.id)).single;
      await app.seasonService.openRound(roundId: round.id, now: now);
      final matchup = (await app.seasons.matchupsInRound(round.id)).single;
      final window = (await app.seasonService.windowFor(round.id))!;
      expect(window.opensAt, DateTime.utc(2026, 10, 10));
      expect(window.closesAt, DateTime.utc(2026, 10, 11, 6));
      final log = await app.loggingService.logForMatchup(
        matchup: matchup,
        peachId: 'a',
        now: now,
      );
      expect(
        () => app.loggingService.submit(
          logId: log.id,
          now: DateTime.utc(2026, 10, 11, 7),
        ),
        throwsA(isA<DomainException>()),
      );
      await app.loggingService.submit(
        logId: log.id,
        now: DateTime.utc(2026, 10, 11, 5, 59),
      );
      expect((await app.logs.getById(log.id))!.isSubmitted, isTrue);
    });

    test('later rounds avoid exercises from recent rounds', () async {
      final crate = await crateWithMembers(['a', 'b']);
      final season = await app.seasonService.createSeason(
        crate: crate,
        name: 'S',
        exerciseDays: const [LocalDate(2026, 10, 12), LocalDate(2026, 10, 14)],
        now: now,
      );
      final rounds = await app.seasons.roundsOf(season.id);
      await app.seasonService.openRound(roundId: rounds[0].id, now: now);
      await app.seasonService.openRound(roundId: rounds[1].id, now: now);
      Future<Set<String>> scoredIds(Round r) async {
        final m = (await app.seasons.matchupsInRound(r.id)).single;
        final w = (await app.workouts.getById(m.workoutId!))!;
        return w.scoredItems.map((i) => i.exerciseId).toSet();
      }

      final first = await scoredIds(rounds[0]);
      final second = await scoredIds(rounds[1]);
      // Rounds have different focuses and the recency penalty is strong, so
      // overlap of scored exercises should be small.
      expect(first.intersection(second).length, lessThanOrEqualTo(1));
    });

    test('rejects a season with no exercise days', () async {
      final crate = await crateWithMembers(['a']);
      expect(
        () => app.seasonService.createSeason(
          crate: crate,
          name: 'x',
          exerciseDays: const [],
          now: now,
        ),
        throwsA(isA<DomainException>()),
      );
    });

    test('logging requires an opened matchup and membership', () async {
      final crate = await crateWithMembers(['a', 'b']);
      final season = await app.seasonService.createSeason(
        crate: crate,
        name: 'S',
        exerciseDays: const [LocalDate(2026, 10, 12)],
        now: now,
      );
      final matchup = (await app.seasons.matchupsOf(season.id)).single;
      expect(
        () => app.loggingService.logForMatchup(
          matchup: matchup,
          peachId: 'a',
          now: now,
        ),
        throwsA(isA<DomainException>()),
      );
      expect(
        () => app.loggingService.logForMatchup(
          matchup: matchup,
          peachId: 'c',
          now: now,
        ),
        throwsA(isA<DomainException>()),
      );
    });
  });

  group('$backend DemoSeeder', () {
    test('seeds a playable mid-season state', () async {
      final demo = create();
      await demo.demoSeeder.seed(now: now);
      final me = await demo.peaches.getById('me');
      expect(me, isNotNull);
      final crates = await demo.crates.watchCratesFor('me').first;
      expect(crates.length, 2);
      final seasons = await demo.seasons.forCrate(
        crates.firstWhere((c) => c.name == 'Weekend Warriors').id,
      );
      expect(seasons.single.status, SeasonStatus.active);
      final rounds = await demo.seasons.roundsOf(seasons.single.id);
      expect(rounds.where((r) => r.status == RoundStatus.closed), isNotEmpty);
      expect(
        rounds.where((r) => r.status == RoundStatus.scheduled),
        isNotEmpty,
      );
      final standings = await demo.seasonService.standings(seasons.single.id);
      expect(standings.any((s) => s.played > 0), isTrue);
      final myLogs = await demo.logs.forPeach('me');
      expect(myLogs, isNotEmpty);
    });
  });
}
