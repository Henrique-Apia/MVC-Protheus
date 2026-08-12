import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PoLoadingModule, PoPageModule, PoButtonModule, PoFieldModule, PoSelectOption } from '@po-ui/ng-components';

import { Agendamento } from '../../../core/models/agendamento.model';
import { AgendamentoService } from '../../../core/services/agendamento.service';
import { AgendaDetalheModalComponent } from '../../../shared/agenda-detalhe-modal/agenda-detalhe-modal';

interface AgendamentoView extends Agendamento {
  dataFormatada: string;
  horario: string;
}

const TAMANHO_PAGINA = 100;
/** Legenda do CNSA001 (AddLegend) - '4' = Fechado. */
const STATUS_FECHADO = '4';

/**
 * "Encerrados" = agendamentos cujo chamado vinculado esta com ZA1_STATUS
 * Fechado. O REST /rest/CNSAAGENDAMENTOS pagina pelo total de agendamentos
 * (nao pelo total de encerrados) - o filtro por status e so no cliente
 * depois de buscar a pagina, entao o contador "N encerrados nesta pagina"
 * abaixo NAO e o total real de encerrados do ano (ver aviso no template).
 */
@Component({
  selector: 'app-agenda-encerrados',
  imports: [PoPageModule, PoLoadingModule, PoButtonModule, PoFieldModule, FormsModule, AgendaDetalheModalComponent],
  templateUrl: './agenda-encerrados.html',
  styleUrl: './agenda-encerrados.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgendaEncerradosComponent implements OnInit {
  private readonly agendamentoService = inject(AgendamentoService);

  @ViewChild(AgendaDetalheModalComponent) protected detalheModal!: AgendaDetalheModalComponent;

  private readonly anoHoje = new Date().getFullYear();

  protected readonly anoSelecionado = signal<number>(this.anoHoje);
  protected readonly anoOpcoes = computed<PoSelectOption[]>(() => [
    { label: String(this.anoHoje - 1), value: this.anoHoje - 1 },
    { label: String(this.anoHoje), value: this.anoHoje },
    { label: String(this.anoHoje + 1), value: this.anoHoje + 1 }
  ]);
  protected readonly pagina = signal(1);
  protected readonly totalPaginaBruta = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly itensEncerrados = signal<AgendamentoView[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly paginasOpcoes = computed<PoSelectOption[]>(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => ({ label: `Página ${i + 1}`, value: i + 1 }))
  );

  ngOnInit(): void {
    this.carregarPagina(1);
  }

  protected abrirDetalhe(item: Agendamento): void {
    this.detalheModal.agendamento = item;
    this.detalheModal.open();
  }

  protected carregarPagina(pagina: number): void {
    this.pagina.set(pagina);
    this.carregando.set(true);
    this.erro.set(null);

    this.agendamentoService.listar({ pagina, tamanho: TAMANHO_PAGINA, ano: this.anoSelecionado() }).subscribe({
      next: (resposta) => {
        this.totalPaginaBruta.set(resposta.items.length);
        this.totalPaginas.set(resposta.totalPaginas);
        this.itensEncerrados.set(
          resposta.items.filter((item) => item.statusChamado === STATUS_FECHADO).map((item) => this.paraView(item))
        );
      },
      error: () => {
        this.erro.set('Não foi possível carregar a lista. Verifique a conexão com o servidor REST.');
        this.carregando.set(false);
      },
      complete: () => this.carregando.set(false)
    });
  }

  protected selecionarAno(ano: number): void {
    this.anoSelecionado.set(ano);
    this.carregarPagina(1);
  }

  private paraView(item: Agendamento): AgendamentoView {
    const [ano, mes, dia] = item.data.split('-');
    return { ...item, dataFormatada: `${dia}/${mes}/${ano}`, horario: `${item.hini} – ${item.hfim}` };
  }
}
