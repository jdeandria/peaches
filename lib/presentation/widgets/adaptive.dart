import 'package:flutter/material.dart';

/// Material 3 window size classes (dp).
enum WindowSize {
  compact,
  medium,
  expanded;

  static WindowSize of(BuildContext context) =>
      fromWidth(MediaQuery.sizeOf(context).width);

  static WindowSize fromWidth(double width) => width < 600
      ? WindowSize.compact
      : width < 840
      ? WindowSize.medium
      : WindowSize.expanded;

  bool get isCompact => this == WindowSize.compact;
}

/// Constrains page content to a readable measure and centres it on wide
/// windows, with the M3 margin for the size class (16 dp compact,
/// 24 dp otherwise). Lists keep scrolling edge to edge; only the content
/// column is limited.
class PageBody extends StatelessWidget {
  const PageBody({required this.child, super.key, this.maxWidth = 760});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final size = WindowSize.of(context);
    // heightFactor keeps the body as tall as its child, so a PageBody used
    // inside a Scaffold's bottom bar does not claim the whole screen.
    return Align(
      alignment: Alignment.topCenter,
      heightFactor: 1,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: size.isCompact ? 0 : 8),
          child: child,
        ),
      ),
    );
  }
}

/// Lays [primary] and [secondary] out as two panes on expanded windows
/// and one column otherwise.
class TwoPane extends StatelessWidget {
  const TwoPane({
    required this.primary,
    required this.secondary,
    super.key,
    this.breakpoint = 1000,
  });

  final Widget primary;
  final Widget secondary;
  final double breakpoint;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < breakpoint) {
          return ListView(
            padding: const EdgeInsets.only(bottom: 88),
            children: [primary, secondary],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 88),
                children: [primary],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 88),
                children: [secondary],
              ),
            ),
          ],
        );
      },
    );
  }
}
