import 'package:timezone/data/latest_10y.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../../domain/core/local_date.dart';
import '../../domain/core/zone_clock.dart';

/// [ZoneClock] backed by the IANA database bundled with `package:timezone`.
/// Unknown zone names fall back to UTC rather than throwing, since a bad
/// zone string on one Crate must never take the app down.
final class TzZoneClock implements ZoneClock {
  TzZoneClock() {
    if (!_initialised) {
      tzdata.initializeTimeZones();
      _initialised = true;
    }
  }

  static bool _initialised = false;

  tz.Location _location(String name) {
    try {
      return tz.getLocation(name);
    } on tz.LocationNotFoundException {
      return tz.UTC;
    }
  }

  @override
  DateTime startOfDay(LocalDate date, String timeZone) => tz.TZDateTime(
    _location(timeZone),
    date.year,
    date.month,
    date.day,
  ).toUtc();

  @override
  LocalDate dateOf(DateTime instant, String timeZone) {
    final local = tz.TZDateTime.from(instant, _location(timeZone));
    return LocalDate(local.year, local.month, local.day);
  }
}
