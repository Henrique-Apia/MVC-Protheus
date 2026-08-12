// Recebe e trata instrucoes vindas do AdvPL (oWebChannel:AdvPLToJS) - ver
// Static Function JsToAdvpl em abreChamados.prw e a documentacao oficial:
// https://tdn.totvs.com/display/public/framework/Protheus-lib-core
//
// Hoje este app so ENVIA comandos pro AdvPL (abrir outro app via 'abrirApp'),
// nao espera nenhum retorno - mas o arquivo precisa existir em
// assets/preload/advpltojs.js pra integracao JsToAdvpl funcionar (pre-requisito
// documentado pelo TDN), mesmo que so com um no-op.
function (codeType, content) {
  console.log('[advpltojs] Mensagem recebida do Protheus:', codeType, content);
}
