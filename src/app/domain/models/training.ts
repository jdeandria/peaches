/** Training-programme vocabulary shared by Crates, Seasons and Workouts. */

/** What a Crate is training for. Drives set/rep prescriptions. */
export const TRAINING_GOALS = [
  /** Low reps, long rests, heavy loads. */
  'strength',
  /** Moderate reps and rests. */
  'hypertrophy',
  /** High reps, short rests, more conditioning. */
  'endurance',
  /** A blend; the default for mixed-ability social Crates. */
  'generalFitness',
] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

/**
 * The emphasis of a single session. Rotated across rounds so that the same
 * muscle groups are not loaded hard on consecutive days.
 */
export const SESSION_FOCUSES = [
  'fullBody',
  'upperBody',
  'lowerBody',
  'conditioning',
  /** Core, mobility and light work: used for back-to-back exercise days. */
  'coreAndMobility',
] as const;
export type SessionFocus = (typeof SESSION_FOCUSES)[number];

/** Whether this focus loads the upper body hard. */
export function loadsUpper(focus: SessionFocus): boolean {
  return focus === 'fullBody' || focus === 'upperBody';
}

/** Whether this focus loads the lower body hard. */
export function loadsLower(focus: SessionFocus): boolean {
  return focus === 'fullBody' || focus === 'lowerBody';
}

/** Unit system preference for display and entry. Stored values are metric. */
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];
