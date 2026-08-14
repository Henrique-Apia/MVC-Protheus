# CNSA002 - Endpoints REST via FWModel (TLPP @Post/@Put/@Delete)

## Contexto

`CNSA002.PRW` (Fontes cnshub) já tem `ModelDef`/`ViewDef`/`MenuDef` completo (MVC clássico, model `FCNSA002`, tabela mestre SZ1 "Ordem de Serviço", grid SZ2DETAIL "Horas Contratadas" relacionado). Separadamente, `POUICNSA002.PRW` (Codigos apia intraweb henrique) expõe REST pro portal PO-UI (pouios) via 5 `WSRESTFUL` (CNSAOS listar, CNSAOSINCLUIR, CNSAOSALTERAR, CNSAOSEXCLUIR, CNSAOSCOPIAR), cada um lendo/gravando SZ1 direto via `RecLock`/`DbSeek`, sem usar o FWModel do CNSA002.PRW - decisão documentada no topo do arquivo ("mais simples, sem depender de host/porta/autenticação entre instâncias").

Motivação: estudo de `wsportlsb.tlpp` (API REST TLPP legada da SBACEM) mostrou o padrão de anotação `@Post`/rota + `User Function`, e a instalação das skills `totvs/engpro-advpl-tlpp-skills` trouxe `tlpp-rest-endpoint-generator`/`fwrest-client-generator`/`mvc-generator` como ferramentas pra gerar esse estilo corretamente. Pergunta original do usuário: usar TLPP com `@Get`/`@Post` pra facilitar uso na intraweb. Decisão tomada durante o brainstorm: em vez de reescrever o `POUICNSA002.PRW` (que fica de lado por agora), adaptar o próprio `CNSA002.PRW` pra ganhar os novos endpoints usando o FWModel que já existe nele.

## Escopo

**Dentro**: adicionar a `CNSA002.PRW` 3 funções TLPP anotadas (Incluir/Alterar/Excluir de uma OS - SZ1), usando `FWLoadModel("CNSA002")` (reaproveita o `ModelDef` existente). Só cabeçalho SZ1 - grid SZ2 (Horas Contratadas) fica fora deste v1. Mover as validações de campo obrigatório (hoje feitas manualmente com `If Empty(...)` dentro do `POUICNSA002.PRW`) para dentro de `FSZ1PosValid` (hoje stub, só `Return .T.`), pra que a validação passe a valer tanto na tela clássica quanto no REST novo.

**Fora**: `POUICNSA002.PRW` e o app Angular `pouios` não são tocados nesta rodada - a integração real da intraweb com estes novos endpoints é um passo futuro, fora deste spec. Listagem (`CNSAOS` GET, busca paginada com JOINs/campos derivados) e Cópia (`CNSAOSCOPIAR`) não entram - não mapeiam bem no padrão FWModel de operação em 1 registro por vez, continuam como estão hoje (WSRESTFUL, consulta/gravação direta) se algum dia forem portados. Grid SZ2 fica para uma iteração futura.

## Arquitetura

`CNSA002.PRW` ganha `#INCLUDE 'tlpp-rest.th'` no topo, ao lado dos includes já existentes (`PROTHEUS.CH`, `RWMAKE.CH`, `TOPCONN.CH`, `TOTVS.CH`, `FWMBROWSE.CH`, `FWMVCDEF.CH`, `COLORS.CH`). As 3 novas funções são adicionadas no fim do arquivo, sem alterar `MenuDef`/`ViewDef`/`ModelDef`/`COPIAR_OS`/`LEGENDA` existentes - exceto a mudança pontual em `FSZ1PosValid` (ver abaixo).

### Rotas

| Verbo | Rota | Ação |
|---|---|---|
| `@Post` | `/cnsaos` | Incluir nova OS |
| `@Put` | `/cnsaos/{os}` | Alterar OS existente (parcial - só grava campo que veio no body) |
| `@Delete` | `/cnsaos/{os}` | Excluir OS |

**Assunção a validar na compilação**: o path `/cnsaos` (minúsculo, TLPP) coincide com o recurso lógico já usado pelo `WSRESTFUL CNSAOS` (GET, maiúsculo, `POUICNSA002.PRW`) em outro arquivo fonte. Verbos diferentes (POST/PUT/DELETE aqui vs GET lá) devem coexistir sem conflito no dispatcher REST do Protheus, mas isso não está documentado - primeira compilação/deploy precisa confirmar que não há erro de rota duplicada.

### Fluxo FWModel por operação

Padrão comum: instância de modelo, seta operação, ativa, popula, valida, grava, desativa. A diferença entre Incluir e Alterar/Excluir é que UPDATE/DELETE exigem a tabela **já posicionada no registro certo antes de ativar o model** - o FWModel carrega os valores da posição atual da workarea, não busca por conta própria.

**Incluir (`@Post /cnsaos`)**:
1. `oModel := FWLoadModel("CNSA002")`
2. `oModel:SetOperation(MODEL_OPERATION_INSERT)`
3. `oModel:Activate()`
4. `oModel:GetModel("SZ1MASTER"):SetValue("Z1_XXX", valor)` para cada campo do body (codCliente→Z1_CLI, lojaCliente→Z1_LOJA, usuario→Z1_USR, modulo→Z1_MODULO, motivo→Z1_MOTIV, descricao→Z1_SERV, codServico→Z1_TIPO, dataOs→Z1_DTOS, horaInicialDec→Z1_INI, horaFinalDec→Z1_FIM, horasTiDec→Z1_TOTAL, codAnalista→Z1_TEC, + opcionais: dtDigitacao→Z1_DTDIGIT, osInterna→Z1_INTERNO, horasTranDec→Z1_TRANS, prevPmt→Z1_PREVIST, numProposta→Z1_NUMPRO, pedVenda→Z1_PV, hrAlmoco→Z1_ALMOCO, projeto→Z1_PROJET, revisao→Z1_REVISA, tarefa→Z1_TAREFA, chamadoHpsd→Z1_CHPSD, chamado→Z1_CHHDK, osDesenv→Z1_OSDESE, linhaPv→Z1_LIN, valorHora→Z1_VLRHR). `Z1_OS` gerado via `GetSxeNum`/`ConfirmSX8` (mesmo padrão já usado em `U_COPIAR_OS` e no `POUICNSA002.PRW` atual). `Z1_APROVAD`/`Z1_FATURAR` fixos "N".
5. `oModel:VldData()` - se falhar, junta `oModel:GetErrorMessage()` em uma string e retorna 400.
6. `oModel:CommitData()` - se falhar, mesma coisa, 500.
7. `oModel:DeActivate()`.

**Alterar (`@Put /cnsaos/{os}`)**:
1. `DbSelectArea("SZ1")`; `SZ1->(DbSetOrder(1))`; `DbSeek(xFilial("SZ1")+cOs)` - se não achar, 404 direto, nem chega a carregar o model.
2. `oModel := FWLoadModel("CNSA002")`; `SetOperation(MODEL_OPERATION_UPDATE)`; `Activate()` (carrega os valores atuais da SZ1 posicionada).
3. Só `SetValue` nos campos que vieram preenchidos no body (mesma lógica parcial do `CNSA_OS_ALTERAR` atual).
4. `VldData()` → `CommitData()` → `DeActivate()`, mesmos códigos de erro do Incluir.

**Excluir (`@Delete /cnsaos/{os}`)**:
1. Mesma busca/404 do Alterar.
2. `oModel := FWLoadModel("CNSA002")`; `SetOperation(MODEL_OPERATION_DELETE)`; `Activate()`.
3. `VldData()` (aciona `FSZ1CAN` - "pode excluir?") → `CommitData()` → `DeActivate()`.

### Validação centralizada (`FSZ1PosValid`)

Hoje: `Static Function FSZ1PosValid(p_oField, p_sAcao, p_sCampo, p_vValor)` só `Return .T.` - stub sem lógica. Passa a validar campo a campo (obrigatoriedade), espelhando os `If Empty(...)` que hoje só existem soltos dentro do `POUICNSA002.PRW`: Z1_CLI, Z1_LOJA, Z1_USR, Z1_MODULO, Z1_MOTIV, Z1_SERV, Z1_TIPO, Z1_DTOS, Z1_INI, Z1_FIM, Z1_TOTAL, Z1_TEC obrigatórios. Isso passa a valer tanto pra tela clássica (`CNSA002` MVC) quanto pro REST novo, sem duplicar a regra em dois lugares.

## Contrato JSON

**Sucesso** (mesmo formato nos 3, `sucesso`/`os`/`mensagem` - mesmo espírito do contrato já usado no pouios):
```json
{"sucesso": true, "os": "000123", "mensagem": "OS incluida com sucesso."}
```
Status: 201 (incluir), 200 (alterar/excluir).

**Erro de validação** (VldData falhou, ou OS não encontrada, ou body inválido):
```json
{"sucesso": false, "erro": "Informe o cliente e o site do cliente."}
```
Status: 400 (campo faltando/inválido), 404 (OS não encontrada no Alterar/Excluir).

**Erro inesperado** (exceção não tratada - `Begin Sequence`/`Recover` ou `Try`/`Catch` do TLPP):
```json
{"sucesso": false, "erro": "<descrição da exceção>"}
```
Status: 500.

Mensagem de erro do `oModel:GetErrorMessage()` (pode vir array de várias falhas de campo) é concatenada em uma string única separada por `"; "` pra manter o contrato simples de 1 campo `erro`, igual ao resto do módulo CNSA.

## Fora de escopo / riscos conhecidos

- Grid SZ2 (Horas Contratadas) não entra no payload dos 3 endpoints - só cabeçalho SZ1.
- `POUICNSA002.PRW` e o Angular `pouios` continuam exatamente como estão - nenhuma integração de fato com os novos endpoints nesta rodada.
- Sem checagem de autenticação/token nos 3 novos endpoints (mesma situação de tudo que já existe no módulo CNSA hoje, incluindo `wsportlsb.tlpp` e `POUICNSA002.PRW`) - não é regressão, mas também não é solução; considerar como item futuro separado se os endpoints forem expostos externamente.
- Colisão de path `/cnsaos` entre fonte novo (`CNSA002.PRW`, TLPP annotation) e fonte existente (`POUICNSA002.PRW`, WSRESTFUL) é uma assunção não confirmada - validar na primeira compilação/deploy.
- `Z1_OS` presume grupo de numeração configurado no SX5 pra `GetSxeNum`/`ConfirmSX8` funcionar (mesma assunção já registrada no `POUICNSA002.PRW` atual, ainda pendente de confirmação por Henrique).
