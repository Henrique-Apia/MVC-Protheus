import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  AlterarOs,
  AlterarOsResposta,
  CopiarOsResposta,
  ExcluirOsResposta,
  FiltroOs,
  IncluirOsResposta,
  NovaOs,
  Os,
  OsPagina
} from '../models/os.model';

// URL absoluta - em producao (apia.com.br) nao existe proxy reverso pro
// Protheus, o navegador chama a rede interna direto (mesmo padrao que o
// app apia_cs do chefe ja usa em producao).
export const PROTHEUS_REST_BASE = 'http://10.0.0.3:3624';
const OS_URL = `${PROTHEUS_REST_BASE}/rest/CNSAOS`;
const OS_INCLUIR_URL = `${PROTHEUS_REST_BASE}/rest/CNSAOSINCLUIR`;
const OS_ALTERAR_URL = `${PROTHEUS_REST_BASE}/rest/CNSAOSALTERAR`;
const OS_EXCLUIR_URL = `${PROTHEUS_REST_BASE}/rest/CNSAOSEXCLUIR`;
const OS_COPIAR_URL = `${PROTHEUS_REST_BASE}/rest/CNSAOSCOPIAR`;

/** Campos opcionais de NovaOs/AlterarOs mandados via querystring quando preenchidos. */
const CAMPOS_OPCIONAIS: Array<keyof NovaOs> = [
  'osInterna',
  'horasTranDec',
  'prevPmt',
  'numProposta',
  'pedVenda',
  'hrAlmoco',
  'projeto',
  'revisao',
  'tarefa',
  'chamadoHpsd',
  'chamado',
  'osDesenv',
  'linhaPv',
  'valorHora'
];

@Injectable({ providedIn: 'root' })
export class OsService {
  private readonly http = inject(HttpClient);

  /** Busca uma página específica. Espelha exatamente o contrato do WSRESTFUL CNSAOS. */
  listar(filtro: FiltroOs): Observable<OsPagina> {
    let url = `${OS_URL}?pagina=${filtro.pagina}&tamanho=${filtro.tamanho}`;
    if (filtro.os) {
      url += `&os=${encodeURIComponent(filtro.os)}`;
    }
    if (filtro.texto) {
      url += `&texto=${encodeURIComponent(filtro.texto)}`;
    }
    if (filtro.cliente) {
      url += `&cliente=${encodeURIComponent(filtro.cliente)}`;
    }
    if (filtro.ano) {
      url += `&ano=${filtro.ano}`;
    }
    return this.http.get<OsPagina>(url);
  }

  /**
   * Busca UMA OS específica por número ("Visualizar"). Reaproveita o mesmo
   * endpoint de listagem (`os` tem prioridade absoluta no servidor) - devolve
   * null se não encontrar nada.
   */
  buscarPorId(os: string): Observable<Os | null> {
    return this.listar({ pagina: 1, tamanho: 1, os }).pipe(map((resposta) => resposta.items[0] ?? null));
  }

  /** Inclui uma nova OS ("Incluir"). Z1_APROVAD/Z1_FATURAR ficam fixos "N" no ADVPL. */
  incluir(nova: NovaOs): Observable<IncluirOsResposta> {
    let url =
      `${OS_INCLUIR_URL}?codCliente=${encodeURIComponent(nova.codCliente)}` +
      `&lojaCliente=${encodeURIComponent(nova.lojaCliente)}` +
      `&usuario=${encodeURIComponent(nova.usuario)}` +
      `&modulo=${encodeURIComponent(nova.modulo)}` +
      `&motivo=${encodeURIComponent(nova.motivo)}` +
      `&descricao=${encodeURIComponent(nova.descricao)}` +
      `&codServico=${encodeURIComponent(nova.codServico)}` +
      `&dataOs=${encodeURIComponent(nova.dataOs)}` +
      `&horaInicialDec=${nova.horaInicialDec}` +
      `&horaFinalDec=${nova.horaFinalDec}` +
      `&horasTiDec=${nova.horasTiDec}` +
      `&codAnalista=${encodeURIComponent(nova.codAnalista)}`;
    if (nova.dtDigitacao) {
      url += `&dtDigitacao=${encodeURIComponent(nova.dtDigitacao)}`;
    }
    for (const campo of CAMPOS_OPCIONAIS) {
      const valor = nova[campo];
      if (valor !== undefined && valor !== '') {
        url += `&${campo}=${encodeURIComponent(String(valor))}`;
      }
    }
    return this.http.post<IncluirOsResposta>(url, null);
  }

  /**
   * Altera uma OS existente ("Alterar"/"Editar"). Alteração PARCIAL - só
   * manda os campos que vieram preenchidos; o ADVPL só troca o que recebeu.
   */
  alterar(dados: AlterarOs): Observable<AlterarOsResposta> {
    let url = `${OS_ALTERAR_URL}?os=${encodeURIComponent(dados.os)}`;
    const todosCampos: Array<keyof NovaOs> = [
      'codCliente',
      'lojaCliente',
      'usuario',
      'modulo',
      'motivo',
      'descricao',
      'codServico',
      'dataOs',
      'horaInicialDec',
      'horaFinalDec',
      'horasTiDec',
      'codAnalista',
      'dtDigitacao',
      ...CAMPOS_OPCIONAIS
    ];
    for (const campo of todosCampos) {
      const valor = dados[campo];
      if (valor !== undefined && valor !== '') {
        url += `&${campo}=${encodeURIComponent(String(valor))}`;
      }
    }
    return this.http.post<AlterarOsResposta>(url, null);
  }

  /** Exclui uma OS ("Excluir"). */
  excluir(os: string): Observable<ExcluirOsResposta> {
    return this.http.post<ExcluirOsResposta>(`${OS_EXCLUIR_URL}?os=${encodeURIComponent(os)}`, null);
  }

  /**
   * Duplica uma OS ("Copiar") - replica U_COPIAR_OS (CNSA002.PRW): gera novo
   * número e zera aprovação/faturamento no ADVPL.
   */
  copiar(os: string): Observable<CopiarOsResposta> {
    return this.http.post<CopiarOsResposta>(`${OS_COPIAR_URL}?os=${encodeURIComponent(os)}`, null);
  }
}
