import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/core/local_date.dart';

void main() {
  group('LocalDate', () {
    test('parses and formats ISO dates', () {
      final d = LocalDate.parse('2026-03-07');
      expect(d.year, 2026);
      expect(d.month, 3);
      expect(d.day, 7);
      expect(d.toIso(), '2026-03-07');
      expect(d.toString(), '2026-03-07');
    });

    test('rejects malformed input', () {
      expect(() => LocalDate.parse('2026-3-7'), throwsFormatException);
      expect(() => LocalDate.parse('yesterday'), throwsFormatException);
    });

    test('ignores time and zone when built from a DateTime', () {
      final late = DateTime.utc(2026, 1, 31, 23, 59);
      expect(LocalDate.of(late), const LocalDate(2026, 1, 31));
    });

    test('adds days across month and year boundaries', () {
      expect(
        const LocalDate(2025, 12, 31).addDays(1),
        const LocalDate(2026, 1, 1),
      );
      expect(
        const LocalDate(2026, 3, 1).addDays(-1),
        const LocalDate(2026, 2, 28),
      );
    });

    test('compares and measures distance', () {
      const a = LocalDate(2026, 5, 1);
      const b = LocalDate(2026, 5, 4);
      expect(a.isBefore(b), isTrue);
      expect(b.isAfter(a), isTrue);
      expect(a.daysUntil(b), 3);
      expect(b.daysUntil(a), -3);
      expect(a.compareTo(a), 0);
    });

    test('reports ISO weekday', () {
      // 2026-10-10 is a Saturday.
      expect(const LocalDate(2026, 10, 10).weekday, DateTime.saturday);
    });

    test('is a value type', () {
      expect(const LocalDate(2026, 1, 1), const LocalDate(2026, 1, 1));
      final set = <LocalDate>{};
      set.add(const LocalDate(2026, 1, 1));
      set.add(const LocalDate(2026, 1, 1));
      expect(set, hasLength(1));
    });
  });
}
