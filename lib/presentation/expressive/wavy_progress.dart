import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'springs.dart';

/// The M3 Expressive wavy linear progress indicator.
///
/// The active indicator is a sine wave, the remaining track is flat with a
/// gap between them and a stop dot at the end. The wave flattens as the
/// value approaches 1, so a finished bar reads as complete rather than busy.
/// With [flowing] the wave travels continuously; leave it off for static
/// list rows to keep animation where attention should be.
///
/// Decorative: callers show progress as text too, so it is excluded from
/// semantics unless [semanticsLabel] is set.
class WavyProgress extends StatefulWidget {
  const WavyProgress({
    required this.value,
    super.key,
    this.flowing = false,
    this.color,
    this.trackColor,
    this.semanticsLabel,
  });

  final double value;
  final bool flowing;
  final Color? color;
  final Color? trackColor;
  final String? semanticsLabel;

  @override
  State<WavyProgress> createState() => _WavyProgressState();
}

class _WavyProgressState extends State<WavyProgress>
    with TickerProviderStateMixin {
  late final AnimationController _phase = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1600),
  );
  late final AnimationController _value = AnimationController(
    vsync: this,
    duration: M3Spring.spatialDefault.duration,
  );
  late Animation<double> _valueAnim = AlwaysStoppedAnimation(
    widget.value.clamp(0.0, 1.0),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncFlow();
  }

  @override
  void didUpdateWidget(WavyProgress old) {
    super.didUpdateWidget(old);
    _syncFlow();
    if (old.value != widget.value) {
      _valueAnim =
          Tween(
            begin: _valueAnim.value,
            end: widget.value.clamp(0.0, 1.0),
          ).animate(
            CurvedAnimation(
              parent: _value,
              curve: M3Spring.spatialDefault.curve,
            ),
          );
      if (MediaQuery.disableAnimationsOf(context)) {
        _value.value = 1;
      } else {
        _value.forward(from: 0);
      }
    }
  }

  void _syncFlow() {
    final reduce = MediaQuery.disableAnimationsOf(context);
    if (widget.flowing && !reduce) {
      if (!_phase.isAnimating) _phase.repeat();
    } else {
      _phase.stop();
    }
  }

  @override
  void dispose() {
    _phase.dispose();
    _value.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bar = SizedBox(
      height: 12,
      width: double.infinity,
      child: AnimatedBuilder(
        animation: Listenable.merge([_phase, _value]),
        builder: (context, _) => CustomPaint(
          painter: _WavyPainter(
            value: _valueAnim.value,
            phase: _phase.value,
            color: widget.color ?? scheme.primary,
            trackColor: widget.trackColor ?? scheme.secondaryContainer,
          ),
        ),
      ),
    );
    if (widget.semanticsLabel == null) return ExcludeSemantics(child: bar);
    return Semantics(
      label: widget.semanticsLabel,
      value: '${(widget.value * 100).round()}%',
      child: bar,
    );
  }
}

class _WavyPainter extends CustomPainter {
  _WavyPainter({
    required this.value,
    required this.phase,
    required this.color,
    required this.trackColor,
  });

  final double value;
  final double phase;
  final Color color;
  final Color trackColor;

  static const stroke = 4.0;
  static const wavelength = 28.0;
  static const amplitude = 3.0;
  static const gap = 4.0;

  @override
  void paint(Canvas canvas, Size size) {
    final mid = size.height / 2;
    final w = size.width;
    final end = (w * value).clamp(0.0, w);
    final paint = Paint()
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    // Track and stop dot.
    final trackStart = value <= 0 ? stroke / 2 : end + gap + stroke;
    if (trackStart < w - stroke / 2) {
      paint.color = trackColor;
      canvas.drawLine(
        Offset(trackStart, mid),
        Offset(w - stroke / 2, mid),
        paint,
      );
    }
    if (value < 1) {
      canvas.drawCircle(
        Offset(w - stroke / 2, mid),
        stroke / 2,
        Paint()..color = color,
      );
    }
    if (end <= stroke / 2) return;

    // Active wave, flattening over the last few percent.
    final settle = ((1 - value) / 0.06).clamp(0.0, 1.0);
    final a = amplitude * settle;
    final path = Path()..moveTo(stroke / 2, mid);
    for (var x = stroke / 2; x <= end - stroke / 2; x += 1.5) {
      final y = mid + a * math.sin((x / wavelength - phase) * 2 * math.pi);
      path.lineTo(x, y);
    }
    paint.color = color;
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_WavyPainter old) =>
      old.value != value ||
      old.phase != phase ||
      old.color != color ||
      old.trackColor != trackColor;
}
