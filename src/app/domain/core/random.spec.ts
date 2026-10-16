import { SeededRandom } from './random';

function sequence(seed: number, n: number): number[] {
  const r = new SeededRandom(seed);
  return Array.from({ length: n }, () => r.nextDouble());
}

describe('SeededRandom', () => {
  it('is deterministic for a seed', () => {
    expect(sequence(42, 100)).toEqual(sequence(42, 100));
    expect(sequence(0, 100)).toEqual(sequence(0, 100));
  });

  it('different seeds give different streams', () => {
    expect(sequence(1, 20)).not.toEqual(sequence(2, 20));
    // Similar seeds (as produced by stableHash on similar ids) diverge at once.
    const firsts = new Set<number>();
    for (let seed = 0; seed < 1000; seed++) firsts.add(new SeededRandom(seed).nextDouble());
    expect(firsts.size).toBe(1000);
  });

  it('treats seeds as unsigned 32-bit integers', () => {
    expect(sequence(-1, 10)).toEqual(sequence(0xffffffff, 10));
    expect(sequence(2 ** 32 + 5, 10)).toEqual(sequence(5, 10));
    // The largest stableHash output is a valid seed.
    expect(sequence(0x7fffffff, 10).every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('nextDouble stays in [0, 1)', () => {
    for (const seed of [0, 1, 7, 0x7fffffff, 0xffffffff, 123456789]) {
      for (const x of sequence(seed, 2000)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(1);
      }
    }
  });

  it('nextInt stays in [0, max) and rejects non-positive max', () => {
    const r = new SeededRandom(9);
    for (let i = 0; i < 2000; i++) {
      const v = r.nextInt(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
    expect(new SeededRandom(1).nextInt(1)).toBe(0);
    expect(() => r.nextInt(0)).toThrow(RangeError);
    expect(() => r.nextInt(-3)).toThrow(RangeError);
  });

  it('is roughly uniform', () => {
    const buckets = new Array<number>(10).fill(0);
    const n = 100_000;
    const r = new SeededRandom(2026);
    for (let i = 0; i < n; i++) buckets[Math.floor(r.nextDouble() * 10)]++;
    // Chi-squared with 9 degrees of freedom; p = 0.001 critical value is 27.88.
    const expected = n / 10;
    const chi2 = buckets.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(27.88);

    let sum = 0;
    const r2 = new SeededRandom(7);
    for (let i = 0; i < n; i++) sum += r2.nextDouble();
    expect(sum / n).toBeCloseTo(0.5, 2);
  });

  it('nextInt covers every value', () => {
    const seen = new Set<number>();
    const r = new SeededRandom(3);
    for (let i = 0; i < 500; i++) seen.add(r.nextInt(5));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
