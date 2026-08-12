// Item devolvido pelas lupas do WSRESTFUL CNSACOMPONENTES (ComponentesRest.prw).
// Mesmo formato para todos os tipos - "complemento" carrega a loja (cliente),
// a revisão (projeto) ou fica vazio quando não se aplica.
export interface ComponenteItem {
  codigo: string;
  complemento: string;
  descricao: string;
}

export interface ComponenteResposta {
  items: ComponenteItem[];
}

// tecnico/cliente/projeto/tarefa já existiam (reaproveitados de pouichamados).
// modulo (SX5 X5_TABELA='Z2'), motivo (SX5 X5_TABELA='Z1') e servico (SB1) são
// consultas simples, sem cascata. proposta (SZ3) exige o parâmetro cliente
// (cascata Cliente -> Proposta, mesma lógica de Cliente -> Projeto).
export type TipoLupa = 'tecnico' | 'cliente' | 'projeto' | 'tarefa' | 'modulo' | 'motivo' | 'servico' | 'proposta';
