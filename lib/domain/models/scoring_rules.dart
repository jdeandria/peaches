import 'package:equatable/equatable.dart';

import '../core/json.dart';

/// How a logged workout is converted into fantasy points.
///
/// Scoring is *relative to the prescription*, so two Peaches with the same
/// workout are compared on how completely each executed it, not on absolute
/// output. This is what makes mixed-ability matchups meaningful.
final class ScoringRules extends Equatable {
  const ScoringRules({
    this.pointsPerItem = 10,
    this.maxAchievementRatio = 1.25,
    this.completionBonus = 10,
    this.completionThreshold = 1.0,
    this.rpeHonestyBonus = 0,
  }) : assert(pointsPerItem > 0, 'pointsPerItem must be positive'),
       assert(maxAchievementRatio >= 1, 'maxAchievementRatio must be >= 1'),
       assert(completionBonus >= 0, 'completionBonus must be >= 0'),
       assert(
         completionThreshold > 0 && completionThreshold <= 1,
         'completionThreshold is 0..1',
       );

  factory ScoringRules.fromJson(JsonMap json) => ScoringRules(
    pointsPerItem: doubleFromJson(json['pointsPerItem'], fallback: 10),
    maxAchievementRatio: doubleFromJson(
      json['maxAchievementRatio'],
      fallback: 1.25,
    ),
    completionBonus: doubleFromJson(json['completionBonus'], fallback: 10),
    completionThreshold: doubleFromJson(
      json['completionThreshold'],
      fallback: 1,
    ),
    rpeHonestyBonus: doubleFromJson(json['rpeHonestyBonus']),
  );

  static const standard = ScoringRules();

  /// Points awarded for fully completing an item with weight 1.0.
  final double pointsPerItem;

  /// Achievement above the prescription still scores, but is capped here so
  /// a single AMRAP cannot swamp the rest of the workout.
  final double maxAchievementRatio;

  /// Flat bonus for completing every scored item to at least
  /// [completionThreshold] of its prescription.
  final double completionBonus;
  final double completionThreshold;

  /// Reserved: bonus for logging an RPE on every item (encourages honest,
  /// complete logging). Zero disables it.
  final double rpeHonestyBonus;

  JsonMap toJson() => {
    'pointsPerItem': pointsPerItem,
    'maxAchievementRatio': maxAchievementRatio,
    'completionBonus': completionBonus,
    'completionThreshold': completionThreshold,
    'rpeHonestyBonus': rpeHonestyBonus,
  };

  @override
  List<Object?> get props => [
    pointsPerItem,
    maxAchievementRatio,
    completionBonus,
    completionThreshold,
    rpeHonestyBonus,
  ];
}
