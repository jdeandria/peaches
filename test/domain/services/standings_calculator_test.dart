import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/models/score.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/services/standings_calculator.dart';

void main() {
  const calc = StandingsCalculator();

  Matchup done(String id, String home, String? away, double h, double a) =>
      Matchup(
        id: id,
        seasonId: 's',
        roundId: 'r',
        homePeachId: home,
        awayPeachId: away,
        status: MatchupStatus.complete,
        result: MatchupResult(homePoints: h, awayPoints: a),
      );

  group('StandingsCalculator', () {
    test('tallies wins, losses, ties and points', () {
      final rows = calc.calculate(
        participantIds: ['a', 'b', 'c'],
        matchups: [
          done('1', 'a', 'b', 50, 40),
          done('2', 'b', 'c', 30, 30),
          done('3', 'c', 'a', 20, 60),
        ],
      );
      final byId = {for (final r in rows) r.peachId: r};
      expect(byId['a']!.wins, 2);
      expect(byId['a']!.pointsFor, 110);
      expect(byId['a']!.pointsAgainst, 60);
      expect(byId['b']!.ties, 1);
      expect(byId['b']!.losses, 1);
      expect(byId['c']!.losses, 1);
      expect(byId['c']!.ties, 1);
      expect(rows.first.peachId, 'a');
    });

    test('ties count as half a win and point differential breaks ties', () {
      final rows = calc.calculate(
        participantIds: ['a', 'b', 'c', 'd'],
        matchups: [
          done('1', 'a', 'b', 50, 20), // a win, b loss
          done('2', 'c', 'd', 40, 10), // c win, d loss
        ],
      );
      // a and c both 1-0; c has +30 diff, a has +30 diff; a has more points for.
      expect(rows.map((r) => r.peachId).take(2), ['a', 'c']);
      expect(rows.last.peachId, 'd');
      expect(rows[0].winPercentage, 1);
    });

    test('byes add points-for and a bye count but no result', () {
      final rows = calc.calculate(
        participantIds: ['a', 'b'],
        matchups: [done('1', 'a', null, 25, 0)],
      );
      final a = rows.firstWhere((r) => r.peachId == 'a');
      expect(a.byes, 1);
      expect(a.played, 0);
      expect(a.pointsFor, 25);
    });

    test('ignores unfinished matchups and includes every participant', () {
      final rows = calc.calculate(
        participantIds: ['a', 'b', 'c'],
        matchups: const [
          Matchup(
            id: 'x',
            seasonId: 's',
            roundId: 'r',
            homePeachId: 'a',
            awayPeachId: 'b',
          ),
        ],
      );
      expect(rows.length, 3);
      expect(rows.every((r) => r.played == 0), isTrue);
      expect(rows.map((r) => r.peachId), ['a', 'b', 'c']);
    });

    test('tracks chronological form and streaks', () {
      final rows = calc.calculate(
        participantIds: ['a', 'b'],
        matchups:
            [
              done('3', 'a', 'b', 10, 0),
              done('1', 'a', 'b', 0, 5),
              done('2', 'b', 'a', 1, 9),
              done('bye', 'a', null, 3, 0),
            ].map(
              (m) => Matchup(
                id: m.id,
                seasonId: m.seasonId,
                roundId: 'r${m.id}',
                homePeachId: m.homePeachId,
                awayPeachId: m.awayPeachId,
                status: m.status,
                result: m.result,
              ),
            ),
        roundIndexOf: {'r1': 0, 'r2': 1, 'r3': 2, 'rbye': 3},
      );
      final a = rows.firstWhere((r) => r.peachId == 'a');
      final b = rows.firstWhere((r) => r.peachId == 'b');
      expect(a.form, [MatchOutcome.loss, MatchOutcome.win, MatchOutcome.win]);
      expect(a.streak, 'W2');
      expect(a.onWinningStreak, isTrue);
      expect(b.streak, 'L2');
      expect(const Standing(peachId: 'x').streak, '');
    });

    test('includes peaches found only in matchups', () {
      final rows = calc.calculate(
        participantIds: const [],
        matchups: [done('1', 'x', 'y', 1, 2)],
      );
      expect(rows.map((r) => r.peachId), ['y', 'x']);
    });
  });
}
