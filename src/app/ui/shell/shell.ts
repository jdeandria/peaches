import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

export interface NavDestination {
  readonly label: string;
  /** Material Symbols name; filled when active. */
  readonly icon: string;
  readonly link: string;
  /** First URL segments that make this destination active ('' = root). */
  readonly matches: readonly string[];
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { label: 'Today', icon: 'today', link: '/', matches: ['', 'matchups', 'log'] },
  { label: 'Crates', icon: 'inventory_2', link: '/crates', matches: ['crates'] },
  { label: 'Profile', icon: 'person', link: '/profile', matches: ['profile'] },
];

/** The destination index active for a URL, or -1. */
export function activeDestination(router: Router, url: string): number {
  const first = router.parseUrl(url).root.children['primary']?.segments[0]?.path ?? '';
  return NAV_DESTINATIONS.findIndex((d) => d.matches.includes(first));
}

/**
 * The top-level shell (port of `HomeShell`). Navigation adapts to the M3
 * window size class with pure CSS: a 68px navigation bar below 600px, a
 * navigation rail (labels under icons) from 600px, and an extended rail
 * (labels beside icons) from 840px. Sets `--pch-bottom-inset` so pages can
 * keep FABs and bottom bars above the navigation bar.
 */
@Component({
  selector: 'pch-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly destinations = NAV_DESTINATIONS;
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly active = computed(() => activeDestination(this.router, this.url()));
}
