import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then((m) => m.HomeComponent)
  },
  {
    // Exigencia do FwCallApp: precisa existir uma rota para "index.html"
    // apontando para o mesmo componente da rota vazia.
    path: 'index.html',
    loadComponent: () => import('./features/home/home').then((m) => m.HomeComponent)
  },
  {
    path: 'chamados',
    loadChildren: () => import('./features/chamados/chamados.routes').then((m) => m.CHAMADOS_ROUTES)
  },
  {
    path: 'agenda',
    loadChildren: () => import('./features/agenda/agenda.routes').then((m) => m.AGENDA_ROUTES)
  },
  {
    path: 'os',
    loadChildren: () => import('./features/os/os.routes').then((m) => m.OS_ROUTES)
  }
];
