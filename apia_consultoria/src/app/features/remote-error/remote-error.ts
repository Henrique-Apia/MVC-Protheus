import { Component, Input, OnInit, inject } from '@angular/core';
import { PoNotificationService } from '@po-ui/ng-components';

@Component({
  selector: 'app-remote-error',
  imports: [],
  templateUrl: './remote-error.html'
})
export class RemoteErrorComponent implements OnInit {
  @Input() moduleName = '';

  private readonly poNotificationService = inject(PoNotificationService);

  ngOnInit(): void {
    this.poNotificationService.error(`Não foi possível carregar o módulo "${this.moduleName}".`);
  }
}
