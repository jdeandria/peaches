import { isBye, Matchup } from '../models/season';
import { ItemScore, scoreTotal, WorkoutScore, ZERO_SCORE } from '../models/score';
import { ScoringRules, STANDARD_SCORING_RULES } from '../models/scoring-rules';
import {
  prescriptionUnit,
  scoredItems,
  totalTarget,
  Workout,
  WorkoutItem,
} from '../models/workout';
import {
  entryForItem,
  ExerciseLogEntry,
  totalMeters,
  totalReps,
  totalSeconds,
  WorkoutLog,
} from '../models/workout-log';

/** Turns a log of a workout into fantasy points. */
export class ScoringService {
  score(workout: Workout, log: WorkoutLog | null, rules = STANDARD_SCORING_RULES): WorkoutScore {
    const scored = scoredItems(workout);
    if (scored.length === 0) return ZERO_SCORE;

    const items: ItemScore[] = [];
    let allComplete = true;
    for (const item of scored) {
      const entry = log ? entryForItem(log, item.id) : undefined;
      const ratio = achievement(item, entry, rules);
      if (ratio < rules.completionThreshold) allComplete = false;
      items.push({
        workoutItemId: item.id,
        achievementRatio: ratio,
        points: round2(rules.pointsPerItem * item.scoringWeight * ratio),
      });
    }
    return { items, completionBonus: allComplete ? rules.completionBonus : 0 };
  }

  /** Resolves a Matchup from both Peaches' logs. A missing log scores zero. */
  resolve(args: {
    matchup: Matchup;
    workout: Workout;
    homeLog: WorkoutLog | null;
    awayLog: WorkoutLog | null;
    rules?: ScoringRules;
  }): Matchup {
    const { matchup, workout, homeLog, awayLog, rules = STANDARD_SCORING_RULES } = args;
    const home = scoreTotal(this.score(workout, homeLog, rules));
    const away = isBye(matchup) ? 0 : scoreTotal(this.score(workout, awayLog, rules));
    return { ...matchup, status: 'complete', result: { homePoints: home, awayPoints: away } };
  }
}

function achievement(
  item: WorkoutItem,
  entry: ExerciseLogEntry | undefined,
  rules: ScoringRules,
): number {
  if (!entry) return 0;
  const target = totalTarget(item.prescription);
  if (target <= 0) return 0;
  let achieved: number;
  switch (prescriptionUnit(item.prescription)) {
    case 'duration':
      achieved = totalSeconds(entry);
      break;
    case 'distance':
      achieved = totalMeters(entry);
      break;
    default:
      achieved = totalReps(entry);
  }
  return Math.min(achieved / target, rules.maxAchievementRatio);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
