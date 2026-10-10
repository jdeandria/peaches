import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/presentation/screens/crates_screen.dart';

import '../support/test_app.dart';

void main() {
  testWidgets('core journey: log a matchup, browse crates and exercises', (
    tester,
  ) async {
    await pumpSeededApp(tester);
    await runCoreJourney(tester);
  });

  testWidgets('profile shows the seeded Peach and updates fitness level', (
    tester,
  ) async {
    final app = await pumpSeededApp(tester);
    await tester.tap(find.byIcon(Icons.person_outline));
    await tester.pumpAndSettle();
    expect(find.text('You'), findsOneWidget);
    expect(find.textContaining('exercises you can do'), findsOneWidget);
    await tester.tap(find.text('Imperial'));
    await tester.pumpAndSettle();
    final me = await app.peaches.getById('me');
    expect(me?.units.name, 'imperial');
  });

  testWidgets('creating a crate opens its detail screen', (tester) async {
    await pumpSeededApp(tester);
    await tester.tap(find.byIcon(Icons.inventory_2_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Create a Crate'));
    await tester.pumpAndSettle();
    expect(find.byType(CreateCrateDialog), findsOneWidget);
    await tester.enterText(find.byType(TextField).first, 'Garage Gym');
    await tester.tap(find.text('Create'));
    await tester.pumpAndSettle();
    expect(find.text('Garage Gym'), findsOneWidget);
    expect(find.textContaining('Code '), findsOneWidget);
    expect(
      find.text('No Season yet. The owner can start one.'),
      findsOneWidget,
    );
  });

  testWidgets('joining with a bad invite code shows an error', (tester) async {
    await pumpSeededApp(tester);
    await tester.tap(find.byIcon(Icons.inventory_2_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Join with invite code'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'NOPE');
    await tester.tap(find.text('Join'));
    await tester.pumpAndSettle();
    expect(find.text('No Crate matches that invite code.'), findsOneWidget);
  });

  testWidgets('owner can start a season from the crate screen', (tester) async {
    await pumpSeededApp(tester);
    await tester.tap(find.byIcon(Icons.inventory_2_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lunch Break Lifters'));
    await tester.pumpAndSettle();
    expect(find.text('Strength Block 1'), findsOneWidget);
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).first, 'Block 2');
    await tester.tap(find.text('Start'));
    await tester.pumpAndSettle();
    // The newest open season is shown.
    expect(find.text('Block 2'), findsOneWidget);
  });
}
