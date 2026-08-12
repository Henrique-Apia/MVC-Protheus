import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PoFieldModule } from '@po-ui/ng-components';

/**
 * Wrapper fino em cima do <po-rich-text> nativo do PO-UI - usado pela
 * "Anotações" do chamado (campo memo único na ZA1, sobrescrito a cada save).
 *
 * ADAPTAÇÃO DA ASSINATURA DE EXEMPLO (Henrique passou este modelo, com
 * `selector: 'sample-po-rich-text-basic'` e `standalone: false`):
 *   import { Component } from '@angular/core';
 *   @Component({
 *     selector: 'sample-po-rich-text-basic',
 *     templateUrl: './sample-po-rich-text-basic.component.html',
 *     standalone: false
 *   })
 *   export class SamplePoRichTextBasicComponent {}
 *   <po-rich-text></po-rich-text>
 *
 * Esse é o exemplo padrão da documentação do PO-UI pro componente. Este
 * projeto inteiro é standalone (Angular 21, sem NgModule declarado em
 * lugar nenhum - ver app.config.ts usando bootstrapApplication), então
 * `standalone: false` exigiria criar um NgModule só pra isso, o que quebraria
 * o padrão usado em todo o resto do app. Mantive o essencial do exemplo - a
 * tag `<po-rich-text>` de verdade - só adaptando pra um componente standalone
 * com `app-` prefix, igual ao resto do projeto (`app-chamados-lista`, etc.).
 */
@Component({
  selector: 'app-anotacao-editor',
  imports: [FormsModule, PoFieldModule],
  templateUrl: './anotacao-editor.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnotacaoEditorComponent {
  @Input() valor = '';
  @Input() somenteLeitura = false;
  @Output() readonly valorChange = new EventEmitter<string>();

  protected aoAlterar(novoValor: string): void {
    this.valorChange.emit(novoValor);
  }
}
