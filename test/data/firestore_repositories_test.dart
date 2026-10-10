import 'package:fake_cloud_firestore/fake_cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/data/firestore/firestore_repositories.dart';
import 'package:peaches/domain/core/local_date.dart';
import 'package:peaches/domain/models/crate.dart';
import 'package:peaches/domain/models/peach.dart';
import 'package:peaches/domain/models/season.dart';
import 'package:peaches/domain/models/training.dart';

void main() {
  final now = DateTime.utc(2026, 10, 10);
  late FakeFirebaseFirestore db;

  setUp(() => db = FakeFirebaseFirestore());

  group('FirestorePeachRepository', () {
    test('getByIds handles more than one whereIn chunk', () async {
      final repo = FirestorePeachRepository(db);
      final ids = List.generate(45, (i) => 'p$i');
      for (final id in ids) {
        await repo.save(Peach(id: id, displayName: id, createdAt: now));
      }
      final found = await repo.getByIds([...ids, 'missing']);
      expect(found.map((p) => p.id).toSet(), ids.toSet());
      expect(await repo.getById('missing'), isNull);
    });

    test('watch emits on change', () async {
      final repo = FirestorePeachRepository(db);
      final stream = repo.watch('a');
      final first = stream.first;
      await repo.save(Peach(id: 'a', displayName: 'A', createdAt: now));
      expect((await first)?.displayName, anyOf(isNull, 'A'));
      final later = await repo.watch('a').first;
      expect(later?.displayName, 'A');
    });
  });

  group('FirestoreCrateRepository', () {
    test(
      'invite code lookup is case-insensitive and memberships query',
      () async {
        final repo = FirestoreCrateRepository(db);
        final crate = Crate(
          id: 'c1',
          name: 'Crate',
          ownerPeachId: 'a',
          inviteCode: 'ABC123',
          createdAt: now,
        );
        await repo.save(crate);
        await repo.saveMembership(
          CrateMembership(crateId: 'c1', peachId: 'a', joinedAt: now),
        );
        await repo.saveMembership(
          CrateMembership(
            crateId: 'c1',
            peachId: 'b',
            status: MembershipStatus.left,
            joinedAt: now,
          ),
        );
        expect((await repo.getByInviteCode(' abc123 '))?.id, 'c1');
        expect(await repo.getByInviteCode('ZZZ'), isNull);
        expect((await repo.membershipsOf('c1')).length, 2);
        expect(
          (await repo.membershipsFor('b')).single.status,
          MembershipStatus.left,
        );
        expect((await repo.watchCratesFor('a').first).map((c) => c.id), ['c1']);
        expect(await repo.watchCratesFor('b').first, isEmpty);
      },
    );
  });

  group('FirestoreSeasonRepository', () {
    test(
      'schedule denormalises date and peachIds for matchup queries',
      () async {
        final repo = FirestoreSeasonRepository(db);
        final season = Season(
          id: 's1',
          crateId: 'c1',
          name: 'S',
          exerciseDays: const [
            LocalDate(2026, 10, 10),
            LocalDate(2026, 10, 12),
          ],
          participantIds: const ['a', 'b'],
          createdAt: now,
        );
        await repo.save(season);
        const r1 = Round(
          id: 'r1',
          seasonId: 's1',
          index: 0,
          date: LocalDate(2026, 10, 10),
          focus: SessionFocus.fullBody,
        );
        const r2 = Round(
          id: 'r2',
          seasonId: 's1',
          index: 1,
          date: LocalDate(2026, 10, 12),
          focus: SessionFocus.upperBody,
        );
        const m1 = Matchup(
          id: 'm1',
          seasonId: 's1',
          roundId: 'r1',
          homePeachId: 'a',
          awayPeachId: 'b',
        );
        const m2 = Matchup(
          id: 'm2',
          seasonId: 's1',
          roundId: 'r2',
          homePeachId: 'b',
          awayPeachId: 'a',
        );
        const bye = Matchup(
          id: 'm3',
          seasonId: 's1',
          roundId: 'r2',
          homePeachId: 'c',
        );
        await repo.saveSchedule([r1, r2], [m1, m2, bye]);

        expect((await repo.roundsOf('s1')).map((r) => r.id), ['r1', 'r2']);
        expect((await repo.getRound('r2'))?.focus, SessionFocus.upperBody);
        expect((await repo.matchupsOf('s1')).length, 3);
        expect((await repo.matchupsInRound('r2')).map((m) => m.id).toSet(), {
          'm2',
          'm3',
        });
        expect((await repo.matchupsFor('a')).map((m) => m.id).toSet(), {
          'm1',
          'm2',
        });
        expect(
          (await repo.matchupsFor(
            'a',
            on: const LocalDate(2026, 10, 12),
          )).map((m) => m.id),
          ['m2'],
        );
        expect((await repo.matchupsFor('c')).map((m) => m.id), ['m3']);

        // Updating a matchup keeps the denormalised date.
        await repo.saveMatchup(
          m2.copyWith(workoutId: 'w', status: MatchupStatus.inProgress),
        );
        final updated = await repo.matchupsFor(
          'a',
          on: const LocalDate(2026, 10, 12),
        );
        expect(updated.single.workoutId, 'w');
        expect((await repo.getMatchup('m2'))?.status, MatchupStatus.inProgress);
        expect(await repo.getMatchup('nope'), isNull);

        expect((await repo.forCrate('c1')).single.id, 's1');
        expect((await repo.watchForCrate('c1').first).single.id, 's1');
        expect((await repo.watchMatchupsFor('b').first).length, 2);
      },
    );
  });
}
