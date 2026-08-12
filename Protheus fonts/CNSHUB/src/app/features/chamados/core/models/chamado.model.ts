// Campos da ZA1 expostos pelo POUICNSA001.prw (WSRESTFUL CNSACHAMADOS)
export interface Chamado {
  idCh: string;
  assunto: string;
  /** '1' Aberto, '2' Pendente Apia, '3' Pendente Cliente, '4' Fechado - mesma legenda do CNSA001. */
  status: string;
  tecnico: string;
  /** Código do consultor (AA1_CODTEC) por trás de `tecnico` - usado para detectar redesignação ao editar. */
  codConsultor: string;
  cliente: string;
  /** Código do cliente (SA1) por trás de `cliente` - necessário pra pré-carregar o form de Editar e liberar a lupa de Projeto (cascata Cliente -> Projeto). */
  codCliente: string;
  lojaCliente: string;
  /** Tipo (ZA1_TIPO), projeto (ZA1_PROJ) e tarefa (ZA1_TAREFA) - sem isso o form de Editar abre esses campos em branco e força reseleção completa via lupa toda vez. */
  tipo: string;
  projeto: string;
  nomeProjeto: string;
  tarefa: string;
  nomeTarefa: string;
  emailCliente: string;
  data: string; // yyyy-MM-dd
}

export interface FiltroChamado {
  pagina: number;
  tamanho: number;
  /** Se true, filtra so os chamados do tecnico da sessao logada. */
  meus?: boolean;
  /** Se true, filtra so chamados sem tecnico designado (ZA1_CONSUL vazio). */
  semResponsavel?: boolean;
  /** Filtra por status. Aceita valor único ('1') ou lista separada por vírgula ('1,2') - o servidor une (OR) todos os valores informados. */
  status?: string;
  /** Visualizar um chamado específico por Id. Tem prioridade absoluta no servidor - ignora meus/semResponsavel/status quando informado. */
  idCh?: string;
  /** Pesquisa livre por texto no assunto (LIKE). Tem prioridade sobre os demais filtros, exceto idCh. */
  texto?: string;
}

export interface ChamadoPagina {
  total: number;
  totalPaginas: number;
  pagina: number;
  tamanho: number;
  items: Chamado[];
}

// Resposta do POST /rest/CNSACHAMADOSASSUMIR (sucesso: 200)
export interface AssumirResposta {
  sucesso: boolean;
  idCh: string;
  status: string;
  tecnico: string;
}

// Resposta do POST /rest/CNSACHAMADOSEXCLUIR (sucesso: 200)
export interface ExcluirResposta {
  sucesso: boolean;
  idCh: string;
  mensagem: string;
}

export interface AlterarResposta {
  sucesso: boolean;
  idCh: string;
  mensagem: string;
}

// Payload do POST /rest/CNSACHAMADOSINCLUIR - campos confirmados na tela real
// "Registro de Chamados - INCLUIR" do CNSA001. Obrigatorios lá: Assunto, Dt
// Abertura, Status (fixo "Aberto" aqui, nem exposto), Tipo, Projeto, Tarefa.
// Cliente/Loja/Consultor/Email do Cliente são opcionais na tela.
export interface NovoChamado {
  assunto: string;
  tipo: string;
  projeto: string;
  tarefa: string;
  /** yyyy-MM-dd (<input type="date">). Se omitido, o ADVPL assume hoje. */
  dtAbertura?: string;
  codCliente?: string;
  /** Se omitido junto com codCliente, o ADVPL assume '01'. */
  lojaCliente?: string;
  emailCliente?: string;
  /** Se omitido, o ADVPL assume o técnico da sessão logada. */
  codConsultor?: string;
}

// Resposta do POST /rest/CNSACHAMADOSINCLUIR (sucesso: 200)
export interface IncluirResposta {
  sucesso: boolean;
  idCh: string;
  mensagem: string;
}

// Payload do POST /rest/CNSACHAMADOSALTERAR - alteracao parcial: so envia o
// que for informado. codCliente/lojaCliente ficam opcionais porque, mesmo
// pre-carregados a partir do GET de listagem, o campo continua opcional na
// tela (usuario pode limpar via lupa - ver limparCliente/limparConsultor).
//
// Mesmo conjunto de campos do NovoChamado (pedido: "Editar deve ficar
// exatamente igual ao Incluir, mesma assinatura de métodos e estrutura") -
// o formulário de Editar é o MESMO componente do Incluir, só troca qual
// método do ChamadoService é chamado no confirmar.
export interface AlterarChamado {
  idCh: string;
  assunto?: string;
  dtAbertura?: string;
  tipo?: string;
  codCliente?: string;
  lojaCliente?: string;
  emailCliente?: string;
  codConsultor?: string;
  projeto?: string;
  tarefa?: string;
  /**
   * Alteração é PARCIAL - codCliente/codConsultor vazios normalmente
   * significam "não mexer" (mantém o valor atual). Essas flags avisam o
   * servidor que o usuário limpou o campo de propósito (botão "✕" da lupa),
   * senão não haveria como distinguir "não mudei" de "limpei".
   */
  limparCliente?: boolean;
  limparConsultor?: boolean;
}

// Payload do POST /rest/CNSACHAMADOSAGENDAR - campos confirmados na tela real
// "Model Agendas - Nova Agenda" do CNSA001. Obrigatórios lá: Data, Técnico,
// Sequência (gerada automaticamente no ADVPL, não é enviada daqui), Início,
// Término, Cliente, Loja. dataFim é uma extensão nossa (não existe na tela
// original) para criar o mesmo agendamento em vários dias de uma vez, usando
// o po-datepicker-range - se igual a dataInicio, cria um dia só.
export interface NovoAgendamento {
  idCh: string;
  dataInicio: string; // yyyy-MM-dd
  dataFim: string; // yyyy-MM-dd (= dataInicio se for um dia só)
  codTecnico: string;
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  codCliente: string;
  lojaCliente?: string;
  descricao?: string;
  confirmacao?: string;
  turno?: string;
  agInterna?: string;
  agCobravel?: string;
  tipoAgenda?: string;
  projeto?: string;
  revisao?: string;
  tarefa?: string;
  tipoHora?: string;
  codAgendador?: string;
}

/** Um dia do intervalo que não pôde ser criado - chave duplicada esgotou retry, ou sobreposição de horário (ver `conflitos`). */
export interface AgendarFalha {
  data: string; // yyyy-MM-dd
  erro: string;
  /** Só presente quando `erro` é de sobreposição - horários já ocupados que geraram o conflito. */
  conflitos?: Array<{ horaInicio: string; horaFim: string }>;
}

// Resposta do POST /rest/CNSACHAMADOSAGENDAR. Sucesso parcial é possível:
// `sucesso`/200 se pelo menos 1 dia foi criado, mesmo com `falhas` não vazio;
// `sucesso:false`/500 só se nenhum dia foi criado.
export interface AgendarResposta {
  sucesso: boolean;
  idCh: string;
  quantidade: number;
  falhas?: AgendarFalha[];
  mensagem: string;
}

// Item devolvido pelo GET /rest/CNSACHAMADOSVERAGENDA (botão "Ver Agenda") -
// um por dia agendado (SZ6) vinculado ao chamado.
export interface VerAgendaItem {
  data: string; // yyyy-MM-dd
  horaInicio: string; // HH:mm
  horaFim: string; // HH:mm
  tecnico: string;
  cliente: string;
  descricao: string;
}

export interface VerAgendaResposta {
  idCh: string;
  items: VerAgendaItem[];
}

// Item devolvido pelo GET /rest/CNSACHAMADOSANOTACOES - histórico completo
// (ZA2), mais antiga primeiro. Substitui o campo único ZA1_ANOT (sobrescrito
// a cada save) - cada save agora vira uma linha nova, nenhuma se perde.
export interface AnotacaoItem {
  seq: string;
  consultor: string;
  data: string; // yyyy-MM-dd
  hora: string; // HH:mm
  texto: string;
}

export interface AnotacoesListaResposta {
  idCh: string;
  items: AnotacaoItem[];
}

// Resposta do POST /rest/CNSACHAMADOSANOTACOESINCLUIR
export interface AnotacaoIncluirResposta {
  sucesso: boolean;
  idCh: string;
  seq: string;
  mensagem: string;
}
