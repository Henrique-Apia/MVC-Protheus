import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import {
  AgendarResposta,
  AlterarChamado,
  AlterarResposta,
  AnotacaoIncluirResposta,
  AnotacoesListaResposta,
  AssumirResposta,
  Chamado,
  ChamadoPagina,
  ExcluirResposta,
  FiltroChamado,
  IncluirResposta,
  NovoAgendamento,
  NovoChamado,
  VerAgendaResposta
} from '../models/chamado.model';

const CHAMADOS_URL = '/rest/CNSACHAMADOS';
const CHAMADOS_ASSUMIR_URL = '/rest/CNSACHAMADOSASSUMIR';
const CHAMADOS_EXCLUIR_URL = '/rest/CNSACHAMADOSEXCLUIR';
const CHAMADOS_INCLUIR_URL = '/rest/CNSACHAMADOSINCLUIR';
const CHAMADOS_ALTERAR_URL = '/rest/CNSACHAMADOSALTERAR';
const CHAMADOS_AGENDAR_URL = '/rest/CNSACHAMADOSAGENDAR';
const CHAMADOS_VERAGENDA_URL = '/rest/CNSACHAMADOSVERAGENDA';
const CHAMADOS_ANOTACOES_URL = '/rest/CNSACHAMADOSANOTACOES';
const CHAMADOS_ANOTACOES_INCLUIR_URL = '/rest/CNSACHAMADOSANOTACOESINCLUIR';

@Injectable({ providedIn: 'root' })
export class ChamadoService {
  private readonly http = inject(HttpClient);

  /** Busca uma pagina especifica. Espelha exatamente o contrato do WSRESTFUL CNSACHAMADOS. */
  listar(filtro: FiltroChamado): Observable<ChamadoPagina> {
    let url = `${CHAMADOS_URL}?pagina=${filtro.pagina}&tamanho=${filtro.tamanho}`;
    if (filtro.meus) {
      url += `&meus=1`;
    }
    if (filtro.semResponsavel) {
      url += `&semResponsavel=1`;
    }
    if (filtro.status) {
      url += `&status=${encodeURIComponent(filtro.status)}`;
    }
    if (filtro.idCh) {
      url += `&idCh=${encodeURIComponent(filtro.idCh)}`;
    }
    if (filtro.texto) {
      url += `&texto=${encodeURIComponent(filtro.texto)}`;
    }
    return this.http.get<ChamadoPagina>(url);
  }

  /**
   * Busca UM chamado especifico por Id ("Visualizar"). Reaproveita o mesmo
   * endpoint de listagem (idCh tem prioridade absoluta no servidor) - devolve
   * null se nao encontrar nada.
   */
  buscarPorId(idCh: string): Observable<Chamado | null> {
    return this.listar({ pagina: 1, tamanho: 1, idCh }).pipe(
      map((resposta) => resposta.items[0] ?? null)
    );
  }

  /**
   * Assume um chamado para o tecnico da sessao logada ("Assumir").
   * Endpoint proprio (CNSACHAMADOSASSUMIR, nao CNSACHAMADOS) - precisou ser
   * um WSRESTFUL separado por limitacao do compilador ADVPL (dois WSMETHOD
   * com DESCRIPTION na implementacao, no mesmo WSSERVICE, nao compilava).
   *
   * Em erro de validacao (403/404/409), o servidor devolve {"erro":"..."} -
   * o chamador precisa ler isso de dentro do corpo do HttpErrorResponse,
   * ja que HttpClient trata qualquer status >= 400 como erro.
   */
  assumir(idCh: string): Observable<AssumirResposta> {
    return this.http.post<AssumirResposta>(`${CHAMADOS_ASSUMIR_URL}?idCh=${encodeURIComponent(idCh)}`, null);
  }

  /**
   * Exclui um chamado ("Excluir"), removendo agenda vinculada e (se houver
   * técnico designado) enviando e-mail de cancelamento. `motivo` é
   * obrigatório no servidor quando o chamado tem técnico - opcional caso
   * contrário.
   */
  excluir(idCh: string, motivo: string): Observable<ExcluirResposta> {
    let url = `${CHAMADOS_EXCLUIR_URL}?idCh=${encodeURIComponent(idCh)}`;
    if (motivo) {
      url += `&motivo=${encodeURIComponent(motivo)}`;
    }
    return this.http.post<ExcluirResposta>(url, null);
  }

  /** Inclui um novo chamado ("Incluir"). Status inicial sempre "Aberto" no ADVPL. */
  incluir(novo: NovoChamado): Observable<IncluirResposta> {
    let url =
      `${CHAMADOS_INCLUIR_URL}?assunto=${encodeURIComponent(novo.assunto)}` +
      `&tipo=${encodeURIComponent(novo.tipo)}` +
      `&projeto=${encodeURIComponent(novo.projeto)}` +
      `&tarefa=${encodeURIComponent(novo.tarefa)}`;
    if (novo.dtAbertura) {
      url += `&dtAbertura=${encodeURIComponent(novo.dtAbertura)}`;
    }
    if (novo.codCliente) {
      url += `&codCliente=${encodeURIComponent(novo.codCliente)}`;
    }
    if (novo.lojaCliente) {
      url += `&lojaCliente=${encodeURIComponent(novo.lojaCliente)}`;
    }
    if (novo.emailCliente) {
      url += `&emailCliente=${encodeURIComponent(novo.emailCliente)}`;
    }
    if (novo.codConsultor) {
      url += `&codConsultor=${encodeURIComponent(novo.codConsultor)}`;
    }
    return this.http.post<IncluirResposta>(url, null);
  }

  /**
   * Altera um chamado existente ("Alterar"/"Editar"). Alteração parcial - só
   * manda os campos que vieram preenchidos; o ADVPL só troca o que recebeu.
   * Mesmo conjunto de campos do incluir() (Editar = Incluir, mesma
   * assinatura/estrutura) - inclusive dispara e-mail de redesignação no
   * servidor se codConsultor vier preenchido e for diferente do atual.
   *
   * limparCliente/limparConsultor viram limparCliente=1/limparConsultor=1 na
   * query - sinalizam que o campo deve ser explicitamente zerado no servidor
   * (ver CNSA_ALTERAR), já que codCliente/codConsultor vazios por si só
   * significam "não mexer" nessa alteração parcial.
   */
  alterar(dados: AlterarChamado): Observable<AlterarResposta> {
    let url = `${CHAMADOS_ALTERAR_URL}?idCh=${encodeURIComponent(dados.idCh)}`;
    if (dados.assunto) {
      url += `&assunto=${encodeURIComponent(dados.assunto)}`;
    }
    if (dados.dtAbertura) {
      url += `&dtAbertura=${encodeURIComponent(dados.dtAbertura)}`;
    }
    if (dados.tipo) {
      url += `&tipo=${encodeURIComponent(dados.tipo)}`;
    }
    if (dados.limparCliente) {
      url += `&limparCliente=1`;
    } else if (dados.codCliente) {
      url += `&codCliente=${encodeURIComponent(dados.codCliente)}`;
    }
    if (dados.lojaCliente) {
      url += `&lojaCliente=${encodeURIComponent(dados.lojaCliente)}`;
    }
    if (dados.emailCliente) {
      url += `&emailCliente=${encodeURIComponent(dados.emailCliente)}`;
    }
    if (dados.limparConsultor) {
      url += `&limparConsultor=1`;
    } else if (dados.codConsultor) {
      url += `&codConsultor=${encodeURIComponent(dados.codConsultor)}`;
    }
    if (dados.projeto) {
      url += `&projeto=${encodeURIComponent(dados.projeto)}`;
    }
    if (dados.tarefa) {
      url += `&tarefa=${encodeURIComponent(dados.tarefa)}`;
    }
    return this.http.post<AlterarResposta>(url, null);
  }

  /**
   * Cria agendamento(s) de verdade na SZ6 ("Agendar") - substitui a
   * tentativa de abrir o cnsaagenda via FwCallApp (que não funciona chamado
   * via REST/Angular). Se dataInicio !== dataFim, o ADVPL cria um registro
   * por dia no intervalo.
   */
  agendar(dados: NovoAgendamento): Observable<AgendarResposta> {
    let url =
      `${CHAMADOS_AGENDAR_URL}?idCh=${encodeURIComponent(dados.idCh)}` +
      `&dataInicio=${encodeURIComponent(dados.dataInicio)}` +
      `&dataFim=${encodeURIComponent(dados.dataFim)}` +
      `&codTecnico=${encodeURIComponent(dados.codTecnico)}` +
      `&horaInicio=${encodeURIComponent(dados.horaInicio)}` +
      `&horaFim=${encodeURIComponent(dados.horaFim)}` +
      `&codCliente=${encodeURIComponent(dados.codCliente)}`;

    const opcionais: Array<[string, string | undefined]> = [
      ['lojaCliente', dados.lojaCliente],
      ['descricao', dados.descricao],
      ['confirmacao', dados.confirmacao],
      ['turno', dados.turno],
      ['agInterna', dados.agInterna],
      ['agCobravel', dados.agCobravel],
      ['tipoAgenda', dados.tipoAgenda],
      ['projeto', dados.projeto],
      ['revisao', dados.revisao],
      ['tarefa', dados.tarefa],
      ['tipoHora', dados.tipoHora],
      ['codAgendador', dados.codAgendador]
    ];
    for (const [chave, valor] of opcionais) {
      if (valor) {
        url += `&${chave}=${encodeURIComponent(valor)}`;
      }
    }

    return this.http.post<AgendarResposta>(url, null);
  }

  /**
   * Busca os agendamentos (SZ6) já criados pra um chamado ("Ver Agenda") -
   * Data, Cliente, Horário, Técnico e Descrição de cada um.
   */
  verAgenda(idCh: string): Observable<VerAgendaResposta> {
    return this.http.get<VerAgendaResposta>(`${CHAMADOS_VERAGENDA_URL}?idCh=${encodeURIComponent(idCh)}`);
  }

  /**
   * Lista o histórico completo de anotações (ZA2) de um chamado, mais antiga
   * primeiro. Substitui o antigo par buscarAnotacao/salvarAnotacao
   * (ZA1_ANOT, campo único sobrescrito a cada save, sem histórico) - cada
   * anotação agora vira uma linha nova, nenhuma se perde. O endpoint antigo
   * (CNSACHAMADOSANOTACAO/ANOTACAOSALVAR) continua existindo no backend,
   * só não é mais chamado por este app.
   */
  listarAnotacoes(idCh: string): Observable<AnotacoesListaResposta> {
    return this.http.get<AnotacoesListaResposta>(`${CHAMADOS_ANOTACOES_URL}?idCh=${encodeURIComponent(idCh)}`);
  }

  /** Adiciona uma anotação nova ao histórico do chamado - nunca sobrescreve as anteriores. */
  incluirAnotacao(idCh: string, texto: string): Observable<AnotacaoIncluirResposta> {
    const url = `${CHAMADOS_ANOTACOES_INCLUIR_URL}?idCh=${encodeURIComponent(idCh)}&texto=${encodeURIComponent(texto)}`;
    return this.http.post<AnotacaoIncluirResposta>(url, null);
  }
}
