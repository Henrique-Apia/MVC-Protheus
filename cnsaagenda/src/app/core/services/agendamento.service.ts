import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import { Agendamento, AgendamentoPagina, FiltroAgendamento } from '../models/agendamento.model';

const AGENDAMENTOS_URL = '/rest/CNSAAGENDAMENTOS';

// Tamanho de pagina para buscar um MES inteiro de uma vez. Um mes tem no
// maximo poucas dezenas de agendamentos (bem longe do teto de 100 que o
// WSDATA aceita), entao isso normalmente resolve em 1 unica pagina.
const TAMANHO_PAGINA_MES = 100;

@Injectable({ providedIn: 'root' })
export class AgendamentoService {
  private readonly http = inject(HttpClient);

  /** Busca uma pagina especifica. Espelha exatamente o contrato do WSRESTFUL CNSAAGENDAMENTOS. */
  listar(filtro: FiltroAgendamento): Observable<AgendamentoPagina> {
    let url = `${AGENDAMENTOS_URL}?pagina=${filtro.pagina}&tamanho=${filtro.tamanho}`;
    if (filtro.ano !== undefined) {
      url += `&ano=${filtro.ano}`;
    }
    if (filtro.mes !== undefined) {
      url += `&mes=${filtro.mes}`;
    }
    if (filtro.meu) {
      url += `&meu=1`;
    }
    if (filtro.assumidos) {
      url += `&assumidos=1`;
    }
    if (filtro.chamado) {
      url += `&chamado=${encodeURIComponent(filtro.chamado)}`;
    }
    if (filtro.tecnico) {
      url += `&tecnico=${encodeURIComponent(filtro.tecnico)}`;
    }
    if (filtro.cliente) {
      url += `&cliente=${encodeURIComponent(filtro.cliente)}`;
    }
    return this.http.get<AgendamentoPagina>(url);
  }

  /**
   * Busca todos os agendamentos de um mes especifico (mes 1-12), concatenando
   * paginas se precisar (na pratica, quase sempre 1 unica pagina).
   *
   * `modo`:
   * - 'todos'     -> sem filtro de tecnico (uso da secao "Agendas")
   * - 'meu'       -> so os agendamentos do tecnico da sessao logada
   * - 'assumidos' -> quem e do grupo privilegiado ve de todos; quem nao e,
   *                  fica restrito ao proprio tecnico (regra aplicada no servidor)
   *
   * O Angular nunca precisa saber o proprio codigo de tecnico nem se e privilegiado -
   * as duas coisas sao resolvidas no servidor via sessao (__cUserId).
   */
  listarPorMes(
    ano: number,
    mes: number,
    modo: 'todos' | 'meu' | 'assumidos' = 'todos',
    tamanhoPagina = TAMANHO_PAGINA_MES
  ): Observable<Agendamento[]> {
    const montar = (pagina: number): FiltroAgendamento => ({
      pagina,
      tamanho: tamanhoPagina,
      ano,
      mes,
      meu: modo === 'meu',
      assumidos: modo === 'assumidos'
    });

    return this.listar(montar(1)).pipe(
      expand((resposta) => (resposta.pagina < resposta.totalPaginas ? this.listar(montar(resposta.pagina + 1)) : EMPTY)),
      reduce((acumulado, resposta) => [...acumulado, ...resposta.items], [] as Agendamento[])
    );
  }

  /**
   * Consulta livre por chamado/tecnico/cliente - sem limite de data (historico
   * completo). Usado na secao "Consultas". Pelo menos um dos tres deve vir
   * preenchido; concatena paginas se a busca trouxer mais de uma pagina.
   */
  listarConsulta(
    filtro: { chamado?: string; tecnico?: string; cliente?: string },
    tamanhoPagina = TAMANHO_PAGINA_MES
  ): Observable<Agendamento[]> {
    const montar = (pagina: number): FiltroAgendamento => ({ pagina, tamanho: tamanhoPagina, ...filtro });

    return this.listar(montar(1)).pipe(
      expand((resposta) =>
        resposta.pagina < resposta.totalPaginas ? this.listar(montar(resposta.pagina + 1)) : EMPTY
      ),
      reduce((acumulado, resposta) => [...acumulado, ...resposta.items], [] as Agendamento[])
    );
  }

  /**
   * Busca UMA pagina especifica de "meu" ou "assumidos", sem concatenar tudo -
   * usado na lista paginada (estilo "Chamados Assumidos" do portal antigo).
   * Sem limite de ano/mes: mostra o historico completo, paginado de verdade,
   * assim como o REST ja devolve (evita o problema de volume que ja tivemos
   * ao tentar carregar tudo de uma vez).
   */
  listarPaginado(
    modo: 'meu' | 'assumidos',
    pagina: number,
    ano?: number,
    tamanho = 20
  ): Observable<AgendamentoPagina> {
    return this.listar({
      pagina,
      tamanho,
      ano,
      meu: modo === 'meu',
      assumidos: modo === 'assumidos'
    });
  }

  /**
   * So o TOTAL de agendamentos de um ano inteiro, sem baixar os itens
   * (tamanho=1 - so precisamos do campo `total` da resposta). Usado pros
   * contadores das abas "Ano anterior/atual/seguinte".
   */
  contarAno(ano: number): Observable<number> {
    return this.listar({ pagina: 1, tamanho: 1, ano }).pipe(map((resposta) => resposta.total));
  }
}
