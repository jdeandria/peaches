import { UnitSystem } from '../models/training';

/**
 * Weight conversion between storage (always kilograms) and display.
 *
 * Logs store kilograms so totals and comparisons work across Peaches with
 * different preferences; only entry and display use the Peach's units.
 */
export const WeightUnits = {
  kgPerLb: 0.45359237,

  label(units: UnitSystem): string {
    return units === 'metric' ? 'kg' : 'lb';
  },

  /** The increment a stepper uses: 2.5 kg or 5 lb, the smallest common plate jumps. */
  step(units: UnitSystem): number {
    return units === 'metric' ? 2.5 : 5;
  },

  toDisplay(kg: number, units: UnitSystem): number {
    return units === 'metric' ? kg : kg / WeightUnits.kgPerLb;
  },

  toKg(value: number, units: UnitSystem): number {
    return units === 'metric' ? value : value * WeightUnits.kgPerLb;
  },

  /**
   * Rounds a display value to the nearest quarter unit, so 20 kg shown in
   * pounds reads 44 rather than 44.0924...
   */
  tidy(value: number): number {
    return roundHalfAwayFromZero(value * 4) / 4;
  },

  /** "20", "22.5", "44.25": no trailing zeros. */
  format(value: number): string {
    const t = WeightUnits.tidy(value);
    if (Number.isInteger(t)) return String(t);
    return t.toFixed(2).replace(/0+$/, '');
  },
} as const;

/** Rounds halves away from zero (`Math.round` rounds them up). */
export function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}
