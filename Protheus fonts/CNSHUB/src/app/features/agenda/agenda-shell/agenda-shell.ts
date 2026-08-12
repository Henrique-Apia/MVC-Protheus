import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/**
 * Casca da secao Agenda - antes (cnsaagenda) essas 6 "abas" eram um signal
 * (secaoAtiva) trocando conteudo num @switch dentro de um unico componente,
 * sem rotas de verdade. Aqui cada aba e uma rota filha real (deep-link
 * funciona, back-button funciona) - ver plano CNSHUB, secao Agenda.
 */
@Component({
  selector: 'app-agenda-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './agenda-shell.html',
  styleUrl: './agenda-shell.css'
})
export class AgendaShellComponent {}
