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
        title: 'Plan',
        loadComponent: () => import('./ui/pages/plan/plan.page').then((m) => m.PlanPage),
      },
      {
        path: 'plan/:week/:workoutId',
        title: 'Plan a workout',
        loadComponent: () =>
          import('./ui/pages/plan/planned-workout.page').then((m) => m.PlannedWorkoutPage),
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
        path: 'crates/:crateId/logs/:logId',
        title: 'Workout',
        loadComponent: () => import('./ui/pages/workout/workout.page').then((m) => m.WorkoutPage),
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
        path: 'you',
        title: 'You',
        loadComponent: () =>
          import('./ui/pages/personal/personal.page').then((m) => m.PersonalPage),
      },
      // Where the tabs used to be.
      { path: 'compete', redirectTo: 'crates' },
      { path: 'profile', redirectTo: 'you' },
      { path: 'matchups/:matchupId/lineup', redirectTo: 'matchups/:matchupId' },
    ],
  },
  { path: '**', redirectTo: '' },
];
