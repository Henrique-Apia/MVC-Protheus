import { Injectable, computed, inject, signal } from '@angular/core';

import { AgendaSemanaService } from './agenda-semana.service';

const STORAGE_KEY = 'cns-shell-auth-token';
const USUARIO_KEY = 'cns-shell-auth-usuario';

/**
 * Sessão de login contra o REST nativo do Protheus. O WSRESTFUL do Protheus
 * já valida usuário/senha real via Basic Auth (confirmado via curl direto -
 * ver docs/superpowers/specs) - não existe endpoint de login separado, o
 * "login" aqui é so testar as credenciais num REST real e guardar o header
 * Basic pronto pra usar em toda chamada seguinte.
 *
 * sessionStorage (nao localStorage) de proposito: credencial some ao fechar
 * a aba, reduz a janela de exposição do usuário/senha guardado em base64
 * (reversível, não é criptografia).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly agendaSemanaService = inject(AgendaSemanaService);

  private readonly tokenSignal = signal<string | null>(sessionStorage.getItem(STORAGE_KEY));
  private readonly usuarioSignal = signal<string | null>(sessionStorage.getItem(USUARIO_KEY));

  readonly autenticado = computed(() => this.tokenSignal() !== null);
  readonly usuario = this.usuarioSignal.asReadonly();

  get basicAuthHeader(): string | null {
    const token = this.tokenSignal();
    return token ? `Basic ${token}` : null;
  }

  definirCredenciais(usuario: string, senha: string): void {
    const token = btoa(`${usuario}:${senha}`);
    this.tokenSignal.set(token);
    this.usuarioSignal.set(usuario);
    sessionStorage.setItem(STORAGE_KEY, token);
    sessionStorage.setItem(USUARIO_KEY, usuario);
    this.agendaSemanaService.limparCache();
  }

  sair(): void {
    this.tokenSignal.set(null);
    this.usuarioSignal.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(USUARIO_KEY);
  }
}
