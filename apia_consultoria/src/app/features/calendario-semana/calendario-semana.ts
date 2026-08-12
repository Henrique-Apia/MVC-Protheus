import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PoButtonModule } from '@po-ui/ng-components';
import { forkJoin } from 'rxjs';

import { Agendamento, AgendaSemanaService } from '../../core/services/agenda-semana.service';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const HORA_INICIO = 7;
const HORA_FIM = 19;
const ALTURA_HORA_PX = 48;

// Cores por status do chamado vinculado - mesma paleta usada nos outros
// gráficos (categorical), só reaproveitando aqui pro bloco do evento.
const COR_POR_STATUS: Record<string, string> = {
  '1': '#2f9bda', // Aberto
  '2': '#e0a030', // Pendente Apia
  '3': '#c3536b', // Pendente Cliente
  '4': '#7d8794' // Fechado
};
const COR_PADRAO = '#2f9bda';

export interface EventoPosicionado {
  agendamento: Agendamento;
  top: number;
  altura: number;
  cor: string;
}

function paraChaveIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function minutosDesdeInicioDoGrid(horaMinuto: string): number {
  const [h, m] = horaMinuto.split(':').map(Number);
  return (h - HORA_INICIO) * 60 + (m || 0);
}

@Component({
  selector: 'app-calendario-semana',
  imports: [PoButtonModule],
  templateUrl: './calendario-semana.html',
  styleUrl: './calendario-semana.css'
})
export class CalendarioSemanaComponent implements OnInit {
  private readonly agendaSemanaService = inject(AgendaSemanaService);

  protected readonly horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  protected readonly diasSemanaLabel = DIAS_SEMANA;
  protected readonly alturaHoraPx = ALTURA_HORA_PX;

  protected readonly carregando = signal(true);
  protected readonly diaBase = signal(new Date());
  protected readonly agendamentos = signal<Agendamento[]>([]);

  protected readonly diasDaSemana = computed(() => {
    const base = this.diaBase();
    const inicioSemana = new Date(base);
    inicioSemana.setDate(base.getDate() - base.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(inicioSemana);
      dia.setDate(inicioSemana.getDate() + i);
      return dia;
    });
  });

  protected readonly labelPeriodo = computed(() => {
    const dias = this.diasDaSemana();
    const formatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
    return `${formatter.format(dias[0])} - ${formatter.format(dias[6])}`;
  });

  protected readonly eventosPorDia = computed<EventoPosicionado[][]>(() => {
    const dias = this.diasDaSemana();
    const todosAgendamentos = this.agendamentos();

    return dias.map((dia) => {
      const chave = paraChaveIso(dia);
      return todosAgendamentos
        .filter((agendamento) => agendamento.data === chave)
        .map((agendamento) => this.posicionar(agendamento));
    });
  });

  ngOnInit(): void {
    this.carregarSemana();
  }

  protected semanaAnterior(): void {
    const base = new Date(this.diaBase());
    base.setDate(base.getDate() - 7);
    this.diaBase.set(base);
    this.carregarSemana();
  }

  protected semanaSeguinte(): void {
    const base = new Date(this.diaBase());
    base.setDate(base.getDate() + 7);
    this.diaBase.set(base);
    this.carregarSemana();
  }

  protected hoje(): void {
    this.diaBase.set(new Date());
    this.carregarSemana();
  }

  private posicionar(agendamento: Agendamento): EventoPosicionado {
    const inicioMin = Math.max(0, minutosDesdeInicioDoGrid(agendamento.hini));
    const fimMin = Math.min((HORA_FIM - HORA_INICIO) * 60, minutosDesdeInicioDoGrid(agendamento.hfim || agendamento.hini));
    const duracaoMin = Math.max(30, fimMin - inicioMin);

    return {
      agendamento,
      top: (inicioMin / 60) * ALTURA_HORA_PX,
      altura: (duracaoMin / 60) * ALTURA_HORA_PX,
      cor: COR_POR_STATUS[agendamento.statusChamado] ?? COR_PADRAO
    };
  }

  private carregarSemana(): void {
    const dias = this.diasDaSemana();
    const meses = new Set(dias.map((dia) => `${dia.getFullYear()}-${dia.getMonth() + 1}`));

    this.carregando.set(true);
    forkJoin(
      Array.from(meses).map((chave) => {
        const [ano, mes] = chave.split('-').map(Number);
        return this.agendaSemanaService.agendamentosDoMes(ano, mes);
      })
    ).subscribe({
      next: (listas) => {
        this.agendamentos.set(listas.flat());
        this.carregando.set(false);
      },
      error: () => {
        this.agendamentos.set([]);
        this.carregando.set(false);
      }
    });
  }
}
