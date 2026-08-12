import { Routes } from '@angular/router';

export const OS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/os-lista/os-lista').then((m) => m.OsListaComponent)
  }
];
