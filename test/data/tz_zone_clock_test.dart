import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/data/tz/tz_zone_clock.dart';
import 'package:peaches/domain/core/local_date.dart';

void main() {
  final clock = TzZoneClock();

  test('start of day honours the zone offset', () {
    // New York is UTC-4 in October (EDT).
    expect(
      clock.startOfDay(const LocalDate(2026, 10, 10), 'America/New_York'),
      DateTime.utc(2026, 10, 10, 4),
    );
    // Tokyo is UTC+9.
    expect(
      clock.startOfDay(const LocalDate(2026, 10, 10), 'Asia/Tokyo'),
      DateTime.utc(2026, 10, 9, 15),
    );
  });

  test('dateOf converts an instant into the zone calendar', () {
    final instant = DateTime.utc(2026, 10, 10, 2); // 22:00 the day before in NY
    expect(
      clock.dateOf(instant, 'America/New_York'),
      const LocalDate(2026, 10, 9),
    );
    expect(clock.dateOf(instant, 'Asia/Tokyo'), const LocalDate(2026, 10, 10));
    expect(clock.dateOf(instant, 'UTC'), const LocalDate(2026, 10, 10));
  });

  test('unknown zones fall back to UTC', () {
    expect(
      clock.startOfDay(const LocalDate(2026, 1, 1), 'Mars/Olympus'),
      DateTime.utc(2026),
    );
  });
}
