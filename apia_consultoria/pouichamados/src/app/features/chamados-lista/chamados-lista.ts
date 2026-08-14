import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  PoButtonModule,
  PoFieldModule,
  PoModalComponent,
  PoModalModule,
  PoNotificationService
} from '@po-ui/ng-components';
import {
  PoPageDynamicTableActions,
  PoPageDynamicTableComponent,
  PoPageDynamicTableCustomAction,
  PoPageDynamicTableFilters,
  PoPageDynamicTableModule
} from '@po-ui/ng-templates';
import {
  AgendarFalha,
  AgendarResposta,
  AlterarResposta,
  AnotacaoItem,
  Chamado,
  IncluirResposta,
  VerAgendaItem
} from '../../core/models/chamado.model';
import { ChamadoService, PROTHEUS_REST_BASE } from '../../core/services/chamado.service';
import { ComponenteItem, TipoLupa } from '../../core/models/componente.model';
import { AnotacaoEditorComponent } from '../../shared/anotacao-editor';
import { LupaModalComponent } from '../../shared/lupa-modal';

// Mesma legenda de status do CNSA001 (AddLegend), usada no modal de detalhe
// e no combo (desabilitado) da tela de Incluir/Editar.
const STATUS_LABEL: Record<string, string> = {
  '1': 'Aberto',
  '2': 'Pendente Apia',
  '3': 'Pendente Cliente',
  '4': 'Fechado'
};

// Opções do combo "Tipo" - valores confirmados por Henrique (print da tela).
const TIPO_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'I', label: 'I - INSTALACAO' },
  { value: 'M', label: 'M - MANUTENCAO' },
  { value: 'S', label: 'S - SUPORTE' },
  { value: 'T', label: 'T - TREINAMENTO' },
  { value: 'A', label: 'A - ATUALIZACAO' },
  { value: 'D', label: 'D - DUVIDA' }
];

type ModoFormulario = 'incluir' | 'editar';

@Component({
  selector: 'app-chamados-lista',
  imports: [
    NgTemplateOutlet,
    PoPageDynamicTableModule,
    PoModalModule,
    PoButtonModule,
    PoFieldModule,
    FormsModule,
    LupaModalComponent,
    AnotacaoEditorComponent
  ],
  templateUrl: './chamados-lista.html',
  styleUrl: './chamados-lista.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChamadosListaComponent {
  private readonly poNotificationService = inject(PoNotificationService);
  private readonly chamadoService = inject(ChamadoService);

  protected readonly tipoOptions = TIPO_OPTIONS;

  @ViewChild('modalDetalhe', { static: true }) protected modalDetalhe!: PoModalComponent;
  @ViewChild('modalExcluir', { static: true }) protected modalExcluir!: PoModalComponent;
  @ViewChild('modalAssumir', { static: true }) protected modalAssumir!: PoModalComponent;
  @ViewChild('modalAgendar', { static: true }) protected modalAgendar!: PoModalComponent;
  @ViewChild('modalFormulario', { static: true }) protected modalFormulario!: PoModalComponent;
  @ViewChild('modalVerAgenda', { static: true }) protected modalVerAgenda!: PoModalComponent;
  @ViewChild('modalAnotacoes', { static: true }) protected modalAnotacoes!: PoModalComponent;
  @ViewChild('lupaModal', { static: true }) protected lupaModal!: LupaModalComponent;
  @ViewChild('tabelaChamados', { static: true }) protected tabelaChamados!: PoPageDynamicTableComponent;

  protected readonly chamadoDetalhe = signal<Chamado | null>(null);

  // Estado do modal de exclusão - agora pede o Id Chamado tambem (nao vem
  // mais de uma linha clicada, ja que Excluir virou botao de pagina, sempre
  // visivel, por pedido explicito - "nao quero que so apareca quando tiver
  // chamado, sempre tem que aparecer").
  protected idChExcluir = '';
  protected motivoExclusao = '';
  protected readonly carregandoExclusao = signal(false);

  // Estado do modal de assumir - mesmo motivo do excluir: agora e botao de
  // pagina, sempre visivel, entao precisa perguntar o Id Chamado.
  protected idChAssumir = '';
  protected readonly carregandoAssumir = signal(false);

  // --- Formulário de Incluir/Editar (UNIFICADO) ---------------------------
  // Pedido: "A função Editar deve ficar exatamente igual ao Incluir (Novo),
  // utilizando a mesma assinatura de métodos e estrutura." - por isso um
  // ÚNICO conjunto de campos/modal serve pros dois modos; só muda o método
  // do ChamadoService chamado em confirmarFormulario() (incluir vs alterar).
  //
  // Campos e obrigatoriedade (*) confirmados na tela real "Registro de
  // Chamados - INCLUIR" do CNSA001 (print de Henrique): Assunto, Dt Abertura,
  // Status (fixo, não editável aqui), Tipo, Projeto e Tarefa são obrigatórios;
  // Cliente/Loja/Consultor/Email do Cliente são opcionais.
  protected readonly modoFormulario = signal<ModoFormulario>('incluir');
  protected idChFormulario = '';
  protected assuntoFormulario = '';
  protected dtAberturaFormulario = '';
  protected statusFormulario = '1';
  protected tipoFormulario = '';
  protected codClienteFormulario = '';
  protected lojaClienteFormulario = '';
  protected nomeClienteFormulario = '';
  protected codConsultorFormulario = '';
  protected nomeTecnicoFormulario = '';
  // Alteração é PARCIAL (só troca o que vier preenchido) - por isso limpar um
  // campo com o "✕" não basta zerar a variável: o service só manda o
  // parâmetro se ele for truthy, então "" nunca chega no servidor e o valor
  // antigo sobrevive. Essas flags avisam confirmarFormulario() que o usuário
  // quer limpar de verdade (ver limparCliente/limparConsultor).
  private limparClienteFormulario = false;
  private limparConsultorFormulario = false;
  protected emailClienteFormulario = '';
  protected projetoFormulario = '';
  protected nomeProjetoFormulario = '';
  protected tarefaFormulario = '';
  protected nomeTarefaFormulario = '';
  protected readonly carregandoFormulario = signal(false);

  // Guarda qual campo dispara a lupa compartilhada (LupaModalComponent é uma
  // instância única reaproveitada por TODOS os campos de consulta - tanto do
  // form Incluir/Editar quanto do form Agendar). origemFormulario distingue
  // qual dos dois formulários abriu a lupa, já que ambos têm campos
  // Cliente/Técnico/Projeto/Tarefa (nomes de variável diferentes).
  private origemLupa: TipoLupa | null = null;
  private origemFormulario: 'incluir' | 'agendar' = 'incluir';

  // --- Ver Agenda -----------------------------------------------------------
  protected idChVerAgenda = '';
  protected readonly agendaItens = signal<VerAgendaItem[]>([]);
  protected readonly carregandoVerAgenda = signal(false);

  // --- Anotações (histórico ZA2 - várias por chamado, nunca sobrescreve) -----
  protected idChAnotacao = '';
  protected readonly historicoAnotacoes = signal<AnotacaoItem[]>([]);
  protected novaAnotacao = '';
  protected readonly carregandoAnotacao = signal(false);
  protected readonly salvandoAnotacao = signal(false);

  // Estado do modal de agendamento - botão de página (selectable: true),
  // mesmo padrão do Excluir/Assumir: seleciona a linha, clica no botão,
  // preenche o resto. Campos confirmados pela tela real "Model Agendas -
  // Nova Agenda" do CNSA001 (print enviado por Henrique). Sequência é
  // gerada automaticamente no ADVPL (não é campo aqui). Agendador, se
  // deixado em branco, o ADVPL assume o técnico da sessão logada - por
  // isso não é exposto no formulário. "Anexo" e o segundo campo "Data" da
  // tela não foram implementados (fora de escopo, já sinalizado no .prw).
  //
  // dataFimAgendar é extensão nossa (não existe na tela original): se
  // deixado em branco, assume o mesmo valor de dataInicioAgendar (um dia
  // só); se preenchido com uma data posterior, cria um agendamento por dia
  // no intervalo (limite de 60 dias, validado no servidor).
  //
  // idsChAgendar é array (extensão nossa) - permite agendar vários chamados
  // de uma vez, aplicando o MESMO técnico/data/horário/cliente/etc a cada um
  // (um POST por chamado, em paralelo, ver confirmarAgendar).
  protected idsChAgendar: string[] = [];
  protected dataInicioAgendar = '';
  protected dataFimAgendar = '';
  protected codTecnicoAgendar = '';
  protected horaInicioAgendar = '';
  protected horaFimAgendar = '';
  protected codClienteAgendar = '';
  protected lojaClienteAgendar = '01';
  protected nomeClienteAgendar = '';
  protected descricaoAgendar = '';
  protected confirmacaoAgendar = '';
  protected turnoAgendar = '';
  protected agInternaAgendar = '';
  protected agCobravelAgendar = '';
  protected tipoAgendaAgendar = '';
  protected projetoAgendar = '';
  protected nomeProjetoAgendar = '';
  protected revisaoAgendar = '';
  protected tarefaAgendar = '';
  protected nomeTarefaAgendar = '';
  protected tipoHoraAgendar = '';
  protected readonly carregandoAgendar = signal(false);

  /**
   * Endpoint usado pelo po-page-dynamic-table (busca, busca avançada e
   * paginação via "Carregar mais resultados"). O ChamadosRestAdapterInterceptor
   * (core/interceptors) traduz page/pageSize/hasNext pro contrato do ADVPL.
   */
  protected readonly servicoApi = `${PROTHEUS_REST_BASE}/rest/CNSACHAMADOS`;

  /**
   * Campos usados tanto pra montar as colunas da tabela quanto pra busca
   * avançada (padrão po-page-dynamic-table). "status" usa type:'label'
   * (tag colorida por linha) — não existe suporte a type:'subtitle' com o
   * botão automático de legenda dentro deste template, então essa
   * funcionalidade foi conscientemente removida ao adotar o padrão TOTVS.
   * "meus" e "semResponsavel" ficam com visible:false pra não virar coluna,
   * aparecendo só como filtro (switch) na busca avançada.
   */
  protected readonly campos: Array<PoPageDynamicTableFilters> = [
    { property: 'idCh', label: 'Id Chamado', key: true, filter: true, gridColumns: 3 },
    {
      property: 'status',
      label: 'Status',
      type: 'label',
      filter: true,
      optionsMulti: true,
      options: [
        { label: 'Aberto', value: '1' },
        { label: 'Pendente Apia', value: '2' },
        { label: 'Pendente Cliente', value: '3' },
        { label: 'Fechado', value: '4' }
      ],
      labels: [
        { value: '1', label: 'Aberto', color: 'color-10' },
        { value: '2', label: 'Pendente Apia', color: 'color-09' },
        { value: '3', label: 'Pendente Cliente', color: 'color-08' },
        { value: '4', label: 'Fechado', color: 'color-07' }
      ]
    },
    { property: 'data', label: 'Dt Abertura', type: 'date', format: 'dd/MM/yyyy', filter: true, gridColumns: 3 },
    { property: 'assunto', label: 'Assunto', filter: true, gridColumns: 6 },
    { property: 'cliente', label: 'Cliente', filter: true, gridColumns: 6 },
    {
      property: 'tecnico',
      label: 'Técnico',
      filter: true,
      gridColumns: 6,
      visible: false,
      allowColumnsManager: true
    },
    {
      property: 'meus',
      label: 'Somente meus chamados',
      type: 'boolean',
      filter: true,
      visible: false,
      booleanTrue: 'Sim',
      booleanFalse: 'Não'
    },
    {
      property: 'semResponsavel',
      label: 'Sem responsável',
      type: 'boolean',
      filter: true,
      visible: false,
      booleanTrue: 'Sim',
      booleanFalse: 'Não'
    },
  ];

  // "Visualizar" segue como ação nativa de detalhe (ícone de olho na linha).
  // "Editar" (lápis) agora abre o MESMO formulário do Incluir, em modo edição.
  protected readonly acoes: PoPageDynamicTableActions = {
    detail: (_id: string, resource: Chamado) => this.abrirDetalhe(resource),
    edit: (_id: string, resource: Chamado) => {
      this.abrirEditar(resource);
      return {};
    }
  };

  // Ações de página (botões no topo, sempre visíveis, independente de a
  // tabela ter dado ou não). Excluir/Assumir/Agendar/Ver Agenda/Anotações
  // usam `selectable: true` - o po-page-dynamic-table mostra os checkboxes
  // de linha automaticamente e passa os itens marcados pra função
  // (getSelectedItemsKeys por baixo dos panos). "Novo" não é selecionável -
  // sempre visível, abre o formulário em branco.
  // "Sair" saiu daqui - agora é o item de menu persistente em app.ts
  // (evita ter dois jeitos de fechar o app com rótulos diferentes).
  protected readonly acoesPagina = computed<Array<PoPageDynamicTableCustomAction>>(() => [
    { label: 'Novo', icon: 'an an-plus-circle', action: this.abrirIncluir.bind(this) },
    { label: 'Excluir', icon: 'an an-trash', selectable: true, action: this.excluirSelecionado.bind(this) },
    { label: 'Assumir', icon: 'an an-user-circle-plus', selectable: true, action: this.assumirSelecionado.bind(this) },
    { label: 'Agendar', icon: 'an an-calendar-plus', selectable: true, action: this.agendarSelecionado.bind(this) },
    { label: 'Ver Agenda', icon: 'an an-calendar-check', selectable: true, action: this.verAgendaSelecionado.bind(this) },
    { label: 'Anotações', icon: 'an an-note-pencil', selectable: true, action: this.anotacoesSelecionado.bind(this) },
    { label: 'Imprimir Browse', icon: 'an an-printer', action: this.imprimirBrowse.bind(this) }
  ]);

  protected statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  private abrirDetalhe(resource: Chamado): void {
    this.chamadoDetalhe.set(resource);
    this.idChAnotacao = resource.idCh;
    this.modalDetalhe.open();
    this.carregarHistoricoAnotacoes();
  }

  // --- Incluir / Editar (formulário unificado) ----------------------------

  /** Botão de página "Novo" - abre o formulário em branco, modo Incluir. */
  protected abrirIncluir(): void {
    this.modoFormulario.set('incluir');
    this.idChFormulario = '';
    this.assuntoFormulario = '';
    this.dtAberturaFormulario = new Date().toISOString().slice(0, 10);
    this.statusFormulario = '1';
    this.tipoFormulario = '';
    this.codClienteFormulario = '';
    this.lojaClienteFormulario = '';
    this.nomeClienteFormulario = '';
    this.codConsultorFormulario = '';
    this.nomeTecnicoFormulario = '';
    this.emailClienteFormulario = '';
    this.projetoFormulario = '';
    this.nomeProjetoFormulario = '';
    this.tarefaFormulario = '';
    this.nomeTarefaFormulario = '';
    this.limparClienteFormulario = false;
    this.limparConsultorFormulario = false;
    // Incluir não tem chamado ainda - sem histórico de anotações pra mostrar.
    this.idChAnotacao = '';
    this.historicoAnotacoes.set([]);
    this.novaAnotacao = '';
    this.modalFormulario.open();
  }

  /**
   * Ação nativa "edit" (lápis) - abre o MESMO formulário, modo Editar.
   * O GET de listagem agora devolve os códigos (codCliente/tipo/projeto/
   * tarefa/emailCliente), então o form pré-carrega tudo - antes vinham só os
   * NOMES de cliente/técnico e o resto abria em branco, obrigando a
   * reselecionar Cliente -> Projeto -> Tarefa do zero em toda edição (a lupa
   * de Projeto exige Cliente selecionado, a de Tarefa exige Projeto - ver
   * abrirLupa()).
   */
  private abrirEditar(resource: Chamado): void {
    this.modoFormulario.set('editar');
    this.idChFormulario = resource.idCh;
    this.assuntoFormulario = resource.assunto;
    this.dtAberturaFormulario = resource.data;
    this.statusFormulario = resource.status;
    this.tipoFormulario = resource.tipo;
    this.codClienteFormulario = resource.codCliente;
    this.lojaClienteFormulario = resource.lojaCliente;
    this.nomeClienteFormulario = resource.cliente;
    this.codConsultorFormulario = resource.codConsultor;
    this.nomeTecnicoFormulario = resource.tecnico;
    this.emailClienteFormulario = resource.emailCliente;
    this.projetoFormulario = resource.projeto;
    this.nomeProjetoFormulario = resource.nomeProjeto;
    this.tarefaFormulario = resource.tarefa;
    this.nomeTarefaFormulario = resource.nomeTarefa;
    this.limparClienteFormulario = false;
    this.limparConsultorFormulario = false;
    this.idChAnotacao = resource.idCh;
    this.novaAnotacao = '';
    this.modalFormulario.open();
    this.carregarHistoricoAnotacoes();
  }

  /**
   * Abre a lupa compartilhada pro campo indicado (form Incluir/Editar).
   * "tarefa" exige projeto já selecionado, "projeto" exige cliente já
   * selecionado (cascata dupla Cliente -> Projeto -> Tarefa, confirmado por
   * Henrique - projeto só mostra os ativos do cliente escolhido).
   */
  protected abrirLupa(tipo: TipoLupa): void {
    if (tipo === 'tarefa' && !this.projetoFormulario.trim()) {
      this.poNotificationService.warning('Selecione um projeto antes de escolher a tarefa.');
      return;
    }
    if (tipo === 'projeto' && !this.codClienteFormulario.trim()) {
      this.poNotificationService.warning('Selecione um cliente antes de escolher o projeto.');
      return;
    }
    this.origemFormulario = 'incluir';
    this.origemLupa = tipo;
    this.lupaModal.abrir(
      tipo,
      tipo === 'tarefa' ? this.projetoFormulario.trim() : '',
      tipo === 'projeto' ? this.codClienteFormulario.trim() : '',
      tipo === 'projeto' ? this.lojaClienteFormulario.trim() : ''
    );
  }

  /**
   * Mesma lupa compartilhada, agora pro form Agendar (cascata dupla usando
   * codClienteAgendar/projetoAgendar em vez dos campos do form Incluir).
   */
  protected abrirLupaAgendar(tipo: TipoLupa): void {
    if (tipo === 'tarefa' && !this.projetoAgendar.trim()) {
      this.poNotificationService.warning('Selecione um projeto antes de escolher a tarefa.');
      return;
    }
    if (tipo === 'projeto' && !this.codClienteAgendar.trim()) {
      this.poNotificationService.warning('Selecione um cliente antes de escolher o projeto.');
      return;
    }
    this.origemFormulario = 'agendar';
    this.origemLupa = tipo;
    this.lupaModal.abrir(
      tipo,
      tipo === 'tarefa' ? this.projetoAgendar.trim() : '',
      tipo === 'projeto' ? this.codClienteAgendar.trim() : '',
      tipo === 'projeto' ? this.lojaClienteAgendar.trim() : ''
    );
  }

  /** Callback único da lupa compartilhada - despacha pro form e campo de origem. */
  protected aoSelecionarLupa(item: ComponenteItem): void {
    if (this.origemFormulario === 'agendar') {
      switch (this.origemLupa) {
        case 'cliente':
          this.codClienteAgendar = item.codigo;
          this.lojaClienteAgendar = item.complemento || '01';
          this.nomeClienteAgendar = item.descricao;
          break;
        case 'tecnico':
          this.codTecnicoAgendar = item.codigo;
          break;
        case 'projeto':
          if (this.projetoAgendar !== item.codigo) {
            // Projeto mudou - a tarefa antiga não necessariamente pertence ao
            // novo projeto (cascata), então limpa a seleção anterior.
            this.tarefaAgendar = '';
            this.nomeTarefaAgendar = '';
          }
          this.projetoAgendar = item.codigo;
          this.nomeProjetoAgendar = item.descricao;
          this.revisaoAgendar = item.complemento || '';
          break;
        case 'tarefa':
          this.tarefaAgendar = item.codigo;
          this.nomeTarefaAgendar = item.descricao;
          break;
      }
      return;
    }

    switch (this.origemLupa) {
      case 'cliente':
        this.codClienteFormulario = item.codigo;
        this.lojaClienteFormulario = item.complemento || '01';
        this.nomeClienteFormulario = item.descricao;
        this.limparClienteFormulario = false;
        break;
      case 'tecnico':
        this.codConsultorFormulario = item.codigo;
        this.nomeTecnicoFormulario = item.descricao;
        this.limparConsultorFormulario = false;
        break;
      case 'projeto':
        if (this.projetoFormulario !== item.codigo) {
          // Projeto mudou - a tarefa antiga não necessariamente pertence ao
          // novo projeto (cascata), então limpa a seleção anterior.
          this.tarefaFormulario = '';
          this.nomeTarefaFormulario = '';
        }
        this.projetoFormulario = item.codigo;
        this.nomeProjetoFormulario = item.descricao;
        break;
      case 'tarefa':
        this.tarefaFormulario = item.codigo;
        this.nomeTarefaFormulario = item.descricao;
        break;
    }
  }

  /** Limpa o campo Cliente do form Incluir/Editar. */
  protected limparCliente(): void {
    this.codClienteFormulario = '';
    this.lojaClienteFormulario = '';
    this.nomeClienteFormulario = '';
    this.limparClienteFormulario = true;
  }

  /** Limpa o campo Consultor do form Incluir/Editar. */
  protected limparConsultor(): void {
    this.codConsultorFormulario = '';
    this.nomeTecnicoFormulario = '';
    this.limparConsultorFormulario = true;
  }

  /** Limpa o campo Projeto do form Incluir/Editar - cascata limpa a Tarefa junto (mesma regra da troca via lupa). */
  protected limparProjeto(): void {
    this.projetoFormulario = '';
    this.nomeProjetoFormulario = '';
    this.tarefaFormulario = '';
    this.nomeTarefaFormulario = '';
  }

  /** Limpa o campo Tarefa do form Incluir/Editar. */
  protected limparTarefa(): void {
    this.tarefaFormulario = '';
    this.nomeTarefaFormulario = '';
  }

  /** Limpa o campo Técnico do form Agendar. */
  protected limparTecnicoAgendar(): void {
    this.codTecnicoAgendar = '';
  }

  /** Limpa o campo Cliente do form Agendar. */
  protected limparClienteAgendar(): void {
    this.codClienteAgendar = '';
    this.nomeClienteAgendar = '';
  }

  /** Limpa o campo Projeto do form Agendar - cascata limpa a Tarefa junto (mesma regra da troca via lupa). */
  protected limparProjetoAgendar(): void {
    this.projetoAgendar = '';
    this.nomeProjetoAgendar = '';
    this.revisaoAgendar = '';
    this.tarefaAgendar = '';
    this.nomeTarefaAgendar = '';
  }

  /** Limpa o campo Tarefa do form Agendar. */
  protected limparTarefaAgendar(): void {
    this.tarefaAgendar = '';
    this.nomeTarefaAgendar = '';
  }

  /**
   * Confirma o formulário - chama incluir() ou alterar() dependendo do modo.
   * Validação client-side espelha os obrigatórios (*) da tela real: Assunto,
   * Dt Abertura, Tipo, Projeto e Tarefa.
   */
  protected confirmarFormulario(): void {
    const assunto = this.assuntoFormulario.trim();
    const dtAbertura = this.dtAberturaFormulario.trim();
    const tipo = this.tipoFormulario.trim();
    const projeto = this.projetoFormulario.trim();
    const tarefa = this.tarefaFormulario.trim();
    const emailCliente = this.emailClienteFormulario.trim();

    if (!assunto) {
      this.poNotificationService.warning('Informe o assunto do chamado.');
      return;
    }
    if (!dtAbertura) {
      this.poNotificationService.warning('Informe a data de abertura.');
      return;
    }
    if (!tipo) {
      this.poNotificationService.warning('Informe o tipo do chamado.');
      return;
    }
    if (!projeto) {
      this.poNotificationService.warning('Informe o projeto.');
      return;
    }
    if (!tarefa) {
      this.poNotificationService.warning('Informe a tarefa.');
      return;
    }
    // Validação de formato somada à do <po-email> nativo (máscara/erro
    // inline) - dupla checagem antes de disparar a requisição.
    if (emailCliente && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCliente)) {
      this.poNotificationService.warning('Informe um e-mail válido para o cliente.');
      return;
    }

    this.carregandoFormulario.set(true);

    const camposComuns = {
      assunto,
      dtAbertura,
      tipo,
      projeto,
      tarefa,
      codCliente: this.codClienteFormulario.trim() || undefined,
      lojaCliente: this.lojaClienteFormulario.trim() || undefined,
      emailCliente: emailCliente || undefined,
      codConsultor: this.codConsultorFormulario.trim() || undefined
    };

    if (this.modoFormulario() === 'incluir') {
      this.chamadoService.incluir(camposComuns).subscribe({
        next: (resposta: IncluirResposta) => {
          this.poNotificationService.success(`Chamado #${resposta.idCh} incluído com sucesso.`);
          this.carregandoFormulario.set(false);
          this.modalFormulario.close();
          this.tabelaChamados.updateDataTable();
        },
        error: (err: HttpErrorResponse) => {
          const mensagem = err.error?.erro ?? 'Não foi possível incluir o chamado. Verifique a conexão com o servidor REST.';
          this.poNotificationService.error(mensagem);
          this.carregandoFormulario.set(false);
        }
      });
    } else {
      const idChAlterar = this.idChFormulario;
      this.chamadoService
        .alterar({
          idCh: idChAlterar,
          ...camposComuns,
          limparCliente: this.limparClienteFormulario,
          limparConsultor: this.limparConsultorFormulario
        })
        .subscribe({
          // Anotação agora é histórico (ZA2) independente do form - adiciona
          // pelo botão próprio dentro do modal (ver adicionarAnotacao()), não
          // faz mais parte do "Confirmar" do chamado.
          next: (resposta: AlterarResposta) => {
            this.poNotificationService.success(`Chamado #${resposta.idCh} alterado com sucesso.`);
            this.carregandoFormulario.set(false);
            this.modalFormulario.close();
            this.tabelaChamados.updateDataTable();
          },
          error: (err: HttpErrorResponse) => {
            const mensagem = err.error?.erro ?? 'Não foi possível alterar o chamado. Verifique a conexão com o servidor REST.';
            this.poNotificationService.error(mensagem);
            this.carregandoFormulario.set(false);
          }
        });
    }
  }

  /**
   * Chamada quando o botão "Excluir" (selectable) é clicado. Recebe as
   * chaves dos itens marcados na tabela (array de {idCh} - sempre array,
   * mesmo com 1 selecionado, porque o mecanismo nativo é multi-seleção).
   */
  private excluirSelecionado(selecionados: Array<{ idCh: string }> | undefined): void {
    if (!selecionados || selecionados.length === 0) {
      this.poNotificationService.warning('Selecione um chamado na tabela.');
      return;
    }
    if (selecionados.length > 1) {
      this.poNotificationService.warning('Selecione apenas um chamado por vez.');
      return;
    }

    this.idChExcluir = selecionados[0].idCh;
    this.motivoExclusao = '';
    this.modalExcluir.open();
  }

  /**
   * Confirma a exclusão de verdade. Cascata completa: remove o chamado,
   * remove agenda vinculada, envia e-mail de cancelamento se havia técnico
   * designado (tudo do lado do ADVPL).
   */
  protected confirmarExclusao(): void {
    const idCh = this.idChExcluir.trim();
    if (!idCh) {
      this.poNotificationService.warning('Informe o número do chamado.');
      return;
    }

    this.carregandoExclusao.set(true);

    this.chamadoService.excluir(idCh, this.motivoExclusao.trim()).subscribe({
      next: (resposta) => {
        this.poNotificationService.success(`Chamado #${resposta.idCh} excluído com sucesso.`);
        this.carregandoExclusao.set(false);
        this.modalExcluir.close();
        this.tabelaChamados.updateDataTable();
      },
      error: (err: HttpErrorResponse) => {
        const mensagem = err.error?.erro ?? 'Não foi possível excluir o chamado. Verifique a conexão com o servidor REST.';
        this.poNotificationService.error(mensagem);
        this.carregandoExclusao.set(false);
      }
    });
  }

  /**
   * Chamada quando o botão "Assumir" (selectable) é clicado. Mesma lógica
   * do Excluir - recebe as chaves dos itens marcados na tabela.
   */
  private assumirSelecionado(selecionados: Array<{ idCh: string }> | undefined): void {
    if (!selecionados || selecionados.length === 0) {
      this.poNotificationService.warning('Selecione um chamado na tabela.');
      return;
    }
    if (selecionados.length > 1) {
      this.poNotificationService.warning('Selecione apenas um chamado por vez.');
      return;
    }

    this.idChAssumir = selecionados[0].idCh;
    this.modalAssumir.open();
  }

  /**
   * Aciona o POST de "Assumir" de verdade (endpoint validado via curl).
   */
  protected confirmarAssumir(): void {
    const idCh = this.idChAssumir.trim();
    if (!idCh) {
      this.poNotificationService.warning('Informe o número do chamado.');
      return;
    }

    this.carregandoAssumir.set(true);

    this.chamadoService.assumir(idCh).subscribe({
      next: (resposta) => {
        this.poNotificationService.success(
          `Chamado #${resposta.idCh} assumido com sucesso por ${resposta.tecnico}.`
        );
        this.carregandoAssumir.set(false);
        this.modalAssumir.close();
        this.tabelaChamados.updateDataTable();
      },
      error: (err: HttpErrorResponse) => {
        const mensagem = err.error?.erro ?? 'Não foi possível assumir o chamado. Verifique a conexão com o servidor REST.';
        this.poNotificationService.error(mensagem);
        this.carregandoAssumir.set(false);
      }
    });
  }

  /**
   * Chamada quando o botão "Agendar" (selectable) é clicado. Diferente do
   * Excluir/Assumir (sempre 1 item, ação irreversível/específica por
   * chamado), Agendar aceita MÚLTIPLOS chamados selecionados - o mesmo
   * técnico/data/horário/cliente/etc do formulário é aplicado a cada um
   * (ver confirmarAgendar).
   */
  private agendarSelecionado(selecionados: Array<{ idCh: string }> | undefined): void {
    if (!selecionados || selecionados.length === 0) {
      this.poNotificationService.warning('Selecione ao menos um chamado na tabela.');
      return;
    }

    this.idsChAgendar = selecionados.map((item) => item.idCh);
    this.dataInicioAgendar = '';
    this.dataFimAgendar = '';
    this.codTecnicoAgendar = '';
    this.horaInicioAgendar = '';
    this.horaFimAgendar = '';
    this.codClienteAgendar = '';
    this.lojaClienteAgendar = '01';
    this.nomeClienteAgendar = '';
    this.descricaoAgendar = '';
    this.confirmacaoAgendar = '';
    this.turnoAgendar = '';
    this.agInternaAgendar = '';
    this.agCobravelAgendar = '';
    this.tipoAgendaAgendar = '';
    this.projetoAgendar = '';
    this.nomeProjetoAgendar = '';
    this.revisaoAgendar = '';
    this.tarefaAgendar = '';
    this.nomeTarefaAgendar = '';
    this.tipoHoraAgendar = '';
    this.modalAgendar.open();
  }

  /**
   * Confirma o agendamento de verdade. Campos obrigatórios seguem a mesma
   * validação do CNSA_AGENDAR (data, técnico, horário início/fim, cliente).
   * Se dataFimAgendar ficar em branco, assume o mesmo valor de
   * dataInicioAgendar (agendamento de um dia só).
   *
   * Multi-chamado (idsChAgendar pode ter mais de 1 item): dispara um POST
   * por chamado, EM PARALELO (forkJoin) - mesmos dados de técnico/data/
   * horário/cliente/etc pra todos. Se algum falhar, os outros continuam
   * (forkJoin espera todos terminarem); no final mostra quantos deram certo
   * e lista os que falharam.
   */
  protected confirmarAgendar(): void {
    const idsCh = this.idsChAgendar;
    const dataInicio = this.dataInicioAgendar.trim();
    const dataFim = this.dataFimAgendar.trim() || dataInicio;
    const codTecnico = this.codTecnicoAgendar.trim();
    const horaInicio = this.horaInicioAgendar.trim();
    const horaFim = this.horaFimAgendar.trim();
    const codCliente = this.codClienteAgendar.trim();

    if (!idsCh || idsCh.length === 0) {
      this.poNotificationService.warning('Chamado inválido.');
      return;
    }
    if (!dataInicio) {
      this.poNotificationService.warning('Informe a data do agendamento.');
      return;
    }
    if (!codTecnico) {
      this.poNotificationService.warning('Informe o técnico.');
      return;
    }
    if (!horaInicio || !horaFim) {
      this.poNotificationService.warning('Informe o horário de início e término.');
      return;
    }
    if (!codCliente) {
      this.poNotificationService.warning('Informe o cliente.');
      return;
    }

    this.carregandoAgendar.set(true);

    const camposComuns = {
      dataInicio,
      dataFim,
      codTecnico,
      horaInicio,
      horaFim,
      codCliente,
      lojaCliente: this.lojaClienteAgendar.trim(),
      descricao: this.descricaoAgendar.trim(),
      confirmacao: this.confirmacaoAgendar.trim(),
      turno: this.turnoAgendar.trim(),
      agInterna: this.agInternaAgendar.trim(),
      agCobravel: this.agCobravelAgendar.trim(),
      tipoAgenda: this.tipoAgendaAgendar.trim(),
      projeto: this.projetoAgendar.trim(),
      revisao: this.revisaoAgendar.trim(),
      tarefa: this.tarefaAgendar.trim(),
      tipoHora: this.tipoHoraAgendar.trim()
    };

    forkJoin(
      idsCh.map((idCh) =>
        this.chamadoService.agendar({ idCh, ...camposComuns }).pipe(
          map((resposta: AgendarResposta) => ({ idCh, sucesso: true as const, resposta })),
          catchError((err: HttpErrorResponse) => {
            // Corpo pode vir no formato antigo {erro} (validação, ex: "Informe
            // o técnico.") ou no novo formato parcial {mensagem, falhas} (todo
            // o intervalo falhou - chave duplicada ou sobreposição em todos os
            // dias) - cobre os dois.
            const corpo = err.error as { erro?: string; mensagem?: string; falhas?: AgendarFalha[] } | undefined;
            const mensagem = corpo?.erro ?? corpo?.mensagem ?? 'Falha na conexão com o servidor REST.';
            return of({ idCh, sucesso: false as const, mensagem, falhas: corpo?.falhas });
          })
        )
      )
    ).subscribe((resultados) => {
      this.carregandoAgendar.set(false);

      let totalCriados = 0;
      const detalhesFalha: string[] = [];

      for (const resultado of resultados) {
        if (resultado.sucesso) {
          totalCriados += resultado.resposta.quantidade;
          if (resultado.resposta.falhas?.length) {
            const dias = resultado.resposta.falhas.map((f) => this.formatarFalhaAgendamento(f)).join('; ');
            detalhesFalha.push(`#${resultado.idCh}: ${dias}`);
          }
        } else {
          const dias = resultado.falhas?.length
            ? ' - ' + resultado.falhas.map((f) => this.formatarFalhaAgendamento(f)).join('; ')
            : '';
          detalhesFalha.push(`#${resultado.idCh}: ${resultado.mensagem}${dias}`);
        }
      }

      if (detalhesFalha.length === 0) {
        this.poNotificationService.success(
          resultados.length === 1 && resultados[0].sucesso
            ? resultados[0].resposta.mensagem
            : `${totalCriados} agendamento(s) criado(s) com sucesso.`
        );
        this.modalAgendar.close();
        this.tabelaChamados.updateDataTable();
      } else if (totalCriados === 0) {
        this.poNotificationService.error(`Não foi possível criar nenhum agendamento. ${detalhesFalha.join(' | ')}`);
      } else {
        this.poNotificationService.warning(`${totalCriados} dia(s) de agendamento criado(s). ${detalhesFalha.join(' | ')}`);
        this.modalAgendar.close();
        this.tabelaChamados.updateDataTable();
      }
    });
  }

  /** Formata um dia que falhou no Agendar - mostra os horários já ocupados quando o motivo é sobreposição. */
  private formatarFalhaAgendamento(f: AgendarFalha): string {
    if (f.conflitos?.length) {
      const horarios = f.conflitos.map((c) => `${c.horaInicio}-${c.horaFim}`).join(', ');
      return `${f.data} (já tem agendamento ${horarios})`;
    }
    return `${f.data} (${f.erro})`;
  }

  /**
   * Chamada quando o botão "Ver Agenda" (selectable) é clicado - lista os
   * agendamentos (SZ6) já criados pro chamado selecionado.
   */
  private verAgendaSelecionado(selecionados: Array<{ idCh: string }> | undefined): void {
    if (!selecionados || selecionados.length === 0) {
      this.poNotificationService.warning('Selecione um chamado na tabela.');
      return;
    }
    if (selecionados.length > 1) {
      this.poNotificationService.warning('Selecione apenas um chamado por vez.');
      return;
    }

    this.idChVerAgenda = selecionados[0].idCh;
    this.agendaItens.set([]);
    this.modalVerAgenda.open();
    this.carregandoVerAgenda.set(true);

    this.chamadoService.verAgenda(this.idChVerAgenda).subscribe({
      next: (resposta) => {
        this.agendaItens.set(resposta.items ?? []);
        this.carregandoVerAgenda.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const mensagem = err.error?.erro ?? 'Não foi possível carregar a agenda do chamado.';
        this.poNotificationService.error(mensagem);
        this.carregandoVerAgenda.set(false);
      }
    });
  }

  /**
   * Copia o nº do chamado pra área de transferência - não existe link direto
   * pro cnsaagenda (os dois apps são servidos sem URL própria endereçável,
   * só via WebApp do Protheus), então o usuário cola manualmente na aba
   * "Consultas" de lá.
   */
  protected copiarIdChVerAgenda(): void {
    navigator.clipboard.writeText(this.idChVerAgenda).then(
      () => this.poNotificationService.success('Número do chamado copiado.'),
      () => this.poNotificationService.error('Não foi possível copiar. Copie manualmente: ' + this.idChVerAgenda)
    );
  }

  /**
   * Chamada quando o botão "Anotações" (selectable) é clicado - carrega o
   * histórico completo (ZA2) do chamado, mais antiga primeiro.
   */
  private anotacoesSelecionado(selecionados: Array<{ idCh: string }> | undefined): void {
    if (!selecionados || selecionados.length === 0) {
      this.poNotificationService.warning('Selecione um chamado na tabela.');
      return;
    }
    if (selecionados.length > 1) {
      this.poNotificationService.warning('Selecione apenas um chamado por vez.');
      return;
    }

    this.idChAnotacao = selecionados[0].idCh;
    this.novaAnotacao = '';
    this.modalAnotacoes.open();
    this.carregarHistoricoAnotacoes();
  }

  private carregarHistoricoAnotacoes(): void {
    this.carregandoAnotacao.set(true);

    this.chamadoService.listarAnotacoes(this.idChAnotacao).subscribe({
      next: (resposta) => {
        this.historicoAnotacoes.set(resposta.items ?? []);
        this.carregandoAnotacao.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const mensagem = err.error?.erro ?? 'Não foi possível carregar o histórico de anotações.';
        this.poNotificationService.error(mensagem);
        this.carregandoAnotacao.set(false);
      }
    });
  }

  /** Adiciona uma anotação nova ao histórico - nunca sobrescreve as anteriores (ver CNSACHAMADOSANOTACOESINCLUIR). */
  protected adicionarAnotacao(): void {
    const texto = this.novaAnotacao.trim();
    if (!texto) {
      this.poNotificationService.warning('Escreva o texto da anotação.');
      return;
    }

    this.salvandoAnotacao.set(true);

    this.chamadoService.incluirAnotacao(this.idChAnotacao, texto).subscribe({
      next: () => {
        this.poNotificationService.success('Anotação adicionada com sucesso.');
        this.novaAnotacao = '';
        this.salvandoAnotacao.set(false);
        this.carregarHistoricoAnotacoes();
      },
      error: (err: HttpErrorResponse) => {
        const mensagem = err.error?.erro ?? 'Não foi possível adicionar a anotação.';
        this.poNotificationService.error(mensagem);
        this.salvandoAnotacao.set(false);
      }
    });
  }

  // "Imprimir Browse" mantém o window.print() de antes.
  private imprimirBrowse(): void {
    window.print();
  }
}
