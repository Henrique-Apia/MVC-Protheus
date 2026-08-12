import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ComponenteResposta, TipoLupa } from '../models/componente.model';

const COMPONENTES_URL = 'http://10.0.0.3:3624/rest/CNSACOMPONENTES';

/**
 * Consultas de apoio ("lupas") usadas nos campos Cliente/Consultor/Projeto/
 * Tarefa da tela de Incluir/Editar chamado - espelha o WSRESTFUL
 * CNSACOMPONENTES (ComponentesRest.prw).
 */
@Injectable({ providedIn: 'root' })
export class ComponenteService {
  private readonly http = inject(HttpClient);

  /**
   * @param tipo tecnico | cliente | projeto | tarefa
   * @param filtro texto livre (código ou nome/descrição) - vazio traz todos
   * @param projeto OBRIGATÓRIO quando tipo === 'tarefa' (cascata Projeto -> Tarefa) - ignorado nos demais tipos
   * @param cliente OBRIGATÓRIO quando tipo === 'projeto' (cascata Cliente -> Projeto, só mostra ativos) - ignorado nos demais tipos
   * @param lojaCliente usado junto com `cliente` quando tipo === 'projeto' (default "01" no servidor se vier vazio)
   */
  buscar(tipo: TipoLupa, filtro: string, projeto?: string, cliente?: string, lojaCliente?: string): Observable<ComponenteResposta> {
    let url = `${COMPONENTES_URL}?tipo=${encodeURIComponent(tipo)}&filtro=${encodeURIComponent(filtro ?? '')}`;
    if (tipo === 'tarefa' && projeto) {
      url += `&projeto=${encodeURIComponent(projeto)}`;
    }
    if (tipo === 'projeto') {
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
