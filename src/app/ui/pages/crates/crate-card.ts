import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { clamp } from '../../../domain/core/math';
import { Crate } from '../../../domain/models/crate';
import { isSeasonOpen, seasonStartDate } from '../../../domain/models/season';
import { AppState } from '../../../state/app-state';
import { ShapedAvatar } from '../../expressive/shaped-avatar';
import { WavyProgress } from '../../expressive/wavy-progress';
import { Fmt } from '../../format';
import { Card } from '../../layout/card';

/** One Crate in the grid: members, settings and the current Season's progress. */
@Component({
  selector: 'pch-crate-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Card, RouterLink, ShapedAvatar, WavyProgress],
  template: `@let c = crate();
    <a pch-card [routerLink]="['/crates', c.id]">
      <div class="head">
        <pch-shaped-avatar
          [shapeId]="c.id"
          [name]="c.name"
          [size]="52"
          color="tertiary-container"
          foreground="on-tertiary-container"
        />
        <div class="text">
          <span class="pch-title-large name">{{ c.name }}</span>
          <span class="pch-body-medium meta">{{ meta() }}</span>
        </div>
      </div>
      @if (c.description) {
        <p class="pch-body-medium description">{{ c.description }}</p>
      }
      @let s = season();
      @if (s) {
        <div class="season">
          <span class="pch-label-large season-name">{{ s.name }}</span>
          <span class="pch-label-medium muted">{{ s.progress }}</span>
        </div>
        <pch-wavy-progress [value]="s.value" />
      } @else {
        <span class="pch-label-large muted none">No Season yet</span>
      }
    </a>`,
  styles: `
    :host {
      display: block;
    }
    a {
      --pch-card-padding: 20px;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .meta,
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .description {
      margin: 12px 0 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .season {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: auto 0 8px;
      padding-top: 16px;
    }
    .season-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .none {
      margin-top: auto;
      padding-top: 16px;
    }
  `,
})
export class CrateCard {
  private readonly state = inject(AppState);

  readonly crate = input.required<Crate>();

  private readonly data = this.state.query(
    () => this.crate().id,
    async (id, app) => {
      const [members, seasons] = await Promise.all([
        app.crateService.activeMembers(id),
        app.seasons.forCrate(id),
      ]);
      const season = seasons.find(isSeasonOpen) ?? seasons[0] ?? null;
      const rounds = season ? await app.seasons.roundsOf(season.id) : [];
      return { memberCount: members.length, season, rounds };
    },
  );

  protected readonly meta = computed(() => {
    const { settings } = this.crate();
    const count = this.data.value()?.memberCount;
    return [
      ...(count === undefined ? [] : [Fmt.count(count, 'Peach', 'Peaches')]),
      Fmt.goal(settings.goal),
      `${settings.workoutDurationMinutes} min`,
    ].join(' · ');
  });

  protected readonly season = computed(() => {
    const data = this.data.value();
    if (!data?.season) return null;
    const { season, rounds } = data;
    const played = rounds.filter((r) => r.status === 'closed').length;
    const start = seasonStartDate(season);
    const progress =
      season.status === 'scheduled' && start
        ? `Starts ${Fmt.day(start)}`
        : `Round ${clamp(played + 1, 1, Math.max(1, rounds.length))} of ${rounds.length}`;
    return {
      name: season.name,
      progress,
      value: rounds.length === 0 ? 0 : played / rounds.length,
    };
  });
}
