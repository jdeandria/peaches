import '../exercises/exercise.dart';
import '../exercises/taxonomy.dart';
import '../models/training.dart';
import '../models/workout.dart';

/// Converts an exercise plus a goal into sets, reps, time and rest.
///
/// Prescriptions follow widely used resistance-training guidelines (for
/// example the ACSM position stand): strength work uses low reps, heavy
/// loads and long rests; hypertrophy moderate reps and rests; endurance
/// high reps and short rests. Bodyweight exercises shift to higher rep
/// targets because load cannot be scaled.
final class Prescriber {
  const Prescriber();

  /// Seconds assumed per repetition when estimating time.
  static const secondsPerRep = 3;

  /// Seconds between exercises for transitions and setup.
  static const transitionSeconds = 20;

  Prescription prescribe({
    required Exercise exercise,
    required BlockType block,
    required TrainingGoal goal,
    required double targetDifficulty,
  }) {
    return switch (block) {
      BlockType.warmUp => _warmUp(exercise),
      BlockType.coolDown => _coolDown(exercise),
      BlockType.conditioning => _conditioning(exercise, goal, targetDifficulty),
      BlockType.strength => _main(exercise, goal, targetDifficulty),
    };
  }

  /// Estimated wall-clock seconds to complete [prescription].
  int estimateSeconds(Exercise exercise, Prescription prescription) {
    final sides = prescription.perSide ? 2 : 1;
    final work = switch (prescription.unit) {
      MeasurementType.reps ||
      MeasurementType.loadedReps => prescription.targetPerSet * secondsPerRep,
      MeasurementType.duration => prescription.targetPerSet,
      // Assume a brisk 1.5 m/s for carries and 3 m/s for locomotion.
      MeasurementType.distance =>
        (prescription.targetPerSet /
                (exercise.pattern == MovementPattern.carry ? 1.5 : 3))
            .round(),
    };
    final sets = prescription.sets * sides;
    return work * sets +
        prescription.restSeconds * (sets - 1) +
        transitionSeconds;
  }

  Prescription _warmUp(Exercise e) {
    final perSide = e.laterality == Laterality.unilateral;
    return switch (e.measurement) {
      MeasurementType.duration || MeasurementType.distance => Prescription(
        sets: 1,
        restSeconds: 0,
        seconds: 30,
        perSide: perSide,
      ),
      _ => Prescription(sets: 1, restSeconds: 0, reps: 10, perSide: perSide),
    };
  }

  Prescription _coolDown(Exercise e) => Prescription(
    sets: 1,
    restSeconds: 0,
    seconds: 30,
    perSide: e.laterality == Laterality.unilateral,
  );

  Prescription _main(Exercise e, TrainingGoal goal, double target) {
    final perSide = e.laterality == Laterality.unilateral;
    final scale = _volumeScale(target);
    final isolation = e.mechanics == Mechanics.isolation;

    // (sets, reps, rest, rpe) base table by goal.
    final (sets, reps, rest, rpe) = switch (goal) {
      TrainingGoal.strength => (4, 5, 120, 8),
      TrainingGoal.hypertrophy => (3, 10, 75, 8),
      TrainingGoal.endurance => (3, 15, 45, 6),
      TrainingGoal.generalFitness => (3, 10, 60, 7),
    };

    switch (e.measurement) {
      case MeasurementType.duration:
        final hold = (30 * scale).round().clamp(15, 90);
        return Prescription(
          sets: isolation ? 2 : sets,
          restSeconds: rest ~/ 2,
          seconds: hold,
          perSide: perSide,
        );
      case MeasurementType.distance:
        final metres = (30 * scale).round().clamp(15, 60);
        return Prescription(
          sets: sets,
          restSeconds: rest ~/ 2,
          meters: metres,
          perSide: perSide,
        );
      case MeasurementType.reps:
        // Bodyweight: cannot add load, so rep targets run higher and strength
        // goals fall back to moderate reps rather than very low ones.
        final base = goal == TrainingGoal.strength ? 8 : reps + 2;
        return Prescription(
          sets: isolation ? sets - 1 : sets,
          restSeconds: rest,
          reps: (base * scale).round().clamp(4, 30),
          perSide: perSide,
        );
      case MeasurementType.loadedReps:
        return Prescription(
          sets: isolation ? sets - 1 : sets,
          restSeconds: rest,
          reps: (reps * scale).round().clamp(3, 25),
          perSide: perSide,
          load: LoadGuidance(rpe: rpe, note: _rpeNote(rpe)),
        );
    }
  }

  Prescription _conditioning(Exercise e, TrainingGoal goal, double target) {
    final scale = _volumeScale(target);
    final perSide = e.laterality == Laterality.unilateral;
    final intervals = goal == TrainingGoal.endurance ? 6 : 4;
    switch (e.measurement) {
      case MeasurementType.distance:
        // Locomotion gets one continuous effort; carries get short shuttles.
        if (e.pattern == MovementPattern.locomotion) {
          return Prescription(
            sets: 1,
            restSeconds: 0,
            meters: (800 * scale).round(),
          );
        }
        return Prescription(
          sets: intervals,
          restSeconds: 45,
          meters: (30 * scale).round(),
          perSide: perSide,
        );
      case MeasurementType.duration:
        return Prescription(
          sets: intervals,
          restSeconds: 30,
          seconds: (30 * scale).round().clamp(20, 60),
        );
      case MeasurementType.reps:
      case MeasurementType.loadedReps:
        return Prescription(
          sets: intervals,
          restSeconds: 30,
          reps: (12 * scale).round().clamp(6, 25),
          perSide: perSide,
          load: e.measurement == MeasurementType.loadedReps
              ? const LoadGuidance(rpe: 6, note: 'Light and fast')
              : null,
        );
    }
  }

  /// Volume multiplier from target difficulty: 1.0 at level 2, +-12%/level.
  static double _volumeScale(double target) =>
      (1 + 0.12 * (target - 2)).clamp(0.7, 1.4);

  static String _rpeNote(int rpe) => switch (rpe) {
    <= 6 => 'Light: four or more reps in reserve',
    7 => 'Moderate: about three reps in reserve',
    8 => 'Hard: about two reps in reserve',
    _ => 'Very hard: one rep in reserve',
  };
}
