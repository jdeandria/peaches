import '../core/ids.dart';
import '../core/local_date.dart';
import '../models/season.dart';
import '../models/training.dart';
import 'focus_rotation.dart';

/// The rounds and matchups produced for a Season.
final class Schedule {
  const Schedule({required this.rounds, required this.matchups});

  final List<Round> rounds;
  final List<Matchup> matchups;

  Iterable<Matchup> matchupsIn(Round round) =>
      matchups.where((m) => m.roundId == round.id);
}

/// Builds a round-robin schedule over a Season's exercise days.
///
/// Uses the circle method: with `n` participants (padded to even with a
/// bye) there are `n - 1` distinct pairings; those repeat, swapping home
/// and away each cycle, until every exercise day has a Round. Output is
/// deterministic for a given participant order.
final class RoundRobinScheduler {
  const RoundRobinScheduler({
    required this._ids,
    this._rotation = const FocusRotation(),
  });

  final IdGenerator _ids;
  final FocusRotation _rotation;

  Schedule schedule(Season season, {required TrainingGoal goal}) {
    final days = List<LocalDate>.of(season.exerciseDays)..sort();
    final focuses = _rotation.assign(days, goal);
    final players = List<String?>.of(season.participantIds);
    if (players.length.isOdd) players.add(null);
    final n = players.length;
    final cyclesLength = n - 1;

    final rounds = <Round>[];
    final matchups = <Matchup>[];

    for (var i = 0; i < days.length; i++) {
      final round = Round(
        id: _ids.newId(),
        seasonId: season.id,
        index: i,
        date: days[i],
        focus: focuses[i],
      );
      rounds.add(round);
      if (n < 2) continue;

      final step = i % cyclesLength;
      final cycle = i ~/ cyclesLength;
      final rotated = _rotate(players, step);
      for (var k = 0; k < n ~/ 2; k++) {
        var a = rotated[k];
        var b = rotated[n - 1 - k];
        if (a == null && b == null) continue;
        // Alternate home/away each cycle so nobody is always "home"; a bye
        // is always recorded on the home side.
        if (a == null || (b != null && cycle.isOdd)) {
          final tmp = a;
          a = b;
          b = tmp;
        }
        matchups.add(
          Matchup(
            id: _ids.newId(),
            seasonId: season.id,
            roundId: round.id,
            homePeachId: a!,
            awayPeachId: b,
          ),
        );
      }
    }
    return Schedule(rounds: rounds, matchups: matchups);
  }

  /// Circle method: fix index 0, rotate the rest by [step].
  static List<String?> _rotate(List<String?> players, int step) {
    if (players.length < 3) return players;
    final fixed = players.first;
    final rest = players.sublist(1);
    final shift = step % rest.length;
    return [
      fixed,
      ...rest.sublist(rest.length - shift),
      ...rest.sublist(0, rest.length - shift),
    ];
  }
}

/// Helpers for choosing exercise days ahead of time.
final class ExerciseDayPlanner {
  const ExerciseDayPlanner();

  /// Every date from [start] to [end] (inclusive) whose ISO weekday is in
  /// [weekdays] (Monday = 1 ... Sunday = 7).
  List<LocalDate> weekdaysBetween(
    LocalDate start,
    LocalDate end,
    Set<int> weekdays,
  ) {
    final days = <LocalDate>[];
    for (var d = start; !d.isAfter(end); d = d.addDays(1)) {
      if (weekdays.contains(d.weekday)) days.add(d);
    }
    return days;
  }
}
