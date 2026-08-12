import { Component, inject, signal } from '@angular/core';
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

  // /login tem layout próprio (tela cheia, sem menu) - o po-menu fica
  // escondido nessa rota pra não sobrepor o formulário de login.
  protected readonly mostrarMenu = signal(!this.router.url.startsWith('/login'));

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
  }

  private sair(): void {
    this.authService.sair();
    this.router.navigateByUrl('/login');
  }
}
