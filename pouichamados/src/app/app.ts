import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PoMenuItem, PoMenuModule, PoNotificationService } from '@po-ui/ng-components';
import { ProAppConfigService, ProJsToAdvplService } from '@totvs/protheus-lib-core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PoMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly proAppConfigService = inject(ProAppConfigService);
  private readonly proJsToAdvplService = inject(ProJsToAdvplService);
  private readonly poNotificationService = inject(PoNotificationService);

  // "icon" + "shortLabel" em todo item de 1º nível é o que habilita o po-menu
  // a ser recolhido/expandido (ver documentação do po-menu).
  //
  // "Sair" fecha o app e devolve o controle pro Protheus (callAppClose) - e o
  // UNICO lugar que faz isso agora (o botao "Sair" que existia dentro da
  // tabela de chamados foi removido pra nao duplicar a mesma acao com rotulo
  // diferente).
  //
  // "Agenda" usa a ponte JsToAdvpl (documentada em
  // https://tdn.totvs.com/display/public/framework/Protheus-lib-core): envia
  // cType="abrirApp"/cContent="cnsaagenda", tratado pela Static Function
  // JsToAdvpl em abreChamados.prw, que chama FwCallApp("cnsaagenda"). So
  // funciona rodando de fato dentro do Protheus (nao em ng serve isolado) e
  // exige que "cnsaagenda" esteja de fato registrado como app no Protheus -
  // nao encontrei nenhum "FwCallApp("cnsaagenda")" existente neste repo, entao
  // isso ainda precisa ser criado/confirmado por Henrique.
  //
  // "OS" (Ordem de Serviço) ainda nao existe como projeto, entao fica so com
  // aviso "em breve" ate ter um app pra abrir.
  protected menus: PoMenuItem[] = [
    { label: 'Chamados', shortLabel: 'Chamados', icon: 'an an-headset', link: '/' },
    {
      label: 'Agenda',
      shortLabel: 'Agenda',
      icon: 'an an-calendar',
      action: () => this.proJsToAdvplService.jsToAdvpl('abrirApp', 'cnsaagenda')
    },
    {
      label: 'Ordem de Serviço',
      shortLabel: 'OS',
      icon: 'an an-clipboard-text',
      action: () =>
        this.poNotificationService.warning('Ordem de Serviço em breve - ainda nao integrada a este portal.')
    },
    {
      label: 'Sair',
      shortLabel: 'Sair',
      icon: 'an an-sign-out',
      action: () => this.proAppConfigService.callAppClose(false)
    }
  ];
}
