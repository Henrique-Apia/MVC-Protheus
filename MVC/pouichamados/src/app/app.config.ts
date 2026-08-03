import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { PoHttpRequestModule } from '@po-ui/ng-components';
import { ProtheusLibCoreModule } from '@totvs/protheus-lib-core';

import { routes } from './app.routes';
import { ChamadosRestAdapterInterceptor } from './core/interceptors/chamados-rest-adapter.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    importProvidersFrom([PoHttpRequestModule, ProtheusLibCoreModule]),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    { provide: HTTP_INTERCEPTORS, useClass: ChamadosRestAdapterInterceptor, multi: true }
  ]
};
