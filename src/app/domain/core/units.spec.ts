import { ExerciseCatalog } from '../exercises/exercise-catalog';
import { takesLoad } from '../exercises/exercise';
import { roundHalfAwayFromZero, WeightUnits } from './units';

describe('WeightUnits', () => {
  it('metric is the identity', () => {
    expect(WeightUnits.toDisplay(20, 'metric')).toBe(20);
    expect(WeightUnits.toKg(20, 'metric')).toBe(20);
    expect(WeightUnits.label('metric')).toBe('kg');
    expect(WeightUnits.step('metric')).toBe(2.5);
  });

  it('imperial converts both ways', () => {
    expect(WeightUnits.toKg(100, 'imperial')).toBeCloseTo(45.359, 3);
    expect(Math.abs(WeightUnits.toDisplay(45.359237, 'imperial') - 100)).toBeLessThan(1e-9);
    expect(WeightUnits.label('imperial')).toBe('lb');
    expect(WeightUnits.step('imperial')).toBe(5);
  });

  it('round trips are lossless for stored values', () => {
    for (const kg of [2.5, 20.0, 61.25, 140.0]) {
      const shown = WeightUnits.toDisplay(kg, 'imperial');
      expect(Math.abs(WeightUnits.toKg(shown, 'imperial') - kg)).toBeLessThan(1e-9);
    }
  });

  it('formats without trailing zeros', () => {
    expect(WeightUnits.format(20)).toBe('20');
    expect(WeightUnits.format(22.5)).toBe('22.5');
    expect(WeightUnits.format(44.0924)).toBe('44');
    expect(WeightUnits.format(44.13)).toBe('44.25');
    expect(WeightUnits.format(44.75)).toBe('44.75');
    expect(WeightUnits.format(0)).toBe('0');
  });

  it('tidy rounds quarter-way ties away from zero, ', () => {
    // x * 4 lands exactly on .5: we round away from zero, while
    // JS Math.round would send negative ties toward +infinity.
    expect(WeightUnits.tidy(10.125)).toBe(10.25); // 40.5 -> 41
    expect(WeightUnits.tidy(-10.125)).toBe(-10.25); // -40.5 -> -41 (Math.round gives -40)
    expect(WeightUnits.tidy(0.125)).toBe(0.25);
    expect(WeightUnits.format(-10.125)).toBe('-10.25');
    expect(WeightUnits.format(-2.5)).toBe('-2.5');
  });

  it('roundHalfAwayFromZero mirrors num.round()', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
    expect(roundHalfAwayFromZero(0) === 0).toBe(true);
  });
});

describe('takesLoad', () => {
  const catalog = ExerciseCatalog.standard();

  it('every barbell, dumbbell and kettlebell exercise takes a load', () => {
    for (const e of catalog.all) {
      if (e.equipment.some((q) => q === 'barbell' || q === 'dumbbell' || q === 'kettlebell')) {
        expect(takesLoad(e), e.id).toBe(true);
      }
    }
  });

  it('bodyweight and band exercises do not', () => {
    expect(takesLoad(catalog.require('bw-push-up'))).toBe(false);
    expect(takesLoad(catalog.require('band-row'))).toBe(false);
    expect(takesLoad(catalog.require('trx-row'))).toBe(false);
  });

  it('weighted carries and holds do', () => {
    expect(takesLoad(catalog.require('db-farmer-carry'))).toBe(true);
    expect(takesLoad(catalog.require('db-suitcase-hold'))).toBe(true);
    expect(takesLoad(catalog.require('sled-push'))).toBe(true);
  });
});
