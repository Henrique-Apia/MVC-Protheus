import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { PoButtonModule, PoLoadingModule, PoPageModule } from '@po-ui/ng-components';

import { Agendamento } from '../../../core/models/agendamento.model';
import { AgendamentoService } from '../../../core/services/agendamento.service';
import { AgendaDetalheModalComponent } from '../../../shared/agenda-detalhe-modal/agenda-detalhe-modal';

type Aba = 'anterior' | 'atual' | 'posterior';

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
  selector: 'app-agenda-calendario',
  imports: [PoPageModule, PoButtonModule, PoLoadingModule, AgendaDetalheModalComponent],
  templateUrl: './agenda-calendario.html',
  styleUrl: './agenda-calendario.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgendaCalendarioComponent implements OnInit {
  private readonly agendamentoService = inject(AgendamentoService);
  private readonly cacheMeses = new Map<string, AgendamentoView[]>();

  @ViewChild(AgendaDetalheModalComponent) protected detalheModal!: AgendaDetalheModalComponent;

  private readonly hoje = new Date();
  private readonly anoHoje = this.hoje.getFullYear();
  private readonly mesHoje = this.hoje.getMonth(); // 0-11
  private readonly diaHoje = this.hoje.getDate();

  protected readonly primeiraCarga = signal(true);
  protected readonly carregandoMes = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected readonly itensDoMesAtual = signal<AgendamentoView[]>([]);

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
    this.carregarMes();
  }

  protected abrirDetalhe(item: Agendamento): void {
    this.detalheModal.agendamento = item;
    this.detalheModal.open();
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
