/** Clamps `value` into `[min, max]`. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds to hundredths, the precision points are kept in. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
