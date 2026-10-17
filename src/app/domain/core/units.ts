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

/**
 * Distance conversion between storage (always metres) and display: kilometres
 * or miles for travel on foot or by bike. Swimming and rowing are metres
 * everywhere, the way pools and ergs count them.
 */
export const DistanceUnits = {
  metersPerMile: 1609.344,

  label(units: UnitSystem): string {
    return units === 'metric' ? 'km' : 'mi';
  },

  toDisplay(meters: number, units: UnitSystem): number {
    return units === 'metric' ? meters / 1000 : meters / DistanceUnits.metersPerMile;
  },

  toMeters(value: number, units: UnitSystem): number {
    return Math.round(units === 'metric' ? value * 1000 : value * DistanceUnits.metersPerMile);
  },

  /** "5", "5.2", "13.11": up to two decimals, no trailing zeros. */
  format(value: number): string {
    return String(Math.round(value * 100) / 100);
  },
} as const;

/** Rounds halves away from zero (`Math.round` rounds them up). */
export function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}
