import { categoryWeights, DEFAULT_WEIGHTS, weightsTotal } from '../models/scoring';
import { BallotTally } from './ballot-tally';

describe('BallotTally', () => {
  it('uses the defaults when nobody has voted', () => {
    expect(BallotTally.tally([])).toEqual(DEFAULT_WEIGHTS);
  });

  it('a single ballot is the result', () => {
    const ballot = categoryWeights({ runWalk: 40, reps: 60 });
    expect(BallotTally.tally([ballot])).toEqual(ballot);
  });

  it('averages ballots and keeps the budget at exactly 100', () => {
    const runner = categoryWeights({ runWalk: 100 });
    const lifter = categoryWeights({ weightMoved: 50, reps: 50 });
    const yogi = categoryWeights({ activeMinutes: 100 });
    const tally = BallotTally.tally([runner, lifter, yogi]);
    // 33.3 / 16.7 / 16.7 / 33.3: largest remainders get the spare points.
    expect(tally).toEqual({
      runWalk: 33,
      ride: 0,
      swimRow: 0,
      weightMoved: 17,
      reps: 17,
      activeMinutes: 33,
    });
    expect(weightsTotal(tally)).toBe(100);
  });

  it('breaks remainder ties by category order', () => {
    const a = categoryWeights({ runWalk: 1, ride: 99 });
    const b = categoryWeights({ runWalk: 0, ride: 100 });
    const tally = BallotTally.tally([a, b]);
    // 0.5 / 99.5: both remainders tie, so the earlier category gets the point.
    expect(tally.runWalk).toBe(1);
    expect(tally.ride).toBe(99);
  });

  it('result is always a valid set of weights', () => {
    const ballots = [
      categoryWeights({
        runWalk: 7,
        ride: 13,
        swimRow: 19,
        weightMoved: 23,
        reps: 29,
        activeMinutes: 9,
      }),
      categoryWeights({ runWalk: 50, activeMinutes: 50 }),
      categoryWeights({ swimRow: 1, reps: 99 }),
    ];
    expect(() => categoryWeights(BallotTally.tally(ballots))).not.toThrow();
  });
});
