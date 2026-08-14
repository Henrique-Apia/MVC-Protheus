import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import { SessaoServ } from './sessao-serv';

export interface AgendaItem {
  data: Date | null;
  tecnico: string;
  seq: string;
  horaInicial: string;
  horaFinal: string;
  cliente: string;
  loja: string;
  confirmado: string;
  turno: string;
}

interface FwModelField {
  id: string;
  value: string;
}

interface FwModelModel {
  id: string;
  fields: FwModelField[];
}

interface FwModelResource {
  models: FwModelModel[];
}

interface FwModelResponse {
  resources: FwModelResource[];
  total: number;
  startindex: number;
}

@Injectable({
  providedIn: 'root',
})
export class Cns009Serv {
  private static readonly TAMANHO_PAGINA = 500;

  constructor(
    private readonly http: HttpClient,
    private readonly sessao: SessaoServ
  ) {}

  /**
   * FIX (14s+ no load, medido): "cond1 .AND. cond2" (filtro composto com dois
   * operadores) dá erro 500 nesta API, mas BETWEEN é uma expressão ÚNICA (sem
   * AND) e já está confirmado funcionando neste mesmo host/path pelo
   * CNSAAGENDAMENTOS (CNSA001.PRW) - sem BETWEEN, o filtro só com limite
   * inferior (Z6_DTAGE>=inicio) devolvia tudo de "inicio" até o fim dos
   * tempos da SZ6 (130k+ linhas históricas), paginado em paralelo (forkJoin),
   * multiplicando o custo. Com BETWEEN, o limite superior já vem filtrado no
   * servidor - sem filtro client-side.
   */
  buscarPorPeriodo(inicio: Date, fim: Date = inicio): Observable<AgendaItem[]> {
    const filtro = `Z6_DTAGE BETWEEN '${this.formatarDataChave(inicio)}' AND '${this.formatarDataChave(fim)}'`;

    return this.buscarPagina(filtro, 1, 1).pipe(
      switchMap(primeira => {
        const total = primeira.total || 0;
        return total > 0 ? this.buscarTodasPaginas(filtro, total) : of([]);
      }),
      map(resources => resources.map(resource => this.toAgendaItem(resource))),
      catchError(error => throwError(() => new Error(this.mensagemErro(error))))
    );
  }

  /**
   * Monta a PK (base64) para as futuras operações de CRUD em um registro
   * único (GET/PUT/DELETE por PK). A chave física da Z6 repete a filial duas
   * vezes (prefixo implícito de filial do Protheus + o campo Z6_FILIAL),
   * seguida da data (aaaammdd), técnico e sequência.
   */
  montarPk(data: Date, tecnico: string, seq: string): string {
    const filial = this.sessao.filial;
    const chave = `${filial}${filial}${this.formatarDataChave(data)}${tecnico}${seq}`;
    return btoa(chave);
  }

  private buscarTodasPaginas(filtro: string, total: number): Observable<FwModelResource[]> {
    const startindexes: number[] = [];

    for (let startindex = 1; startindex <= total; startindex += Cns009Serv.TAMANHO_PAGINA) {
      startindexes.push(startindex);
    }

    return forkJoin(
      startindexes.map(startindex => this.buscarPagina(filtro, startindex, Cns009Serv.TAMANHO_PAGINA))
    ).pipe(map(respostas => respostas.flatMap(resposta => resposta.resources || [])));
  }

  private buscarPagina(filtro: string, startindex: number, count: number): Observable<FwModelResponse> {
    const url = `${environment.apiUrl}/agenda/?filter=${encodeURIComponent(filtro)}&startindex=${startindex}&count=${count}`;
    return this.http.get<FwModelResponse>(url, { headers: this.montarHeaders() });
  }

  private montarHeaders(): HttpHeaders {
    return new HttpHeaders({
      tenantid: `${this.sessao.empresa},${this.sessao.filial}`,
      Authorization: environment.authorization
    });
  }

  private mensagemErro(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Não foi possível conectar à API. Verifique se o servidor está no ar e se o CORS está liberado para esta origem.';
    }

    return `Erro HTTP ${error.status} (${error.statusText}) ao consultar a agenda.`;
  }

  private campo(resource: FwModelResource, nome: string): string {
    const model = resource.models.find(m => m.id === 'ModelSZ6_Main');
    const field = model?.fields.find(f => f.id === nome);
    return field?.value ?? '';
  }

  private formatarDataChave(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}${mes}${dia}`;
  }

  private parseData(valor: string): Date | null {
    if (!valor || valor.length !== 8) {
      return null;
    }

    const ano = Number(valor.substring(0, 4));
    const mes = Number(valor.substring(4, 6)) - 1;
    const dia = Number(valor.substring(6, 8));

    return new Date(ano, mes, dia);
  }

  private toAgendaItem(resource: FwModelResource): AgendaItem {
    return {
      data: this.parseData(this.campo(resource, 'Z6_DTAGE')),
      tecnico: this.campo(resource, 'Z6_TECNICO'),
      seq: this.campo(resource, 'Z6_SEQ'),
      horaInicial: this.campo(resource, 'Z6_HMINI'),
      horaFinal: this.campo(resource, 'Z6_HMFIM'),
      cliente: this.campo(resource, 'Z6_CLIENTE'),
      loja: this.campo(resource, 'Z6_LOJA'),
      confirmado: this.campo(resource, 'Z6_CONFIRM'),
      turno: this.campo(resource, 'Z6_TURNO')
    };
  }
}
