import { ChangeDetectionStrategy, Component, EventEmitter, Output, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PoButtonModule, PoModalComponent, PoModalModule } from '@po-ui/ng-components';

import { ComponenteItem, TipoLupa } from '../core/models/componente.model';
import { ComponenteService } from '../core/services/componente.service';

const TITULOS: Record<TipoLupa, string> = {
  tecnico: 'Selecionar analista',
  cliente: 'Selecionar cliente',
  projeto: 'Selecionar projeto',
  tarefa: 'Selecionar tarefa',
  modulo: 'Selecionar módulo',
  motivo: 'Selecionar motivo',
  servico: 'Selecionar serviço',
  proposta: 'Selecionar proposta'
};

/**
 * Modal de lupa genérico, reaproveitado por todos os campos de consulta da
 * tela de Incluir/Editar OS (Cliente, Analista, Módulo, Motivo, Serviço,
 * Proposta, Projeto e Tarefa) - cada um consome o mesmo WSRESTFUL
 * CNSACOMPONENTES, só troca o `tipo`. Cópia adaptada do mesmo componente em
 * pouichamados (cada app Angular tem sua própria cópia - não há lib
 * compartilhada entre os projetos).
 *
 * Uso: `@ViewChild(LupaModalComponent) lupa!: LupaModalComponent;` no
 * componente pai, chamar `this.lupa.abrir('cliente')` (ou
 * `this.lupa.abrir('tarefa', codigoDoProjeto)` pra tarefa/proposta, que
 * dependem de projeto/cliente já selecionado) e escutar
 * `(selecionado)="..."` no template.
 */
@Component({
  selector: 'app-lupa-modal',
  imports: [FormsModule, PoModalModule, PoButtonModule],
  templateUrl: './lupa-modal.html',
  styleUrl: './lupa-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LupaModalComponent {
  private readonly componenteService = inject(ComponenteService);

  @Output() readonly selecionado = new EventEmitter<ComponenteItem>();

  @ViewChild('modal', { static: true }) protected modal!: PoModalComponent;

  protected filtro = '';
  protected readonly itens = signal<ComponenteItem[]>([]);
  protected readonly carregando = signal(false);
  protected readonly jaPesquisou = signal(false);
  protected readonly tituloAtual = signal(TITULOS.cliente);

  private tipoAtual: TipoLupa = 'cliente';
  private projetoAtual = '';
  private clienteAtual = '';
  private lojaClienteAtual = '';

  /**
   * Abre a lupa já disparando a primeira busca (sem filtro - traz todos).
   * `projeto` só é relevante (e obrigatório de fato) quando tipo === 'tarefa'.
   * `cliente`/`lojaCliente` só relevantes (e obrigatórios) quando
   * tipo === 'projeto' ou 'proposta'.
   */
  abrir(tipo: TipoLupa, projeto = '', cliente = '', lojaCliente = ''): void {
    this.tipoAtual = tipo;
    this.projetoAtual = projeto;
    this.clienteAtual = cliente;
    this.lojaClienteAtual = lojaCliente;
    this.tituloAtual.set(TITULOS[tipo]);
    this.filtro = '';
    this.itens.set([]);
    this.jaPesquisou.set(false);
    this.modal.open();
    this.pesquisar();
  }

  protected pesquisar(): void {
    this.carregando.set(true);
    this.componenteService
      .buscar(this.tipoAtual, this.filtro.trim(), this.projetoAtual, this.clienteAtual, this.lojaClienteAtual)
      .subscribe({
        next: (resposta) => {
          this.itens.set(resposta.items ?? []);
          this.carregando.set(false);
          this.jaPesquisou.set(true);
        },
        error: () => {
          this.itens.set([]);
          this.carregando.set(false);
          this.jaPesquisou.set(true);
        }
      });
  }

  protected selecionar(item: ComponenteItem): void {
    this.selecionado.emit(item);
    this.modal.close();
  }

  protected fechar(): void {
    this.modal.close();
  }
}
