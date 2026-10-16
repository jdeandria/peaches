import { ExerciseCatalog } from '../domain/exercises/exercise-catalog';
import { Equipment } from '../domain/exercises/taxonomy';
import { ExerciseCapability } from '../domain/models/capability';
import { CapabilityRepository } from '../domain/repositories';

/** Maintains a Peach's "I can do this" declarations. */
export class CapabilityService {
  constructor(
    private readonly capabilities: CapabilityRepository,
    private readonly catalog: ExerciseCatalog,
  ) {}

  setAble(peachId: string, exerciseId: string, able: boolean, now: Date): Promise<void> {
    return this.capabilities.save({
      peachId,
      exerciseId,
      status: able ? 'able' : 'unable',
      updatedAt: now,
      notes: null,
    });
  }

  /**
   * Marks every catalog exercise performable with `equipment` and at or
   * below `maxDifficulty` as able. A quick-start for new Peaches. Returns
   * how many exercises were enabled.
   */
  async enableForEquipment(args: {
    peachId: string;
    equipment: ReadonlySet<Equipment>;
    maxDifficulty: number;
    now: Date;
  }): Promise<number> {
    const caps: ExerciseCapability[] = this.catalog
      .performableWith(args.equipment)
      .filter((e) => e.difficulty <= args.maxDifficulty)
      .map((e) => ({
        peachId: args.peachId,
        exerciseId: e.id,
        status: 'able',
        updatedAt: args.now,
        notes: null,
      }));
    await this.capabilities.saveAll(caps);
    return caps.length;
  }
}
