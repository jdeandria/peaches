import 'package:equatable/equatable.dart';

import '../core/json.dart';
import '../exercises/taxonomy.dart';
import 'scoring_rules.dart';
import 'training.dart';

/// Tunable behaviour of a Crate. Everything a Crate owner can change lives
/// here so that [Crate] itself stays a stable identity record.
final class CrateSettings extends Equatable {
  const CrateSettings({
    this.workoutDurationMinutes = 40,
    this.goal = TrainingGoal.generalFitness,
    this.scoringRules = ScoringRules.standard,
    this.loggingGraceHours = 6,
    this.excludedExerciseIds = const {},
    this.excludedJointStress = const {},
  }) : assert(
         workoutDurationMinutes >= 15 && workoutDurationMinutes <= 120,
         'workoutDurationMinutes is 15..120',
       ),
       assert(loggingGraceHours >= 0, 'loggingGraceHours must be >= 0');

  factory CrateSettings.fromJson(JsonMap json) => CrateSettings(
    workoutDurationMinutes: intFromJson(
      json['workoutDurationMinutes'],
      fallback: 40,
    ),
    goal: enumFromJson(
      TrainingGoal.values,
      json['goal'],
      fallback: TrainingGoal.generalFitness,
    ),
    scoringRules: json['scoringRules'] is Map
        ? ScoringRules.fromJson(
            (json['scoringRules'] as Map).cast<String, Object?>(),
          )
        : ScoringRules.standard,
    loggingGraceHours: intFromJson(json['loggingGraceHours'], fallback: 6),
    excludedExerciseIds: stringListFromJson(json['excludedExerciseIds'])
        .toSet(),
    excludedJointStress: enumListFromJson(
      JointStress.values,
      json['excludedJointStress'],
    ).toSet(),
  );

  static const defaults = CrateSettings();

  final int workoutDurationMinutes;
  final TrainingGoal goal;
  final ScoringRules scoringRules;

  /// Hours after the end of an exercise day during which logs still count.
  final int loggingGraceHours;

  /// Exercises the Crate has banned regardless of member capability.
  final Set<String> excludedExerciseIds;

  /// Joint-stress classes the Crate avoids (e.g. a knee-friendly Crate).
  final Set<JointStress> excludedJointStress;

  CrateSettings copyWith({
    int? workoutDurationMinutes,
    TrainingGoal? goal,
    ScoringRules? scoringRules,
    int? loggingGraceHours,
    Set<String>? excludedExerciseIds,
    Set<JointStress>? excludedJointStress,
  }) => CrateSettings(
    workoutDurationMinutes:
        workoutDurationMinutes ?? this.workoutDurationMinutes,
    goal: goal ?? this.goal,
    scoringRules: scoringRules ?? this.scoringRules,
    loggingGraceHours: loggingGraceHours ?? this.loggingGraceHours,
    excludedExerciseIds: excludedExerciseIds ?? this.excludedExerciseIds,
    excludedJointStress: excludedJointStress ?? this.excludedJointStress,
  );

  JsonMap toJson() => {
    'workoutDurationMinutes': workoutDurationMinutes,
    'goal': goal.name,
    'scoringRules': scoringRules.toJson(),
    'loggingGraceHours': loggingGraceHours,
    'excludedExerciseIds': excludedExerciseIds.toList()..sort(),
    'excludedJointStress': enumListToJson(excludedJointStress),
  };

  @override
  List<Object?> get props => [
    workoutDurationMinutes,
    goal,
    scoringRules,
    loggingGraceHours,
    excludedExerciseIds,
    excludedJointStress,
  ];
}

/// A group of Peaches who train and compete together.
final class Crate extends Equatable {
  const Crate({
    required this.id,
    required this.name,
    required this.ownerPeachId,
    required this.inviteCode,
    required this.createdAt,
    this.description = '',
    this.timeZone = 'UTC',
    this.settings = CrateSettings.defaults,
  });

  factory Crate.fromJson(JsonMap json) => Crate(
    id: json['id'] as String,
    name: json['name'] as String,
    description: json['description'] as String? ?? '',
    ownerPeachId: json['ownerPeachId'] as String,
    inviteCode: json['inviteCode'] as String,
    timeZone: json['timeZone'] as String? ?? 'UTC',
    settings: json['settings'] is Map
        ? CrateSettings.fromJson(
            (json['settings'] as Map).cast<String, Object?>(),
          )
        : CrateSettings.defaults,
    createdAt: dateTimeFromJson(json['createdAt']),
  );

  final String id;
  final String name;
  final String description;
  final String ownerPeachId;

  /// Short shareable code other Peaches use to join.
  final String inviteCode;

  /// IANA time zone in which exercise days begin and end.
  final String timeZone;
  final CrateSettings settings;
  final DateTime createdAt;

  Crate copyWith({
    String? name,
    String? description,
    String? ownerPeachId,
    String? inviteCode,
    String? timeZone,
    CrateSettings? settings,
  }) => Crate(
    id: id,
    name: name ?? this.name,
    description: description ?? this.description,
    ownerPeachId: ownerPeachId ?? this.ownerPeachId,
    inviteCode: inviteCode ?? this.inviteCode,
    timeZone: timeZone ?? this.timeZone,
    settings: settings ?? this.settings,
    createdAt: createdAt,
  );

  JsonMap toJson() => {
    'id': id,
    'name': name,
    'description': description,
    'ownerPeachId': ownerPeachId,
    'inviteCode': inviteCode,
    'timeZone': timeZone,
    'settings': settings.toJson(),
    'createdAt': dateTimeToJson(createdAt),
  };

  @override
  List<Object?> get props => [
    id,
    name,
    description,
    ownerPeachId,
    inviteCode,
    timeZone,
    settings,
    createdAt,
  ];
}

enum CrateRole { owner, admin, member }

enum MembershipStatus { active, invited, left, removed }

/// The many-to-many link between Peaches and Crates.
final class CrateMembership extends Equatable {
  const CrateMembership({
    required this.crateId,
    required this.peachId,
    required this.joinedAt,
    this.role = CrateRole.member,
    this.status = MembershipStatus.active,
  });

  factory CrateMembership.fromJson(JsonMap json) => CrateMembership(
    crateId: json['crateId'] as String,
    peachId: json['peachId'] as String,
    role: enumFromJson(
      CrateRole.values,
      json['role'],
      fallback: CrateRole.member,
    ),
    status: enumFromJson(
      MembershipStatus.values,
      json['status'],
      fallback: MembershipStatus.active,
    ),
    joinedAt: dateTimeFromJson(json['joinedAt']),
  );

  final String crateId;
  final String peachId;
  final CrateRole role;
  final MembershipStatus status;
  final DateTime joinedAt;

  bool get isActive => status == MembershipStatus.active;

  bool get canManage => role == CrateRole.owner || role == CrateRole.admin;

  CrateMembership copyWith({CrateRole? role, MembershipStatus? status}) =>
      CrateMembership(
        crateId: crateId,
        peachId: peachId,
        role: role ?? this.role,
        status: status ?? this.status,
        joinedAt: joinedAt,
      );

  JsonMap toJson() => {
    'crateId': crateId,
    'peachId': peachId,
    'role': role.name,
    'status': status.name,
    'joinedAt': dateTimeToJson(joinedAt),
  };

  @override
  List<Object?> get props => [crateId, peachId, role, status, joinedAt];
}
