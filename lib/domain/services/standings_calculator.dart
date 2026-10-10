import '../models/score.dart';
import '../models/season.dart';

/// Computes a Season's table from its completed Matchups.
///
/// Standings are derived, never stored, so they can never drift from the
/// matchup results. Sort order: win percentage, then point differential,
/// then points for, then id for stability.
final class StandingsCalculator {
  const StandingsCalculator();

  List<Standing> calculate({
    required Iterable<String> participantIds,
    required Iterable<Matchup> matchups,
  }) {
    final table = {for (final id in participantIds) id: Standing(peachId: id)};

    void ensure(String id) =>
        table.putIfAbsent(id, () => Standing(peachId: id));

    for (final m in matchups) {
      final result = m.result;
      if (result == null || m.status != MatchupStatus.complete) continue;
      ensure(m.homePeachId);
      final home = table[m.homePeachId]!;
      if (m.isBye) {
        table[m.homePeachId] = home.copyWith(
          byes: home.byes + 1,
          pointsFor: home.pointsFor + result.homePoints,
        );
        continue;
      }
      ensure(m.awayPeachId!);
      final away = table[m.awayPeachId!]!;
      table[m.homePeachId] = _apply(home, result.homePoints, result.awayPoints);
      table[m.awayPeachId!] = _apply(
        away,
        result.awayPoints,
        result.homePoints,
      );
    }

    final rows = table.values.toList()
      ..sort((a, b) {
        final byWin = b.winPercentage.compareTo(a.winPercentage);
        if (byWin != 0) return byWin;
        final byWins = b.wins.compareTo(a.wins);
        if (byWins != 0) return byWins;
        final byDiff = b.pointDifferential.compareTo(a.pointDifferential);
        if (byDiff != 0) return byDiff;
        final byFor = b.pointsFor.compareTo(a.pointsFor);
        if (byFor != 0) return byFor;
        return a.peachId.compareTo(b.peachId);
      });
    return rows;
  }

  static Standing _apply(Standing s, double scored, double conceded) =>
      s.copyWith(
        wins: s.wins + (scored > conceded ? 1 : 0),
        losses: s.losses + (scored < conceded ? 1 : 0),
        ties: s.ties + (scored == conceded ? 1 : 0),
        pointsFor: s.pointsFor + scored,
        pointsAgainst: s.pointsAgainst + conceded,
      );
}
