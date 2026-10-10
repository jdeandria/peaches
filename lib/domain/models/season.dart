import 'package:equatable/equatable.dart';

import '../core/json.dart';
import '../core/local_date.dart';
import 'training.dart';

enum SeasonStatus { draft, scheduled, active, complete, cancelled }

/// A fantasy-style tournament run by one Crate.
///
/// A Season is created from a list of *exercise days* decided ahead of time.
/// Each exercise day becomes a [Round]; each Round pairs the participants
/// into [Matchup]s. Participants are frozen when the Season is scheduled so
/// members who join later wait for the next Season.
final class Season extends Equatable {
  const Season({
    required this.id,
    required this.crateId,
    required this.name,
    required this.exerciseDays,
    required this.participantIds,
    required this.createdAt,
    this.status = SeasonStatus.draft,
  });

  factory Season.fromJson(JsonMap json) => Season(
    id: json['id'] as String,
    crateId: json['crateId'] as String,
    name: json['name'] as String,
    exerciseDays: stringListFromJson(json['exerciseDays'])
        .map(LocalDate.parse)
        .toList(growable: false),
    participantIds: stringListFromJson(json['participantIds']),
    status: enumFromJson(
      SeasonStatus.values,
      json['status'],
      fallback: SeasonStatus.draft,
    ),
    createdAt: dateTimeFromJson(json['createdAt']),
  );

  final String id;
  final String crateId;
  final String name;

  /// Sorted, unique calendar days (in the Crate's time zone) on which a
  /// Round takes place.
  final List<LocalDate> exerciseDays;

  /// Peaches competing in this Season, frozen at scheduling time.
  final List<String> participantIds;
  final SeasonStatus status;
  final DateTime createdAt;

  LocalDate? get startDate => exerciseDays.isEmpty ? null : exerciseDays.first;
  LocalDate? get endDate => exerciseDays.isEmpty ? null : exerciseDays.last;

  bool get isOpen =>
      status == SeasonStatus.scheduled || status == SeasonStatus.active;

  Season copyWith({
    String? name,
    List<LocalDate>? exerciseDays,
    List<String>? participantIds,
    SeasonStatus? status,
  }) => Season(
    id: id,
    crateId: crateId,
    name: name ?? this.name,
    exerciseDays: exerciseDays ?? this.exerciseDays,
    participantIds: participantIds ?? this.participantIds,
    status: status ?? this.status,
    createdAt: createdAt,
  );

  JsonMap toJson() => {
    'id': id,
    'crateId': crateId,
    'name': name,
    'exerciseDays': exerciseDays.map((d) => d.toIso()).toList(),
    'participantIds': participantIds,
    'status': status.name,
    'createdAt': dateTimeToJson(createdAt),
  };

  @override
  List<Object?> get props => [
    id,
    crateId,
    name,
    exerciseDays,
    participantIds,
    status,
    createdAt,
  ];
}

enum RoundStatus { scheduled, open, closed }

/// One exercise day of a Season.
final class Round extends Equatable {
  const Round({
    required this.id,
    required this.seasonId,
    required this.index,
    required this.date,
    required this.focus,
    this.status = RoundStatus.scheduled,
  }) : assert(index >= 0, 'index must be >= 0');

  factory Round.fromJson(JsonMap json) => Round(
    id: json['id'] as String,
    seasonId: json['seasonId'] as String,
    index: intFromJson(json['index']),
    date: LocalDate.parse(json['date'] as String),
    focus: enumFromJson(
      SessionFocus.values,
      json['focus'],
      fallback: SessionFocus.fullBody,
    ),
    status: enumFromJson(
      RoundStatus.values,
      json['status'],
      fallback: RoundStatus.scheduled,
    ),
  );

  final String id;
  final String seasonId;

  /// Zero-based position within the Season.
  final int index;
  final LocalDate date;

  /// The session emphasis every workout in this Round follows.
  final SessionFocus focus;
  final RoundStatus status;

  Round copyWith({RoundStatus? status, SessionFocus? focus}) => Round(
    id: id,
    seasonId: seasonId,
    index: index,
    date: date,
    focus: focus ?? this.focus,
    status: status ?? this.status,
  );

  JsonMap toJson() => {
    'id': id,
    'seasonId': seasonId,
    'index': index,
    'date': date.toIso(),
    'focus': focus.name,
    'status': status.name,
  };

  @override
  List<Object?> get props => [id, seasonId, index, date, focus, status];
}

enum MatchupStatus { scheduled, inProgress, complete }

/// The outcome of a completed Matchup.
final class MatchupResult extends Equatable {
  const MatchupResult({required this.homePoints, required this.awayPoints});

  factory MatchupResult.fromJson(JsonMap json) => MatchupResult(
    homePoints: doubleFromJson(json['homePoints']),
    awayPoints: doubleFromJson(json['awayPoints']),
  );

  final double homePoints;
  final double awayPoints;

  bool get isTie => homePoints == awayPoints;
  bool get homeWon => homePoints > awayPoints;

  JsonMap toJson() => {'homePoints': homePoints, 'awayPoints': awayPoints};

  @override
  List<Object?> get props => [homePoints, awayPoints];
}

/// A head-to-head pairing inside a Round.
///
/// [awayPeachId] is null for a bye: the home Peach still receives a workout
/// and can score points-for, but no win or loss is recorded.
final class Matchup extends Equatable {
  const Matchup({
    required this.id,
    required this.seasonId,
    required this.roundId,
    required this.homePeachId,
    this.awayPeachId,
    this.workoutId,
    this.status = MatchupStatus.scheduled,
    this.result,
  });

  factory Matchup.fromJson(JsonMap json) => Matchup(
    id: json['id'] as String,
    seasonId: json['seasonId'] as String,
    roundId: json['roundId'] as String,
    homePeachId: json['homePeachId'] as String,
    awayPeachId: json['awayPeachId'] as String?,
    workoutId: json['workoutId'] as String?,
    status: enumFromJson(
      MatchupStatus.values,
      json['status'],
      fallback: MatchupStatus.scheduled,
    ),
    result: json['result'] is Map
        ? MatchupResult.fromJson(
            (json['result'] as Map).cast<String, Object?>(),
          )
        : null,
  );

  final String id;
  final String seasonId;
  final String roundId;
  final String homePeachId;
  final String? awayPeachId;

  /// The generated workout both Peaches perform. Null until generated.
  final String? workoutId;
  final MatchupStatus status;
  final MatchupResult? result;

  bool get isBye => awayPeachId == null;

  List<String> get peachIds => [homePeachId, ?awayPeachId];

  bool involves(String peachId) =>
      homePeachId == peachId || awayPeachId == peachId;

  /// The opponent of [peachId], or null for a bye or a non-participant.
  String? opponentOf(String peachId) {
    if (peachId == homePeachId) return awayPeachId;
    if (peachId == awayPeachId) return homePeachId;
    return null;
  }

  /// The winner's id, or null for a tie, a bye or an unfinished matchup.
  String? get winnerId {
    final r = result;
    if (r == null || isBye || r.isTie) return null;
    return r.homeWon ? homePeachId : awayPeachId;
  }

  Matchup copyWith({
    String? workoutId,
    MatchupStatus? status,
    MatchupResult? result,
  }) => Matchup(
    id: id,
    seasonId: seasonId,
    roundId: roundId,
    homePeachId: homePeachId,
    awayPeachId: awayPeachId,
    workoutId: workoutId ?? this.workoutId,
    status: status ?? this.status,
    result: result ?? this.result,
  );

  JsonMap toJson() => {
    'id': id,
    'seasonId': seasonId,
    'roundId': roundId,
    'homePeachId': homePeachId,
    'awayPeachId': awayPeachId,
    'workoutId': workoutId,
    'status': status.name,
    'result': result?.toJson(),
  };

  @override
  List<Object?> get props => [
    id,
    seasonId,
    roundId,
    homePeachId,
    awayPeachId,
    workoutId,
    status,
    result,
  ];
}
