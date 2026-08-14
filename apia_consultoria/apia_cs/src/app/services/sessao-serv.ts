import { Injectable } from '@angular/core';

/**
 * Contexto de empresa/filial do usuário logado. Hoje fixo em '01'/'01'; quando
 * a rotina de login for implementada, estes valores devem passar a ser
 * preenchidos a partir da autenticação do usuário em vez de inicializados aqui.
 */
@Injectable({
  providedIn: 'root'
})
export class SessaoServ {
  empresa = '01';
  filial = '01';
}
