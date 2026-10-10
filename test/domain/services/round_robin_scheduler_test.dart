import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/core/ids.dart';
import 'package:peaches/domain/core/local_date.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/services/round_robin_scheduler.dart';

void main() {
  Season season(List<String> peaches, int dayCount) => Season(
    id: 's1',
    crateId: 'c1',
    name: 'test',
    exerciseDays: List.generate(
      dayCount,
      (i) => const LocalDate(2026, 11, 1).addDays(i * 2),
    ),
    participantIds: peaches,
    createdAt: DateTime.utc(2026),
  );

  RoundRobinScheduler scheduler() =>
      RoundRobinScheduler(ids: SequentialIdGenerator(prefix: 's'));

  group('RoundRobinScheduler', () {
    test('creates one round per exercise day in date order', () {
      final s = scheduler().schedule(
        season(['a', 'b', 'c', 'd'], 5),
        goal: TrainingGoal.generalFitness,
      );
      expect(s.rounds.length, 5);
      for (var i = 0; i < s.rounds.length; i++) {
        expect(s.rounds[i].index, i);
        if (i > 0) {
          expect(s.rounds[i].date.isAfter(s.rounds[i - 1].date), isTrue);
        }
      }
    });

    test('every participant appears exactly once per round (even count)', () {
      final peaches = ['a', 'b', 'c', 'd', 'e', 'f'];
      final s = scheduler().schedule(
        season(peaches, 5),
        goal: TrainingGoal.generalFitness,
      );
      for (final round in s.rounds) {
        final ids = s.matchupsIn(round).expand((m) => m.peachIds).toList();
        expect(ids.toSet(), peaches.toSet(), reason: 'round ${round.index}');
        expect(ids.length, peaches.length);
        expect(s.matchupsIn(round).any((m) => m.isBye), isFalse);
      }
    });

    test('odd participant counts give exactly one bye per round', () {
      final peaches = ['a', 'b', 'c', 'd', 'e'];
      final s = scheduler().schedule(
        season(peaches, 5),
        goal: TrainingGoal.generalFitness,
      );
      final byeHolders = <String>[];
      for (final round in s.rounds) {
        final matchups = s.matchupsIn(round).toList();
        expect(
          matchups.where((m) => m.isBye).length,
          1,
          reason: 'round ${round.index}',
        );
        byeHolders.add(matchups.firstWhere((m) => m.isBye).homePeachId);
        final ids = matchups.expand((m) => m.peachIds).toList();
        expect(ids.toSet(), peaches.toSet());
      }
      // Over one full cycle (n rounds) everyone gets exactly one bye.
      expect(byeHolders.toSet(), peaches.toSet());
    });

    test('each pair meets exactly once per cycle', () {
      final peaches = ['a', 'b', 'c', 'd', 'e', 'f'];
      final cycle = peaches.length - 1;
      final s = scheduler().schedule(
        season(peaches, cycle),
        goal: TrainingGoal.generalFitness,
      );
      final pairs = s.matchups
          .map((m) => ({m.homePeachId, m.awayPeachId!}).toList()..sort())
          .map((p) => p.join('-'))
          .toList();
      expect(pairs.toSet().length, pairs.length);
      expect(pairs.length, peaches.length * cycle ~/ 2);
    });

    test('schedule repeats with home and away swapped on the second cycle', () {
      final peaches = ['a', 'b', 'c', 'd'];
      final s = scheduler().schedule(
        season(peaches, 6),
        goal: TrainingGoal.generalFitness,
      );
      final first = s.matchupsIn(s.rounds[0]).toList();
      final second = s.matchupsIn(s.rounds[3]).toList();
      for (final m in first) {
        final mirror = second.firstWhere(
          (x) =>
              x.homePeachId == m.awayPeachId && x.awayPeachId == m.homePeachId,
        );
        expect(mirror, isNotNull);
      }
    });

    test('is deterministic', () {
      final a = scheduler().schedule(
        season(['a', 'b', 'c'], 4),
        goal: TrainingGoal.strength,
      );
      final b = scheduler().schedule(
        season(['a', 'b', 'c'], 4),
        goal: TrainingGoal.strength,
      );
      expect(a.matchups, b.matchups);
      expect(a.rounds, b.rounds);
    });

    test('a single participant gets a bye every round', () {
      final s = scheduler().schedule(
        season(['solo'], 3),
        goal: TrainingGoal.strength,
      );
      expect(s.rounds.length, 3);
      expect(s.matchups.length, 3);
      expect(
        s.matchups.every((m) => m.isBye && m.homePeachId == 'solo'),
        isTrue,
      );
    });

    test('two participants play each other every round', () {
      final s = scheduler().schedule(
        season(['a', 'b'], 4),
        goal: TrainingGoal.strength,
      );
      expect(s.matchups.length, 4);
      for (final m in s.matchups) {
        expect({m.homePeachId, m.awayPeachId}, {'a', 'b'});
      }
      expect(s.matchups.map((m) => m.homePeachId).toSet(), {'a', 'b'});
    });

    test('rounds carry a focus from the rotation', () {
      final s = scheduler().schedule(
        season(['a', 'b'], 4),
        goal: TrainingGoal.generalFitness,
      );
      expect(s.rounds.map((r) => r.focus).toSet().length, greaterThan(1));
    });
  });

  group('ExerciseDayPlanner', () {
    test('selects matching weekdays inclusive of both ends', () {
      const planner = ExerciseDayPlanner();
      final days = planner.weekdaysBetween(
        const LocalDate(2026, 10, 5), // Monday
        const LocalDate(2026, 10, 18), // Sunday
        {DateTime.monday, DateTime.wednesday, DateTime.friday},
      );
      expect(days.map((d) => d.day), [5, 7, 9, 12, 14, 16]);
    });

    test('returns empty when the range is reversed', () {
      const planner = ExerciseDayPlanner();
      expect(
        planner.weekdaysBetween(
          const LocalDate(2026, 10, 18),
          const LocalDate(2026, 10, 5),
          {1},
        ),
        isEmpty,
      );
    });
  });
}
