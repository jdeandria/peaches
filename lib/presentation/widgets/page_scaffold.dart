import 'package:flutter/material.dart';

import 'adaptive.dart';
import 'motion.dart';

/// The page frame every screen uses.
///
/// * A pinned toolbar whose leading, title and actions sit inside the same
///   centred column as the content, so nothing hugs the window edge on
///   wide screens.
/// * An M3 large headline (and optional supporting text) that scrolls away;
///   the toolbar title fades in once it has.
/// * Content either as [children] or lazily via [itemCount]/[itemBuilder].
class PageScaffold extends StatefulWidget {
  const PageScaffold({
    required this.title,
    super.key,
    this.subtitle,
    this.actions = const [],
    this.children = const [],
    this.itemCount,
    this.itemBuilder,
    this.maxWidth = 720,
    this.floatingActionButton,
    this.bottomBar,
    this.onRefresh,
    this.showBack = false,
    this.toolbarTitle,
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final List<Widget> children;
  final int? itemCount;
  final IndexedWidgetBuilder? itemBuilder;
  final double maxWidth;
  final Widget? floatingActionButton;

  /// Pinned below the content (e.g. a primary action), constrained to the
  /// same column.
  final Widget? bottomBar;
  final Future<void> Function()? onRefresh;
  final bool showBack;

  /// Shown in the toolbar instead of [title] once the headline scrolls
  /// away; defaults to [title].
  final String? toolbarTitle;

  @override
  State<PageScaffold> createState() => _PageScaffoldState();
}

class _PageScaffoldState extends State<PageScaffold> {
  final _controller = ScrollController();
  final _collapsed = ValueNotifier(false);

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      final c = _controller.hasClients && _controller.offset > 48;
      if (c != _collapsed.value) _collapsed.value = c;
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _collapsed.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final compact = WindowSize.of(context).isCompact;
    final gutter = compact ? 16.0 : 24.0;

    // Top-aligned and height-shrinking so it is safe in a bottom bar;
    // full-width inside the cap so start-aligned content lines up.
    Widget column(Widget child) => Align(
      alignment: Alignment.topCenter,
      heightFactor: 1,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: widget.maxWidth + gutter * 2),
        child: SizedBox(width: double.infinity, child: child),
      ),
    );

    final toolbar = SliverAppBar(
      pinned: true,
      automaticallyImplyLeading: false,
      titleSpacing: 0,
      toolbarHeight: 64,
      title: SizedBox(
        width: double.infinity,
        child: column(
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: widget.showBack ? gutter - 12 : gutter - 4,
            ),
            child: Row(
              children: [
                if (widget.showBack) const BackButton(),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(left: widget.showBack ? 4 : 4),
                    // Built only once the headline has scrolled away, so the
                    // title is never in the tree (or announced) twice.
                    child: ValueListenableBuilder<bool>(
                      valueListenable: _collapsed,
                      builder: (context, collapsed, _) => AnimatedSwitcher(
                        duration: Motion.short,
                        switchInCurve: Motion.enter,
                        switchOutCurve: Motion.exit,
                        layoutBuilder: (current, previous) => Stack(
                          alignment: Alignment.centerLeft,
                          children: [...previous, ?current],
                        ),
                        child: collapsed
                            ? Text(
                                widget.toolbarTitle ?? widget.title,
                                key: const ValueKey('title'),
                                overflow: TextOverflow.ellipsis,
                              )
                            : const SizedBox.shrink(key: ValueKey('none')),
                      ),
                    ),
                  ),
                ),
                ...widget.actions,
              ],
            ),
          ),
        ),
      ),
    );

    final header = SliverToBoxAdapter(
      child: column(
        Padding(
          padding: EdgeInsets.fromLTRB(gutter, 0, gutter, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.title, style: theme.textTheme.headlineMedium),
              if (widget.subtitle != null) ...[
                const SizedBox(height: 4),
                Text(
                  widget.subtitle!,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );

    final content = SliverLayoutBuilder(
      builder: (context, constraints) {
        final side = ((constraints.crossAxisExtent - widget.maxWidth) / 2)
            .clamp(gutter, double.infinity)
            .toDouble();
        final bottom = widget.floatingActionButton != null ? 96.0 : 32.0;
        final padding = EdgeInsets.fromLTRB(side, 8, side, bottom);
        if (widget.itemBuilder != null) {
          return SliverPadding(
            padding: padding,
            sliver: SliverList.builder(
              itemCount: widget.itemCount,
              itemBuilder: widget.itemBuilder!,
            ),
          );
        }
        return SliverPadding(
          padding: padding,
          sliver: SliverList.list(children: widget.children),
        );
      },
    );

    Widget scroll = CustomScrollView(
      controller: _controller,
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [toolbar, header, content],
    );
    if (widget.onRefresh != null) {
      scroll = RefreshIndicator(onRefresh: widget.onRefresh!, child: scroll);
    }

    return Scaffold(
      body: scroll,
      floatingActionButton: widget.floatingActionButton,
      bottomNavigationBar: widget.bottomBar == null
          ? null
          : Material(
              color: scheme.surfaceContainer,
              child: SafeArea(
                top: false,
                child: column(
                  Padding(
                    padding: EdgeInsets.fromLTRB(gutter, 12, gutter, 12),
                    child: widget.bottomBar,
                  ),
                ),
              ),
            ),
    );
  }
}

/// A section heading inside page content.
class PageSection extends StatelessWidget {
  const PageSection(this.title, {super.key, this.trailing, this.top = 24});

  final String title;
  final Widget? trailing;
  final double top;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(4, top, 4, 12),
      child: Row(
        children: [
          Expanded(child: Text(title, style: theme.textTheme.titleMedium)),
          ?trailing,
        ],
      ),
    );
  }
}

/// A compact status label: a dot and text in a role colour. Lighter than a
/// filled chip, for states that should be legible but not loud.
class StatusLabel extends StatelessWidget {
  const StatusLabel(this.text, {super.key, this.color});

  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final c = color ?? theme.colorScheme.onSurfaceVariant;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: c, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(text, style: theme.textTheme.labelMedium?.copyWith(color: c)),
      ],
    );
  }
}
