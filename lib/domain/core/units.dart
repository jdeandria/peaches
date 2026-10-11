import '../models/training.dart';

/// Weight conversion between storage (always kilograms) and display.
///
/// Logs store kilograms so totals and comparisons work across Peaches with
/// different preferences; only entry and display use the Peach's units.
abstract final class WeightUnits {
  static const kgPerLb = 0.45359237;

  static String label(UnitSystem units) =>
      units == UnitSystem.metric ? 'kg' : 'lb';

  /// The increment a stepper uses: 2.5 kg or 5 lb, the smallest common
  /// plate jumps.
  static double step(UnitSystem units) => units == UnitSystem.metric ? 2.5 : 5;

  static double toDisplay(double kg, UnitSystem units) =>
      units == UnitSystem.metric ? kg : kg / kgPerLb;

  static double toKg(double value, UnitSystem units) =>
      units == UnitSystem.metric ? value : value * kgPerLb;

  /// Rounds a display value to the nearest quarter unit, so 20 kg shown in
  /// pounds reads 44.1 rather than 44.0924...
  static double tidy(double value) => (value * 4).round() / 4;

  /// "20", "22.5", "44.25": no trailing zeros.
  static String format(double value) {
    final t = tidy(value);
    if (t == t.roundToDouble()) return t.toInt().toString();
    return t.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
  }
}
