import 'package:equatable/equatable.dart';

/// A calendar date with no time or zone component.
///
/// Exercise days, season boundaries and logging windows are all calendar
/// dates in the owning Crate's time zone. Using [DateTime] for those would
/// silently drag a time zone along and produce off-by-one-day bugs, so the
/// domain uses this type instead and converts at the edges.
final class LocalDate extends Equatable implements Comparable<LocalDate> {
  const LocalDate(this.year, this.month, this.day)
    : assert(month >= 1 && month <= 12, 'month must be 1..12'),
      assert(day >= 1 && day <= 31, 'day must be 1..31');

  /// Builds a [LocalDate] from the calendar fields of [dateTime], ignoring
  /// its time and zone. Convert to the desired zone before calling.
  factory LocalDate.of(DateTime dateTime) =>
      LocalDate(dateTime.year, dateTime.month, dateTime.day);

  /// Parses an ISO-8601 calendar date (`yyyy-MM-dd`).
  factory LocalDate.parse(String iso) {
    final match = _isoPattern.firstMatch(iso);
    if (match == null) throw FormatException('Invalid LocalDate', iso);
    return LocalDate(
      int.parse(match.group(1)!),
      int.parse(match.group(2)!),
      int.parse(match.group(3)!),
    );
  }

  static final _isoPattern = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  final int year;
  final int month;
  final int day;

  /// ISO weekday: Monday = 1 ... Sunday = 7 (matches [DateTime.weekday]).
  int get weekday => toDateTime().weekday;

  /// Days since the Unix epoch, convenient for arithmetic and sorting.
  int get epochDay => toDateTime().difference(DateTime.utc(1970)).inDays;

  DateTime toDateTime() => DateTime.utc(year, month, day);

  LocalDate addDays(int days) =>
      LocalDate.of(toDateTime().add(Duration(days: days)));

  int daysUntil(LocalDate other) => other.epochDay - epochDay;

  bool isBefore(LocalDate other) => compareTo(other) < 0;
  bool isAfter(LocalDate other) => compareTo(other) > 0;

  String toIso() => '$year-${_pad(month)}-${_pad(day)}';

  static String _pad(int value) => value.toString().padLeft(2, '0');

  @override
  int compareTo(LocalDate other) => epochDay.compareTo(other.epochDay);

  @override
  List<Object?> get props => [year, month, day];

  @override
  String toString() => toIso();
}
