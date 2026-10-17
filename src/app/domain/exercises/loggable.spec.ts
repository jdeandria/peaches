import { ExerciseCatalog } from './exercise-catalog';
import { distanceKindOf, loggableFromCatalog } from './loggable';

describe('loggable exercises', () => {
  const catalog = ExerciseCatalog.standard();
  const kind = (id: string) => distanceKindOf(catalog.require(id));

  it('classifies cardio by how it travels', () => {
    expect(kind('bw-run')).toBe('runWalk');
    expect(kind('bw-walk')).toBe('runWalk');
    expect(kind('treadmill-run')).toBe('runWalk');
    expect(kind('outdoor-cycling')).toBe('ride');
    expect(kind('bike-steady')).toBe('ride');
    expect(kind('row-steady')).toBe('swimRow');
    expect(kind('swim-freestyle')).toBe('swimRow');
  });

  it('carries, jump rope and strength work score no distance', () => {
    expect(kind('db-farmer-carry')).toBeNull();
    expect(kind('rope-jump')).toBeNull();
    expect(kind('bw-shadow-boxing')).toBeNull();
    expect(kind('bw-walking-lunge')).toBeNull();
  });

  it('every catalog exercise maps to a track', () => {
    for (const e of catalog.all) {
      const l = loggableFromCatalog(e);
      if (l.distanceKind !== null) expect(l.track).toBe('distance');
      if (e.measurement === 'reps' || e.measurement === 'loadedReps') {
        expect(l.track).toBe('reps');
      }
    }
    expect(loggableFromCatalog(catalog.require('bike-steady')).track).toBe('distance');
    expect(loggableFromCatalog(catalog.require('bw-forearm-plank')).track).toBe('time');
    expect(loggableFromCatalog(catalog.require('db-bench-press')).takesLoad).toBe(true);
  });
});
