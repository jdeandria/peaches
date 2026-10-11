import 'dart:math' as math;
import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';

import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/presentation/expressive/button_group.dart';
import 'package:peaches/presentation/expressive/loading_indicator.dart';
import 'package:peaches/presentation/expressive/shapes.dart';
import 'package:peaches/presentation/expressive/springs.dart';
import 'package:peaches/presentation/expressive/wavy_progress.dart';

Widget _host(Widget child, {bool reduceMotion = false}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduceMotion),
    child: Scaffold(
      body: Center(child: SizedBox(width: 300, child: child)),
    ),
  ),
);

void main() {
  group('M3Spring', () {
    test('settles in a finite time and ends at 1', () {
      for (final s in [
        M3Spring.spatialFast,
        M3Spring.spatialDefault,
        M3Spring.spatialSlow,
        M3Spring.effectsDefault,
      ]) {
        expect(s.duration.inMilliseconds, inInclusiveRange(50, 3000));
        expect(s.curve.transform(0), 0);
        expect(s.curve.transform(1), closeTo(1, 0.01));
      }
    });

    test('spatial springs overshoot slightly, effects springs do not', () {
      double peak(M3Spring s) =>
          [for (var t = 0.0; t <= 1; t += 0.01) s.curve.transform(t)]
              .reduce(math.max);
      expect(peak(M3Spring.spatialDefault), greaterThan(1.0));
      expect(peak(M3Spring.spatialDefault), lessThan(1.1));
      expect(peak(M3Spring.effectsDefault), lessThanOrEqualTo(1.001));
    });

    test('slow springs take longer than fast ones', () {
      expect(
        M3Spring.spatialSlow.duration,
        greaterThan(M3Spring.spatialFast.duration),
      );
    });
  });

  group('ExpressiveShape', () {
    test('radius stays within the bounding circle', () {
      for (final shape in [
        ...ExpressiveShape.identity,
        ExpressiveShape.circle,
      ]) {
        for (var i = 0; i < 360; i++) {
          final r = shape.radiusAt(i * math.pi / 180);
          expect(r, inInclusiveRange(1 - shape.depth - 1e-9, 1 + 1e-9));
        }
      }
    });

    test('identity shape is stable per id and varies across ids', () {
      expect(ExpressiveShape.forId('ada'), ExpressiveShape.forId('ada'));
      final shapes = {
        for (final id in ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
          ExpressiveShape.forId(id),
      };
      expect(shapes.length, greaterThan(2));
    });

    test('blending interpolates radii between two shapes', () {
      const a = ExpressiveShape.circle;
      const b = ExpressiveShape.clover4;
      final mid = a.lerpTo(b, 0.5)! as ExpressiveShape;
      for (var i = 0; i < 36; i++) {
        final theta = i * math.pi / 18;
        expect(
          mid.radiusAt(theta),
          closeTo((a.radiusAt(theta) + b.radiusAt(theta)) / 2, 1e-9),
        );
      }
    });

    test('produces a closed path inside its rect', () {
      const rect = Rect.fromLTWH(0, 0, 100, 100);
      final bounds = ExpressiveShape.cookie9.getOuterPath(rect).getBounds();
      expect(rect.inflate(0.5).contains(bounds.topLeft), isTrue);
      expect(rect.inflate(0.5).contains(bounds.bottomRight), isTrue);
    });
  });

  group('ConnectedButtonGroup', () {
    testWidgets('selects, and deselects when allowed', (tester) async {
      int? selected;
      await tester.pumpWidget(
        _host(
          StatefulBuilder(
            builder: (context, setState) => ConnectedButtonGroup<int>(
              options: const [(1, 'One'), (2, 'Two'), (3, 'Three')],
              selected: selected,
              allowDeselect: true,
              onChanged: (v) => setState(() => selected = v),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Two'));
      await tester.pumpAndSettle();
      expect(selected, 2);
      expect(
        tester
            .getSemantics(find.text('Two'))
            .getSemanticsData()
            .flagsCollection
            .isSelected,
        Tristate.isTrue,
      );
      await tester.tap(find.text('Two'));
      await tester.pumpAndSettle();
      expect(selected, isNull);
    });
  });

  group('WavyProgress', () {
    testWidgets('is decorative unless labelled', (tester) async {
      await tester.pumpWidget(_host(const WavyProgress(value: 0.4)));
      expect(find.byType(ExcludeSemantics), findsWidgets);
      await tester.pumpWidget(
        _host(const WavyProgress(value: 0.4, semanticsLabel: 'Progress')),
      );
      expect(find.bySemanticsLabel('Progress'), findsOneWidget);
    });

    testWidgets('a flowing wave stops when motion is reduced', (tester) async {
      await tester.pumpWidget(
        _host(
          const WavyProgress(value: 0.5, flowing: true),
          reduceMotion: true,
        ),
      );
      // Settles immediately because nothing repeats.
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);
    });
  });

  group('ExpressiveLoadingIndicator', () {
    testWidgets('animates, is labelled, and stays still with reduced motion', (
      tester,
    ) async {
      await tester.pumpWidget(_host(const ExpressiveLoadingIndicator()));
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.hasRunningAnimations, isTrue);

      await tester.pumpWidget(
        _host(const ExpressiveLoadingIndicator(), reduceMotion: true),
      );
      await tester.pumpAndSettle();
      expect(tester.hasRunningAnimations, isFalse);
    });
  });
}
