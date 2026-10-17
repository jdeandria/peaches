import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { Peach } from '../../../domain/models/peach';
import { UnitSystem } from '../../../domain/models/training';
import { AppState } from '../../../state/app-state';
import { Pwa } from '../../../state/pwa';
import { APP_VERSION } from '../../../version';
import { ButtonGroup, ButtonGroupOption } from '../../expressive/button-group';
import { LoadingIndicator } from '../../expressive/loading-indicator';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';
import { EmptyState } from '../../layout/empty-state';
import { ListCard } from '../../layout/list-card';
import { ListRow } from '../../layout/list-row';
import { Page } from '../../layout/page';
import { Section } from '../../layout/section';
import { Stagger } from '../../layout/stagger';

const UNIT_OPTIONS: readonly ButtonGroupOption<UnitSystem>[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
];

/** The current Peach's identity and settings. */
@Component({
  selector: 'pch-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonGroup,
    Card,
    EmptyState,
    ListCard,
    ListRow,
    LoadingIndicator,
    Page,
    Section,
    ShapedAvatar,
    Stagger,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly state = inject(AppState);
  protected readonly pwa = inject(Pwa);

  protected readonly version = APP_VERSION;
  protected readonly unitOptions = UNIT_OPTIONS;

  protected readonly peach = computed(() => this.state.peach.value());
  /** True while the profile is still loading (as opposed to signed out). */
  protected readonly loading = computed(
    () => this.state.peachId() !== null && this.state.peach.value() === undefined,
  );

  protected readonly identityLine = computed(() => {
    const p = this.peach();
    const crates = this.state.myCrates.value()?.length ?? 0;
    return [...(p?.email ? [p.email] : []), Fmt.count(crates, 'Crate')].join(' · ');
  });

  protected readonly canSignOut = computed(() => {
    // Re-evaluated with the auth state; the provider set depends on it.
    this.state.authUser();
    return this.state.auth.availableProviders.size > 0;
  });

  async saveUnits(peach: Peach, units: UnitSystem | null): Promise<void> {
    if (units === null || units === peach.units) return;
    await this.state.run((app) => app.peaches.save({ ...peach, units }));
  }

  protected install(): void {
    void this.pwa.install();
  }

  protected signOut(): void {
    void this.state.auth.signOut();
  }
}
