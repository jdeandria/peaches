import { Routes } from '@angular/router';

import { signedInGuard, signedOutGuard } from './state/guards';
import { Shell } from './ui/shell/shell';

/**
 * Pages are lazy-loaded so the first paint only pays for the shell and the
 * page being opened; the service worker prefetches the rest for offline use.
 */
export const routes: Routes = [
  {
    path: 'sign-in',
    title: 'Sign in',
    canMatch: [signedOutGuard],
    loadComponent: () => import('./ui/pages/sign-in/sign-in.page').then((m) => m.SignInPage),
  },
  {
    path: '',
    component: Shell,
    canMatch: [signedInGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Today',
        loadComponent: () => import('./ui/pages/today/today.page').then((m) => m.TodayPage),
      },
      {
        path: 'crates',
        title: 'Crates',
        loadComponent: () => import('./ui/pages/crates/crates.page').then((m) => m.CratesPage),
      },
      {
        path: 'crates/:crateId',
        title: 'Crate',
        loadComponent: () =>
          import('./ui/pages/crate-detail/crate-detail.page').then((m) => m.CrateDetailPage),
      },
      {
        path: 'crates/:crateId/vote',
        title: 'Vote',
        loadComponent: () => import('./ui/pages/vote/vote.page').then((m) => m.VotePage),
      },
      {
        path: 'matchups/:matchupId',
        title: 'Matchup',
        loadComponent: () => import('./ui/pages/matchup/matchup.page').then((m) => m.MatchupPage),
      },
      {
        path: 'log',
        title: 'Log a workout',
        loadComponent: () => import('./ui/pages/log/log.page').then((m) => m.LogPage),
      },
      {
        path: 'log/:logId',
        title: 'Workout',
        loadComponent: () => import('./ui/pages/log/log.page').then((m) => m.LogPage),
      },
      {
        path: 'exercises',
        title: 'Exercises',
        loadComponent: () =>
          import('./ui/pages/exercises/exercises.page').then((m) => m.ExercisesPage),
      },
      {
        path: 'profile',
        title: 'Profile',
        loadComponent: () => import('./ui/pages/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
