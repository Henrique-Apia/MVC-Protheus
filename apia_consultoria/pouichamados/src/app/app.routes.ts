import { Routes } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { ChamadosRestAdapterInterceptor } from './core/interceptors/chamados-rest-adapter.interceptor';
import { ShellAuthInterceptor } from './core/interceptors/shell-auth.interceptor';

const REST_ADAPTER_PROVIDERS = [
  provideHttpClient(withInterceptorsFromDi()),
  { provide: HTTP_INTERCEPTORS, useClass: ChamadosRestAdapterInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: ShellAuthInterceptor, multi: true }
];

export const routes: Routes = [
  {
    path: '',
    providers: REST_ADAPTER_PROVIDERS,
    loadComponent: () =>
      import('./features/chamados-lista/chamados-lista').then((m) => m.ChamadosListaComponent)
  },
  {
    // Exigencia do FwCallApp: precisa existir uma rota para "index.html"
    // apontando para o mesmo componente da rota vazia.
    path: 'index.html',
    providers: REST_ADAPTER_PROVIDERS,
    loadComponent: () =>
      import('./features/chamados-lista/chamados-lista').then((m) => m.ChamadosListaComponent)
  }
];
