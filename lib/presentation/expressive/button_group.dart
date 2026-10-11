import 'package:flutter/material.dart';

import 'springs.dart';

/// An M3 Expressive connected button group: single-select options as
/// separate buttons with small gaps. Inner corners are tight, outer corners
/// fully round, and the selected button morphs to a full pill.
class ConnectedButtonGroup<T> extends StatelessWidget {
  const ConnectedButtonGroup({
    required this.options,
    required this.selected,
    required this.onChanged,
    super.key,
    this.allowDeselect = false,
    this.height = 48,
  });

  final List<(T, String)> options;
  final T? selected;
  final ValueChanged<T?> onChanged;
  final bool allowDeselect;
  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final full = Radius.circular(height / 2);
    const inner = Radius.circular(8);
    final reduce = MediaQuery.disableAnimationsOf(context);

    return Row(
      children: [
        for (final (i, (value, label)) in options.indexed) ...[
          if (i > 0) const SizedBox(width: 2),
          Expanded(
            child: Builder(
              builder: (context) {
                final isSelected = value == selected;
                final first = i == 0;
                final last = i == options.length - 1;
                final shape = RoundedRectangleBorder(
                  borderRadius: isSelected
                      ? BorderRadius.all(full)
                      : BorderRadius.horizontal(
                          left: first ? full : inner,
                          right: last ? full : inner,
                        ),
                );
                return Semantics(
                  selected: isSelected,
                  inMutuallyExclusiveGroup: true,
                  button: true,
                  child: Material(
                    color: isSelected
                        ? scheme.primary
                        : scheme.surfaceContainerHighest,
                    shape: shape,
                    animationDuration: reduce
                        ? Duration.zero
                        : M3Spring.spatialFast.duration,
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () =>
                          onChanged(isSelected && allowDeselect ? null : value),
                      child: SizedBox(
                        height: height,
                        child: Center(
                          child: Text(
                            label,
                            style: theme.textTheme.labelLarge?.copyWith(
                              color: isSelected
                                  ? scheme.onPrimary
                                  : scheme.onSurfaceVariant,
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}
