import 'local_date.dart';

/// Converts between calendar dates in an IANA time zone and UTC instants.
///
/// The domain keeps exercise days as [LocalDate]s in the Crate's zone; this
/// is the single place where those dates meet the clock. The real
/// implementation uses the `timezone` package; tests use [UtcZoneClock].
abstract interface class ZoneClock {
  /// The UTC instant at which [date] begins in [timeZone].
  DateTime startOfDay(LocalDate date, String timeZone);

  /// The calendar date of [instant] as seen in [timeZone].
  LocalDate dateOf(DateTime instant, String timeZone);
}

/// Treats every zone as UTC. Correct for Crates in UTC and good enough for
/// tests; never use it in production.
final class UtcZoneClock implements ZoneClock {
  const UtcZoneClock();

  @override
  DateTime startOfDay(LocalDate date, String timeZone) => date.toDateTime();

  @override
  LocalDate dateOf(DateTime instant, String timeZone) =>
      LocalDate.of(instant.toUtc());
}
