import '../models/score.dart';
import '../models/season.dart';

/// Computes a Season's table from its completed Matchups.
///
/// Standings are derived, never stored, so they can never drift from the
/// matchup results. Sort order: win percentage, then point differential,
/// then points for, then id for stability.
final class StandingsCalculator {
  const StandingsCalculator();

  /// [roundIndexOf] orders matchups chronologically so that form and
  /// streaks are meaningful; without it, iteration order is used.
  List<Standing> calculate({
    required Iterable<String> participantIds,
    required Iterable<Matchup> matchups,
    Map<String, int> roundIndexOf = const {},
  }) {
    final ordered = matchups.toList()
      ..sort(
        (a, b) => (roundIndexOf[a.roundId] ?? 0).compareTo(
          roundIndexOf[b.roundId] ?? 0,
        ),
      );
    final table = {for (final id in participantIds) id: Standing(peachId: id)};

    void ensure(String id) =>
        table.putIfAbsent(id, () => Standing(peachId: id));

    for (final m in ordered) {
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

  static Standing _apply(Standing s, double scored, double conceded) {
    final outcome = scored > conceded
        ? MatchOutcome.win
        : scored < conceded
        ? MatchOutcome.loss
        : MatchOutcome.tie;
    return s.copyWith(
      wins: s.wins + (outcome == MatchOutcome.win ? 1 : 0),
      losses: s.losses + (outcome == MatchOutcome.loss ? 1 : 0),
      ties: s.ties + (outcome == MatchOutcome.tie ? 1 : 0),
      pointsFor: s.pointsFor + scored,
      pointsAgainst: s.pointsAgainst + conceded,
      form: [...s.form, outcome],
    );
  }
}
