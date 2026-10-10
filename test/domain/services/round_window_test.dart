import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/domain/core/local_date.dart';
import 'package:peaches/domain/core/zone_clock.dart';
import 'package:peaches/domain/models/crate.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/models/training.dart';
import 'package:peaches/domain/services/round_window.dart';

void main() {
  const service = RoundWindowService(UtcZoneClock());
  final crate = Crate(
    id: 'c',
    name: 'c',
    ownerPeachId: 'p',
    inviteCode: 'X',
    createdAt: DateTime.utc(2026),
    settings: const CrateSettings(loggingGraceHours: 3),
  );
  const round = Round(
    id: 'r',
    seasonId: 's',
    index: 0,
    date: LocalDate(2026, 10, 10),
    focus: SessionFocus.fullBody,
  );

  test('window spans the day plus the grace period', () {
    final w = service.windowFor(round, crate);
    expect(w.opensAt, DateTime.utc(2026, 10, 10));
    expect(w.closesAt, DateTime.utc(2026, 10, 11, 3));
    expect(w.isOpenAt(DateTime.utc(2026, 10, 9, 23, 59)), isFalse);
    expect(w.isOpenAt(DateTime.utc(2026, 10, 10)), isTrue);
    expect(w.isOpenAt(DateTime.utc(2026, 10, 11, 2, 59)), isTrue);
    expect(w.isOpenAt(DateTime.utc(2026, 10, 11, 3)), isFalse);
    expect(w.hasClosedBy(DateTime.utc(2026, 10, 11, 3)), isTrue);
    expect(
      w.remainingAt(DateTime.utc(2026, 10, 11, 2)),
      const Duration(hours: 1),
    );
    expect(w.remainingAt(DateTime.utc(2026, 10, 12)), Duration.zero);
  });
}
