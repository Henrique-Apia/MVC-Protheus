import { Routes } from '@angular/router';

export const AGENDA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./agenda-shell/agenda-shell').then((m) => m.AgendaShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'calendario' },
      {
        path: 'calendario',
        loadComponent: () => import('./agenda-calendario/agenda-calendario').then((m) => m.AgendaCalendarioComponent)
      },
      {
        path: 'buscar-novos',
        loadComponent: () =>
          import('./agenda-buscar-novos/agenda-buscar-novos').then((m) => m.AgendaBuscarNovosComponent)
      },
      {
        path: 'meus',
        loadComponent: () =>
          import('./agenda-minha-lista/agenda-minha-lista').then((m) => m.AgendaMinhaListaComponent),
        data: { modo: 'meu' }
      },
      {
        path: 'assumidos',
        loadComponent: () =>
          import('./agenda-minha-lista/agenda-minha-lista').then((m) => m.AgendaMinhaListaComponent),
        data: { modo: 'assumidos' }
      },
      {
        path: 'encerrados',
        loadComponent: () => import('./agenda-encerrados/agenda-encerrados').then((m) => m.AgendaEncerradosComponent)
      },
      {
        path: 'consultas',
        loadComponent: () => import('./agenda-consultas/agenda-consultas').then((m) => m.AgendaConsultasComponent)
      }
    ]
  }
];
