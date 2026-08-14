import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, expand, reduce, shareReplay, EMPTY } from 'rxjs';

const PROTHEUS_REST_BASE = 'http://10.0.0.3:3624';
const TAMANHO_PAGINA = 100;

export interface Agendamento {
  data: string; // yyyy-MM-dd
  tecnico: string;
  seq: string;
  hini: string; // HH:MM
  hfim: string; // HH:MM
  cliente: string;
  loja: string;
  confirmado: string;
  turno: string;
  chamado: string;
  statusChamado: string;
}

interface PaginaRest<T> {
  total: number;
  totalPaginas: number;
  pagina: number;
  tamanho: number;
  items: T[];
}

/**
 * Agendamentos (Z6) pro calendário semanal da Home. Usa o filtro
 * `assumidos=1` que o REST já implementa: quem é do grupo privilegiado
 * (CNSA_NOGRUPO) vê a agenda de todo mundo, quem não é vê só a própria
 * (resolvido pelo Protheus a partir do usuário autenticado no Basic Auth,
 * não precisa mandar o técnico explicitamente).
 *
 * O REST só filtra por ano/mês (CNSAAGENDAMENTOS?ano=X&mes=Y) - busca o mês
 * inteiro que contém a semana visível e cacheia por mês, trocar de semana
 * dentro do mesmo mês não gera chamada nova.
 */
@Injectable({ providedIn: 'root' })
export class AgendaSemanaService {
  private readonly http = inject(HttpClient);
  private readonly cachePorMes = new Map<string, Observable<Agendamento[]>>();

  // Chamado no login (ver AuthService) - cache é por mes/ano só, sem usuario;
  // sem isso, trocar de usuario na mesma aba reaproveitaria dado de outra
  // pessoa (ou de quem via tudo por ser admin).
  limparCache(): void {
    this.cachePorMes.clear();
  }

  agendamentosDoMes(ano: number, mes: number): Observable<Agendamento[]> {
    const chave = `${ano}-${mes}`;
    if (!this.cachePorMes.has(chave)) {
      const url = `${PROTHEUS_REST_BASE}/rest/CNSAAGENDAMENTOS?ano=${ano}&mes=${mes}&assumidos=1`;
      const buscarPagina = (pagina: number): Observable<PaginaRest<Agendamento>> =>
        this.http.get<PaginaRest<Agendamento>>(`${url}&pagina=${pagina}&tamanho=${TAMANHO_PAGINA}`);

      this.cachePorMes.set(
        chave,
        buscarPagina(1).pipe(
          expand((resposta) => (resposta.pagina < resposta.totalPaginas ? buscarPagina(resposta.pagina + 1) : EMPTY)),
          reduce((acumulado, resposta) => [...acumulado, ...resposta.items], [] as Agendamento[]),
          shareReplay(1)
        )
      );
    }
    return this.cachePorMes.get(chave)!;
  }
}
