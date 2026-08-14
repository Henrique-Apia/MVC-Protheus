import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const STORAGE_KEY = 'cns-shell-auth-token';

/**
 * Anexa o Basic Auth guardado pelo login do cns-shell (mesma origem,
 * sessionStorage compartilhado entre host e remotes federados) em toda
 * chamada pro REST do Protheus. Le a chave diretamente do storage em vez de
 * importar o AuthService do cns-shell - remote federado nao deve depender
 * de codigo interno do host.
 */
@Injectable()
export class ShellAuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = sessionStorage.getItem(STORAGE_KEY);
    if (!token || !req.url.includes('/rest/')) {
      return next.handle(req);
    }
    return next.handle(req.clone({ setHeaders: { Authorization: `Basic ${token}` } }));
  }
}
