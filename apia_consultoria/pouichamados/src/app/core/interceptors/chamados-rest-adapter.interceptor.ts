import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize, map } from 'rxjs/operators';

import { BuscaCronometroService } from '../services/busca-cronometro.service';

/**
 * Adapta o contrato do endpoint legado WSRESTFUL CNSACHAMADOS (POUICNSA001.prw)
 * para o padrão de API esperado pelos templates po-page-dynamic-table / po-table
 * (ver https://po-ui.io/guides/api):
 *
 * - Requisição: o po-page-dynamic-table sempre manda `page` e `pageSize` (não dá
 *   pra renomear isso no componente) — o ADVPL espera `pagina` e `tamanho`.
 * - Requisição: os campos boolean do p-fields (meus / semResponsavel) saem como
 *   a string 'true'/'false' — o ADVPL só espera o parâmetro quando for pra
 *   filtrar (`meus=1`), e omitido caso contrário.
 * - Resposta: o po-page-dynamic-table espera `{ hasNext, items }` — o ADVPL
 *   retorna `{ total, totalPaginas, pagina, tamanho, items }`.
 *
 * A busca rápida já sai com o nome certo (`texto`) porque o componente usa
 * p-quick-search-param="texto" (ver chamados-lista.ts), então não precisa de
 * tradução aqui. O mesmo vale pra idCh, assunto e status: os nomes de
 * propriedade no p-fields já batem com os nomes que o ADVPL espera.
 *
 * ATENÇÃO: os filtros de "cliente" e "data" foram incluídos no p-fields para
 * aparecer na busca avançada, mas o WSRESTFUL atual (CNSACHAMADOS) ainda não
 * implementa filtro por esses dois campos — só por idCh, texto, meus,
 * semResponsavel e status. Ou seja, hoje eles aparecem na tela mas não
 * filtram de verdade até o ADVPL ganhar suporte a eles.
 */
@Injectable()
export class ChamadosRestAdapterInterceptor implements HttpInterceptor {
  private readonly cronometro = inject(BuscaCronometroService);

  private readonly CHAMADOS_PATH = '/rest/CNSACHAMADOS';

  private readonly CAMPOS_BOOLEAN = ['meus', 'semResponsavel'];

  // po-page-dynamic-table não expõe nenhuma propriedade pra configurar o
  // tamanho de página (conferido: nem p-page-size nem nada parecido existe
  // no componente) - manda sempre pageSize=10, fixo, por baixo dos panos.
  // Único jeito de pedir mais itens por tela ("50 chamados antes de clicar
  // em Carregar mais") é sobrescrever aqui, antes de virar `tamanho` pro
  // ADVPL (que aceita até 100, ver POUICNSA001.PRW).
  private readonly TAMANHO_PAGINA = 50;

  /**
   * FIX: `.includes(CHAMADOS_PATH)` também batia em CNSACHAMADOSVERAGENDA,
   * ASSUMIR, EXCLUIR, AGENDAR, ANOTACAO(SALVAR), ANOTACOES(INCLUIR) etc -
   * qualquer endpoint cujo nome começa com o mesmo prefixo. O `map` de
   * resposta abaixo então reescrevia o corpo desses outros endpoints pra
   * `{ hasNext, items }`, descartando qualquer outro campo (ex: `idCh`) e
   * inventando um `hasNext` sempre falso. `endsWith` no trecho antes da
   * query string garante que só a listagem de verdade (`/rest/CNSACHAMADOS`
   * exato) é adaptada.
   */
  private ehListagemChamados(url: string): boolean {
    return url.split('?')[0].endsWith(this.CHAMADOS_PATH);
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.ehListagemChamados(req.url)) {
      return next.handle(req);
    }

    let params = req.params;

    if (params.has('page')) {
      params = params.set('pagina', params.get('page')!).delete('page');
    }
    if (params.has('pageSize')) {
      params = params.set('tamanho', String(this.TAMANHO_PAGINA)).delete('pageSize');
    }

    for (const campo of this.CAMPOS_BOOLEAN) {
      if (!params.has(campo)) {
        continue;
      }
      const valor = params.get(campo);
      params = params.delete(campo);
      if (valor === 'true') {
        params = params.set(campo, '1');
      }
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
