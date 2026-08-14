// Item devolvido pelas lupas do WSRESTFUL CNSACOMPONENTES (ComponentesRest.prw).
// Mesmo formato pros 4 tipos (tecnico/cliente/projeto/tarefa) - "complemento"
// carrega a loja (cliente) ou a revisão (projeto); fica vazio quando não se
// aplica (tecnico/tarefa).
export interface ComponenteItem {
  codigo: string;
  complemento: string;
  descricao: string;
}

export interface ComponenteResposta {
  items: ComponenteItem[];
}

// "tarefa" exige o parâmetro projeto (lupa em cascata - ver CNSA_TARLUPA no
// ComponentesRest.prw). Os outros três são independentes.
export type TipoLupa = 'tecnico' | 'cliente' | 'projeto' | 'tarefa';
