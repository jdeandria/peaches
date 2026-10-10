import 'package:flutter/material.dart';

/// Material 3 theming for Peaches.
///
/// The brand seed is peach (#FFE5B4). Accent roles (primary, secondary,
/// tertiary) come from the standard tonal-spot scheme so buttons and
/// highlights read as warm peach; every *surface* role is taken from a
/// neutral scheme so backgrounds stay calm greys rather than tinted cream.
abstract final class PeachesTheme {
  static const Color seed = Color(0xFFFFE5B4);

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ColorScheme colorScheme(Brightness brightness) {
    final accent = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
    );
    final neutral = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
      dynamicSchemeVariant: DynamicSchemeVariant.neutral,
    );
    return accent.copyWith(
      surface: neutral.surface,
      onSurface: neutral.onSurface,
      surfaceDim: neutral.surfaceDim,
      surfaceBright: neutral.surfaceBright,
      surfaceContainerLowest: neutral.surfaceContainerLowest,
      surfaceContainerLow: neutral.surfaceContainerLow,
      surfaceContainer: neutral.surfaceContainer,
      surfaceContainerHigh: neutral.surfaceContainerHigh,
      surfaceContainerHighest: neutral.surfaceContainerHighest,
      onSurfaceVariant: neutral.onSurfaceVariant,
      outline: neutral.outline,
      outlineVariant: neutral.outlineVariant,
      inverseSurface: neutral.inverseSurface,
      onInverseSurface: neutral.onInverseSurface,
    );
  }

  static ThemeData _build(Brightness brightness) {
    final scheme = colorScheme(brightness);
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          // iOS and macOS keep Flutter's Cupertino defaults.
          TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
          TargetPlatform.linux: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.windows: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.fuchsia: FadeForwardsPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 2,
        centerTitle: false,
      ),
      // Stock Cards match TonalCard's elevated variant at rest; interactive
      // surfaces should use TonalCard so they lift on hover and press.
      cardTheme: CardThemeData(
        elevation: 1,
        color: scheme.surfaceContainerLow,
        shadowColor: scheme.shadow,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainerHighest,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant.withValues(alpha: 0.5),
        space: 1,
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        linearTrackColor: scheme.surfaceContainerHighest,
        linearMinHeight: 6,
        borderRadius: BorderRadius.circular(3),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surfaceContainer,
        indicatorColor: scheme.secondaryContainer,
      ),
      listTileTheme: const ListTileThemeData(
        contentPadding: EdgeInsets.symmetric(horizontal: 16),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
    );
  }
}
