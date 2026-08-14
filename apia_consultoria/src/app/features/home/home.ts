import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PoButtonModule, PoChartModule, PoChartSerie, PoChartType, PoPageModule } from '@po-ui/ng-components';

import { AuthService } from '../../core/services/auth.service';
import { ContagemDoMes, StatusResumoService } from '../../core/services/status-resumo.service';
import { CalendarioSemanaComponent } from '../calendario-semana/calendario-semana';

const DATA_FORMATTER = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const NOME_MES_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

@Component({
  selector: 'app-home',
  imports: [PoButtonModule, PoChartModule, PoPageModule, CalendarioSemanaComponent],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit {
  private readonly statusResumoService = inject(StatusResumoService);
  private readonly authService = inject(AuthService);

  protected readonly tipoColuna = PoChartType.Column;

  protected readonly usuario = this.authService.usuario;
  protected readonly dataHoje = signal(DATA_FORMATTER.format(new Date()));

  protected readonly carregando = signal(true);
  protected readonly anoSelecionado = signal(new Date().getFullYear());
  protected readonly mesSelecionado = signal(new Date().getMonth() + 1); // 1-12
  protected readonly dadosDoMes = signal<ContagemDoMes | null>(null);

  protected readonly nomeMes = computed(() => NOME_MES_FORMATTER.format(new Date(this.anoSelecionado(), this.mesSelecionado() - 1)));
  protected readonly categorias = computed(() => [this.nomeMes()]);
  protected readonly serieChamadosOs = computed<PoChartSerie[]>(() => {
    const dados = this.dadosDoMes();
    if (!dados) {
      return [];
    }
    return [
      { label: 'Chamados', data: [dados.chamados] },
      { label: 'Ordens de Serviço', data: [dados.os] }
    ];
  });

  ngOnInit(): void {
    this.carregarMes();
  }

  protected mesAnterior(): void {
    this.navegarMes(-1);
  }

  protected mesSeguinte(): void {
    this.navegarMes(1);
  }

  private navegarMes(delta: number): void {
    let mes = this.mesSelecionado() + delta;
    let ano = this.anoSelecionado();

    if (mes < 1) {
      mes = 12;
      ano--;
    } else if (mes > 12) {
      mes = 1;
      ano++;
    }

    this.mesSelecionado.set(mes);
    this.anoSelecionado.set(ano);
    this.carregarMes();
  }

  private carregarMes(): void {
    this.carregando.set(true);
    this.statusResumoService.contarDoMes(this.anoSelecionado(), this.mesSelecionado()).subscribe({
      next: (dados) => {
        this.dadosDoMes.set(dados);
        this.carregando.set(false);
      },
      error: () => {
        this.dadosDoMes.set(null);
        this.carregando.set(false);
      }
    });
  }
}
