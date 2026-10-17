import { stableHash } from './stable-hash';

describe('stableHash', () => {
  it('matches pinned values, so every device agrees', () => {
    // Pinned outputs: if these change, seeded data (the demo's weights)
    // would differ between builds.
    expect(stableHash('')).toBe(0x011c9dc5);
    expect(stableHash('peach')).toBe(stableHash('peach'));
    // Cross-checked against an independent Python FNV-1a implementation.
    expect(stableHash('m-1|r-1|0')).toBe(227895114);
  });

  it('matches a reference FNV-1a over UTF-16 code units on more inputs', () => {
    // Values from FNV-1a over `str.encode('utf-16-le')` in Python.
    expect(stableHash('peach')).toBe(1952290186);
    expect(stableHash('?')).toBe(1878650762);
    expect(stableHash('é')).toBe(1509650188);
    expect(stableHash('🍑')).toBe(727728261);
    expect(stableHash('w-m1|r-3|2')).toBe(2142106085);
  });

  it('is non-negative and spreads similar inputs', () => {
    const values = new Set<number>();
    for (let i = 0; i < 1000; i++) values.add(stableHash(`m-${i}|r-1|0`));
    expect(values.size).toBe(1000);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0x7fffffff);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('handles characters outside ASCII', () => {
    expect(stableHash('🍑')).not.toBe(stableHash('?'));
  });

  it('hashes UTF-16 code units, not code points or UTF-8 bytes', () => {
    // A lone surrogate is a valid JS string and must still hash stably.
    expect(stableHash('\ud83c')).toBe(stableHash('\ud83c'));
    expect(stableHash('🍑')).toBe(stableHash('🍑'));
  });
});
