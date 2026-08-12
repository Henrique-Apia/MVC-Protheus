import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/agenda-lista/agenda-lista').then((m) => m.AgendaListaComponent)
  },
  {
    // Exigencia do FwCallApp: precisa existir uma rota para "index.html"
    // apontando para o mesmo componente da rota vazia.
    path: 'index.html',
    loadComponent: () =>
      import('./features/agenda-lista/agenda-lista').then((m) => m.AgendaListaComponent)
  }
];