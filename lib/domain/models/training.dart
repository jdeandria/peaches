/// Training-programme vocabulary shared by Crates, Seasons and Workouts.
library;

/// What a Crate is training for. Drives set/rep prescriptions.
enum TrainingGoal {
  /// Low reps, long rests, heavy loads.
  strength,

  /// Moderate reps and rests.
  hypertrophy,

  /// High reps, short rests, more conditioning.
  endurance,

  /// A blend; the default for mixed-ability social Crates.
  generalFitness,
}

/// The emphasis of a single session. Rotated across rounds so that the same
/// muscle groups are not loaded hard on consecutive days.
enum SessionFocus {
  fullBody,
  upperBody,
  lowerBody,
  conditioning,

  /// Core, mobility and light work: used for back-to-back exercise days.
  coreAndMobility;

  /// Whether this focus loads the upper body hard.
  bool get loadsUpper => this == fullBody || this == upperBody;

  /// Whether this focus loads the lower body hard.
  bool get loadsLower => this == fullBody || this == lowerBody;
}

/// Unit system preference for display and entry. Stored values are metric.
enum UnitSystem { metric, imperial }
