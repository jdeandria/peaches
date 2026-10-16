import { addDays, LocalDate, localDate } from '../core/local-date';
import { loadsLower, loadsUpper, SessionFocus, TRAINING_GOALS } from '../models/training';
import { FocusRotation } from './focus-rotation';

describe('FocusRotation', () => {
  const rotation = new FocusRotation();
  const days = (octoberDays: number[]): LocalDate[] =>
    octoberDays.map((d) => localDate(2026, 10, d));

  it('returns one focus per day', () => {
    expect(rotation.assign(days([1, 3, 5, 8, 10]), 'generalFitness').length).toBe(5);
  });

  it('cycles through the general sequence on spaced days', () => {
    expect(rotation.assign(days([1, 3, 5, 7, 9]), 'generalFitness')).toEqual<SessionFocus[]>([
      'fullBody',
      'upperBody',
      'lowerBody',
      'conditioning',
      'fullBody',
    ]);
  });

  it('cycles through the strength sequence on spaced days', () => {
    expect(rotation.assign(days([1, 3, 5, 7]), 'strength')).toEqual<SessionFocus[]>([
      'lowerBody',
      'upperBody',
      'fullBody',
      'lowerBody',
    ]);
  });

  it('never loads the same region hard on consecutive days', () => {
    for (const goal of TRAINING_GOALS) {
      const result = rotation.assign(days([1, 2, 3, 4, 5, 6, 7, 8]), goal);
      for (let i = 1; i < result.length; i++) {
        const a = result[i - 1];
        const b = result[i];
        expect(loadsUpper(a) && loadsUpper(b), `${goal} day ${i}: ${a} -> ${b}`).toBe(false);
        expect(loadsLower(a) && loadsLower(b), `${goal} day ${i}: ${a} -> ${b}`).toBe(false);
      }
    }
  });

  it('treats days that straddle a month or year end as consecutive', () => {
    const straddle = [localDate(2026, 12, 31), localDate(2027, 1, 1)];
    // fullBody then upperBody would both load the upper body.
    const result = rotation.assign(straddle, 'generalFitness');
    expect(result[0]).toBe('fullBody');
    expect(loadsUpper(result[1])).toBe(false);
    const leap = [localDate(2028, 2, 28), localDate(2028, 2, 29), localDate(2028, 3, 1)];
    const r2 = rotation.assign(leap, 'generalFitness');
    for (let i = 1; i < r2.length; i++) {
      expect(loadsUpper(r2[i - 1]) && loadsUpper(r2[i])).toBe(false);
      expect(loadsLower(r2[i - 1]) && loadsLower(r2[i])).toBe(false);
    }
  });

  it('long daily seasons stay valid for every goal', () => {
    const daily = Array.from({ length: 60 }, (_, i) => addDays(localDate(2026, 10, 1), i));
    for (const goal of TRAINING_GOALS) {
      const result = rotation.assign(daily, goal);
      expect(result.length).toBe(60);
      for (let i = 1; i < result.length; i++) {
        expect(loadsUpper(result[i - 1]) && loadsUpper(result[i])).toBe(false);
        expect(loadsLower(result[i - 1]) && loadsLower(result[i])).toBe(false);
      }
    }
  });

  it('endurance goal emphasises conditioning', () => {
    const result = rotation.assign(days([1, 4, 7, 10]), 'endurance');
    expect(result.filter((f) => f === 'conditioning').length).toBe(2);
  });

  it('handles empty input', () => {
    expect(rotation.assign([], 'strength')).toEqual([]);
  });
});
