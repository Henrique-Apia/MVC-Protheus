import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

/** Anexa o Basic Auth da sessão em toda chamada pro REST do Protheus (`/rest/...`). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const header = authService.basicAuthHeader;

  if (!header || !req.url.includes('/rest/')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: header } }));
};
