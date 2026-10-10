import 'package:equatable/equatable.dart';

import '../core/json.dart';
import '../exercises/taxonomy.dart';
import 'training.dart';

/// The role a block plays in a session. Blocks are performed in this order.
enum BlockType { warmUp, strength, conditioning, coolDown }

/// Load guidance expressed as rating of perceived exertion (1..10), which
/// works for every Peach regardless of known maxes.
final class LoadGuidance extends Equatable {
  const LoadGuidance({required this.rpe, this.note})
    : assert(rpe >= 1 && rpe <= 10, 'rpe is 1..10');

  factory LoadGuidance.fromJson(JsonMap json) => LoadGuidance(
    rpe: intFromJson(json['rpe'], fallback: 7),
    note: json['note'] as String?,
  );

  final int rpe;
  final String? note;

  JsonMap toJson() => {'rpe': rpe, 'note': note};

  @override
  List<Object?> get props => [rpe, note];
}

/// What to do for one exercise: sets of reps, seconds or metres.
///
/// Exactly one of [reps], [seconds] or [meters] is set, matching the
/// exercise's [MeasurementType]. For unilateral exercises values are
/// *per side*.
final class Prescription extends Equatable {
  const Prescription({
    required this.sets,
    required this.restSeconds,
    this.reps,
    this.seconds,
    this.meters,
    this.load,
    this.perSide = false,
  }) : assert(sets >= 1, 'sets must be >= 1'),
       assert(restSeconds >= 0, 'restSeconds must be >= 0'),
       assert(
         (reps != null ? 1 : 0) +
                 (seconds != null ? 1 : 0) +
                 (meters != null ? 1 : 0) ==
             1,
         'Exactly one of reps, seconds or meters must be set',
       );

  factory Prescription.fromJson(JsonMap json) => Prescription(
    sets: intFromJson(json['sets'], fallback: 1),
    restSeconds: intFromJson(json['restSeconds']),
    reps: json['reps'] == null ? null : intFromJson(json['reps']),
    seconds: json['seconds'] == null ? null : intFromJson(json['seconds']),
    meters: json['meters'] == null ? null : intFromJson(json['meters']),
    load: json['load'] is Map
        ? LoadGuidance.fromJson((json['load'] as Map).cast<String, Object?>())
        : null,
    perSide: json['perSide'] == true,
  );

  final int sets;
  final int restSeconds;
  final int? reps;
  final int? seconds;
  final int? meters;
  final LoadGuidance? load;
  final bool perSide;

  /// The per-set target in the exercise's native unit.
  int get targetPerSet => reps ?? seconds ?? meters ?? 0;

  /// Total prescribed volume in the native unit (reps, seconds or metres),
  /// counting both sides for per-side prescriptions.
  int get totalTarget => targetPerSet * sets * (perSide ? 2 : 1);

  MeasurementType get unit => reps != null
      ? MeasurementType.reps
      : seconds != null
      ? MeasurementType.duration
      : MeasurementType.distance;

  JsonMap toJson() => {
    'sets': sets,
    'restSeconds': restSeconds,
    'reps': reps,
    'seconds': seconds,
    'meters': meters,
    'load': load?.toJson(),
    'perSide': perSide,
  };

  @override
  List<Object?> get props => [
    sets,
    restSeconds,
    reps,
    seconds,
    meters,
    load,
    perSide,
  ];
}

/// One exercise inside a block.
final class WorkoutItem extends Equatable {
  const WorkoutItem({
    required this.id,
    required this.exerciseId,
    required this.prescription,
    this.scoringWeight = 1.0,
  }) : assert(scoringWeight >= 0, 'scoringWeight must be >= 0');

  factory WorkoutItem.fromJson(JsonMap json) => WorkoutItem(
    id: json['id'] as String,
    exerciseId: json['exerciseId'] as String,
    prescription: Prescription.fromJson(
      (json['prescription'] as Map).cast<String, Object?>(),
    ),
    scoringWeight: doubleFromJson(json['scoringWeight'], fallback: 1),
  );

  /// Unique within the workout; logs reference items by this id.
  final String id;
  final String exerciseId;
  final Prescription prescription;

  /// Relative contribution to the workout score. Warm-up and cool-down
  /// items are typically 0 so they are logged but not competed on.
  final double scoringWeight;

  bool get isScored => scoringWeight > 0;

  JsonMap toJson() => {
    'id': id,
    'exerciseId': exerciseId,
    'prescription': prescription.toJson(),
    'scoringWeight': scoringWeight,
  };

  @override
  List<Object?> get props => [id, exerciseId, prescription, scoringWeight];
}

final class WorkoutBlock extends Equatable {
  const WorkoutBlock({required this.type, required this.items});

  factory WorkoutBlock.fromJson(JsonMap json) => WorkoutBlock(
    type: enumFromJson(BlockType.values, json['type']),
    items: mapListFromJson(json['items'])
        .map(WorkoutItem.fromJson)
        .toList(growable: false),
  );

  final BlockType type;
  final List<WorkoutItem> items;

  JsonMap toJson() => {
    'type': type.name,
    'items': items.map((i) => i.toJson()).toList(),
  };

  @override
  List<Object?> get props => [type, items];
}

/// A generated session. Immutable once created; regenerate for changes.
///
/// A Workout is independent of who performs it so the same instance can be
/// shared by both Peaches in a Matchup (fair play) or attached to nothing
/// for a solo session.
final class Workout extends Equatable {
  const Workout({
    required this.id,
    required this.blocks,
    required this.focus,
    required this.goal,
    required this.targetDifficulty,
    required this.estimatedMinutes,
    required this.seed,
    required this.generatorVersion,
    required this.createdAt,
    this.title,
  });

  factory Workout.fromJson(JsonMap json) => Workout(
    id: json['id'] as String,
    title: json['title'] as String?,
    blocks: mapListFromJson(json['blocks'])
        .map(WorkoutBlock.fromJson)
        .toList(growable: false),
    focus: enumFromJson(SessionFocus.values, json['focus']),
    goal: enumFromJson(TrainingGoal.values, json['goal']),
    targetDifficulty: doubleFromJson(json['targetDifficulty'], fallback: 2),
    estimatedMinutes: intFromJson(json['estimatedMinutes']),
    seed: intFromJson(json['seed']),
    generatorVersion: intFromJson(json['generatorVersion']),
    createdAt: dateTimeFromJson(json['createdAt']),
  );

  final String id;
  final String? title;
  final List<WorkoutBlock> blocks;
  final SessionFocus focus;
  final TrainingGoal goal;
  final double targetDifficulty;
  final int estimatedMinutes;

  /// Random seed used to generate this workout: the generator is
  /// deterministic, so seed + inputs + version reproduce it exactly.
  final int seed;
  final int generatorVersion;
  final DateTime createdAt;

  Iterable<WorkoutItem> get items => blocks.expand((b) => b.items);

  Iterable<WorkoutItem> get scoredItems => items.where((i) => i.isScored);

  WorkoutItem? itemById(String id) {
    for (final item in items) {
      if (item.id == id) return item;
    }
    return null;
  }

  JsonMap toJson() => {
    'id': id,
    'title': title,
    'blocks': blocks.map((b) => b.toJson()).toList(),
    'focus': focus.name,
    'goal': goal.name,
    'targetDifficulty': targetDifficulty,
    'estimatedMinutes': estimatedMinutes,
    'seed': seed,
    'generatorVersion': generatorVersion,
    'createdAt': dateTimeToJson(createdAt),
  };

  @override
  List<Object?> get props => [
    id,
    title,
    blocks,
    focus,
    goal,
    targetDifficulty,
    estimatedMinutes,
    seed,
    generatorVersion,
    createdAt,
  ];
}
