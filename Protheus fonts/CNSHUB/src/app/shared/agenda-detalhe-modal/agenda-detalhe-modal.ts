import { CommonModule } from '@angular/common';
import { Component, Input, ViewChild } from '@angular/core';
import { PoModalModule, PoModalComponent } from '@po-ui/ng-components';

import { Agendamento } from '../../core/models/agendamento.model';

@Component({
  selector: 'app-agenda-detalhe-modal',
  standalone: true,
  imports: [CommonModule, PoModalModule],
  templateUrl: './agenda-detalhe-modal.html'
})
export class AgendaDetalheModalComponent {
  @Input() agendamento: Agendamento | null = null;
  @ViewChild(PoModalComponent, { static: true }) poModal!: PoModalComponent;

  open(): void {
    this.poModal.open();
  }
}
