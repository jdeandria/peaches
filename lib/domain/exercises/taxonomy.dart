/// The exercise taxonomy used to describe and sample exercises.
///
/// Every exercise in the catalog is classified along these axes. The workout
/// generator reasons about *patterns*, *muscles*, *modality* and *equipment*
/// rather than about specific exercises, which is what lets it build a
/// balanced session from whatever subset of exercises two Peaches share.
library;

/// Fundamental human movement patterns (after Cook / Boyle style functional
/// training taxonomies). Balancing these across a session is the primary
/// lever for a well-rounded, injury-conscious workout.
enum MovementPattern {
  /// Knee-dominant bilateral lower body (squat, leg press).
  squat,

  /// Hip-dominant lower body (deadlift, hip thrust, swing).
  hinge,

  /// Single-leg / split-stance lower body (lunge, step-up, split squat).
  lunge,

  /// Upper body push in the horizontal plane (push-up, bench press).
  horizontalPush,

  /// Upper body push in the vertical plane (overhead press, pike push-up).
  verticalPush,

  /// Upper body pull in the horizontal plane (row).
  horizontalPull,

  /// Upper body pull in the vertical plane (pull-up, lat pulldown).
  verticalPull,

  /// Loaded carries and holds (farmer carry, suitcase carry).
  carry,

  /// Trunk flexion (crunch, leg raise, hollow hold).
  coreFlexion,

  /// Resisting extension of the spine (plank, dead bug).
  antiExtension,

  /// Rotation or resisting rotation (Russian twist, Pallof press).
  rotation,

  /// Resisting lateral flexion (side plank, suitcase hold).
  antiLateralFlexion,

  /// Explosive jumping / throwing (jump squat, burpee, slam).
  plyometric,

  /// Steady or interval locomotion (run, row, bike, jump rope).
  locomotion,

  /// Single-joint accessory work (curl, extension, calf raise).
  isolation,

  /// Dynamic mobility / activation used in warm-ups.
  mobility,

  /// Static stretching used in cool-downs.
  stretch;

  /// Whether the pattern is a *pushing* upper-body pattern.
  bool get isPush => this == horizontalPush || this == verticalPush;

  /// Whether the pattern is a *pulling* upper-body pattern.
  bool get isPull => this == horizontalPull || this == verticalPull;

  bool get isLowerBody => this == squat || this == hinge || this == lunge;

  bool get isCore =>
      this == coreFlexion ||
      this == antiExtension ||
      this == rotation ||
      this == antiLateralFlexion;
}

/// Muscle groups at the granularity useful for balancing a workout.
enum MuscleGroup {
  quadriceps,
  hamstrings,
  glutes,
  calves,
  hipFlexors,
  adductors,
  abductors,
  chest,
  lats,
  upperBack,
  lowerBack,
  frontDelts,
  sideDelts,
  rearDelts,
  biceps,
  triceps,
  forearms,
  abdominals,
  obliques,
  deepCore,
  cardiovascular,
  fullBody;

  BodyRegion get region => switch (this) {
    quadriceps ||
    hamstrings ||
    glutes ||
    calves ||
    hipFlexors ||
    adductors ||
    abductors => BodyRegion.lower,
    chest ||
    lats ||
    upperBack ||
    frontDelts ||
    sideDelts ||
    rearDelts ||
    biceps ||
    triceps ||
    forearms => BodyRegion.upper,
    lowerBack || abdominals || obliques || deepCore => BodyRegion.core,
    cardiovascular || fullBody => BodyRegion.systemic,
  };
}

enum BodyRegion { upper, lower, core, systemic }

/// Equipment an exercise *requires*. Bodyweight exercises list none.
enum Equipment {
  dumbbell,
  barbell,
  kettlebell,
  resistanceBand,
  pullUpBar,
  dipStation,
  bench,
  box,
  medicineBall,
  slamBall,
  jumpRope,
  cableMachine,
  weightMachine,
  treadmill,
  stationaryBike,
  rowingMachine,
  elliptical,
  stairClimber,
  suspensionTrainer,
  abWheel,
  foamRoller,
  wall,
  chair,
  stairs,
  pool,
  bicycle,
  sled,
  battleRope,
  sandbag,
  plate,
}

/// The training quality an exercise primarily develops.
enum Modality {
  strength,
  power,
  conditioning,
  mobility,
  flexibility,
  stability,
}

/// Compound (multi-joint) vs isolation (single-joint).
enum Mechanics { compound, isolation }

/// How an exercise is counted and therefore how it is scored.
enum MeasurementType {
  /// Repetitions of bodyweight or fixed-load movement.
  reps,

  /// Repetitions where the load lifted matters (dumbbell press).
  loadedReps,

  /// Time under tension or time on task (plank, bike interval).
  duration,

  /// Distance covered (run, row, carry).
  distance,
}

enum Laterality {
  bilateral,

  /// One side at a time, prescribed per side.
  unilateral,

  /// Alternating sides within a set, prescribed as total reps.
  alternating,
}

/// Coarse joint-stress flags so Peaches with limitations can exclude whole
/// classes of movement without reviewing every exercise.
enum JointStress { knee, hip, lowerBack, shoulder, wrist, elbow, ankle, neck }
