import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PoButtonModule,
  PoDatepickerRange,
  PoFieldModule,
  PoPageModule,
  PoTableColumn,
  PoTableModule
} from '@po-ui/ng-components';

import { AgendaItem, Cns009Serv } from '../services/cns009-serv';

function paraIso(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

@Component({
  selector: 'app-cns009',
  imports: [FormsModule, PoButtonModule, PoFieldModule, PoPageModule, PoTableModule],
  templateUrl: './cns009.html',
  styleUrl: './cns009.css'
})
export class Cns009 implements OnInit, OnDestroy {
  readonly columns: Array<PoTableColumn> = [
    { property: 'data', label: 'Data', type: 'date', format: 'dd/MM/yyyy' },
    { property: 'tecnico', label: 'Técnico' },
    { property: 'seq', label: 'Seq' },
    { property: 'horaInicial', label: 'Hora Inicial' },
    { property: 'horaFinal', label: 'Hora Final' },
    { property: 'cliente', label: 'Cliente' },
    { property: 'loja', label: 'Loja' },
    { property: 'confirmado', label: 'Confirmado' },
    { property: 'turno', label: 'Turno' }
  ];

  // Padrao mes atual - abre a tela ja mostrando algo util e rapido, em vez
  // de exigir escolher periodo manualmente toda vez (usuario ainda troca
  // livremente e busca de novo).
  periodo: PoDatepickerRange = this.periodoMesAtual();
  items: AgendaItem[] = [];
  loading = false;
  erro: string | null = null;

  // Cronometro visivel - sem isso, quem tá olhando a tela nao tem como saber
  // se a busca ainda ta rodando ou travou, só clicando de novo pra ver.
  segundosDecorridos = 0;
  private inicioBusca = 0;
  private intervaloCronometro: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly cns009Serv: Cns009Serv) {}

  ngOnInit(): void {
    this.buscar();
  }

  ngOnDestroy(): void {
    this.pararCronometro();
  }

  buscar(): void {
    if (!this.periodo.start) {
      return;
    }

    this.loading = true;
    this.erro = null;
    this.iniciarCronometro();

    const inicio = this.paraData(this.periodo.start);
    const fim = this.periodo.end ? this.paraData(this.periodo.end) : undefined;

    this.cns009Serv.buscarPorPeriodo(inicio, fim).subscribe({
      next: items => {
        this.items = items;
        this.loading = false;
        this.pararCronometro();
      },
      error: (error: Error) => {
        this.erro = error.message;
        this.loading = false;
        this.pararCronometro();
      }
    });
  }

  private iniciarCronometro(): void {
    this.inicioBusca = Date.now();
    this.segundosDecorridos = 0;
    this.pararCronometro();
    this.intervaloCronometro = setInterval(() => {
      this.segundosDecorridos = Math.floor((Date.now() - this.inicioBusca) / 1000);
    }, 200);
  }

  private pararCronometro(): void {
    if (this.intervaloCronometro !== null) {
      clearInterval(this.intervaloCronometro);
      this.intervaloCronometro = null;
    }
  }

  private paraData(valor: string | Date): Date {
    if (valor instanceof Date) {
      return valor;
    }

    const [ano, mes, dia] = valor.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  }

  private periodoMesAtual(): PoDatepickerRange {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { start: paraIso(inicio), end: paraIso(fim) };
  }
}
