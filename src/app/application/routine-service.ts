import { IdGenerator } from '../domain/core/ids';
import { Routine, ROUTINE_NAME_MAX } from '../domain/models/routine';
import { ExerciseLogEntry } from '../domain/models/workout-log';
import { RoutineRepository } from '../domain/repositories';
import { implausibility } from '../domain/services/plausibility';
import { DomainError } from './errors';

/** Most routines a Peach can keep. */
export const MAX_ROUTINES = 50;

/**
 * Saved workouts: a session's plan kept under a name, to plan again in one
 * tap. Only what to do is kept (exercises and target sets), never what was
 * done or how hard it felt.
 */
export class RoutineService {
  constructor(
    private readonly routines: RoutineRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** Saves `exercises` as a new routine. */
  async create(
    peachId: string,
    name: string,
    exercises: readonly ExerciseLogEntry[],
    now: Date,
  ): Promise<Routine> {
    if ((await this.routines.forPeach(peachId)).length >= MAX_ROUTINES) {
      throw new DomainError(`You can keep up to ${MAX_ROUTINES} routines.`);
    }
    const routine: Routine = {
      id: this.ids.newId(),
      peachId,
      name: checkedName(name),
      exercises: checkedExercises(exercises),
      updatedAt: now,
    };
    await this.routines.save(routine);
    return routine;
  }

  /** Renames a routine, or replaces its exercises (with a session's plan, say). */
  async update(
    peachId: string,
    id: string,
    change: { name?: string; exercises?: readonly ExerciseLogEntry[] },
    now: Date,
  ): Promise<Routine> {
    const routine = await this.own(peachId, id);
    const updated: Routine = {
      ...routine,
      name: change.name === undefined ? routine.name : checkedName(change.name),
      exercises:
        change.exercises === undefined ? routine.exercises : checkedExercises(change.exercises),
      updatedAt: now,
    };
    await this.routines.save(updated);
    return updated;
  }

  /** Deletes a routine; returns it, so it can be put back. */
  async remove(peachId: string, id: string): Promise<Routine> {
    const routine = await this.own(peachId, id);
    await this.routines.delete(id);
    return routine;
  }

  /** Puts back a routine that was just deleted. */
  async restore(routine: Routine): Promise<void> {
    await this.routines.save(routine);
  }

  private async own(peachId: string, id: string): Promise<Routine> {
    const routine = await this.routines.getById(id);
    if (!routine || routine.peachId !== peachId) throw new DomainError('Routine not found.');
    return routine;
  }
}

function checkedName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new DomainError('Give the routine a name.');
  if (trimmed.length > ROUTINE_NAME_MAX) {
    throw new DomainError(`Keep the name to ${ROUTINE_NAME_MAX} characters.`);
  }
  return trimmed;
}

/** Target sets only: what was felt (RPE, notes) belongs to a session. */
function checkedExercises(exercises: readonly ExerciseLogEntry[]): ExerciseLogEntry[] {
  const kept = exercises
    .filter((e) => e.sets.length > 0)
    .map((e) => ({ ...e, rpe: null, notes: null }));
  if (kept.length === 0) throw new DomainError('A routine needs at least one exercise.');
  for (const e of kept) {
    const problem = implausibility(e);
    if (problem) throw new DomainError(problem);
  }
  return kept;
}
