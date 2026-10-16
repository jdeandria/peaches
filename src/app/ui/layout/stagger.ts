import { Directive, input, numberAttribute } from '@angular/core';

/**
 * Staggered entrance (port of `StaggeredEntrance`): the host fades in and
 * slides up into place after `index × 40ms` (capped at 12), on the default
 * spatial spring. Runs once, on creation; none under reduced motion.
 *
 * `@for (m of items; track m.id; let i = $index) { <pch-card [pchStagger]="i">…`
 */
@Directive({
  selector: '[pchStagger]',
  host: {
    class: 'pch-stagger',
    '[style.--pch-stagger-index]': 'index()',
  },
})
export class Stagger {
  readonly index = input(0, { alias: 'pchStagger', transform: numberAttribute });
}
