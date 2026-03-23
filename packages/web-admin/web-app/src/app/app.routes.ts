import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'status', pathMatch: 'full' },
      {
        path: 'status',
        loadComponent: () =>
          import('./pages/admin/admin-status/admin-status.component').then(m => m.AdminStatusComponent),
      },
      {
        path: 'roles',
        loadComponent: () =>
          import('./pages/admin/admin-roles/admin-roles.component').then(m => m.AdminRolesComponent),
      },
      {
        path: 'roles/:roleId/widgets',
        loadComponent: () =>
          import('./pages/admin/admin-widgets/admin-widgets.component').then(m => m.AdminWidgetsComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/admin/admin-users/admin-users.component').then(m => m.AdminUsersComponent),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(m => m.NotFoundComponent),
  },
];
