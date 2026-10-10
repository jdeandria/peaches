import 'package:equatable/equatable.dart';

import '../core/json.dart';
import 'taxonomy.dart';

/// A catalog exercise.
///
/// Exercises are reference data, not user data: the catalog is versioned and
/// shipped with the app, and user data refers to exercises by stable [id]
/// (a slug such as `bw-push-up`). Renaming an exercise never changes its id.
final class Exercise extends Equatable {
  const Exercise({
    required this.id,
    required this.name,
    required this.pattern,
    required this.primaryMuscles,
    required this.modality,
    required this.measurement,
    this.secondaryMuscles = const [],
    this.equipment = const [],
    this.mechanics = Mechanics.compound,
    this.laterality = Laterality.bilateral,
    this.difficulty = 2,
    this.met = 5.0,
    this.jointStress = const [],
    this.family,
    this.aliases = const [],
    this.cues,
  }) : assert(difficulty >= 1 && difficulty <= 5, 'difficulty is 1..5'),
       assert(met > 0, 'met must be positive');

  factory Exercise.fromJson(JsonMap json) => Exercise(
    id: json['id'] as String,
    name: json['name'] as String,
    pattern: enumFromJson(MovementPattern.values, json['pattern']),
    primaryMuscles: enumListFromJson(
      MuscleGroup.values,
      json['primaryMuscles'],
    ),
    secondaryMuscles: enumListFromJson(
      MuscleGroup.values,
      json['secondaryMuscles'],
    ),
    modality: enumFromJson(Modality.values, json['modality']),
    measurement: enumFromJson(MeasurementType.values, json['measurement']),
    equipment: enumListFromJson(Equipment.values, json['equipment']),
    mechanics: enumFromJson(
      Mechanics.values,
      json['mechanics'],
      fallback: Mechanics.compound,
    ),
    laterality: enumFromJson(
      Laterality.values,
      json['laterality'],
      fallback: Laterality.bilateral,
    ),
    difficulty: intFromJson(json['difficulty'], fallback: 2),
    met: doubleFromJson(json['met'], fallback: 5),
    jointStress: enumListFromJson(JointStress.values, json['jointStress']),
    family: json['family'] as String?,
    aliases: stringListFromJson(json['aliases']),
    cues: json['cues'] as String?,
  );

  /// Stable identifier. Convention: `<equipment>-<name>` in kebab-case.
  final String id;
  final String name;
  final MovementPattern pattern;
  final List<MuscleGroup> primaryMuscles;
  final List<MuscleGroup> secondaryMuscles;
  final Modality modality;
  final MeasurementType measurement;
  final List<Equipment> equipment;
  final Mechanics mechanics;
  final Laterality laterality;

  /// Technical / strength difficulty from 1 (anyone) to 5 (advanced).
  final int difficulty;

  /// Approximate metabolic equivalent (energy cost) while performing.
  final double met;

  final List<JointStress> jointStress;

  /// Progression family, e.g. `push-up`, so regressions and progressions can
  /// be found (`knee push-up` -> `push-up` -> `archer push-up`).
  final String? family;

  final List<String> aliases;

  /// Short coaching cue shown in the workout view.
  final String? cues;

  bool get isBodyweight => equipment.isEmpty;

  Set<MuscleGroup> get allMuscles => {...primaryMuscles, ...secondaryMuscles};

  Set<BodyRegion> get regions => primaryMuscles.map((m) => m.region).toSet();

  /// Whether this exercise can be performed with [available] equipment.
  bool isPerformableWith(Set<Equipment> available) =>
      equipment.every(available.contains);

  JsonMap toJson() => {
    'id': id,
    'name': name,
    'pattern': pattern.name,
    'primaryMuscles': enumListToJson(primaryMuscles),
    'secondaryMuscles': enumListToJson(secondaryMuscles),
    'modality': modality.name,
    'measurement': measurement.name,
    'equipment': enumListToJson(equipment),
    'mechanics': mechanics.name,
    'laterality': laterality.name,
    'difficulty': difficulty,
    'met': met,
    'jointStress': enumListToJson(jointStress),
    'family': family,
    'aliases': aliases,
    'cues': cues,
  };

  @override
  List<Object?> get props => [id];

  @override
  String toString() => 'Exercise($id)';
}
