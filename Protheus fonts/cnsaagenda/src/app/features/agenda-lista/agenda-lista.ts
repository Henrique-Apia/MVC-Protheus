import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PoButtonModule, PoLoadingModule, PoPageModule, PoMenuModule, PoMenuItem, PoFieldModule, PoSelectOption } from '@po-ui/ng-components';
import { ProAppConfigService } from '@totvs/protheus-lib-core';

import { Agendamento } from '../../core/models/agendamento.model';
import { AgendamentoService } from '../../core/services/agendamento.service';

type Aba = 'anterior' | 'atual' | 'posterior';

// Só "agendas" e "consultas" têm conteúdo real. As demais são placeholder por
// enquanto - a transformação do CNSA001 (chamados) em PO UI fica para depois.
type Secao =
  | 'agendas'
  | 'buscarNovosItens'
  | 'meus'
  | 'assumidos'
  | 'encerrados'
  | 'consultas';

const TITULO_SECAO: Record<Secao, string> = {
  agendas: 'Agenda de Atendimentos',
  buscarNovosItens: 'Buscar Novos Itens',
  meus: 'Meus',
  assumidos: 'Assumidos',
  encerrados: 'Encerrados',
  consultas: 'Consultas'
};

interface AgendamentoView extends Agendamento {
  /** dd/MM/yyyy - montado por split de string, nunca via Date(). */
  dataFormatada: string;
  horario: string;
  situacao: string;
}

interface CelulaDia {
  dia: number | null;
  qtd: number;
  fimDeSemana: boolean;
  selecionado: boolean;
}

interface GrupoTecnico {
  tecnico: string;
  cor: string;
  itens: AgendamentoView[];
}

const PALETA_TECNICO = ['#1a7fc1', '#2aa9a0', '#e8a34d', '#c3536b', '#8b6fd1', '#6fae6f'];

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const NOMES_DIA_SEMANA = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado'
];

@Component({
  selector: 'app-agenda-lista',
  imports: [PoPageModule, PoButtonModule, PoLoadingModule, PoMenuModule, PoFieldModule, FormsModule],
  templateUrl: './agenda-lista.html',
  styleUrl: './agenda-lista.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgendaListaComponent implements OnInit {
  private readonly agendamentoService = inject(AgendamentoService);
  private readonly proAppConfigService = inject(ProAppConfigService);

  private readonly cacheMeses = new Map<string, AgendamentoView[]>();

  private readonly hoje = new Date();
  private readonly anoHoje = this.hoje.getFullYear();
  private readonly mesHoje = this.hoje.getMonth(); // 0-11
  private readonly diaHoje = this.hoje.getDate();

  protected readonly secaoAtiva = signal<Secao>('agendas');
  protected readonly tituloSecaoAtiva = computed(() => TITULO_SECAO[this.secaoAtiva()]);

  // "Agendas" continua no calendario (aprovado antes). "Meus"/"Assumidos"
  // agora sao uma lista paginada (nao o calendario) - menos navegacao,
  // mostra tudo de uma vez, com paginas de verdade vindas do REST.
  protected readonly categoriaSecao = computed<'calendario' | 'lista' | 'consultas' | 'atualizar' | 'outro'>(() => {
    const s = this.secaoAtiva();
    if (s === 'agendas') return 'calendario';
    if (s === 'meus' || s === 'assumidos') return 'lista';
    if (s === 'consultas') return 'consultas';
    if (s === 'buscarNovosItens') return 'atualizar';
    return 'outro';
  });

  protected readonly modoLista = computed<'meu' | 'assumidos'>(() =>
    this.secaoAtiva() === 'assumidos' ? 'assumidos' : 'meu'
  );

  // Menu lateral nativo do PO UI configurado com ações diretas
  protected readonly itensMenuPo: Array<PoMenuItem> = [
    { label: 'Agendas', action: () => this.selecionarSecao('agendas') },
    { label: 'Buscar Novos Itens', action: () => this.selecionarSecao('buscarNovosItens') },
    { label: 'Meus', action: () => this.selecionarSecao('meus') },
    { label: 'Assumidos', action: () => this.selecionarSecao('assumidos') },
    { label: 'Encerrados', action: () => this.selecionarSecao('encerrados') },
    { label: 'Consultas', action: () => this.selecionarSecao('consultas') },
    { label: 'Sair', action: () => this.fechar() }
  ];

  protected readonly primeiraCarga = signal(true);
  protected readonly carregandoMes = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly itensDoMesAtual = signal<AgendamentoView[]>([]);

  protected readonly contagemAnoAnterior = signal(0);
  protected readonly contagemAnoAtual = signal(0);
  protected readonly contagemAnoPosterior = signal(0);

  protected readonly anoExibido = signal<number>(this.anoHoje);
  protected readonly mesExibido = signal<number>(this.mesHoje);
  protected readonly diaSelecionado = signal<number | null>(this.diaHoje);

  protected readonly abaAtiva = computed<Aba | null>(() => {
    const diff = this.anoExibido() - this.anoHoje;
    if (diff === -1) return 'anterior';
    if (diff === 0) return 'atual';
    if (diff === 1) return 'posterior';
    return null;
  });

  // Estado da seção "Consultas" - busca livre por chamado/técnico/cliente,
  // sem limite de data (histórico completo, não só os 3 anos da agenda).
  protected consultaChamado = '';
  protected consultaTecnico = '';
  protected consultaCliente = '';
  protected readonly carregandoConsulta = signal(false);
  protected readonly erroConsulta = signal<string | null>(null);
  // null = busca ainda não realizada; [] = buscou e não achou nada
  protected readonly resultadosConsulta = signal<AgendamentoView[] | null>(null);

  // Estado da lista paginada ("Meus"/"Assumidos") - estilo cartão, paginada
  // de verdade pelo REST (sem concatenar tudo, evita repetir o problema de volume).
  // Primeiro escolhe o ANO (mesma janela de 3 anos da agenda), depois a pagina
  // dentro daquele ano - evita ter uma lista enorme de paginas soltas.
  private readonly TAMANHO_PAGINA_LISTA = 100;
  protected readonly anoListaSelecionado = signal<number>(this.anoHoje);
  protected readonly anoOpcoesLista = computed<PoSelectOption[]>(() => [
    { label: String(this.anoHoje - 1), value: this.anoHoje - 1 },
    { label: String(this.anoHoje), value: this.anoHoje },
    { label: String(this.anoHoje + 1), value: this.anoHoje + 1 }
  ]);
  protected readonly paginaLista = signal(1);
  protected readonly totalLista = signal(0);
  protected readonly totalPaginasLista = signal(0);
  protected readonly itensLista = signal<AgendamentoView[]>([]);
  protected readonly carregandoLista = signal(false);
  protected readonly erroLista = signal<string | null>(null);
  protected readonly paginasOpcoes = computed<PoSelectOption[]>(() =>
    Array.from({ length: this.totalPaginasLista() }, (_, i) => ({ label: `Página ${i + 1}`, value: i + 1 }))
  );

  protected readonly nomeMesExibido = computed(() => `${NOMES_MES[this.mesExibido()]} de ${this.anoExibido()}`);

  protected readonly grade = computed<CelulaDia[]>(() => {
    const ano = this.anoExibido();
    const mes = this.mesExibido();
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    const diaSel = this.diaSelecionado();

    const contagem = new Map<number, number>();
    for (const item of this.itensDoMesAtual()) {
      const dia = Number(item.data.split('-')[2]);
      contagem.set(dia, (contagem.get(dia) ?? 0) + 1);
    }

    const celulas: CelulaDia[] = [];
    for (let i = 0; i < primeiroDiaSemana; i++) {
      celulas.push({ dia: null, qtd: 0, fimDeSemana: false, selecionado: false });
    }
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const diaSemana = new Date(ano, mes, dia).getDay();
      celulas.push({
        dia,
        qtd: contagem.get(dia) ?? 0,
        fimDeSemana: diaSemana === 0 || diaSemana === 6,
        selecionado: dia === diaSel
      });
    }
    return celulas;
  });

  protected readonly labelDiaSelecionado = computed(() => {
    const dia = this.diaSelecionado();
    if (dia === null) return '';
    const ano = this.anoExibido();
    const mes = this.mesExibido();
    const diaSemana = new Date(ano, mes, dia).getDay();
    return `${NOMES_DIA_SEMANA[diaSemana]} — ${this.pad(dia)}/${this.pad(mes + 1)}/${ano}`;
  });

  protected readonly gruposDoDiaSelecionado = computed<GrupoTecnico[]>(() => {
    const dia = this.diaSelecionado();
    if (dia === null) return [];

    const itensDoDia = this.itensDoMesAtual().filter((item) => Number(item.data.split('-')[2]) === dia);
    const grupos = new Map<string, AgendamentoView[]>();

    for (const item of itensDoDia) {
      const lista = grupos.get(item.tecnico) ?? [];
      lista.push(item);
      grupos.set(item.tecnico, lista);
    }

    return Array.from(grupos.entries()).map(([tecnico, itens]) => ({
      tecnico,
      cor: this.corTecnico(tecnico),
      itens
    }));
  });

  ngOnInit(): void {
    this.carregarContagens();
    this.carregarMes();
  }

  protected fechar(): void {
    this.proAppConfigService.callAppClose(false);
  }

  protected selecionarSecao(secao: Secao): void {
    this.secaoAtiva.set(secao);
    if (secao === 'agendas') {
      this.carregarMes();
    } else if (secao === 'meus' || secao === 'assumidos') {
      this.carregarPaginaLista(1);
    } else if (secao === 'buscarNovosItens') {
      this.atualizarDados();
    }
  }

  protected carregarPaginaLista(pagina: number): void {
    const modo = this.modoLista();
    const ano = this.anoListaSelecionado();
    this.paginaLista.set(pagina);
    this.carregandoLista.set(true);
    this.erroLista.set(null);

    this.agendamentoService.listarPaginado(modo, pagina, ano, this.TAMANHO_PAGINA_LISTA).subscribe({
      next: (resposta) => {
        this.itensLista.set(resposta.items.map((item) => this.paraView(item)));
        this.totalLista.set(resposta.total);
        this.totalPaginasLista.set(resposta.totalPaginas);
      },
      error: () => {
        this.erroLista.set('Não foi possível carregar a lista. Verifique a conexão com o servidor REST.');
        this.carregandoLista.set(false);
      },
      complete: () => this.carregandoLista.set(false)
    });
  }

  protected selecionarAnoLista(ano: number): void {
    this.anoListaSelecionado.set(ano);
    this.carregarPaginaLista(1);
  }

  /** "Buscar Novos Itens" - limpa o cache do calendário e busca dados frescos do servidor. */
  protected atualizarDados(): void {
    this.cacheMeses.clear();
    this.carregarMes();
  }

  protected buscarConsulta(): void {
    const chamado = this.consultaChamado.trim();
    const tecnico = this.consultaTecnico.trim();
    const cliente = this.consultaCliente.trim();

    if (!chamado && !tecnico && !cliente) {
      this.erroConsulta.set('Informe ao menos um filtro: chamado, técnico ou cliente.');
      return;
    }

    this.carregandoConsulta.set(true);
    this.erroConsulta.set(null);

    this.agendamentoService
      .listarConsulta({
        chamado: chamado || undefined,
        tecnico: tecnico || undefined,
        cliente: cliente || undefined
      })
      .subscribe({
        next: (itens) => {
          this.resultadosConsulta.set(itens.map((item) => this.paraView(item)));
        },
        error: () => {
          this.erroConsulta.set('Não foi possível realizar a consulta. Verifique a conexão com o servidor REST.');
          this.carregandoConsulta.set(false);
        },
        complete: () => this.carregandoConsulta.set(false)
      });
  }

  protected selecionarAba(aba: Aba): void {
    const ano = this.anoHoje + this.deltaAno(aba);
    this.anoExibido.set(ano);
    this.mesExibido.set(this.mesHoje);
    this.diaSelecionado.set(this.diaValidoNoMes(ano, this.mesHoje, this.diaHoje));
    this.carregarMes();
  }

  protected mudarMes(delta: -1 | 1): void {
    let novoMes = this.mesExibido() + delta;
    let novoAno = this.anoExibido();

    if (novoMes < 0) {
      novoMes = 11;
      novoAno -= 1;
    } else if (novoMes > 11) {
      novoMes = 0;
      novoAno += 1;
    }

    this.mesExibido.set(novoMes);
    this.anoExibido.set(novoAno);
    this.diaSelecionado.set(null);
    this.carregarMes();
  }

  protected irParaExtremo(inicio: boolean): void {
    this.mesExibido.set(inicio ? 0 : 11);
    this.diaSelecionado.set(null);
    this.carregarMes();
  }

  protected selecionarDia(dia: number | null): void {
    if (dia === null) return;
    this.diaSelecionado.set(dia);
  }

  protected carregarMes(): void {
    const ano = this.anoExibido();
    const mes = this.mesExibido();
    const chave = `${ano}-${mes}`;

    const cacheado = this.cacheMeses.get(chave);
    if (cacheado) {
      this.itensDoMesAtual.set(cacheado);
      this.erro.set(null);
      this.finalizarPrimeiraCarga();
      return;
    }

    this.carregandoMes.set(true);

    this.agendamentoService.listarPorMes(ano, mes + 1).subscribe({
      next: (itens) => {
        const views = itens.map((item) => this.paraView(item));
        this.cacheMeses.set(chave, views);
        this.itensDoMesAtual.set(views);
        this.erro.set(null);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os agendamentos deste mês. Verifique a conexão com o servidor REST.');
        this.carregandoMes.set(false);
        this.finalizarPrimeiraCarga();
      },
      complete: () => {
        this.carregandoMes.set(false);
        this.finalizarPrimeiraCarga();
      }
    });
  }

  private finalizarPrimeiraCarga(): void {
    if (this.primeiraCarga()) {
      this.primeiraCarga.set(false);
    }
  }

  private carregarContagens(): void {
    this.agendamentoService.contarAno(this.anoHoje - 1).subscribe({
      next: (n) => this.contagemAnoAnterior.set(n),
      error: () => this.contagemAnoAnterior.set(0)
    });
    this.agendamentoService.contarAno(this.anoHoje).subscribe({
      next: (n) => this.contagemAnoAtual.set(n),
      error: () => this.contagemAnoAtual.set(0)
    });
    this.agendamentoService.contarAno(this.anoHoje + 1).subscribe({
      next: (n) => this.contagemAnoPosterior.set(n),
      error: () => this.contagemAnoPosterior.set(0)
    });
  }

  private deltaAno(aba: Aba): number {
    return aba === 'anterior' ? -1 : aba === 'posterior' ? 1 : 0;
  }

  private diaValidoNoMes(ano: number, mes: number, dia: number): number {
    const diasNoMes = new Date(ano, mes + 1, 0).getDate();
    return Math.min(dia, diasNoMes);
  }

  private paraView(item: Agendamento): AgendamentoView {
    const [ano, mes, dia] = item.data.split('-');
    return {
      ...item,
      dataFormatada: `${dia}/${mes}/${ano}`,
      horario: `${item.hini} – ${item.hfim}`,
      situacao: this.rotuloSituacao(item.confirmado)
    };
  }

  private rotuloSituacao(valor: string): string {
    const v = (valor ?? '').trim().toUpperCase();
    if (['S', '1', 'T', 'SIM'].includes(v)) return 'Confirmado';
    if (['N', '0', 'F', 'NAO', 'NÃO', ''].includes(v)) return 'Pendente';
    return valor;
  }

  private corTecnico(nome: string): string {
    let hash = 0;
    for (const char of nome) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return PALETA_TECNICO[hash % PALETA_TECNICO.length];
  }

  private pad(n: number): string {
    return String(n).padStart(2, '0');
  }
}
