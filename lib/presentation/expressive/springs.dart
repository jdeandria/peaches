import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

/// Material 3 Expressive motion springs.
///
/// M3 Expressive replaces duration-and-easing curves with springs. Spatial
/// springs (position, size, shape) may overshoot slightly; effects springs
/// (opacity, colour) are critically damped. Values are the "expressive"
/// motion scheme tokens.
@immutable
final class M3Spring {
  const M3Spring._(this.dampingRatio, this.stiffness);

  final double dampingRatio;
  final double stiffness;

  static const spatialFast = M3Spring._(0.6, 800);
  static const spatialDefault = M3Spring._(0.8, 380);
  static const spatialSlow = M3Spring._(0.8, 200);
  static const effectsFast = M3Spring._(1, 3800);
  static const effectsDefault = M3Spring._(1, 1600);
  static const effectsSlow = M3Spring._(1, 800);

  SpringDescription get description => SpringDescription.withDampingRatio(
    mass: 1,
    stiffness: stiffness,
    ratio: dampingRatio,
  );

  /// How long the spring takes to settle from 0 to 1, for use with
  /// duration-based animation APIs.
  Duration get duration => _durations.putIfAbsent(this, () {
    final sim = SpringSimulation(description, 0, 1, 0);
    for (var ms = 16; ms < 3000; ms += 4) {
      final t = ms / 1000;
      if ((sim.x(t) - 1).abs() < 0.002 && sim.dx(t).abs() < 0.02) {
        return Duration(milliseconds: ms);
      }
    }
    return const Duration(milliseconds: 3000);
  });

  /// The spring as a [Curve] over [duration].
  Curve get curve => _SpringCurve(this);

  static final _durations = <M3Spring, Duration>{};
}

final class _SpringCurve extends Curve {
  const _SpringCurve(this.spring);

  final M3Spring spring;

  @override
  double transformInternal(double t) {
    final seconds = spring.duration.inMicroseconds / 1e6;
    return SpringSimulation(spring.description, 0, 1, 0).x(t * seconds);
  }
}
