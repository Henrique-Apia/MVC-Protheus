import { ChangeDetectionStrategy, Component, ViewChild, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
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
import { AlterarOsResposta, IncluirOsResposta, NovaOs, Os } from '../../core/models/os.model';
import { OsService } from '../../core/services/os.service';
import { ComponenteItem, TipoLupa } from '../../../../shared/lupa/componente.model';
import { LupaModalComponent } from '../../../../shared/lupa/lupa-modal';

// Combo "Ano" da busca avançada - mesma janela padrão usada no servidor
// quando nenhum ano é escolhido (ano atual -2 até +1, confirmado por
// Henrique: com ano atual 2026, mostra 2024/2025/2026/2027). Mais recente
// primeiro.
const ANO_ATUAL = new Date().getFullYear();
const ANO_OPTIONS: Array<{ value: string; label: string }> = Array.from({ length: 4 }, (_, i) => {
  const ano = ANO_ATUAL + 1 - i;
  return { value: String(ano), label: String(ano) };
});

// Mesma legenda de status do CNSA002 (AddLegend), derivada no backend a
// partir de Z1_APROVAD/Z1_FATURAR.
const STATUS_LABEL: Record<string, string> = {
  aprovada_faturada: 'Aprovada e Faturada',
  faturada_sem_aprovacao: 'Faturada sem Aprovação',
  aprovada: 'Aprovada',
  aguardando_aprovacao: 'Aguardando Aprovação',
  negada: 'Negada'
};

type ModoFormulario = 'incluir' | 'editar';

@Component({
  selector: 'app-os-lista',
  imports: [PoPageDynamicTableModule, PoModalModule, PoButtonModule, PoFieldModule, FormsModule, LupaModalComponent],
  templateUrl: './os-lista.html',
  styleUrl: './os-lista.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OsListaComponent {
  private readonly poNotificationService = inject(PoNotificationService);
  private readonly osService = inject(OsService);

  @ViewChild('modalDetalhe', { static: true }) protected modalDetalhe!: PoModalComponent;
  @ViewChild('modalExcluir', { static: true }) protected modalExcluir!: PoModalComponent;
  @ViewChild('modalCopiar', { static: true }) protected modalCopiar!: PoModalComponent;
  @ViewChild('modalFormulario', { static: true }) protected modalFormulario!: PoModalComponent;
  @ViewChild('lupaModal', { static: true }) protected lupaModal!: LupaModalComponent;
  @ViewChild('tabelaOs', { static: true }) protected tabelaOs!: PoPageDynamicTableComponent;

  protected readonly osDetalhe = signal<Os | null>(null);

  // --- Excluir / Copiar (botão de página, selectable, sempre visível) -------
  protected osExcluir = '';
  protected readonly carregandoExclusao = signal(false);
  protected osCopiar = '';
  protected readonly carregandoCopia = signal(false);

  // --- Formulário de Incluir/Editar (UNIFICADO) -----------------------------
  // Mesmo padrão do pouichamados: um único conjunto de campos/modal serve
  // pros dois modos, só muda o método do OsService chamado em
  // confirmarFormulario() (incluir vs alterar). Campos e obrigatoriedade (*)
  // confirmados na tela real "Dados da OS" do CNSA002 (prints de Henrique).
  protected readonly modoFormulario = signal<ModoFormulario>('incluir');
  protected osFormulario = '';
  protected dtDigitacaoFormulario = '';
  protected codClienteFormulario = '';
  protected lojaClienteFormulario = '';
  protected nomeClienteFormulario = '';
  protected usuarioFormulario = '';
  protected moduloFormulario = '';
  protected nomeModuloFormulario = '';
  protected motivoFormulario = '';
  protected nomeMotivoFormulario = '';
  protected descricaoFormulario = '';
  protected codServicoFormulario = '';
  protected nomeServicoFormulario = '';
  protected dataOsFormulario = '';
  protected osInternaFormulario = 'N';
  protected horaInicialFormulario = '';
  protected horaInicialDecFormulario: number | null = null;
  protected horaFinalFormulario = '';
  protected horaFinalDecFormulario: number | null = null;
  protected horasTranDecFormulario: number | null = null;
  protected prevPmtFormulario = 'N';
  protected horasTiDecFormulario: number | null = null;
  protected codAnalistaFormulario = '';
  protected nomeAnalistaFormulario = '';
  protected numPropostaFormulario = '';
  protected nomePropostaFormulario = '';
  protected pedVendaFormulario = '';
  protected hrAlmocoFormulario: number | null = null;
  protected projetoFormulario = '';
  protected nomeProjetoFormulario = '';
  protected revisaoFormulario = '';
  protected tarefaFormulario = '';
  protected nomeTarefaFormulario = '';
  protected chamadoHpsdFormulario = '';
  protected chamadoFormulario = '';
  protected osDesenvFormulario = 'N';
  protected linhaPvFormulario = '';
  protected valorHoraFormulario: number | null = null;
  protected readonly carregandoFormulario = signal(false);

  // Guarda qual campo disparou a lupa compartilhada (LupaModalComponent é uma
  // instância única reaproveitada por TODOS os campos de consulta do form).
  private origemLupa: TipoLupa | null = null;

  /** Endpoint usado pelo po-page-dynamic-table - OsRestAdapterInterceptor traduz page/pageSize/hasNext. */
  protected readonly servicoApi = '/rest/CNSAOS';

  protected readonly campos: Array<PoPageDynamicTableFilters> = [
    { property: 'os', label: 'Número OS', key: true, filter: true, gridColumns: 2 },
    { property: 'dataOs', label: 'Data OS', type: 'date', format: 'dd/MM/yyyy', filter: true, gridColumns: 2 },
    { property: 'nomeCliente', label: 'Cliente', gridColumns: 4 },
    { property: 'descricao', label: 'Descrição', filter: true, gridColumns: 6 },
    { property: 'nomeAnalista', label: 'Analista', gridColumns: 4, visible: false, allowColumnsManager: true },
    {
      property: 'status',
      label: 'Status',
      type: 'label',
      filter: true,
      optionsMulti: true,
      options: [
        { label: 'Aprovada e Faturada', value: 'aprovada_faturada' },
        { label: 'Faturada sem Aprovação', value: 'faturada_sem_aprovacao' },
        { label: 'Aprovada', value: 'aprovada' },
        { label: 'Aguardando Aprovação', value: 'aguardando_aprovacao' },
        { label: 'Negada', value: 'negada' }
      ],
      labels: [
        { value: 'aprovada_faturada', label: 'Aprovada e Faturada', color: 'color-11' },
        { value: 'faturada_sem_aprovacao', label: 'Faturada sem Aprovação', color: 'color-05' },
        { value: 'aprovada', label: 'Aprovada', color: 'color-10' },
        { value: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: 'color-09' },
        { value: 'negada', label: 'Negada', color: 'color-07' }
      ]
    },
    // Filtro por código do cliente (SA1) - digite o código, não o nome (o
    // WSRESTFUL CNSAOS filtra por Z1_CLI exato). Mesma limitação conhecida
    // do campo "cliente" em pouichamados.
    { property: 'cliente', label: 'Código Cliente', filter: true, visible: false },
    // Idem, por código do analista (AA1/Z1_TEC).
    { property: 'analista', label: 'Código Analista', filter: true, visible: false },
    {
      property: 'ano',
      label: 'Ano',
      type: 'select',
      filter: true,
      options: ANO_OPTIONS,
      visible: false
    }
  ];

  protected readonly acoes: PoPageDynamicTableActions = {
    detail: (_id: string, resource: Os) => this.abrirDetalhe(resource),
    edit: (_id: string, resource: Os) => {
      this.abrirEditar(resource);
      return {};
    }
  };

  protected readonly acoesPagina = computed<Array<PoPageDynamicTableCustomAction>>(() => [
    { label: 'Novo', icon: 'an an-plus-circle', action: this.abrirIncluir.bind(this) },
    { label: 'Excluir', icon: 'an an-trash', selectable: true, action: this.excluirSelecionado.bind(this) },
    { label: 'Copiar', icon: 'an an-copy', selectable: true, action: this.copiarSelecionado.bind(this) }
  ]);

  protected statusLabel(status: string): string {
    return STATUS_LABEL[status] ?? status;
  }

  private abrirDetalhe(resource: Os): void {
    this.osDetalhe.set(resource);
    this.modalDetalhe.open();
  }

  // --- Incluir / Editar (formulário unificado) ------------------------------

  /** Botão de página "Novo" - abre o formulário em branco, modo Incluir. */
  protected abrirIncluir(): void {
    this.modoFormulario.set('incluir');
    this.osFormulario = '';
    this.dtDigitacaoFormulario = new Date().toISOString().slice(0, 10);
    this.codClienteFormulario = '';
    this.lojaClienteFormulario = '';
    this.nomeClienteFormulario = '';
    this.usuarioFormulario = '';
    this.moduloFormulario = '';
    this.nomeModuloFormulario = '';
    this.motivoFormulario = '';
    this.nomeMotivoFormulario = '';
    this.descricaoFormulario = '';
    this.codServicoFormulario = '';
    this.nomeServicoFormulario = '';
    this.dataOsFormulario = new Date().toISOString().slice(0, 10);
    this.osInternaFormulario = 'N';
    this.horaInicialFormulario = '';
    this.horaInicialDecFormulario = null;
    this.horaFinalFormulario = '';
    this.horaFinalDecFormulario = null;
    this.horasTranDecFormulario = null;
    this.prevPmtFormulario = 'N';
    this.horasTiDecFormulario = null;
    this.codAnalistaFormulario = '';
    this.nomeAnalistaFormulario = '';
    this.numPropostaFormulario = '';
    this.nomePropostaFormulario = '';
    this.pedVendaFormulario = '';
    this.hrAlmocoFormulario = null;
    this.projetoFormulario = '';
    this.nomeProjetoFormulario = '';
    this.revisaoFormulario = '';
    this.tarefaFormulario = '';
    this.nomeTarefaFormulario = '';
    this.chamadoHpsdFormulario = '';
    this.chamadoFormulario = '';
    this.osDesenvFormulario = 'N';
    this.linhaPvFormulario = '';
    this.valorHoraFormulario = null;
    this.modalFormulario.open();
  }

  /** Ação nativa "edit" (lápis) - abre o MESMO formulário, modo Editar, pré-carregado. */
  private abrirEditar(resource: Os): void {
    this.modoFormulario.set('editar');
    this.osFormulario = resource.os;
    this.dtDigitacaoFormulario = resource.dtDigitacao;
    this.codClienteFormulario = resource.codCliente;
    this.lojaClienteFormulario = resource.lojaCliente;
    this.nomeClienteFormulario = resource.nomeCliente;
    this.usuarioFormulario = resource.usuario;
    this.moduloFormulario = resource.modulo;
    this.nomeModuloFormulario = resource.nomeModulo;
    this.motivoFormulario = resource.motivo;
    this.nomeMotivoFormulario = resource.nomeMotivo;
    this.descricaoFormulario = resource.descricao;
    this.codServicoFormulario = resource.codServico;
    this.nomeServicoFormulario = resource.nomeServico;
    this.dataOsFormulario = resource.dataOs;
    this.osInternaFormulario = resource.osInterna || 'N';
    this.horaInicialFormulario = resource.horaInicial;
    this.horaInicialDecFormulario = resource.horaInicialDec;
    this.horaFinalFormulario = resource.horaFinal;
    this.horaFinalDecFormulario = resource.horaFinalDec;
    this.horasTranDecFormulario = resource.horasTranDec;
    this.prevPmtFormulario = resource.prevPmt || 'N';
    this.horasTiDecFormulario = resource.horasTiDec;
    this.codAnalistaFormulario = resource.codAnalista;
    this.nomeAnalistaFormulario = resource.nomeAnalista;
    this.numPropostaFormulario = resource.numProposta;
    this.nomePropostaFormulario = '';
    this.pedVendaFormulario = resource.pedVenda;
    this.hrAlmocoFormulario = resource.hrAlmoco;
    this.projetoFormulario = resource.projeto;
    this.nomeProjetoFormulario = resource.nomeProjeto;
    this.revisaoFormulario = resource.revisao;
    this.tarefaFormulario = resource.tarefa;
    this.nomeTarefaFormulario = resource.nomeTarefa;
    this.chamadoHpsdFormulario = resource.chamadoHpsd;
    this.chamadoFormulario = resource.chamado;
    this.osDesenvFormulario = resource.osDesenv || 'N';
    this.linhaPvFormulario = resource.linhaPv;
    this.valorHoraFormulario = resource.valorHora;
    this.modalFormulario.open();
  }

  /**
   * Abre a lupa compartilhada pro campo indicado. "tarefa" exige projeto já
   * selecionado; "projeto" e "proposta" exigem cliente já selecionado
   * (cascata Cliente -> Projeto/Proposta, Projeto -> Tarefa).
   */
  protected abrirLupa(tipo: TipoLupa): void {
    if (tipo === 'tarefa' && !this.projetoFormulario.trim()) {
      this.poNotificationService.warning('Selecione um projeto antes de escolher a tarefa.');
      return;
    }
    if ((tipo === 'projeto' || tipo === 'proposta') && !this.codClienteFormulario.trim()) {
      this.poNotificationService.warning('Selecione um cliente antes de escolher ' + (tipo === 'projeto' ? 'o projeto.' : 'a proposta.'));
      return;
    }
    this.origemLupa = tipo;
    this.lupaModal.abrir(
      tipo,
      tipo === 'tarefa' ? this.projetoFormulario.trim() : '',
      tipo === 'projeto' || tipo === 'proposta' ? this.codClienteFormulario.trim() : '',
      tipo === 'projeto' || tipo === 'proposta' ? this.lojaClienteFormulario.trim() : '',
      tipo === 'tecnico' ? 'Selecionar analista' : undefined
    );
  }

  /** Callback único da lupa compartilhada - despacha pro campo de origem. */
  protected aoSelecionarLupa(item: ComponenteItem): void {
    switch (this.origemLupa) {
      case 'cliente':
        this.codClienteFormulario = item.codigo;
        this.lojaClienteFormulario = item.complemento || '01';
        this.nomeClienteFormulario = item.descricao;
        // Cliente mudou - projeto/tarefa/proposta antigos não necessariamente
        // pertencem ao novo cliente (cascata), então limpa a seleção anterior.
        this.projetoFormulario = '';
        this.nomeProjetoFormulario = '';
        this.tarefaFormulario = '';
        this.nomeTarefaFormulario = '';
        this.numPropostaFormulario = '';
        this.nomePropostaFormulario = '';
        break;
      case 'tecnico':
        this.codAnalistaFormulario = item.codigo;
        this.nomeAnalistaFormulario = item.descricao;
        break;
      case 'modulo':
        this.moduloFormulario = item.codigo;
        this.nomeModuloFormulario = item.descricao;
        break;
      case 'motivo':
        this.motivoFormulario = item.codigo;
        this.nomeMotivoFormulario = item.descricao;
        break;
      case 'servico':
        this.codServicoFormulario = item.codigo;
        this.nomeServicoFormulario = item.descricao;
        break;
      case 'projeto':
        if (this.projetoFormulario !== item.codigo) {
          this.tarefaFormulario = '';
          this.nomeTarefaFormulario = '';
        }
        this.projetoFormulario = item.codigo;
        this.nomeProjetoFormulario = item.descricao;
        this.revisaoFormulario = item.complemento || this.revisaoFormulario;
        break;
      case 'tarefa':
        this.tarefaFormulario = item.codigo;
        this.nomeTarefaFormulario = item.descricao;
        break;
      case 'proposta':
        this.numPropostaFormulario = item.codigo;
        this.nomePropostaFormulario = item.descricao;
        break;
    }
  }

  protected limparCliente(): void {
    this.codClienteFormulario = '';
    this.lojaClienteFormulario = '';
    this.nomeClienteFormulario = '';
    this.projetoFormulario = '';
    this.nomeProjetoFormulario = '';
    this.tarefaFormulario = '';
    this.nomeTarefaFormulario = '';
    this.numPropostaFormulario = '';
    this.nomePropostaFormulario = '';
  }

  protected limparAnalista(): void {
    this.codAnalistaFormulario = '';
    this.nomeAnalistaFormulario = '';
  }

  protected limparModulo(): void {
    this.moduloFormulario = '';
    this.nomeModuloFormulario = '';
  }

  protected limparMotivo(): void {
    this.motivoFormulario = '';
    this.nomeMotivoFormulario = '';
  }

  protected limparServico(): void {
    this.codServicoFormulario = '';
    this.nomeServicoFormulario = '';
  }

  protected limparProjeto(): void {
    this.projetoFormulario = '';
    this.nomeProjetoFormulario = '';
    this.tarefaFormulario = '';
    this.nomeTarefaFormulario = '';
  }

  protected limparTarefa(): void {
    this.tarefaFormulario = '';
    this.nomeTarefaFormulario = '';
  }

  protected limparProposta(): void {
    this.numPropostaFormulario = '';
    this.nomePropostaFormulario = '';
  }

  /**
   * Confirma o formulário - chama incluir() ou alterar() dependendo do modo.
   * Validação client-side espelha os obrigatórios (*) da tela real: Cliente,
   * Site, Usuário, Módulo, Motivo, Descrição, Cod Serviço, Data OS, Hr Inic
   * dec, Hr Fim dec, Hrs TI Dec e Analista.
   */
  protected confirmarFormulario(): void {
    const codCliente = this.codClienteFormulario.trim();
    const lojaCliente = this.lojaClienteFormulario.trim();
    const usuario = this.usuarioFormulario.trim();
    const modulo = this.moduloFormulario.trim();
    const motivo = this.motivoFormulario.trim();
    const descricao = this.descricaoFormulario.trim();
    const codServico = this.codServicoFormulario.trim();
    const dataOs = this.dataOsFormulario.trim();
    const codAnalista = this.codAnalistaFormulario.trim();

    if (!codCliente || !lojaCliente) {
      this.poNotificationService.warning('Selecione o cliente.');
      return;
    }
    if (!usuario) {
      this.poNotificationService.warning('Informe o usuário.');
      return;
    }
    if (!modulo) {
      this.poNotificationService.warning('Selecione o módulo.');
      return;
    }
    if (!motivo) {
      this.poNotificationService.warning('Selecione o motivo.');
      return;
    }
    if (!descricao) {
      this.poNotificationService.warning('Informe a descrição.');
      return;
    }
    if (!codServico) {
      this.poNotificationService.warning('Selecione o serviço.');
      return;
    }
    if (!dataOs) {
      this.poNotificationService.warning('Informe a data da OS.');
      return;
    }
    if (this.horaInicialDecFormulario === null || this.horaFinalDecFormulario === null) {
      this.poNotificationService.warning('Informe a hora inicial e final (decimais).');
      return;
    }
    if (this.horasTiDecFormulario === null) {
      this.poNotificationService.warning('Informe as horas TI (decimais).');
      return;
    }
    if (!codAnalista) {
      this.poNotificationService.warning('Selecione o analista.');
      return;
    }

    this.carregandoFormulario.set(true);

    const camposComuns: NovaOs = {
      codCliente,
      lojaCliente,
      usuario,
      modulo,
      motivo,
      descricao,
      codServico,
      dataOs,
      horaInicialDec: this.horaInicialDecFormulario,
      horaFinalDec: this.horaFinalDecFormulario,
      horasTiDec: this.horasTiDecFormulario,
      codAnalista,
      dtDigitacao: this.dtDigitacaoFormulario.trim() || undefined,
      osInterna: this.osInternaFormulario,
      horasTranDec: this.horasTranDecFormulario ?? undefined,
      prevPmt: this.prevPmtFormulario,
      numProposta: this.numPropostaFormulario.trim() || undefined,
      pedVenda: this.pedVendaFormulario.trim() || undefined,
      hrAlmoco: this.hrAlmocoFormulario ?? undefined,
      projeto: this.projetoFormulario.trim() || undefined,
      revisao: this.revisaoFormulario.trim() || undefined,
      tarefa: this.tarefaFormulario.trim() || undefined,
      chamadoHpsd: this.chamadoHpsdFormulario.trim() || undefined,
      chamado: this.chamadoFormulario.trim() || undefined,
      osDesenv: this.osDesenvFormulario,
      linhaPv: this.linhaPvFormulario.trim() || undefined,
      valorHora: this.valorHoraFormulario ?? undefined
    };

    if (this.modoFormulario() === 'incluir') {
      this.osService.incluir(camposComuns).subscribe({
        next: (resposta: IncluirOsResposta) => {
          this.poNotificationService.success(`OS #${resposta.os} incluída com sucesso.`);
          this.carregandoFormulario.set(false);
          this.modalFormulario.close();
          this.tabelaOs.updateDataTable();
        this.forcarRepaint();
        },
        error: (err: HttpErrorResponse) => {
          const mensagem = err.error?.erro ?? 'Não foi possível incluir a OS. Verifique a conexão com o servidor REST.';
          this.poNotificationService.error(mensagem);
          this.carregandoFormulario.set(false);
        }
      });
    } else {
      this.osService.alterar({ os: this.osFormulario, ...camposComuns }).subscribe({
        next: (resposta: AlterarOsResposta) => {
          this.poNotificationService.success(`OS #${resposta.os} alterada com sucesso.`);
          this.carregandoFormulario.set(false);
          this.modalFormulario.close();
          this.tabelaOs.updateDataTable();
        this.forcarRepaint();
        },
        error: (err: HttpErrorResponse) => {
          const mensagem = err.error?.erro ?? 'Não foi possível alterar a OS. Verifique a conexão com o servidor REST.';
          this.poNotificationService.error(mensagem);
          this.carregandoFormulario.set(false);
        }
      });
    }
  }

  /** Botão de página "Excluir" (selectable) - recebe as chaves dos itens marcados. */
  private excluirSelecionado(selecionados: Array<{ os: string }> | undefined): void {
    if (!selecionados || selecionados.length === 0) {
      this.poNotificationService.warning('Selecione uma OS na tabela.');
      return;
    }
    if (selecionados.length > 1) {
      this.poNotificationService.warning('Selecione apenas uma OS por vez.');
      return;
    }

    this.osExcluir = selecionados[0].os;
    this.modalExcluir.open();
  }

  protected confirmarExclusao(): void {
    const os = this.osExcluir.trim();
    if (!os) {
      this.poNotificationService.warning('Informe o número da OS.');
      return;
    }

    this.carregandoExclusao.set(true);

    this.osService.excluir(os).subscribe({
      next: (resposta) => {
        this.poNotificationService.success(`OS #${resposta.os} excluída com sucesso.`);
        this.carregandoExclusao.set(false);
        this.modalExcluir.close();
        this.tabelaOs.updateDataTable();
        this.forcarRepaint();
      },
      error: (err: HttpErrorResponse) => {
        const mensagem = err.error?.erro ?? 'Não foi possível excluir a OS. Verifique a conexão com o servidor REST.';
        this.poNotificationService.error(mensagem);
        this.carregandoExclusao.set(false);
      }
    });
  }

  /** Botão de página "Copiar" (selectable) - duplica a OS (U_COPIAR_OS no ADVPL). */
  private copiarSelecionado(selecionados: Array<{ os: string }> | undefined): void {
    if (!selecionados || selecionados.length === 0) {
      this.poNotificationService.warning('Selecione uma OS na tabela.');
      return;
    }
    if (selecionados.length > 1) {
      this.poNotificationService.warning('Selecione apenas uma OS por vez.');
      return;
    }

    this.osCopiar = selecionados[0].os;
    this.modalCopiar.open();
  }

  protected confirmarCopia(): void {
    const os = this.osCopiar.trim();
    if (!os) {
      this.poNotificationService.warning('Informe o número da OS.');
      return;
    }

    this.carregandoCopia.set(true);

    this.osService.copiar(os).subscribe({
      next: (resposta) => {
        this.poNotificationService.success(`OS #${resposta.osOriginal} copiada com sucesso. Nova OS: #${resposta.osNova}.`);
        this.carregandoCopia.set(false);
        this.modalCopiar.close();
        this.tabelaOs.updateDataTable();
        this.forcarRepaint();
      },
      error: (err: HttpErrorResponse) => {
        const mensagem = err.error?.erro ?? 'Não foi possível copiar a OS. Verifique a conexão com o servidor REST.';
        this.poNotificationService.error(mensagem);
        this.carregandoCopia.set(false);
      }
    });
  }

  /**
   * Paliativo pro WebView do Protheus (FwCallApp) demorar a repintar a tela
   * depois de Incluir/Editar/Excluir/Copiar - a lista já foi atualizada
   * (updateDataTable), só a repintura visual atrasa até algum evento de
   * interação/foco. Um "resize" sintético costuma forçar o motor de
   * renderização a repintar na hora, sem precisar o usuário clicar em nada.
   */
  private forcarRepaint(): void {
    window.dispatchEvent(new Event('resize'));
  }
}
