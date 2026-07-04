import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'welcome',
    loadComponent: () => import('./pages/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: 'camera',
    loadComponent: () => import('./pages/camera.page').then((m) => m.CameraPage),
  },
  {
    path: '',
    redirectTo: '/welcome',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: '/welcome',
  },
];
