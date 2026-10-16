import { ChangeDetectionStrategy, Component, input, numberAttribute } from '@angular/core';

/**
 * A section heading inside page content (port of `PageSection`): a
 * title-medium `<h2>` with an optional trailing slot (`[sectionTrailing]`).
 */
@Component({
  selector: 'pch-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.title]': 'null',
    '[style.padding-top.px]': 'top()',
  },
  template: `<h2 class="pch-title-medium">{{ title() }}</h2>
    <ng-content select="[sectionTrailing]" />`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 24px 4px 12px;
    }
    h2 {
      flex: 1;
      min-width: 0;
      margin: 0;
    }
  `,
})
export class Section {
  readonly title = input.required<string>();
  /** Space above the heading in px (default 24). */
  readonly top = input(24, { transform: numberAttribute });
}
