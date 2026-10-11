import 'package:flutter/material.dart';

import 'shapes.dart';
import 'springs.dart';

/// The M3 Expressive loading indicator: a shape that morphs through the
/// expressive shape sequence while rotating, for waits under a few
/// seconds. Falls back to a still shape when motion is reduced.
class ExpressiveLoadingIndicator extends StatefulWidget {
  const ExpressiveLoadingIndicator({
    super.key,
    this.size = 48,
    this.contained = false,
  });

  final double size;

  /// Draw on a circular primary-container, as M3 specifies for indicators
  /// that float over content.
  final bool contained;

  @override
  State<ExpressiveLoadingIndicator> createState() =>
      _ExpressiveLoadingIndicatorState();
}

class _ExpressiveLoadingIndicatorState extends State<ExpressiveLoadingIndicator>
    with SingleTickerProviderStateMixin {
  static const _sequence = [
    ExpressiveShape.softBurst,
    ExpressiveShape.cookie9,
    ExpressiveShape.clover4,
    ExpressiveShape.sunny,
    ExpressiveShape.cookie4,
    ExpressiveShape.clover8,
  ];
  static const _step = Duration(milliseconds: 650);

  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: _step * _sequence.length,
  );
  final _curve = M3Spring.spatialFast.curve;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final inner = widget.size * (widget.contained ? 0.62 : 1);
    final indicator = AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final pos = _c.value * _sequence.length;
        final i = pos.floor() % _sequence.length;
        final t = _curve.transform((pos - pos.floor()).clamp(0.0, 1.0));
        final shape = BlendedShape(
          _sequence[i],
          _sequence[(i + 1) % _sequence.length],
          t,
        );
        return Transform.rotate(
          angle: _c.value * 2 * 3.141592653589793 * 2,
          child: SizedBox.square(
            dimension: inner,
            child: DecoratedBox(
              decoration: ShapeDecoration(color: scheme.primary, shape: shape),
            ),
          ),
        );
      },
    );
    return Semantics(
      label: 'Loading',
      child: SizedBox.square(
        dimension: widget.size,
        child: widget.contained
            ? DecoratedBox(
                decoration: BoxDecoration(
                  color: scheme.primaryContainer,
                  shape: BoxShape.circle,
                ),
                child: Center(child: indicator),
              )
            : Center(child: indicator),
      ),
    );
  }
}
