import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PoLoadingModule, PoPageModule, PoButtonModule, PoFieldModule, PoSelectOption } from '@po-ui/ng-components';

import { Agendamento } from '../../../core/models/agendamento.model';
import { AgendamentoService } from '../../../core/services/agendamento.service';
import { AgendaDetalheModalComponent } from '../../../shared/agenda-detalhe-modal/agenda-detalhe-modal';

interface AgendamentoView extends Agendamento {
  dataFormatada: string;
  horario: string;
  situacao: string;
}

const TAMANHO_PAGINA = 100;

/** Lista paginada estilo cartão - usada tanto por "Meus" quanto "Assumidos" (route data define `modo`). */
@Component({
  selector: 'app-agenda-minha-lista',
  imports: [PoPageModule, PoLoadingModule, PoButtonModule, PoFieldModule, FormsModule, AgendaDetalheModalComponent],
  templateUrl: './agenda-minha-lista.html',
  styleUrl: './agenda-minha-lista.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgendaMinhaListaComponent implements OnInit {
  private readonly agendamentoService = inject(AgendamentoService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild(AgendaDetalheModalComponent) protected detalheModal!: AgendaDetalheModalComponent;

  private readonly anoHoje = new Date().getFullYear();
  private modo: 'meu' | 'assumidos' = 'meu';

  protected readonly titulo = computed(() => (this.modo === 'assumidos' ? 'Assumidos' : 'Meus'));

  protected readonly anoSelecionado = signal<number>(this.anoHoje);
  protected readonly anoOpcoes = computed<PoSelectOption[]>(() => [
    { label: String(this.anoHoje - 1), value: this.anoHoje - 1 },
    { label: String(this.anoHoje), value: this.anoHoje },
    { label: String(this.anoHoje + 1), value: this.anoHoje + 1 }
  ]);
  protected readonly pagina = signal(1);
  protected readonly total = signal(0);
  protected readonly totalPaginas = signal(0);
  protected readonly itens = signal<AgendamentoView[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly paginasOpcoes = computed<PoSelectOption[]>(() =>
    Array.from({ length: this.totalPaginas() }, (_, i) => ({ label: `Página ${i + 1}`, value: i + 1 }))
  );

  ngOnInit(): void {
    this.modo = this.route.snapshot.data['modo'] === 'assumidos' ? 'assumidos' : 'meu';
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

    this.agendamentoService.listarPaginado(this.modo, pagina, this.anoSelecionado(), TAMANHO_PAGINA).subscribe({
      next: (resposta) => {
        this.itens.set(resposta.items.map((item) => this.paraView(item)));
        this.total.set(resposta.total);
        this.totalPaginas.set(resposta.totalPaginas);
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
}
