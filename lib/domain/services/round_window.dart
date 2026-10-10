import '../core/zone_clock.dart';
import '../models/crate.dart';
import '../models/season.dart';

/// When a Round can be logged against.
///
/// A Round opens at the start of its exercise day in the Crate's time zone
/// and closes at the end of that day plus the Crate's grace period. Logs
/// submitted after close do not count, so the window is the one rule
/// every Peach in a Crate shares regardless of where they live.
final class RoundWindow {
  const RoundWindow({required this.opensAt, required this.closesAt});

  final DateTime opensAt;
  final DateTime closesAt;

  bool isOpenAt(DateTime instant) =>
      !instant.isBefore(opensAt) && instant.isBefore(closesAt);

  bool hasClosedBy(DateTime instant) => !instant.isBefore(closesAt);

  Duration remainingAt(DateTime instant) =>
      closesAt.difference(instant).isNegative
      ? Duration.zero
      : closesAt.difference(instant);
}

final class RoundWindowService {
  const RoundWindowService(this._zone);

  final ZoneClock _zone;

  RoundWindow windowFor(Round round, Crate crate) {
    final opens = _zone.startOfDay(round.date, crate.timeZone);
    final closes = _zone
        .startOfDay(round.date.addDays(1), crate.timeZone)
        .add(Duration(hours: crate.settings.loggingGraceHours));
    return RoundWindow(opensAt: opens, closesAt: closes);
  }
}
