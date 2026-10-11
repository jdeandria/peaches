import 'package:equatable/equatable.dart';

/// Points earned on one scored workout item.
final class ItemScore extends Equatable {
  const ItemScore({
    required this.workoutItemId,
    required this.achievementRatio,
    required this.points,
  });

  final String workoutItemId;

  /// Achieved volume divided by prescribed volume, after capping.
  final double achievementRatio;
  final double points;

  @override
  List<Object?> get props => [workoutItemId, achievementRatio, points];
}

/// The full breakdown of a Peach's score for one workout.
final class WorkoutScore extends Equatable {
  const WorkoutScore({required this.items, required this.completionBonus});

  static const zero = WorkoutScore(items: [], completionBonus: 0);

  final List<ItemScore> items;
  final double completionBonus;

  double get itemPoints => items.fold(0, (sum, i) => sum + i.points);
  double get total => itemPoints + completionBonus;

  @override
  List<Object?> get props => [items, completionBonus];
}

/// The outcome of one played matchup from one Peach's point of view.
enum MatchOutcome { win, loss, tie }

/// A row in a Season's standings table.
final class Standing extends Equatable {
  const Standing({
    required this.peachId,
    this.wins = 0,
    this.losses = 0,
    this.ties = 0,
    this.pointsFor = 0,
    this.pointsAgainst = 0,
    this.byes = 0,
    this.form = const [],
  });

  final String peachId;

  /// Played outcomes in chronological order (byes excluded).
  final List<MatchOutcome> form;

  /// The current run of identical outcomes, e.g. "W3" or "L1"; empty
  /// before the first played matchup.
  String get streak {
    if (form.isEmpty) return '';
    final last = form.last;
    var n = 0;
    for (final o in form.reversed) {
      if (o != last) break;
      n++;
    }
    final letter = switch (last) {
      MatchOutcome.win => 'W',
      MatchOutcome.loss => 'L',
      MatchOutcome.tie => 'T',
    };
    return '$letter$n';
  }

  /// Whether the streak is a winning one (for emphasis in the table).
  bool get onWinningStreak => form.isNotEmpty && form.last == MatchOutcome.win;
  final int wins;
  final int losses;
  final int ties;
  final double pointsFor;
  final double pointsAgainst;
  final int byes;

  int get played => wins + losses + ties;

  /// Win percentage with ties counted as half a win (NFL convention).
  double get winPercentage => played == 0 ? 0 : (wins + ties / 2) / played;

  double get pointDifferential => pointsFor - pointsAgainst;

  Standing copyWith({
    int? wins,
    int? losses,
    int? ties,
    double? pointsFor,
    double? pointsAgainst,
    int? byes,
    List<MatchOutcome>? form,
  }) => Standing(
    peachId: peachId,
    wins: wins ?? this.wins,
    losses: losses ?? this.losses,
    ties: ties ?? this.ties,
    pointsFor: pointsFor ?? this.pointsFor,
    pointsAgainst: pointsAgainst ?? this.pointsAgainst,
    byes: byes ?? this.byes,
    form: form ?? this.form,
  );

  @override
  List<Object?> get props => [
    peachId,
    wins,
    losses,
    ties,
    pointsFor,
    pointsAgainst,
    byes,
    form,
  ];
}
