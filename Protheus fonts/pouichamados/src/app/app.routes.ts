import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/chamados-lista/chamados-lista').then((m) => m.ChamadosListaComponent)
  },
  {
    // Exigencia do FwCallApp: precisa existir uma rota para "index.html"
    // apontando para o mesmo componente da rota vazia.
    path: 'index.html',
    loadComponent: () =>
      import('./features/chamados-lista/chamados-lista').then((m) => m.ChamadosListaComponent)
  }
];
