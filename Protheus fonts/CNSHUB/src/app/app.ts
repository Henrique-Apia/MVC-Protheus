import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PoMenuItem, PoMenuModule } from '@po-ui/ng-components';
import { ProAppConfigService } from '@totvs/protheus-lib-core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PoMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly proAppConfigService = inject(ProAppConfigService);

  // "icon" + "shortLabel" em todo item de 1º nível é o que habilita o po-menu
  // a ser recolhido/expandido (ver documentação do po-menu).
  protected menus: PoMenuItem[] = [
    { label: 'Início', shortLabel: 'Início', icon: 'an an-house', link: '/' },
    { label: 'Chamados', shortLabel: 'Chamados', icon: 'an an-headset', link: '/chamados' },
    { label: 'Agenda', shortLabel: 'Agenda', icon: 'an an-calendar', link: '/agenda' },
    { label: 'Ordem de Serviço', shortLabel: 'OS', icon: 'an an-clipboard-text', link: '/os' },
    {
      label: 'Sair',
      shortLabel: 'Sair',
      icon: 'an an-sign-out',
      action: () => this.proAppConfigService.callAppClose(false)
    }
  ];
}
