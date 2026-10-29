import { Location } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';

/**
 * The page frame every screen uses (port of `PageScaffold`).
 *
 * - A sticky toolbar whose back button, title and actions sit in the same
 *   centred column as the content.
 * - A large headline (and optional subtitle) that scrolls away; the toolbar
 *   title fades in once it has. Without a back button the headline sits in
 *   the toolbar's row, beside the actions, so a tab's content starts high.
 * - Content projected into a column capped at `maxWidth`, with the M3
 *   margin for the window size class (16px compact, 24px otherwise).
 * - Slots: `[pageActions]` (toolbar), `[pageFab]` (floating action button),
 *   `[pageBottomBar]` (pinned bar constrained to the column), `[pageTitle]`
 *   (in place of the headline, such as a name to edit in place; `title`
 *   still names the page in the toolbar).
 */
@Component({
  selector: 'pch-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconButton, MatTooltip],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  host: {
    // `title` is an input; don't let it become a native tooltip on the page.
    '[attr.title]': 'null',
    '[style.--pch-page-max.px]': 'maxWidth()',
  },
})
export class Page {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
  /** Shown in the toolbar once the headline scrolls away; defaults to `title`. */
  readonly toolbarTitle = input<string>();
  /** Content column width cap in px (default 720). */
  readonly maxWidth = input(720, { transform: numberAttribute });
  /** Show a back button: goes back in app history, else to `backLink`. */
  readonly showBack = input(false, { transform: booleanAttribute });
  /** Where back goes when there is no in-app history (default `/`). */
  readonly backLink = input<string>('/');
  /** Show a refresh button in the toolbar that emits `refresh`. */
  readonly refreshable = input(false, { transform: booleanAttribute });
  /** Disables the refresh button while a refresh is in flight. */
  readonly refreshing = input(false, { transform: booleanAttribute });
  readonly refresh = output<void>();

  protected readonly collapsed = signal(false);
  private readonly headline = viewChild.required<ElementRef<HTMLElement>>('headline');
  private readonly actions = viewChild.required<ElementRef<HTMLElement>>('actions');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Room for the actions beside a headline that shares their row.
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(([entry]) =>
          this.host.nativeElement.style.setProperty(
            '--pch-actions-width',
            `${entry.contentRect.width}px`,
          ),
        );
        ro.observe(this.actions().nativeElement);
        destroyRef.onDestroy(() => ro.disconnect());
      }
      if (typeof IntersectionObserver === 'undefined') return;
      // Collapsed once the headline has scrolled under the 64px toolbar, or,
      // when it starts in the toolbar's row, off the top.
      const top = this.showBack() ? 64 : 0;
      const io = new IntersectionObserver(
        ([entry]) =>
          this.collapsed.set(!entry.isIntersecting && entry.boundingClientRect.top < top),
        { rootMargin: `-${top}px 0px 0px 0px` },
      );
      io.observe(this.headline().nativeElement);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }

  protected back(): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(this.backLink());
    }
  }
}
