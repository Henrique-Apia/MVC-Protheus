import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import { BuscaCronometroService } from '../services/busca-cronometro.service';

/**
 * Adapta o contrato do WSRESTFUL CNSAOS (POUICNSA002.prw) para o padrão de
 * API esperado pelo po-page-dynamic-table (ver https://po-ui.io/guides/api) -
 * mesma adaptação já usada em pouichamados (ChamadosRestAdapterInterceptor):
 *
 * - Requisição: o po-page-dynamic-table sempre manda `page`/`pageSize` - o
 *   ADVPL espera `pagina`/`tamanho`.
 * - Resposta: o po-page-dynamic-table espera `{ hasNext, items }` - o ADVPL
 *   retorna `{ total, totalPaginas, pagina, tamanho, items }`.
 *
 * `endsWith` no trecho antes da query string garante que só a listagem de
 * verdade (`/rest/CNSAOS` exato) é adaptada - não bate em CNSAOSINCLUIR,
 * CNSAOSALTERAR, CNSAOSEXCLUIR ou CNSAOSCOPIAR (mesmo cuidado do pouichamados).
 */
@Injectable()
export class OsRestAdapterInterceptor implements HttpInterceptor {
  private readonly cronometro = inject(BuscaCronometroService);

  private readonly OS_PATH = '/rest/CNSAOS';

  // po-page-dynamic-table não expõe nenhuma propriedade pra configurar o
  // tamanho de página - manda sempre pageSize=10, fixo, por baixo dos panos.
  // Sobrescrevemos aqui antes de virar `tamanho` pro ADVPL (que aceita até
  // 100, mesmo padrão de pouichamados/POUICNSA001.PRW).
  private readonly TAMANHO_PAGINA = 25;

  private ehListagemOs(url: string): boolean {
    return url.split('?')[0].endsWith(this.OS_PATH);
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.ehListagemOs(req.url)) {
      return next.handle(req);
    }

    let params = req.params;

    if (params.has('page')) {
      params = params.set('pagina', params.get('page')!).delete('page');
    }
    if (params.has('pageSize')) {
      params = params.set('tamanho', String(this.TAMANHO_PAGINA)).delete('pageSize');
    }

    const adaptada = req.clone({ params });

    this.cronometro.iniciar();

    return next.handle(adaptada).pipe(
      map((event) => {
        if (event instanceof HttpResponse && event.body && Array.isArray((event.body as any).items)) {
          const corpo = event.body as { pagina: number; totalPaginas: number; items: unknown[] };
          return event.clone({ body: { hasNext: corpo.pagina < corpo.totalPaginas, items: corpo.items } });
        }
        return event;
      }),
      finalize(() => this.cronometro.parar())
    );
  }
}
