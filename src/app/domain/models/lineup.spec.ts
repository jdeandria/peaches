import { isLocked, lineupProblem } from './lineup';
import { DEFAULT_LINEUP_RULES } from './scoring';

describe('lineups', () => {
  it('fit the Season’s slots, one pledge per category, each sensible', () => {
    const rules = DEFAULT_LINEUP_RULES;
    expect(lineupProblem([{ category: 'runWalk', target: 10 }], rules)).toBeNull();
    expect(lineupProblem([], rules)).toBeNull();
    expect(
      lineupProblem(
        (['runWalk', 'ride', 'reps', 'swimRow'] as const).map((category) => ({
          category,
          target: 1,
        })),
        rules,
      ),
    ).toMatch(/at most 3/);
    expect(
      lineupProblem(
        [
          { category: 'reps', target: 10 },
          { category: 'reps', target: 20 },
        ],
        rules,
      ),
    ).toMatch(/once/);
    expect(lineupProblem([{ category: 'reps', target: 0 }], rules)).toMatch(/more than zero/);
    expect(lineupProblem([{ category: 'runWalk', target: 500 }], rules)).toMatch(/anyone/);
    expect(lineupProblem([{ category: 'reps', target: 5 }], { ...rules, slots: 0 })).toMatch(
      /doesn’t use lineups/,
    );
  });

  it('lock when the week starts', () => {
    const locksAt = new Date(Date.UTC(2026, 9, 12));
    expect(isLocked({ locksAt }, new Date(locksAt.getTime() - 1))).toBe(false);
    expect(isLocked({ locksAt }, locksAt)).toBe(true);
  });
});
