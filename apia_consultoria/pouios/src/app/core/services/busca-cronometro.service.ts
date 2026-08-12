import { Injectable, signal } from '@angular/core';

/**
 * Cronômetro visível "Buscando... Xs" pra qualquer busca real na tela de OS
 * (carga inicial, botão "Buscar" do período, "Carregar mais resultados",
 * busca avançada). Alimentado pelo OsRestAdapterInterceptor - contador de
 * requisições em voo, não um único boolean, porque o po-page-dynamic-table
 * pode disparar mais de uma chamada quase junto (ex: paginação).
 */
@Injectable({ providedIn: 'root' })
export class BuscaCronometroService {
  private requisicoesEmVoo = 0;
  private inicioBusca = 0;
  private intervalo: ReturnType<typeof setInterval> | null = null;

  readonly buscando = signal(false);
  readonly segundos = signal(0);

  iniciar(): void {
    this.requisicoesEmVoo++;
    if (this.requisicoesEmVoo > 1) {
      return;
    }
    this.inicioBusca = Date.now();
    this.segundos.set(0);
    this.buscando.set(true);
    this.intervalo = setInterval(() => {
      this.segundos.set(Math.floor((Date.now() - this.inicioBusca) / 1000));
    }, 200);
  }

  parar(): void {
    this.requisicoesEmVoo = Math.max(0, this.requisicoesEmVoo - 1);
    if (this.requisicoesEmVoo > 0) {
      return;
    }
    if (this.intervalo !== null) {
      clearInterval(this.intervalo);
      this.intervalo = null;
    }
    this.buscando.set(false);
  }
}
