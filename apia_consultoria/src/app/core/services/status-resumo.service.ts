import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';

const PROTHEUS_REST_BASE = 'http://10.0.0.3:3624';

export interface ContagemDoMes {
  ano: number;
  mes: number;
  chamados: number;
  os: number;
}

interface PaginaRest {
  total: number;
}

/**
 * Totais de Chamados e OS de UM mês só, pro gráfico da Home. CNSACHAMADOS e
 * CNSAOS agora aceitam `ano`+`mes` (filtro no backend, ver POUICNSA001/002.PRW)
 * - busca só `total` (tamanho=1, não precisa dos registros em si) e cacheia
 * por mês/ano; trocar de mês só busca de novo se ainda não tiver em cache.
 */
@Injectable({ providedIn: 'root' })
export class StatusResumoService {
  private readonly http = inject(HttpClient);
  private readonly cachePorMes = new Map<string, Observable<ContagemDoMes>>();

  limparCache(): void {
    this.cachePorMes.clear();
  }

  contarDoMes(ano: number, mes: number): Observable<ContagemDoMes> {
    const chave = `${ano}-${mes}`;
    if (!this.cachePorMes.has(chave)) {
      this.cachePorMes.set(
        chave,
        forkJoin({
          chamados: this.http.get<PaginaRest>(`${PROTHEUS_REST_BASE}/rest/CNSACHAMADOS?ano=${ano}&mes=${mes}&pagina=1&tamanho=1`),
          os: this.http.get<PaginaRest>(`${PROTHEUS_REST_BASE}/rest/CNSAOS?ano=${ano}&mes=${mes}&pagina=1&tamanho=1`)
        }).pipe(
          map(({ chamados, os }) => ({ ano, mes, chamados: chamados.total, os: os.total })),
          shareReplay(1)
        )
      );
    }
    return this.cachePorMes.get(chave)!;
  }
}
