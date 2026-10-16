/**
 * Material 3 Expressive motion springs.
 *
 * Spatial springs (position, size, shape) may overshoot slightly; effects
 * springs (opacity, colour) are critically damped. CSS equivalents live in
 * `theme/_springs.scss` as `--pch-spring-*` linear() easings.
 */
export interface M3Spring {
  readonly dampingRatio: number;
  readonly stiffness: number;
}

export const M3Springs = {
  spatialFast: { dampingRatio: 0.6, stiffness: 800 },
  spatialDefault: { dampingRatio: 0.8, stiffness: 380 },
  spatialSlow: { dampingRatio: 0.8, stiffness: 200 },
  effectsFast: { dampingRatio: 1, stiffness: 3800 },
  effectsDefault: { dampingRatio: 1, stiffness: 1600 },
  effectsSlow: { dampingRatio: 1, stiffness: 800 },
} as const satisfies Record<string, M3Spring>;

/** Position and velocity at `t` seconds of a unit-mass spring from 0 to 1. */
export function springState(s: M3Spring, t: number): [x: number, v: number] {
  const w = Math.sqrt(s.stiffness);
  if (s.dampingRatio >= 1) {
    const e = Math.exp(-w * t);
    return [1 - e * (1 + w * t), e * w * w * t];
  }
  const wd = w * Math.sqrt(1 - s.dampingRatio ** 2);
  const zw = s.dampingRatio * w;
  const e = Math.exp(-zw * t);
  const sin = Math.sin(wd * t);
  return [1 - e * (Math.cos(wd * t) + (zw / wd) * sin), e * sin * ((zw * zw) / wd + wd)];
}

const durations = new Map<M3Spring, number>();

/** Milliseconds until the spring settles. */
export function springDuration(s: M3Spring): number {
  let ms = durations.get(s);
  if (ms === undefined) {
    ms = 3000;
    for (let t = 16; t < 3000; t += 4) {
      const [x, v] = springState(s, t / 1000);
      if (Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) {
        ms = t;
        break;
      }
    }
    durations.set(s, ms);
  }
  return ms;
}

/** The spring as an easing over [springDuration]: maps 0..1 to progress. */
export function springCurve(s: M3Spring): (t: number) => number {
  const seconds = springDuration(s) / 1000;
  return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : springState(s, t * seconds)[0]);
}
