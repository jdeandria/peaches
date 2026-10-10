import 'package:equatable/equatable.dart';

import '../core/json.dart';
import 'training.dart';

/// A user of the app.
///
/// A Peach is independent of any Crate: capabilities, logs and fitness level
/// belong to the Peach and are shared across every Crate they join.
final class Peach extends Equatable {
  const Peach({
    required this.id,
    required this.displayName,
    required this.createdAt,
    this.email,
    this.avatarUrl,
    this.fitnessLevel = 2,
    this.timeZone = 'UTC',
    this.units = UnitSystem.metric,
  }) : assert(fitnessLevel >= 1 && fitnessLevel <= 5, 'fitnessLevel is 1..5');

  factory Peach.fromJson(JsonMap json) => Peach(
    id: json['id'] as String,
    displayName: json['displayName'] as String,
    email: json['email'] as String?,
    avatarUrl: json['avatarUrl'] as String?,
    fitnessLevel: intFromJson(json['fitnessLevel'], fallback: 2),
    timeZone: json['timeZone'] as String? ?? 'UTC',
    units: enumFromJson(
      UnitSystem.values,
      json['units'],
      fallback: UnitSystem.metric,
    ),
    createdAt: dateTimeFromJson(json['createdAt']),
  );

  final String id;
  final String displayName;
  final String? email;
  final String? avatarUrl;

  /// Self-assessed level 1 (new to exercise) .. 5 (advanced). Caps the
  /// difficulty of exercises the generator will prescribe.
  final int fitnessLevel;

  /// IANA time zone used to decide what "today" means for free logging.
  final String timeZone;
  final UnitSystem units;
  final DateTime createdAt;

  Peach copyWith({
    String? displayName,
    String? email,
    String? avatarUrl,
    int? fitnessLevel,
    String? timeZone,
    UnitSystem? units,
  }) => Peach(
    id: id,
    displayName: displayName ?? this.displayName,
    email: email ?? this.email,
    avatarUrl: avatarUrl ?? this.avatarUrl,
    fitnessLevel: fitnessLevel ?? this.fitnessLevel,
    timeZone: timeZone ?? this.timeZone,
    units: units ?? this.units,
    createdAt: createdAt,
  );

  JsonMap toJson() => {
    'id': id,
    'displayName': displayName,
    'email': email,
    'avatarUrl': avatarUrl,
    'fitnessLevel': fitnessLevel,
    'timeZone': timeZone,
    'units': units.name,
    'createdAt': dateTimeToJson(createdAt),
  };

  @override
  List<Object?> get props => [
    id,
    displayName,
    email,
    avatarUrl,
    fitnessLevel,
    timeZone,
    units,
    createdAt,
  ];
}
