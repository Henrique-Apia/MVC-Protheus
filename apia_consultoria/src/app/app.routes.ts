import { Routes } from '@angular/router';
import { loadRemoteModule } from '@angular-architects/native-federation-v4';

import { authGuard } from './core/guards/auth.guard';

function loadRemoteRoutes(remoteName: string) {
  return () =>
    loadRemoteModule(remoteName, './Routes')
      .then((m) => m.routes)
      .catch((err) => {
        console.error(`Falha ao carregar remote "${remoteName}"`, err);
        return [
          {
            path: '',
            loadComponent: () =>
              import('./features/remote-error/remote-error').then((m) => m.RemoteErrorComponent),
            data: { moduleName: remoteName }
          }
        ];
      });
}

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home').then((m) => m.HomeComponent)
  },
  {
    path: 'chamados',
    canActivate: [authGuard],
    loadChildren: loadRemoteRoutes('pouichamados')
  },
  {
    path: 'agenda',
    pathMatch: 'full',
    redirectTo: 'agenda/cns009'
  },
  {
    path: 'agenda',
    canActivate: [authGuard],
    loadChildren: loadRemoteRoutes('apia_cs')
  },
  {
    path: 'os',
    canActivate: [authGuard],
    loadChildren: loadRemoteRoutes('pouios')
  }
];
