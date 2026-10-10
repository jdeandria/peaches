import 'package:flutter/material.dart';

/// Material 3 card variants.
///
/// * [elevated]: surface-container-low at rest with a level-1 shadow, the
///   default for primary content that sits on the page surface.
/// * [filled]: surface-container-highest, no shadow; for grouped secondary
///   content and list containers.
/// * [outlined]: surface with an outline-variant border; for low-emphasis
///   content.
enum TonalCardVariant { elevated, filled, outlined }

/// A card with Material 3 *tonal elevation*: its surface tone and shadow
/// rise together on hover, focus and press, per the M3 interaction
/// elevation table (rest 1 → hover 2 → pressed 1 for elevated cards;
/// rest 0 → hover 1 for filled and outlined cards).
///
/// Surface tint is disabled so tone comes only from the surface container
/// roles, which is the current (2023+) M3 guidance.
class TonalCard extends StatefulWidget {
  const TonalCard({
    required this.child,
    super.key,
    this.variant = TonalCardVariant.elevated,
    this.onTap,
    this.onLongPress,
    this.padding = const EdgeInsets.all(16),
    this.margin = EdgeInsets.zero,
    this.clipBehavior = Clip.antiAlias,
    this.borderRadius = const BorderRadius.all(Radius.circular(12)),
  });

  final Widget child;
  final TonalCardVariant variant;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Clip clipBehavior;
  final BorderRadius borderRadius;

  @override
  State<TonalCard> createState() => _TonalCardState();
}

class _TonalCardState extends State<TonalCard> {
  bool _hovered = false;
  bool _focused = false;
  bool _pressed = false;

  bool get _interactive => widget.onTap != null || widget.onLongPress != null;

  /// M3 elevation level (0..5) for the current interaction state.
  int get _level {
    final rest = widget.variant == TonalCardVariant.elevated ? 1 : 0;
    if (!_interactive) return rest;
    if (_pressed) return rest;
    if (_hovered || _focused) return rest + 1;
    return rest;
  }

  Color _container(ColorScheme scheme, int level) {
    return switch (widget.variant) {
      TonalCardVariant.elevated => switch (level) {
        0 => scheme.surfaceContainerLow,
        1 => scheme.surfaceContainerLow,
        2 => scheme.surfaceContainer,
        _ => scheme.surfaceContainerHigh,
      },
      TonalCardVariant.filled => switch (level) {
        0 => scheme.surfaceContainerHighest,
        _ => scheme.surfaceContainerHighest,
      },
      TonalCardVariant.outlined => switch (level) {
        0 => scheme.surface,
        _ => scheme.surfaceContainerLow,
      },
    };
  }

  static const _shadowDp = [0.0, 1.0, 3.0, 6.0, 8.0, 12.0];

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final level = _level;
    final shape = RoundedRectangleBorder(
      borderRadius: widget.borderRadius,
      side: widget.variant == TonalCardVariant.outlined
          ? BorderSide(color: scheme.outlineVariant)
          : BorderSide.none,
    );

    Widget content = Padding(padding: widget.padding, child: widget.child);
    if (_interactive) {
      content = InkWell(
        onTap: widget.onTap,
        onLongPress: widget.onLongPress,
        onHover: (v) => setState(() => _hovered = v),
        onFocusChange: (v) => setState(() => _focused = v),
        onHighlightChanged: (v) => setState(() => _pressed = v),
        customBorder: shape,
        child: content,
      );
    }

    return Padding(
      padding: widget.margin,
      child: Material(
        type: MaterialType.card,
        color: _container(scheme, level),
        shadowColor: scheme.shadow,
        surfaceTintColor: Colors.transparent,
        elevation: _shadowDp[level],
        shape: shape,
        clipBehavior: widget.clipBehavior,
        animationDuration: const Duration(milliseconds: 150),
        child: content,
      ),
    );
  }
}

/// A titled group of rows inside a [TonalCard], separated by hairlines.
/// Use for lists that belong together (members, rounds, log entries).
class TonalListCard extends StatelessWidget {
  const TonalListCard({
    required this.children,
    super.key,
    this.variant = TonalCardVariant.filled,
    this.margin = const EdgeInsets.symmetric(horizontal: 16),
  });

  final List<Widget> children;
  final TonalCardVariant variant;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final divider = Divider(
      height: 1,
      indent: 16,
      endIndent: 16,
      color: Theme.of(context).colorScheme.outlineVariant
          .withValues(alpha: 0.5),
    );
    return TonalCard(
      variant: variant,
      margin: margin,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) divider,
            children[i],
          ],
        ],
      ),
    );
  }
}
