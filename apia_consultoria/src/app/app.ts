import { ApplicationRef, Component, NgZone, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { PoMenuItem, PoMenuModule } from '@po-ui/ng-components';

import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PoMenuModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly appRef = inject(ApplicationRef);
  private readonly ngZone = inject(NgZone);

  // /login tem layout próprio (tela cheia, sem menu) - o po-menu fica
  // escondido nessa rota pra não sobrepor o formulário de login. Começa
  // como false (não true) de propósito: no boot, `router.url` ainda não
  // reflete a navegação inicial (nem o resultado do authGuard) - lendo ele
  // aqui no construtor sempre dava "true" por uma fração de segundo, ou
  // seja, o menu aparecia mesmo quando o guard ia redirecionar pra /login
  // (flash da "tela de depois do login" reportado pelo usuário). Só o
  // primeiro NavigationEnd (abaixo) reflete a URL final de verdade.
  protected readonly mostrarMenu = signal(false);

  protected menus: PoMenuItem[] = [
    { label: 'Home', shortLabel: 'Home', icon: 'an an-house', link: '/' },
    { label: 'Chamados', shortLabel: 'Chamados', icon: 'an an-headset', link: '/chamados' },
    { label: 'Agenda', shortLabel: 'Agenda', icon: 'an an-calendar', link: '/agenda' },
    { label: 'Ordem de Serviço', shortLabel: 'OS', icon: 'an an-clipboard-text', link: '/os' },
    { label: 'Sair', shortLabel: 'Sair', icon: 'an an-sign-out', action: () => this.sair() }
  ];

  constructor() {
    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        this.mostrarMenu.set(!evento.urlAfterRedirects.startsWith('/login'));
      }
    });

    // Bug relatado: dado da requisição chega, mas só aparece na tela depois
    // de um clique, quando a aba fica aberta em segundo plano por horas
    // (chamados). Causa: o navegador pausa o scheduler de renderização do
    // Angular (baseado em requestAnimationFrame) em abas não visíveis - a
    // resposta HTTP atualiza o estado, mas o ciclo de detecção de mudanças
    // que desenharia isso fica pendente até algo "acordar" o navegador (ex:
    // clique). Forçando um tick manual quando a aba volta a ficar visível
    // cobre esse caso sem depender de interação do usuário.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.ngZone.run(() => this.appRef.tick());
      }
    });
  }

  private sair(): void {
    this.authService.sair();
    this.router.navigateByUrl('/login');
  }
}
