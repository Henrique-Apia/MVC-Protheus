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

// tecnico/cliente/projeto/tarefa sao usados por Chamados e OS. modulo (SX5
// X5_TABELA='Z2'), motivo (SX5 X5_TABELA='Z1') e servico (SB1) sao consultas
// simples, sem cascata - exclusivos de OS. proposta (SZ3) exige o parametro
// cliente (cascata Cliente -> Proposta, mesma logica de Cliente -> Projeto) -
// tambem exclusivo de OS.
export type TipoLupa = 'tecnico' | 'cliente' | 'projeto' | 'tarefa' | 'modulo' | 'motivo' | 'servico' | 'proposta';
