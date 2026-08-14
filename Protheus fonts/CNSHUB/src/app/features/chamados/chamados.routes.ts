import { Routes } from '@angular/router';

export const CHAMADOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/chamados-lista/chamados-lista').then((m) => m.ChamadosListaComponent)
  }
];
