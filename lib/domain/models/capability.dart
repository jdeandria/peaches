import 'package:equatable/equatable.dart';

import '../core/json.dart';

/// Whether a Peach has said they can perform an exercise.
enum CapabilityStatus {
  /// The Peach can do this exercise and is happy to be assigned it.
  able,

  /// The Peach cannot or will not do this exercise (injury, equipment, ...).
  unable,
}

/// A Peach's declaration about one exercise. Capabilities are global to the
/// Peach, not per Crate: "I can do pull-ups" is true everywhere.
///
/// Only [CapabilityStatus.able] exercises are ever prescribed. An exercise a
/// Peach has not declared is treated as not available, which keeps generated
/// workouts safe by default.
final class ExerciseCapability extends Equatable {
  const ExerciseCapability({
    required this.peachId,
    required this.exerciseId,
    required this.status,
    required this.updatedAt,
    this.notes,
  });

  factory ExerciseCapability.fromJson(JsonMap json) => ExerciseCapability(
    peachId: json['peachId'] as String,
    exerciseId: json['exerciseId'] as String,
    status: enumFromJson(CapabilityStatus.values, json['status']),
    updatedAt: dateTimeFromJson(json['updatedAt']),
    notes: json['notes'] as String?,
  );

  final String peachId;
  final String exerciseId;
  final CapabilityStatus status;
  final DateTime updatedAt;
  final String? notes;

  bool get isAble => status == CapabilityStatus.able;

  JsonMap toJson() => {
    'peachId': peachId,
    'exerciseId': exerciseId,
    'status': status.name,
    'updatedAt': dateTimeToJson(updatedAt),
    'notes': notes,
  };

  @override
  List<Object?> get props => [peachId, exerciseId, status, updatedAt, notes];
}
