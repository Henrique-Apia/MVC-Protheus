import { Routes } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { OsRestAdapterInterceptor } from './core/interceptors/os-rest-adapter.interceptor';
import { ShellAuthInterceptor } from './core/interceptors/shell-auth.interceptor';

const REST_ADAPTER_PROVIDERS = [
  provideHttpClient(withInterceptorsFromDi()),
  { provide: HTTP_INTERCEPTORS, useClass: OsRestAdapterInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: ShellAuthInterceptor, multi: true }
];

export const routes: Routes = [
  {
    path: '',
    providers: REST_ADAPTER_PROVIDERS,
    loadComponent: () => import('./features/os-lista/os-lista').then((m) => m.OsListaComponent)
  },
  {
    // Exigencia do FwCallApp: precisa existir uma rota para "index.html"
    // apontando para o mesmo componente da rota vazia (mesmo padrao do pouichamados).
    path: 'index.html',
    providers: REST_ADAPTER_PROVIDERS,
    loadComponent: () => import('./features/os-lista/os-lista').then((m) => m.OsListaComponent)
  }
];
