// Campos da SZ1 expostos pelo POUICNSA002.prw (WSRESTFUL CNSAOS) - só os
// campos de negócio (ver docs/superpowers/specs/2026-07-31-pouios-ordens-servico-design.md).
// Campos de auditoria/aprovação/fatura (Z1_APROVAD, Z1_FATURAR e todo o
// rastro de aprovador/e-mail/IP/custos) ficam fora do v1 - só existem no
// backend pra alimentar o campo derivado `status` (legenda da lista).
export interface Os {
  os: string;
  dtDigitacao: string; // yyyy-MM-dd
  codCliente: string;
  lojaCliente: string;
  nomeCliente: string;
  usuario: string;
  modulo: string;
  nomeModulo: string;
  motivo: string;
  nomeMotivo: string;
  descricao: string;
  codServico: string;
  nomeServico: string;
  dataOs: string; // yyyy-MM-dd
  /** 'S' | 'N' */
  osInterna: string;
  horaInicial: string; // HH:mm
  horaInicialDec: number;
  horaFinal: string; // HH:mm
  horaFinalDec: number;
  horasTranDec: number;
  /** 'S' | 'N' */
  prevPmt: string;
  horasTiDec: number;
  totalHoras: string;
  codAnalista: string;
  nomeAnalista: string;
  numProposta: string;
  pedVenda: string;
  hrAlmoco: number;
  projeto: string;
  nomeProjeto: string;
  revisao: string;
  tarefa: string;
  nomeTarefa: string;
  chamadoHpsd: string;
  chamado: string;
  /** 'S' | 'N' */
  osDesenv: string;
  linhaPv: string;
  valorHora: number;
  /**
   * Derivado no servidor a partir de Z1_APROVAD/Z1_FATURAR - mesma legenda do
   * AddLegend do CNSA002: 'aprovada_faturada' | 'faturada_sem_aprovacao' |
   * 'aprovada' | 'aguardando_aprovacao' | 'negada'.
   */
  status: string;
}

export interface FiltroOs {
  pagina: number;
  tamanho: number;
  /** Visualizar uma OS específica por número. Tem prioridade absoluta no servidor. */
  os?: string;
  /** Pesquisa livre por texto na descrição (LIKE). */
  texto?: string;
  /** Filtra por código do cliente (SA1). */
  cliente?: string;
  /** Filtra por ano da Data OS. Sem informar, o servidor usa janela padrão (ano atual -1 a +2). */
  ano?: number;
}

export interface OsPagina {
  total: number;
  totalPaginas: number;
  pagina: number;
  tamanho: number;
  items: Os[];
}

// Payload do POST /rest/CNSAOSINCLUIR - campos obrigatórios (*) confirmados
// na tela real "Dados da OS" do CNSA002 (prints de Henrique): Cliente, Site
// Cliente, Usuario, Modulo, Motivo, Descrição, Cod Servico, Data OS, Hora
// Inicial/Final decimais, Hrs TI Dec e Analista.
export interface NovaOs {
  codCliente: string;
  lojaCliente: string;
  usuario: string;
  modulo: string;
  motivo: string;
  descricao: string;
  codServico: string;
  dataOs: string; // yyyy-MM-dd
  horaInicialDec: number;
  horaFinalDec: number;
  horasTiDec: number;
  codAnalista: string;
  dtDigitacao?: string; // yyyy-MM-dd, se omitido o ADVPL assume hoje
  osInterna?: string;
  horasTranDec?: number;
  prevPmt?: string;
  numProposta?: string;
  pedVenda?: string;
  hrAlmoco?: number;
  projeto?: string;
  revisao?: string;
  tarefa?: string;
  chamadoHpsd?: string;
  chamado?: string;
  osDesenv?: string;
  linhaPv?: string;
  valorHora?: number;
}

export interface IncluirOsResposta {
  sucesso: boolean;
  os: string;
  mensagem: string;
}

// Alteração é PARCIAL - só manda o que vier preenchido, mesmo padrão do
// AlterarChamado em pouichamados.
export interface AlterarOs extends Partial<NovaOs> {
  os: string;
}

export interface AlterarOsResposta {
  sucesso: boolean;
  os: string;
  mensagem: string;
}

export interface ExcluirOsResposta {
  sucesso: boolean;
  os: string;
  mensagem: string;
}

// Resposta do POST /rest/CNSAOSCOPIAR - replica U_COPIAR_OS (CNSA002.PRW):
// novo Z1_OS, zera aprovação/faturamento.
export interface CopiarOsResposta {
  sucesso: boolean;
  osOriginal: string;
  osNova: string;
  mensagem: string;
}
