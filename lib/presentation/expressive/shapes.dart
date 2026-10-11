import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Material 3 Expressive shapes, drawn as radial outlines.
///
/// Each shape is a function from angle to radius: a circle modulated by
/// [lobes] smooth bumps of relative [depth]. That covers the M3 Expressive
/// "cookie", "clover", "sunny" and "burst" families, and because every
/// shape has the same parameterisation any two of them can be morphed by
/// blending radii, which is what the loading indicator does.
@immutable
class ExpressiveShape extends OutlinedBorder {
  const ExpressiveShape({
    required this.lobes,
    required this.depth,
    this.sharpness = 1,
    this.rotation = 0,
    super.side,
  });

  static const circle = ExpressiveShape(lobes: 1, depth: 0);
  static const cookie4 = ExpressiveShape(lobes: 4, depth: 0.10);
  static const cookie6 = ExpressiveShape(lobes: 6, depth: 0.09);
  static const cookie9 = ExpressiveShape(lobes: 9, depth: 0.075);
  static const cookie12 = ExpressiveShape(lobes: 12, depth: 0.06);
  static const clover4 = ExpressiveShape(
    lobes: 4,
    depth: 0.28,
    sharpness: 0.6,
    rotation: math.pi / 4,
  );
  static const clover8 = ExpressiveShape(lobes: 8, depth: 0.16, sharpness: 0.6);
  static const sunny = ExpressiveShape(lobes: 8, depth: 0.08, sharpness: 2.2);
  static const softBurst = ExpressiveShape(
    lobes: 10,
    depth: 0.12,
    sharpness: 1.6,
  );

  /// Shapes used for people and crates; one is picked per id so a Peach
  /// always wears the same shape.
  static const identity = [
    cookie9,
    clover4,
    sunny,
    softBurst,
    cookie6,
    clover8,
  ];

  static ExpressiveShape forId(String id) =>
      identity[id.codeUnits.fold<int>(7, (h, c) => (h * 31 + c) & 0x7fffffff) %
          identity.length];

  final int lobes;

  /// Bump depth as a fraction of the radius (0 is a circle).
  final double depth;

  /// Values below 1 round the bumps into petals; above 1 sharpen them.
  final double sharpness;
  final double rotation;

  /// Radius multiplier (0..1) at angle [theta].
  double radiusAt(double theta) {
    if (depth == 0) return 1;
    final c = (math.cos(lobes * (theta - rotation)) + 1) / 2; // 0..1
    final shaped = math.pow(c, sharpness).toDouble();
    return 1 - depth + depth * shaped;
  }

  static Path pathFor(Rect rect, double Function(double theta) radius) {
    const steps = 180;
    final center = rect.center;
    final r = rect.shortestSide / 2;
    final path = Path();
    for (var i = 0; i <= steps; i++) {
      final theta = i / steps * 2 * math.pi - math.pi / 2;
      final p =
          center + Offset(math.cos(theta), math.sin(theta)) * r * radius(theta);
      i == 0 ? path.moveTo(p.dx, p.dy) : path.lineTo(p.dx, p.dy);
    }
    return path..close();
  }

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      pathFor(rect, radiusAt);

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => getOuterPath(
    rect.deflate(side.strokeInset),
    textDirection: textDirection,
  );

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(side.strokeInset);

  @override
  ExpressiveShape copyWith({BorderSide? side}) => ExpressiveShape(
    lobes: lobes,
    depth: depth,
    sharpness: sharpness,
    rotation: rotation,
    side: side ?? this.side,
  );

  @override
  ShapeBorder scale(double t) => copyWith(side: side.scale(t));

  @override
  ShapeBorder? lerpTo(ShapeBorder? b, double t) =>
      b is ExpressiveShape ? BlendedShape(this, b, t) : super.lerpTo(b, t);

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    if (side.style == BorderStyle.none) return;
    canvas.drawPath(getOuterPath(rect), side.toPaint());
  }

  @override
  bool operator ==(Object other) =>
      other is ExpressiveShape &&
      other.lobes == lobes &&
      other.depth == depth &&
      other.sharpness == sharpness &&
      other.rotation == rotation &&
      other.side == side;

  @override
  int get hashCode => Object.hash(lobes, depth, sharpness, rotation, side);
}

/// Two expressive shapes blended at [t]; used for morphing.
class BlendedShape extends ExpressiveShape {
  const BlendedShape(this.a, this.b, this.t) : super(lobes: 0, depth: 0);

  final ExpressiveShape a;
  final ExpressiveShape b;
  final double t;

  @override
  double radiusAt(double theta) =>
      ui.lerpDouble(a.radiusAt(theta), b.radiusAt(theta), t)!;

  @override
  bool operator ==(Object other) =>
      other is BlendedShape && other.a == a && other.b == b && other.t == t;

  @override
  int get hashCode => Object.hash(a, b, t);
}

/// An avatar clipped to an expressive shape.
class ShapedAvatar extends StatelessWidget {
  const ShapedAvatar({
    required this.child,
    super.key,
    this.shape = ExpressiveShape.cookie9,
    this.size = 40,
    this.color,
    this.foregroundColor,
  });

  /// An avatar whose shape is chosen from [id], with the initial of [name].
  factory ShapedAvatar.person({
    required String id,
    required String name,
    double size = 40,
    Color? color,
    Color? foregroundColor,
    TextStyle? style,
    Key? key,
  }) => ShapedAvatar(
    key: key,
    shape: ExpressiveShape.forId(id),
    size: size,
    color: color,
    foregroundColor: foregroundColor,
    child: Text(name.isEmpty ? '?' : name.characters.first, style: style),
  );

  final Widget child;
  final ExpressiveShape shape;
  final double size;
  final Color? color;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final fg = foregroundColor ?? scheme.onSecondaryContainer;
    return SizedBox.square(
      dimension: size,
      child: Material(
        color: color ?? scheme.secondaryContainer,
        shape: shape,
        child: Center(
          child: DefaultTextStyle.merge(
            style: TextStyle(
              color: fg,
              fontSize: size * 0.42,
              fontWeight: FontWeight.w600,
            ),
            child: IconTheme.merge(
              data: IconThemeData(color: fg, size: size * 0.5),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}
