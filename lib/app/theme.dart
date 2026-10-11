import 'package:flutter/material.dart';

import '../presentation/expressive/springs.dart';

/// Material 3 theming for Peaches.
///
/// **Colour.** The brand seed is peach (#FFE5B4). That seed's own hue is a
/// yellow-orange whose tone-40 accent reads gold-brown, so accents use the
/// M3 *fruit salad* variant of the same seed, which lands primary on real
/// peach-fruit coral and keeps the seed's golden hue as tertiary. Every
/// surface role comes from a hue-free neutral scheme, so backgrounds are
/// clean greys and white rather than tinted cream.
///
/// **Shape.** M3 corner scale: 8 small (chips), 12 medium (fields), 16
/// large (cards), 28 extra-large (dialogs, sheets, hero cards).
abstract final class PeachesTheme {
  static const Color seed = Color(0xFFFFE5B4);

  static const radiusSmall = 8.0;
  static const radiusMedium = 12.0;
  static const radiusLarge = 16.0;
  static const radiusExtraLarge = 28.0;

  static ThemeData light() => _build(Brightness.light);

  static ThemeData dark() => _build(Brightness.dark);

  static ColorScheme colorScheme(Brightness brightness) {
    final accent = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
      dynamicSchemeVariant: DynamicSchemeVariant.fruitSalad,
    );
    final neutral = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
      dynamicSchemeVariant: DynamicSchemeVariant.monochrome,
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
      shadow: neutral.shadow,
    );
  }

  static ThemeData _build(Brightness brightness) {
    final scheme = colorScheme(brightness);
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
    );
    final text = base.textTheme;
    RoundedRectangleBorder rounded(double r) =>
        RoundedRectangleBorder(borderRadius: BorderRadius.circular(r));

    return base.copyWith(
      scaffoldBackgroundColor: scheme.surface,
      // M3 Expressive emphasized type: heavier display and headline weights
      // with tighter tracking, so headings and key numbers carry the page.
      textTheme: text.copyWith(
        displaySmall: text.displaySmall?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.5,
        ),
        headlineMedium: text.headlineMedium?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.5,
        ),
        headlineSmall: text.headlineSmall?.copyWith(
          fontWeight: FontWeight.w600,
          letterSpacing: -0.25,
        ),
        titleLarge: text.titleLarge?.copyWith(fontWeight: FontWeight.w600),
        titleMedium: text.titleMedium?.copyWith(fontWeight: FontWeight.w500),
        labelLarge: text.labelLarge?.copyWith(fontWeight: FontWeight.w600),
      ),
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
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: text.titleLarge?.copyWith(
          color: scheme.onSurface,
          fontWeight: FontWeight.w500,
        ),
      ),
      // Stock Cards match TonalCard's elevated variant at rest; interactive
      // surfaces should use TonalCard so they lift on hover and press.
      cardTheme: CardThemeData(
        elevation: 1,
        color: brightness == Brightness.light
            ? scheme.surfaceContainerLowest
            : scheme.surfaceContainerLow,
        shadowColor: scheme.shadow.withValues(alpha: 0.4),
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: rounded(radiusLarge),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainerLow,
        selectedColor: scheme.secondaryContainer,
        side: BorderSide(color: scheme.outlineVariant),
        shape: rounded(radiusSmall),
        labelStyle: text.labelLarge,
      ),
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant.withValues(alpha: 0.6),
        space: 1,
        thickness: 1,
      ),
      // Linear progress uses the Expressive WavyProgress widget; this keeps
      // any stock indicator (and the circular rings) on the current spec.
      progressIndicatorTheme: ProgressIndicatorThemeData(
        linearTrackColor: scheme.secondaryContainer,
        circularTrackColor: scheme.secondaryContainer,
        linearMinHeight: 4,
        borderRadius: BorderRadius.circular(2),
        // ignore: deprecated_member_use
        year2023: false,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: scheme.surfaceContainer,
        indicatorColor: scheme.secondaryContainer,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        // M3 Expressive's shorter navigation bar.
        height: 68,
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: scheme.surfaceContainerLow,
        indicatorColor: scheme.secondaryContainer,
        selectedIconTheme: IconThemeData(color: scheme.onSecondaryContainer),
        unselectedIconTheme: IconThemeData(color: scheme.onSurfaceVariant),
        selectedLabelTextStyle: text.labelLarge?.copyWith(
          color: scheme.onSurface,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelTextStyle: text.labelLarge?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
      ),
      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16),
        shape: rounded(radiusMedium),
        titleTextStyle: text.bodyLarge?.copyWith(color: scheme.onSurface),
        subtitleTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onSurfaceVariant,
        ),
      ),
      // M3 Expressive buttons morph from a pill to a rounded square while
      // pressed, animated with the fast spatial spring.
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(64, 48),
          textStyle: text.labelLarge?.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          animationDuration: M3Spring.spatialFast.duration,
        ).copyWith(shape: _morphingShape(12)),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(64, 48),
          animationDuration: M3Spring.spatialFast.duration,
        ).copyWith(shape: _morphingShape(12)),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          animationDuration: M3Spring.spatialFast.duration,
        ).copyWith(shape: _morphingShape(12)),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          animationDuration: M3Spring.spatialFast.duration,
        ).copyWith(shape: _morphingShape(12)),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: scheme.primaryContainer,
        foregroundColor: scheme.onPrimaryContainer,
        elevation: 2,
        highlightElevation: 3,
        shape: rounded(radiusLarge),
      ),
      searchBarTheme: SearchBarThemeData(
        elevation: const WidgetStatePropertyAll(0),
        backgroundColor: WidgetStatePropertyAll(scheme.surfaceContainerHigh),
        shadowColor: const WidgetStatePropertyAll(Colors.transparent),
        surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
        constraints: const BoxConstraints(minHeight: 56),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 16),
        ),
      ),
      switchTheme: SwitchThemeData(
        // M3 switch with an icon in the thumb when selected.
        thumbIcon: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? const Icon(Icons.check, size: 16)
              : null,
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          selectedBackgroundColor: scheme.secondaryContainer,
          selectedForegroundColor: scheme.onSecondaryContainer,
          minimumSize: const Size(0, 44),
        ),
      ),
      // The handle-bar slider with a gapped track: the design M3 Expressive
      // kept. Flutter still gates it behind this (deprecated) opt-in.
      // ignore: deprecated_member_use
      sliderTheme: const SliderThemeData(year2023: false),
      dialogTheme: DialogThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        surfaceTintColor: Colors.transparent,
        shape: rounded(radiusExtraLarge),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surfaceContainerLow,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(radiusExtraLarge),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusMedium),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: rounded(radiusSmall),
      ),
      dataTableTheme: DataTableThemeData(
        headingTextStyle: text.labelMedium?.copyWith(
          color: scheme.onSurfaceVariant,
          letterSpacing: 0.4,
        ),
        dataTextStyle: text.bodyMedium?.copyWith(
          color: scheme.onSurface,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
        headingRowHeight: 44,
        dataRowMinHeight: 48,
        dataRowMaxHeight: 52,
        dividerThickness: 0.5,
      ),
    );
  }

  /// Pill at rest, rounded square of [pressedRadius] while pressed.
  static WidgetStateProperty<OutlinedBorder> _morphingShape(
    double pressedRadius,
  ) => WidgetStateProperty.resolveWith(
    (states) => states.contains(WidgetState.pressed)
        ? RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(pressedRadius),
          )
        : const StadiumBorder(),
  );
}
