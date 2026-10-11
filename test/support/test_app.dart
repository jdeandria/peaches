import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/app/app.dart';
import 'package:peaches/application/app_container.dart';
import 'package:peaches/application/auth_service.dart';
import 'package:peaches/application/providers.dart';
import 'package:peaches/data/demo/demo_seeder.dart';
import 'package:peaches/domain/core/ids.dart';

/// A fixed Monday morning so seeded data is stable across runs.
final fixedNow = DateTime.utc(2026, 10, 12, 9);

/// Builds the app over a freshly seeded in-memory backend.
Future<AppContainer> pumpSeededApp(WidgetTester tester) async {
  final container = AppContainer.inMemory(
    ids: SequentialIdGenerator(prefix: 'x'),
  );
  await container.demoSeeder.seed(now: fixedNow);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appContainerProvider.overrideWithValue(container),
        clockProvider.overrideWithValue(() => fixedNow),
        authServiceProvider.overrideWithValue(
          DemoAuthService(
            user: const AuthUser(
              id: DemoSeeder.currentPeachId,
              displayName: 'You',
            ),
          ),
        ),
      ],
      child: const PeachesApp(),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

/// Shared end-to-end journey used by both widget and integration tests:
/// Today -> open matchup -> log one exercise -> submit -> Crates -> Crate
/// detail -> Exercises -> toggle capability.
Future<void> runCoreJourney(WidgetTester tester) async {
  expect(find.text('Up next'), findsOneWidget);
  final openTile = find.textContaining('vs ').first;
  expect(openTile, findsOneWidget);
  await tester.tap(openTile);
  await tester.pumpAndSettle();

  expect(find.text('Main work'), findsOneWidget);
  expect(find.text('Submit workout'), findsOneWidget);
  expect(find.text('0 pts'), findsOneWidget);

  // Log the first *scored* exercise (it shows a progress bar) as prescribed.
  final scoredTile = find
      .ancestor(
        of: find.byType(LinearProgressIndicator).first,
        matching: find.byType(InkWell),
      )
      .first;
  final firstAddIcon = find.descendant(
    of: scoredTile,
    matching: find.byTooltip('Log sets'),
  );
  await tester.ensureVisible(firstAddIcon);
  await tester.tap(firstAddIcon);
  await tester.pumpAndSettle();
  await tester.tap(find.text('As prescribed'));
  await tester.pump();
  await tester.tap(find.text('Save'));
  await tester.pumpAndSettle();
  expect(find.text('0 pts'), findsNothing);

  await tester.tap(find.text('Submit workout'));
  await tester.pumpAndSettle();
  expect(find.text('Workout submitted. Nice work.'), findsOneWidget);
  expect(find.text('Submit workout'), findsNothing);
  // The header lives at the top of a lazy list; scroll back to see it.
  await tester.drag(find.byType(Scrollable).first, const Offset(0, 2000));
  await tester.pumpAndSettle();
  expect(
    find.text('Submitted. Results arrive when the round closes.'),
    findsOneWidget,
  );

  // Back to the shell, then Crates.
  await tester.pageBack();
  await tester.pumpAndSettle();
  await tester.tap(find.byIcon(Icons.inventory_2_outlined));
  await tester.pumpAndSettle();
  expect(find.text('Weekend Warriors'), findsOneWidget);
  await tester.tap(find.text('Weekend Warriors'));
  await tester.pumpAndSettle();
  expect(find.text('Autumn Kick-off'), findsOneWidget);
  expect(find.text('W-L-T'), findsOneWidget);
  expect(find.text('Rounds'), findsOneWidget);

  await tester.pageBack();
  await tester.pumpAndSettle();
  await tester.tap(find.byIcon(Icons.fitness_center_outlined));
  await tester.pumpAndSettle();
  expect(find.textContaining('Search'), findsOneWidget);
  await tester.enterText(find.byType(TextField).first, 'Pistol');
  await tester.pumpAndSettle();
  expect(find.text('Pistol Squat'), findsOneWidget);
  final toggle = find.byType(Switch).first;
  final before = tester.widget<Switch>(toggle).value;
  await tester.tap(toggle);
  await tester.pumpAndSettle();
  expect(tester.widget<Switch>(find.byType(Switch).first).value, !before);
}
