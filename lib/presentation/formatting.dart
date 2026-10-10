import 'package:intl/intl.dart';

import '../domain/core/local_date.dart';
import '../domain/exercises/taxonomy.dart';
import '../domain/models/season.dart';
import '../domain/models/training.dart';
import '../domain/models/workout.dart';

/// Human-readable labels for domain values. Kept in one place so the UI
/// never reaches into enum names.
abstract final class Fmt {
  static final _dayFormat = DateFormat.MMMEd();
  static final _longDayFormat = DateFormat.yMMMMEEEEd();

  static String day(LocalDate date) => _dayFormat.format(date.toDateTime());

  static String longDay(LocalDate date) =>
      _longDayFormat.format(date.toDateTime());

  static String points(double value) => value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(1);

  static String prescription(Prescription p) {
    final unit = switch (p.unit) {
      MeasurementType.duration => '${p.targetPerSet} s',
      MeasurementType.distance => '${p.targetPerSet} m',
      _ => '${p.targetPerSet} reps',
    };
    final side = p.perSide ? ' / side' : '';
    final rest = p.restSeconds > 0 ? ' · rest ${p.restSeconds} s' : '';
    final load = p.load == null ? '' : ' · RPE ${p.load!.rpe}';
    return '${p.sets} × $unit$side$rest$load';
  }

  static String focus(SessionFocus focus) => switch (focus) {
    SessionFocus.fullBody => 'Full body',
    SessionFocus.upperBody => 'Upper body',
    SessionFocus.lowerBody => 'Lower body',
    SessionFocus.conditioning => 'Conditioning',
    SessionFocus.coreAndMobility => 'Core & mobility',
  };

  static String goal(TrainingGoal goal) => switch (goal) {
    TrainingGoal.strength => 'Strength',
    TrainingGoal.hypertrophy => 'Muscle',
    TrainingGoal.endurance => 'Endurance',
    TrainingGoal.generalFitness => 'General fitness',
  };

  static String block(BlockType type) => switch (type) {
    BlockType.warmUp => 'Warm-up',
    BlockType.strength => 'Main work',
    BlockType.conditioning => 'Conditioning',
    BlockType.coolDown => 'Cool-down',
  };

  static String pattern(MovementPattern p) => switch (p) {
    MovementPattern.squat => 'Squat',
    MovementPattern.hinge => 'Hinge',
    MovementPattern.lunge => 'Lunge',
    MovementPattern.horizontalPush => 'Horizontal push',
    MovementPattern.verticalPush => 'Vertical push',
    MovementPattern.horizontalPull => 'Horizontal pull',
    MovementPattern.verticalPull => 'Vertical pull',
    MovementPattern.carry => 'Carry',
    MovementPattern.coreFlexion => 'Core flexion',
    MovementPattern.antiExtension => 'Anti-extension',
    MovementPattern.rotation => 'Rotation',
    MovementPattern.antiLateralFlexion => 'Anti-lateral flexion',
    MovementPattern.plyometric => 'Plyometric',
    MovementPattern.locomotion => 'Cardio',
    MovementPattern.isolation => 'Isolation',
    MovementPattern.mobility => 'Mobility',
    MovementPattern.stretch => 'Stretch',
  };

  static String equipment(Equipment e) => switch (e) {
    Equipment.dumbbell => 'Dumbbell',
    Equipment.barbell => 'Barbell',
    Equipment.kettlebell => 'Kettlebell',
    Equipment.resistanceBand => 'Band',
    Equipment.pullUpBar => 'Pull-up bar',
    Equipment.dipStation => 'Dip station',
    Equipment.bench => 'Bench',
    Equipment.box => 'Box',
    Equipment.medicineBall => 'Medicine ball',
    Equipment.slamBall => 'Slam ball',
    Equipment.jumpRope => 'Jump rope',
    Equipment.cableMachine => 'Cable machine',
    Equipment.weightMachine => 'Machine',
    Equipment.treadmill => 'Treadmill',
    Equipment.stationaryBike => 'Bike',
    Equipment.rowingMachine => 'Rower',
    Equipment.elliptical => 'Elliptical',
    Equipment.stairClimber => 'Stair climber',
    Equipment.suspensionTrainer => 'Suspension trainer',
    Equipment.abWheel => 'Ab wheel',
    Equipment.foamRoller => 'Foam roller',
    Equipment.wall => 'Wall',
    Equipment.chair => 'Chair',
    Equipment.stairs => 'Stairs',
    Equipment.pool => 'Pool',
    Equipment.bicycle => 'Bicycle',
    Equipment.sled => 'Sled',
    Equipment.battleRope => 'Battle rope',
    Equipment.sandbag => 'Sandbag',
    Equipment.plate => 'Plate',
  };

  static String matchupStatus(MatchupStatus status) => switch (status) {
    MatchupStatus.scheduled => 'Scheduled',
    MatchupStatus.inProgress => 'Open',
    MatchupStatus.complete => 'Final',
  };

  static String roundStatus(RoundStatus status) => switch (status) {
    RoundStatus.scheduled => 'Upcoming',
    RoundStatus.open => 'Open',
    RoundStatus.closed => 'Closed',
  };
}
