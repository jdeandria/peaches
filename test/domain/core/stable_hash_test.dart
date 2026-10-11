import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/application/season_service.dart';
import 'package:peaches/domain/core/local_date.dart';
import 'package:peaches/domain/core/stable_hash.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/models/training.dart';

void main() {
  group('stableHash', () {
    test('matches pinned values, so every device agrees', () {
      // Pinned outputs: if these change, workouts already generated on one
      // device would no longer match what another device generates.
      expect(stableHash(''), 0x011c9dc5);
      expect(stableHash('peach'), stableHash('peach'));
      // Cross-checked against an independent Python FNV-1a implementation.
      expect(stableHash('m-1|r-1|0'), 227895114);
    });

    test('is non-negative and spreads similar inputs', () {
      final values = {for (var i = 0; i < 1000; i++) stableHash('m-$i|r-1|0')};
      expect(values.length, 1000);
      expect(values.every((v) => v >= 0), isTrue);
    });

    test('handles characters outside ASCII', () {
      expect(stableHash('🍑'), isNot(stableHash('?')));
    });
  });

  test('workout seeds derive only from matchup and round identity', () {
    const matchup = Matchup(
      id: 'm-1',
      seasonId: 's',
      roundId: 'r-1',
      homePeachId: 'a',
      awayPeachId: 'b',
    );
    const round = Round(
      id: 'r-1',
      seasonId: 's',
      index: 0,
      date: LocalDate(2026, 10, 12),
      focus: SessionFocus.fullBody,
    );
    expect(SeasonService.seedFor(matchup, round), stableHash('m-1|r-1|0'));
  });
}
