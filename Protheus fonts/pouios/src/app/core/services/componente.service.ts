import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ComponenteResposta, TipoLupa } from '../models/componente.model';

const COMPONENTES_URL = '/rest/CNSACOMPONENTES';

/**
 * Consultas de apoio ("lupas") usadas nos campos de consulta da tela de
 * Incluir/Editar OS - espelha o WSRESTFUL CNSACOMPONENTES (ComponentesRest.prw),
 * mesmo endpoint já usado pelo pouichamados, estendido com modulo/motivo/
 * servico/proposta.
 */
@Injectable({ providedIn: 'root' })
export class ComponenteService {
  private readonly http = inject(HttpClient);

  /**
   * @param tipo tecnico | cliente | projeto | tarefa | modulo | motivo | servico | proposta
   * @param filtro texto livre (código ou nome/descrição) - vazio traz todos
   * @param projeto OBRIGATÓRIO quando tipo === 'tarefa' (cascata Projeto -> Tarefa) - ignorado nos demais tipos
   * @param cliente OBRIGATÓRIO quando tipo === 'projeto' ou 'proposta' (cascata Cliente -> Projeto/Proposta) - ignorado nos demais tipos
   * @param lojaCliente usado junto com `cliente` quando tipo === 'projeto'/'proposta' (default "01" no servidor se vier vazio)
   */
  buscar(tipo: TipoLupa, filtro: string, projeto?: string, cliente?: string, lojaCliente?: string): Observable<ComponenteResposta> {
    let url = `${COMPONENTES_URL}?tipo=${encodeURIComponent(tipo)}&filtro=${encodeURIComponent(filtro ?? '')}`;
    if (tipo === 'tarefa' && projeto) {
      url += `&projeto=${encodeURIComponent(projeto)}`;
    }
    if (tipo === 'projeto' || tipo === 'proposta') {
      if (cliente) {
        url += `&cliente=${encodeURIComponent(cliente)}`;
      }
      if (lojaCliente) {
        url += `&lojaCliente=${encodeURIComponent(lojaCliente)}`;
      }
    }
    return this.http.get<ComponenteResposta>(url);
  }
}
