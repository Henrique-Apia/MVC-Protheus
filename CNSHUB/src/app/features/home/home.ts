import { ChangeDetectionStrategy, Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, forkJoin, of, tap } from 'rxjs';
import { PoCalendarMode, PoCalendarModule, PoLoadingModule, PoPageModule, PoTagModule } from '@po-ui/ng-components';

import { Agendamento } from '../../core/models/agendamento.model';
import { AgendamentoService } from '../../core/services/agendamento.service';
import { AgendaDetalheModalComponent } from '../../shared/agenda-detalhe-modal/agenda-detalhe-modal';

interface AgendamentoView extends Agendamento {
  /** dd/MM/yyyy - montado por split de string, nunca via Date(). */
  dataFormatada: string;
  horario: string;
}

interface DiaComAgendamento {
  data: string; // yyyy-MM-dd
  dataFormatada: string;
  qtd: number;
}

/**
 * po-calendar (PO UI 21.23) nao tem API pra marcar dias com evento/badge no
 * proprio grid do calendario (so p-mode/p-range-presets/p-change) - por isso
 * a "marcacao visual" dos dias com agendamento vira este painel ao lado,
 * nao um ponto colorido dentro do calendario. Ver plano CNSHUB, secao Home.
 */
@Component({
  selector: 'app-home',
  imports: [CommonModule, PoCalendarModule, PoLoadingModule, PoPageModule, PoTagModule, AgendaDetalheModalComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements OnInit {
  private readonly agendamentoService = inject(AgendamentoService);
  private readonly cacheMeses = new Map<string, Agendamento[]>();

  @ViewChild(AgendaDetalheModalComponent) protected detalheModal!: AgendaDetalheModalComponent;

  protected readonly modoRange = PoCalendarMode.Range;

  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly itensDoPeriodo = signal<AgendamentoView[]>([]);

  protected readonly diasComAgendamento = computed<DiaComAgendamento[]>(() => {
    const contagem = new Map<string, number>();
    for (const item of this.itensDoPeriodo()) {
      contagem.set(item.data, (contagem.get(item.data) ?? 0) + 1);
    }
    return Array.from(contagem.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, qtd]) => ({ data, dataFormatada: this.formatarData(data), qtd }));
  });

  ngOnInit(): void {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    this.carregarPeriodo(this.paraIso(inicioMes), this.paraIso(fimMes));
  }

  protected abrirDetalhe(item: Agendamento): void {
    this.detalheModal.agendamento = item;
    this.detalheModal.open();
  }

  /** `po-calendar` em p-mode="range" emite { start, end } no (p-change). */
  protected onRangeChange(valor: string | { start: unknown; end: unknown }): void {
    if (typeof valor === 'string' || !valor) {
      return;
    }
    this.carregarPeriodo(this.paraIso(valor.start), this.paraIso(valor.end));
  }

  private carregarPeriodo(inicioIso: string, fimIso: string): void {
    this.carregando.set(true);
    this.erro.set(null);

    const meses = this.mesesEntre(inicioIso, fimIso);
    forkJoin(meses.map(({ ano, mes }) => this.buscarMes(ano, mes))).subscribe({
      next: (porMes) => {
        const doPeriodo = porMes
          .flat()
          .filter((item) => item.data >= inicioIso && item.data <= fimIso)
          .map((item) => this.paraView(item))
          .sort((a, b) => (a.data + a.hini).localeCompare(b.data + b.hini));
        this.itensDoPeriodo.set(doPeriodo);
      },
      error: () => {
        this.erro.set('Não foi possível carregar os agendamentos do período. Verifique a conexão com o servidor REST.');
        this.carregando.set(false);
      },
      complete: () => this.carregando.set(false)
    });
  }

  private buscarMes(ano: number, mes: number): Observable<Agendamento[]> {
    const chave = `${ano}-${mes}`;
    const cacheado = this.cacheMeses.get(chave);
    if (cacheado) {
      return of(cacheado);
    }
    return this.agendamentoService.listarPorMes(ano, mes).pipe(tap((itens) => this.cacheMeses.set(chave, itens)));
  }

  private mesesEntre(inicioIso: string, fimIso: string): Array<{ ano: number; mes: number }> {
    let [ano, mes] = inicioIso.split('-').map(Number);
    const [anoFim, mesFim] = fimIso.split('-').map(Number);

    const meses: Array<{ ano: number; mes: number }> = [];
    while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
      meses.push({ ano, mes });
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
    }
    return meses;
  }

  private paraView(item: Agendamento): AgendamentoView {
    const [ano, mes, dia] = item.data.split('-');
    return { ...item, dataFormatada: `${dia}/${mes}/${ano}`, horario: `${item.hini} – ${item.hfim}` };
  }

  private formatarData(iso: string): string {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  private paraIso(data: unknown): string {
    if (typeof data === 'string') {
      return data.slice(0, 10);
    }
    const d = new Date(data as string | number | Date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
