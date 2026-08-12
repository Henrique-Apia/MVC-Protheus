import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PoButtonModule, PoPageModule } from '@po-ui/ng-components';

/**
 * No cnsaagenda original, "Buscar Novos Itens" existia pra limpar um cache
 * em memoria (Map por mes) mantido dentro do unico componente monolitico e
 * forcar um novo fetch. Com rotas de verdade (ver plano CNSHUB), cada
 * navegacao pra "Agendas" instancia um AgendaCalendarioComponent NOVO, com
 * cache vazio - o problema que essa secao resolvia deixou de existir, entao
 * ela virou so um atalho de volta pro calendario (sem logica pra duplicar).
 */
@Component({
  selector: 'app-agenda-buscar-novos',
  imports: [PoPageModule, PoButtonModule, RouterLink],
  templateUrl: './agenda-buscar-novos.html'
})
export class AgendaBuscarNovosComponent {}
