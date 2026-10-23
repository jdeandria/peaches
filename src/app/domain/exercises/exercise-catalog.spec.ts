import { STANDARD_CATALOG_VERSION, STANDARD_EXERCISES } from './catalog-data';
import {
  allMuscles,
  Exercise,
  exerciseFromJson,
  exerciseToJson,
  isBodyweight,
  isPerformableWith,
  regionsOf,
  takesLoad,
} from './exercise';
import { ExerciseCatalog, searchRank } from './exercise-catalog';
import {
  EQUIPMENT,
  isCore,
  isLoadEquipment,
  isPull,
  isPush,
  JOINT_STRESSES,
  LATERALITIES,
  MEASUREMENT_TYPES,
  MECHANICS,
  MODALITIES,
  MOVEMENT_PATTERNS,
  MovementPattern,
  MUSCLE_GROUPS,
  regionOf,
} from './taxonomy';

describe('standard catalog integrity', () => {
  const catalog = ExerciseCatalog.standard();

  it('is large', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(400);
  });

  it('ships the 440 exercises of catalog version 1', () => {
    expect(catalog.length).toBe(440);
    expect(STANDARD_EXERCISES.length).toBe(440);
    expect(catalog.version).toBe(STANDARD_CATALOG_VERSION);
    expect(STANDARD_CATALOG_VERSION).toBe(1);
  });

  it('is a shared instance', () => {
    expect(ExerciseCatalog.standard()).toBe(catalog);
  });

  it('ids are unique, kebab-case slugs', () => {
    const ids = catalog.all.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const id of ids) expect(slug.test(id), `${id} is not a slug`).toBe(true);
  });

  it('names are unique', () => {
    const names = catalog.all.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('every exercise names at least one primary muscle', () => {
    for (const e of catalog.all) expect(e.primaryMuscles.length, e.id).toBeGreaterThan(0);
  });

  it('primary and secondary muscles do not overlap', () => {
    for (const e of catalog.all) {
      const overlap = e.primaryMuscles.filter((m) => e.secondaryMuscles.includes(m));
      expect(overlap, e.id).toEqual([]);
    }
  });

  it('every field holds a known taxonomy value', () => {
    for (const e of catalog.all) {
      expect(MOVEMENT_PATTERNS, e.id).toContain(e.pattern);
      expect(MODALITIES, e.id).toContain(e.modality);
      expect(MEASUREMENT_TYPES, e.id).toContain(e.measurement);
      expect(MECHANICS, e.id).toContain(e.mechanics);
      expect(LATERALITIES, e.id).toContain(e.laterality);
      for (const m of allMuscles(e)) expect(MUSCLE_GROUPS, e.id).toContain(m);
      for (const q of e.equipment) expect(EQUIPMENT, e.id).toContain(q);
      for (const j of e.jointStress) expect(JOINT_STRESSES, e.id).toContain(j);
      expect(Number.isInteger(e.difficulty), e.id).toBe(true);
      expect(e.difficulty, e.id).toBeGreaterThanOrEqual(1);
      expect(e.difficulty, e.id).toBeLessThanOrEqual(5);
      expect(e.met, e.id).toBeGreaterThan(0);
    }
  });

  it('every movement pattern is represented', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      expect(catalog.withPattern(pattern).length, pattern).toBeGreaterThan(0);
    }
  });

  it('every main pattern has bodyweight options at difficulty <= 2', () => {
    const mainPatterns: MovementPattern[] = [
      'squat',
      'hinge',
      'lunge',
      'horizontalPush',
      'horizontalPull',
      'antiExtension',
      'rotation',
      'antiLateralFlexion',
      'coreFlexion',
      'plyometric',
      'locomotion',
      'mobility',
      'stretch',
    ];
    for (const pattern of mainPatterns) {
      const easyBodyweight = catalog
        .withPattern(pattern)
        .filter((e) => isBodyweight(e) && e.difficulty <= 2);
      expect(easyBodyweight.length, pattern).toBeGreaterThan(0);
    }
  });

  it('warm-up and cool-down patterns use matching modalities', () => {
    for (const e of catalog.withPattern('mobility')) expect(e.modality, e.id).toBe('mobility');
    for (const e of catalog.withPattern('stretch')) {
      expect(e.modality, e.id).toBe('flexibility');
      expect(e.measurement, e.id).toBe('duration');
    }
  });

  it('locomotion is always conditioning work', () => {
    for (const e of catalog.withPattern('locomotion')) {
      expect(e.modality, e.id).toBe('conditioning');
      expect(e.measurement, e.id).not.toBe('loadedReps');
    }
  });

  it('loaded exercises require equipment', () => {
    for (const e of catalog.all) {
      if (e.measurement === 'loadedReps') expect(e.equipment.length, e.id).toBeGreaterThan(0);
    }
  });

  it('isolation mechanics only appear in accessory-style patterns', () => {
    const allowed: MovementPattern[] = [
      'isolation',
      'horizontalPull',
      'verticalPull',
      'antiLateralFlexion',
    ];
    for (const e of catalog.all) {
      if (e.mechanics === 'isolation') expect(allowed, e.id).toContain(e.pattern);
    }
  });

  it('progression families link at least two exercises', () => {
    const counts = new Map<string, number>();
    for (const e of catalog.all) {
      if (e.family !== null) counts.set(e.family, (counts.get(e.family) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThan(0);
    for (const [family, n] of counts) expect(n, family).toBeGreaterThanOrEqual(2);
    for (const family of counts.keys()) {
      expect(catalog.inFamily(family).length).toBe(counts.get(family));
    }
  });

  it('optional fields use null, never undefined', () => {
    for (const e of catalog.all) {
      expect(e.family === undefined, e.id).toBe(false);
      expect(e.cues === undefined, e.id).toBe(false);
    }
  });

  it('every exercise round-trips through JSON', () => {
    for (const e of catalog.all) {
      const json = exerciseToJson(e);
      const copy = exerciseFromJson(JSON.parse(JSON.stringify(json)));
      expect(exerciseToJson(copy), e.id).toEqual(json);
      expect(copy, e.id).toEqual(e);
    }
  });
});

describe('Exercise helpers', () => {
  const catalog = ExerciseCatalog.standard();

  it('derive bodyweight, regions and muscles', () => {
    const pushUp = catalog.require('bw-push-up');
    expect(isBodyweight(pushUp)).toBe(true);
    expect(regionsOf(pushUp).has('upper')).toBe(true);
    expect(allMuscles(pushUp).size).toBe(
      new Set([...pushUp.primaryMuscles, ...pushUp.secondaryMuscles]).size,
    );
    expect(isBodyweight(catalog.require('db-farmer-carry'))).toBe(false);
  });

  it('isPerformableWith needs every listed piece of equipment', () => {
    const e = catalog.all.find((x) => x.equipment.length >= 2)!;
    expect(isPerformableWith(e, new Set(e.equipment))).toBe(true);
    expect(isPerformableWith(e, new Set(e.equipment.slice(1)))).toBe(false);
    expect(isPerformableWith(catalog.require('bw-push-up'), new Set())).toBe(true);
  });

  it('takesLoad follows the load-bearing equipment classification', () => {
    for (const e of catalog.all) {
      expect(takesLoad(e), e.id).toBe(
        e.measurement === 'loadedReps' || e.equipment.some(isLoadEquipment),
      );
    }
    expect(isLoadEquipment('resistanceBand')).toBe(false);
    expect(isLoadEquipment('suspensionTrainer')).toBe(false);
    expect(isLoadEquipment('sandbag')).toBe(true);
  });

  it('pattern and region predicates', () => {
    expect(isPush('horizontalPush') && isPush('verticalPush')).toBe(true);
    expect(isPull('horizontalPull') && isPull('verticalPull')).toBe(true);
    expect(isCore('antiLateralFlexion')).toBe(true);
    expect(isCore('carry')).toBe(false);
    expect(regionOf('lowerBack')).toBe('core');
    expect(regionOf('fullBody')).toBe('systemic');
    for (const m of MUSCLE_GROUPS) expect(regionOf(m), m).toBeDefined();
  });

  it('fromJson applies defaults and drops unknown list entries', () => {
    const e = exerciseFromJson({
      id: 'x-test',
      name: 'Test',
      pattern: 'squat',
      primaryMuscles: ['quadriceps', 'tentacles'],
      modality: 'strength',
      measurement: 'reps',
      equipment: ['dumbbell', 'jetpack'],
      mechanics: 'quantum',
    });
    expect(e.primaryMuscles).toEqual(['quadriceps']);
    expect(e.equipment).toEqual(['dumbbell']);
    expect(e.mechanics).toBe('compound');
    expect(e.laterality).toBe('bilateral');
    expect(e.difficulty).toBe(2);
    expect(e.met).toBe(5);
    expect(e.family).toBeNull();
    expect(e.cues).toBeNull();
    expect(e.aliases).toEqual([]);
  });

  it('fromJson rejects an unknown pattern (no safe fallback)', () => {
    expect(() =>
      exerciseFromJson({
        id: 'x',
        name: 'x',
        pattern: 'teleport',
        primaryMuscles: [],
        modality: 'strength',
        measurement: 'reps',
      }),
    ).toThrow();
  });
});

describe('ExerciseCatalog queries', () => {
  const catalog = ExerciseCatalog.standard();

  it('byId and require', () => {
    expect(catalog.byId('bw-push-up')?.name).toBe('Push Up');
    expect(catalog.byId('nope')).toBeUndefined();
    expect(() => catalog.require('nope')).toThrow(RangeError);
  });

  it('byIds drops unknown ids', () => {
    const found = catalog.byIds(['bw-push-up', 'ghost', 'bw-air-squat']);
    expect(found.map((e) => e.id)).toEqual(['bw-push-up', 'bw-air-squat']);
  });

  it('performableWith filters by equipment', () => {
    const bodyweightOnly = catalog.performableWith(new Set());
    expect(bodyweightOnly.every(isBodyweight)).toBe(true);
    const withDumbbells = catalog.performableWith(new Set(['dumbbell']));
    expect(withDumbbells.length).toBeGreaterThan(bodyweightOnly.length);
    expect(withDumbbells.some((e) => e.equipment.includes('barbell'))).toBe(false);
  });

  it('withModality filters by modality', () => {
    const power = catalog.withModality('power');
    expect(power.length).toBeGreaterThan(0);
    expect(power.every((e) => e.modality === 'power')).toBe(true);
  });

  it('search matches names and aliases case-insensitively', () => {
    expect(catalog.search('AIR squat').map((e) => e.id)).toContain('bw-air-squat');
    expect(catalog.search('military').map((e) => e.id)).toContain('bb-overhead-press');
    expect(catalog.search('   ').length).toBe(catalog.length);
    expect(catalog.search('zzzz-no-such-thing')).toEqual([]);
  });

  it('search forgives hyphens, spacing and plurals, best matches first', () => {
    for (const q of ['pushup', 'push-ups', 'Push ups', 'PUSH UP']) {
      expect(catalog.search(q)[0]?.id).toBe('bw-push-up');
    }
    // An alias that starts with the query beats a name that merely contains a word of it.
    expect(catalog.search('air squat')[0]?.id).toBe('bw-air-squat');
    expect(catalog.search('air squat').map((e) => e.id)).not.toContain('bw-chair-squat');
    expect(catalog.search('bench presses').map((e) => e.id)).toContain('bb-bench-press');
    expect(catalog.search('deadlifts').map((e) => e.id)).toContain('bb-deadlift');
  });

  it('ranks matches: name prefix, alias prefix, name, alias', () => {
    expect(searchRank('push', 'Push Up')).toBe(0);
    expect(searchRank('air squat', 'Bodyweight Squat', ['Air Squat'])).toBe(1);
    expect(searchRank('squat', 'Goblet Squat')).toBe(2);
    expect(searchRank('press', 'Strict Thing', ['Shoulder Press'])).toBe(3);
    expect(searchRank('air', 'Chair Squat')).toBeNull();
    expect(searchRank('  ', 'Push Up')).toBeNull();
  });

  it('rejects duplicate ids', () => {
    const e = catalog.require('bw-push-up');
    expect(() => new ExerciseCatalog([e, e])).toThrow();
  });

  it('all returns a copy that cannot corrupt the catalog', () => {
    const all = catalog.all;
    all.length = 0;
    expect(catalog.all.length).toBe(440);
  });

  it('a custom catalog only knows its own exercises', () => {
    const subset: Exercise[] = catalog.byIds(['bw-push-up', 'bw-air-squat']);
    const custom = new ExerciseCatalog(subset, 7);
    expect(custom.length).toBe(2);
    expect(custom.version).toBe(7);
    expect(custom.byId('bw-burpee')).toBeUndefined();
  });
});
