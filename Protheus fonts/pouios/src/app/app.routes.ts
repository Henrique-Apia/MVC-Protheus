import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/os-lista/os-lista').then((m) => m.OsListaComponent)
  },
  {
    // Exigencia do FwCallApp: precisa existir uma rota para "index.html"
    // apontando para o mesmo componente da rota vazia (mesmo padrao do pouichamados).
    path: 'index.html',
    loadComponent: () => import('./features/os-lista/os-lista').then((m) => m.OsListaComponent)
  }
];
