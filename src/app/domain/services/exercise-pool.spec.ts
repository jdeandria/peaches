import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { ExerciseCapability } from '../models/capability';
import { crateSettings } from '../models/crate';
import { ExercisePoolService } from './exercise-pool';

describe('ExercisePoolService', () => {
  const catalog = ExerciseCatalog.standard();
  const service = new ExercisePoolService(catalog);
  const now = new Date(Date.UTC(2026, 0, 1));

  const able = (peachId: string, exerciseId: string): ExerciseCapability => ({
    peachId,
    exerciseId,
    status: 'able',
    updatedAt: now,
    notes: null,
  });
  const unable = (peachId: string, exerciseId: string): ExerciseCapability => ({
    ...able(peachId, exerciseId),
    status: 'unable',
  });

  const caps = [
    able('p1', 'bw-push-up'),
    able('p1', 'bw-air-squat'),
    able('p1', 'bw-pull-up'),
    unable('p1', 'bw-burpee'),
    able('p2', 'bw-push-up'),
    able('p2', 'bw-air-squat'),
    able('p2', 'bw-burpee'),
    able('p3', 'bw-air-squat'),
  ];

  it('ableIdsOf returns only able exercises for that Peach', () => {
    expect(service.ableIdsOf('p1', caps)).toEqual(
      new Set(['bw-push-up', 'bw-air-squat', 'bw-pull-up']),
    );
    expect(service.ableIdsOf('nobody', caps).size).toBe(0);
  });

  it('sharedIds is the intersection across Peaches', () => {
    expect(service.sharedIds(['p1', 'p2'], caps)).toEqual(new Set(['bw-push-up', 'bw-air-squat']));
    expect(service.sharedIds(['p1', 'p2', 'p3'], caps)).toEqual(new Set(['bw-air-squat']));
    expect(service.sharedIds(['p1'], caps)).toEqual(service.ableIdsOf('p1', caps));
    expect(service.sharedIds([], caps).size).toBe(0);
  });

  it('sharedIds accepts one-shot iterables for capabilities', () => {
    function* gen() {
      yield* caps;
    }
    expect(service.sharedIds(['p1', 'p2'], gen())).toEqual(new Set(['bw-push-up', 'bw-air-squat']));
  });

  it('resolve drops unknown ids and applies crate exclusions', () => {
    const pool = service.resolve(['bw-push-up', 'ghost', 'bw-air-squat', 'bw-pull-up'], {
      settings: crateSettings({ excludedExerciseIds: ['bw-pull-up'] }),
    });
    expect(new Set(pool.map((e) => e.id))).toEqual(new Set(['bw-push-up', 'bw-air-squat']));
  });

  it('resolve honours joint-stress exclusions and difficulty cap', () => {
    const pool = service.resolve(
      ['bw-push-up', 'bw-air-squat', 'bw-pistol-squat', 'bw-glute-bridge'],
      { settings: crateSettings({ excludedJointStress: ['knee'] }), maxDifficulty: 3 },
    );
    // push-up stresses wrist/shoulder only; squats stress the knee;
    // glute bridge has no joint flags.
    expect(new Set(pool.map((e) => e.id))).toEqual(new Set(['bw-push-up', 'bw-glute-bridge']));
  });

  it('resolve returns catalog order whatever order the ids arrive in', () => {
    // Backends load capabilities in different orders; the generator's draw
    // depends on candidate order, so every device must see the same order.
    const ids = ['bw-push-up', 'bw-air-squat', 'bw-glute-bridge', 'bw-pull-up'];
    const forward = service.resolve(ids).map((e) => e.id);
    const backward = service.resolve([...ids].reverse()).map((e) => e.id);
    expect(backward).toEqual(forward);
    const catalogOrder = catalog.all.map((e) => e.id).filter((id) => ids.includes(id));
    expect(forward).toEqual(catalogOrder);
  });

  it('resolve applies the difficulty cap on its own', () => {
    const pool = service.resolve(
      catalog.all.map((e) => e.id),
      { maxDifficulty: 1 },
    );
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every((e) => e.difficulty <= 1)).toBe(true);
  });

  it('poolFor composes intersection and resolution', () => {
    const pool = service.poolFor(['p1', 'p2'], caps);
    expect(new Set(pool.map((e) => e.id))).toEqual(new Set(['bw-push-up', 'bw-air-squat']));
  });
});
