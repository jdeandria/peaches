import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:peaches/app/theme.dart';

void main() {
  group('PeachesTheme', () {
    test('uses Material 3 in both modes', () {
      expect(PeachesTheme.light().useMaterial3, isTrue);
      expect(PeachesTheme.dark().useMaterial3, isTrue);
      expect(PeachesTheme.light().brightness, Brightness.light);
      expect(PeachesTheme.dark().brightness, Brightness.dark);
    });

    test('accent roles carry the warm peach hue', () {
      for (final brightness in Brightness.values) {
        final scheme = PeachesTheme.colorScheme(brightness);
        final hue = HSLColor.fromColor(scheme.primary).hue;
        // Peach sits in the orange band (~20-60 degrees).
        expect(hue, inInclusiveRange(15, 70), reason: brightness.name);
      }
    });

    test('surfaces are neutral, not tinted', () {
      for (final brightness in Brightness.values) {
        final scheme = PeachesTheme.colorScheme(brightness);
        for (final color in [
          scheme.surface,
          scheme.surfaceContainer,
          scheme.surfaceContainerHigh,
          scheme.surfaceContainerLow,
        ]) {
          // Chroma proxy: spread between the strongest and weakest channel.
          final channels = [color.r, color.g, color.b];
          final spread =
              channels.reduce((a, b) => a > b ? a : b) -
              channels.reduce((a, b) => a < b ? a : b);
          expect(spread, lessThan(0.05), reason: '$brightness $color');
        }
      }
    });

    test('scaffold background matches the surface role', () {
      final theme = PeachesTheme.light();
      expect(theme.scaffoldBackgroundColor, theme.colorScheme.surface);
    });
  });
}
