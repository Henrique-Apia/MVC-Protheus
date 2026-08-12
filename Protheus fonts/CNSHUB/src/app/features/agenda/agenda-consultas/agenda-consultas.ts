import { ChangeDetectionStrategy, Component, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PoButtonModule, PoLoadingModule, PoPageModule } from '@po-ui/ng-components';

import { Agendamento } from '../../../core/models/agendamento.model';
import { AgendamentoService } from '../../../core/services/agendamento.service';
import { AgendaDetalheModalComponent } from '../../../shared/agenda-detalhe-modal/agenda-detalhe-modal';

interface AgendamentoView extends Agendamento {
  dataFormatada: string;
  horario: string;
  situacao: string;
}

@Component({
  selector: 'app-agenda-consultas',
  imports: [PoPageModule, PoButtonModule, PoLoadingModule, FormsModule, AgendaDetalheModalComponent],
  templateUrl: './agenda-consultas.html',
  styleUrl: './agenda-consultas.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgendaConsultasComponent {
  private readonly agendamentoService = inject(AgendamentoService);

  @ViewChild(AgendaDetalheModalComponent) protected detalheModal!: AgendaDetalheModalComponent;

  protected consultaChamado = '';
  protected consultaTecnico = '';
  protected consultaCliente = '';
  protected readonly carregando = signal(false);
  protected readonly erro = signal<string | null>(null);
  // null = busca ainda não realizada; [] = buscou e não achou nada
  protected readonly resultados = signal<AgendamentoView[] | null>(null);

  protected abrirDetalhe(item: Agendamento): void {
    this.detalheModal.agendamento = item;
    this.detalheModal.open();
  }

  protected buscar(): void {
    const chamado = this.consultaChamado.trim();
    const tecnico = this.consultaTecnico.trim();
    const cliente = this.consultaCliente.trim();

    if (!chamado && !tecnico && !cliente) {
      this.erro.set('Informe ao menos um filtro: chamado, técnico ou cliente.');
      return;
    }

    this.carregando.set(true);
    this.erro.set(null);

    this.agendamentoService
      .listarConsulta({
        chamado: chamado || undefined,
        tecnico: tecnico || undefined,
        cliente: cliente || undefined
      })
      .subscribe({
        next: (itens) => {
          this.resultados.set(itens.map((item) => this.paraView(item)));
        },
        error: () => {
          this.erro.set('Não foi possível realizar a consulta. Verifique a conexão com o servidor REST.');
          this.carregando.set(false);
        },
        complete: () => this.carregando.set(false)
      });
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
