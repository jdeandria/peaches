import 'package:animations/animations.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Material 3 motion, applied consistently.
///
/// Durations and easings are Flutter's M3 tokens ([Durations], [Easing]).
/// Every helper here honours the platform's reduce-motion setting through
/// [MediaQuery.disableAnimationsOf].
abstract final class Motion {
  /// Emphasised decelerate: elements entering the screen.
  static const enter = Easing.emphasizedDecelerate;

  /// Emphasised accelerate: elements leaving the screen.
  static const exit = Easing.emphasizedAccelerate;

  /// Standard easing for in-place state changes (progress, colour).
  static const standard = Easing.standard;

  static const short = Durations.short4; // 200 ms
  static const medium = Durations.medium2; // 300 ms
  static const long = Durations.long2; // 500 ms

  /// Delay between consecutive items in a staggered list.
  static const stagger = Duration(milliseconds: 40);

  static bool reduced(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context);
}

/// Fades and slides [child] into place after [index] × [Motion.stagger].
///
/// Use inside a column or list so items cascade in. Runs once, when the
/// widget is first built.
class StaggeredEntrance extends StatefulWidget {
  const StaggeredEntrance({
    required this.index,
    required this.child,
    super.key,
    this.offset = const Offset(0, 0.08),
  });

  final int index;
  final Widget child;

  /// Starting slide offset as a fraction of the child's size.
  final Offset offset;

  @override
  State<StaggeredEntrance> createState() => _StaggeredEntranceState();
}

class _StaggeredEntranceState extends State<StaggeredEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Motion.medium,
  );
  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Motion.enter,
  );
  late final Animation<Offset> _slide = Tween(
    begin: widget.offset,
    end: Offset.zero,
  ).animate(_fade);

  @override
  void initState() {
    super.initState();
    Future.delayed(Motion.stagger * widget.index.clamp(0, 12), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return widget.child;
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}

/// A linear progress bar that animates to its new value.
///
/// Decorative by default: callers show the same information as text
/// ("3 of 6 logged"), so the bar is excluded from semantics unless
/// [semanticsLabel] is given.
class AnimatedProgress extends StatelessWidget {
  const AnimatedProgress({required this.value, super.key, this.semanticsLabel});

  final double value;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    Widget bar(double v) =>
        LinearProgressIndicator(value: v, semanticsLabel: semanticsLabel);
    final child = Motion.reduced(context)
        ? bar(value)
        : TweenAnimationBuilder<double>(
            tween: Tween(end: value.clamp(0, 1)),
            duration: Motion.long,
            curve: Motion.standard,
            builder: (context, v, _) => bar(v),
          );
    return semanticsLabel == null ? ExcludeSemantics(child: child) : child;
  }
}

/// A number that counts up or down to its new value.
class AnimatedNumber extends StatelessWidget {
  const AnimatedNumber({
    required this.value,
    required this.format,
    super.key,
    this.style,
  });

  final double value;
  final String Function(double) format;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    if (Motion.reduced(context)) return Text(format(value), style: style);
    return TweenAnimationBuilder<double>(
      tween: Tween(end: value),
      duration: Motion.long,
      curve: Motion.standard,
      builder: (context, v, _) => Text(format(v), style: style),
    );
  }
}

/// Swaps children with the M3 fade-through transition.
class FadeThroughSwitcher extends StatelessWidget {
  const FadeThroughSwitcher({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return PageTransitionSwitcher(
      duration: Motion.reduced(context) ? Duration.zero : Motion.medium,
      transitionBuilder: (child, primary, secondary) => FadeThroughTransition(
        animation: primary,
        secondaryAnimation: secondary,
        fillColor: Colors.transparent,
        child: child,
      ),
      child: child,
    );
  }
}

/// A go_router page whose route uses the M3 shared-axis transition.
class SharedAxisPage extends CustomTransitionPage<dynamic> {
  SharedAxisPage({
    required super.child,
    required LocalKey super.key,
    SharedAxisTransitionType type = SharedAxisTransitionType.horizontal,
  }) : super(
         transitionDuration: Motion.medium,
         reverseTransitionDuration: Motion.medium,
         transitionsBuilder: (context, animation, secondaryAnimation, child) =>
             SharedAxisTransition(
               animation: animation,
               secondaryAnimation: secondaryAnimation,
               transitionType: type,
               fillColor: Theme.of(context).colorScheme.surface,
               child: child,
             ),
       );
}

/// A go_router page whose route uses the M3 fade-through transition
/// (top-level destinations such as sign-in ↔ home).
class FadeThroughPage extends CustomTransitionPage<dynamic> {
  FadeThroughPage({required super.child, required LocalKey super.key})
    : super(
        transitionDuration: Motion.medium,
        reverseTransitionDuration: Motion.medium,
        transitionsBuilder: (context, animation, secondaryAnimation, child) =>
            FadeThroughTransition(
              animation: animation,
              secondaryAnimation: secondaryAnimation,
              fillColor: Theme.of(context).colorScheme.surface,
              child: child,
            ),
      );
}
