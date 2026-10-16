/**
 * A small seeded pseudo-random generator (mulberry32).
 *
 * The demo seeder must produce the same output for the same seed on every
 * device and test run, so it never uses `Math.random`. Mulberry32 is
 * fast, has a full 2^32 period and passes the statistical tests that matter
 * for weighted sampling.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** A float in [0, 1). */
  nextDouble(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [0, max). */
  nextInt(max: number): number {
    if (max <= 0) throw new RangeError('max must be positive');
    return Math.floor(this.nextDouble() * max);
  }
}
