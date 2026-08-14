// Resposta bruta do endpoint /rest/FwModel/agenda/
export interface FwModelField {
  id: string;
  value: string | null;
}

export interface FwModelGridModel {
  id: string;
  fields: FwModelField[];
}

export interface FwModelResource {
  models: FwModelGridModel[];
}

export interface FwModelResponse {
  total: number;
  startindex: number;
  resources: FwModelResource[];
}

// Campos da SZ6 expostos pelo FwModel, ja mapeados pelo CNSA001.prw
export interface Agendamento {
  filial: string;
  data: string; // yyyy-MM-dd
  tecnico: string;
  seq: string;
  hini: string;
  hfim: string;
  cliente: string;
  loja: string;
  confirmado: string;
  turno: string;
  /** Numero do chamado (ZA1) vinculado a este agendamento. */
  chamado: string;
  /** Status do chamado vinculado (mesma legenda do CNSA001: '4' = Fechado). Vazio se nao resolvido. */
  statusChamado: string;
}

export interface FiltroAgendamento {
  pagina: number;
  tamanho: number;
  /** Ano do filtro. Se informado sozinho (sem mes), filtra o ano inteiro. */
  ano?: number;
  /** Mes do filtro, 1-12. So tem efeito se `ano` tambem for informado. */
  mes?: number;
  /** Se true, filtra so os agendamentos do tecnico da sessao logada. */
  meu?: boolean;
  /** Se true, filtra por "assumidos": quem e do grupo privilegiado ve de todos,
   *  quem nao e fica restrito ao proprio tecnico (regra aplicada no servidor). */
  assumidos?: boolean;
  /** Consulta livre por numero do chamado - ignora ano/mes, sem limite de data. */
  chamado?: string;
  /** Consulta livre por codigo do tecnico (AA1_CODTEC) - ignora ano/mes. */
  tecnico?: string;
  /** Consulta livre por codigo do cliente (SA1_COD) - ignora ano/mes. */
  cliente?: string;
}

export interface AgendamentoPagina {
  total: number;
  totalPaginas: number;
  startindex: number;
  pagina: number;
  tamanho: number;
  items: Agendamento[];
}
