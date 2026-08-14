import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { PoPageLogin, PoPageLoginLiterals, PoPageLoginModule } from '@po-ui/ng-templates';
import { PoNotificationService } from '@po-ui/ng-components';

import { AuthService } from '../../core/services/auth.service';

/**
 * Login contra o REST nativo do Protheus - nao existe endpoint de login
 * separado (confirmado via curl direto: Basic Auth com usuario/senha real
 * do Protheus ja funciona em qualquer WSRESTFUL existente, ex CNSACHAMADOS).
 * "Entrar" so testa as credenciais numa chamada real; se voltar autorizado,
 * guarda o header pronto (AuthService) pro resto da sessao.
 */
@Component({
  selector: 'app-login',
  imports: [PoPageLoginModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(PoNotificationService);

  protected readonly carregando = signal(false);

  constructor() {
    // Sem isso, apertar "Voltar" no navegador até a tela de login (sem
    // clicar em "Sair") não invalida a sessão - o token continua válido em
    // sessionStorage, então apertar "Avançar" depois passa direto pelo
    // authGuard sem pedir login de novo. Encerrando a sessão sempre que essa
    // tela é montada (voltar, "Sair", ou acesso direto) torna o
    // reautenticar obrigatório em todos os casos.
    this.authService.sair();
  }

  protected readonly literais: PoPageLoginLiterals = {
    loginLabel: 'Usuário',
    loginPlaceholder: 'Insira seu usuário'
  };

  protected entrar(dados: PoPageLogin): void {
    const usuario = dados.login.trim();
    const senha = dados.password;

    this.carregando.set(true);

    const token = btoa(`${usuario}:${senha}`);

    // URL absoluta - sem proxy reverso em producao, mesmo padrao do resto do app.
    this.http.get('http://10.0.0.3:3624/rest/CNSACHAMADOS?pagina=1&tamanho=1', { headers: { Authorization: `Basic ${token}` } }).subscribe({
      next: () => {
        this.authService.definirCredenciais(usuario, senha);
        this.carregando.set(false);
        this.router.navigateByUrl('/');
      },
      error: () => {
        this.notificationService.error('Usuário ou senha inválidos.');
        this.carregando.set(false);
      }
    });
  }
}
