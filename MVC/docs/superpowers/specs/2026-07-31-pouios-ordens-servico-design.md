# PO UI de Ordens de Serviço (pouios)

## Contexto

Hoje a OS (tabela SZ1, faturamento de horas de consultoria) só existe na tela
clássica do Protheus (`CNSA002.PRW`), acessada via TOTVS Smart Client. O pedido
é criar um portal PO-UI (`pouios`, pasta Angular já criada e com scaffold
padrão do Angular CLI, sem PO-UI instalado ainda) para Incluir/Alterar/
Excluir/Copiar/Listar OS, no mesmo padrão dos dois apps irmãos já existentes
neste repositório:

- `pouichamados` — CRUD de chamados (ZA1), backend em `POUICNSA001.PRW`.
- `cnsaagenda` — calendário de agendamentos (SZ6), backend embutido em
  `CNSA001.PRW` (WSRESTFUL `CNSAAGENDAMENTOS`, único caso que usa proxy FwModel
  em vez de acesso direto à tabela).

`CNSA002.PRW` (203 linhas) hoje só tem a rotina MVC clássica: `FWMBrowse`,
`ModelDef`/`ViewDef` (SZ1 master + grid SZ2 "Horas Contratadas"), `MenuDef`
(Pesquisar/Visualizar/Incluir/Alterar/Excluir/Copiar/Legenda) e duas funções
de apoio (`U_COPIAR_OS`, `U_LEGENDA`). Não tem REST nenhum ainda — será todo
novo.

## Escopo do v1

Mirror do `MenuDef` do CNSA002: **Listar, Incluir, Editar, Excluir, Copiar**.
Aprovação e faturamento (`Z1_APROVAD`, `Z1_FATURAR` e todo o fluxo de
aprovador/e-mail/IP/data) ficam fora do v1 — são regras de negócio sensíveis
que não foram confirmadas em detalhe, melhor tratar numa v2 dedicada.

### Campos no formulário Incluir/Editar

Só os campos de **negócio** da SZ1 (confirmado com o usuário) — de fora ficam
os campos de auditoria/aprovação/fatura (`Z1_ALTPOR`, `Z1_ALTEM`, `Z1_APVDOR`,
`Z1_APVMAIL`, `Z1_APVIP`, `Z1_APVDATA`, `Z1_APVHORA`, `Z1_APVTIPO`,
`Z1_HRDIGIT`, `Z1_APVMAN`, `Z1_ENVDT`, `Z1_ENVHR`, `Z1_DREMUN`, `Z1_DNREMUN`,
`Z1_CUSTOD`, `Z1_CUSTOI`, `Z1_OSACTEC`, `Z1_CHTOTVS`, `Z1_OSENVCL`,
`Z1_APROVAD`, `Z1_FATURAR`):

| Campo form          | SZ1        | Observação |
|---------------------|------------|------------|
| Cliente + Loja       | Z1_CLI, Z1_LOJA | lupa (SA1, tipo `cliente` já existe em `ComponentesRest.prw`) |
| Nome Cliente         | (derivado) | readonly, vem da lupa |
| Usuário              | Z1_USR     | texto livre |
| Módulo               | Z1_MODULO  | lupa/select — tabela genérica SX5, `X5_TABELA='Z2'` (confirmado: "Visualizar Campo - Z1_MODULO" mostra `Cons. Padrão: Z2 - Modulos Para Os's`) |
| Motivo               | Z1_MOTIV   | lupa/select — tabela genérica SX5, `X5_TABELA='Z1'` (confirmado: "Visualizar Campo - Z1_MOTIV" mostra `Cons. Padrão: Z1 - Motivos de Os's`) |
| Descrição            | Z1_SERV    | textarea livre |
| Cod Serviço + Nome   | Z1_TIPO, Z1_NMTIPO | lupa — tabela `SB1` (Produto), campos `B1_COD`/`B1_DESC` (confirmado: "Visualizar Campo - Z1_TIPO" mostra `Cons. Padrão: SB1 - Produto`) |
| Data OS              | Z1_DTOS    | date |
| OS Interna?          | Z1_INTERNO | select S/N |
| Hora Inicial/Final (+decimais) | Z1_HRINI, Z1_INI, Z1_HRFIM, Z1_FIM | |
| Hrs Tran Dec / Prev PMT? / Hrs TI Dec | Z1_TRANS, Z1_PREVIST, Z1_TOTAL | Total Horas (Z1_HRTOT) fica readonly/calculado |
| Analista + Nome      | Z1_TEC, Z1_NMTEC | lupa — reaproveita tipo `tecnico` (AA1) já existente em `ComponentesRest.prw` |
| No Proposta          | Z1_NUMPRO  | lupa — tabela `SZ3` (Cabeçalho de Propostas), campos `Z3_NUM`/`Z3_CODCLI`/`Z3_LOJA`/`Z3_DESC` (confirmado: "Visualizar Campo - Z1_NUMPRO" mostra `Cons. Padrão: SZ3 - Proposta`). Cascata por cliente igual Projeto: filtra `Z3_CODCLI`+`Z3_LOJA` pelo cliente já selecionado no formulário |
| Ped.Venda            | Z1_PV      | texto livre |
| Hr.Almoço            | Z1_ALMOCO  | |
| Projeto / Revisão / Tarefa | Z1_PROJET, Z1_REVISA, Z1_TAREFA | reaproveita lupas `projeto`/`tarefa` (AF8/AF9) já existentes, cascata Cliente → Projeto → Tarefa igual pouichamados |
| Chamado HPSD / Chamado | Z1_CHPSD, Z1_CHHDK | texto livre |
| OS desenv / Linha Pv | Z1_OSDESE, Z1_LIN | |
| Valor Hora           | Z1_VLRHR   | |

Campo `Z1_OS` (chave) fica readonly/gerado automaticamente no Incluir, igual
`idCh` em chamados.

### Dicionário confirmado (prints, 31/07/2026)

Todas as lupas do formulário estão com tabela física confirmada:
- **Módulo**: SX5 genérica, `X5_TABELA='Z2'`.
- **Motivo**: SX5 genérica, `X5_TABELA='Z1'`.
- **Cod Serviço**: `SB1` (Produto), `B1_COD`/`B1_DESC`.
- **Proposta**: `SZ3` (Cabeçalho de Propostas), `Z3_NUM`/`Z3_CODCLI`/
  `Z3_LOJA`/`Z3_DESC`.

Sem pendências de dicionário para o v1.

### Fora de escopo do v1

- Aprovar / Faturar e todo o rastro de auditoria associado.
- Grid SZ2 "Horas Contratadas" (saldo de horas contratadas por cliente) — é
  uma consulta de apoio, não um dado editável por OS; fica para depois se for
  pedido.

## Arquitetura

### Backend (Protheus)

Novo arquivo `POUICNSA002.PRW`, mesmo estilo de `POUICNSA001.PRW` (WSRESTFUL
lendo/gravando SZ1 direto via `BeginSql`/`RecLock`, sem proxy FwModel):

- `WSRESTFUL CNSAOS` (GET) — listagem/visualização. Filtros: `pagina`,
  `tamanho`, `os` (visualizar por chave), `texto` (busca livre), `cliente`.
  Devolve os 5 status de legenda do `AddLegend` do CNSA002 (Aprovada e
  Faturada / Faturada sem Aprovação / Aprovada / Aguardando Aprovação /
  Negada) como um campo derivado `status`, calculado a partir de
  `Z1_APROVAD`/`Z1_FATURAR` (mesmo se esses dois campos não aparecerem no
  formulário, continuam existindo na SZ1 e alimentando a legenda da lista).
- `WSRESTFUL CNSAOSINCLUIR` (POST) — cria OS. `Z1_APROVAD`/`Z1_FATURAR` fixos
  `"N"` no ADVPL (não expostos ao front).
- `WSRESTFUL CNSAOSALTERAR` (POST) — altera parcial (só o que vier
  preenchido, mesmo padrão de `CNSA_ALTERAR`).
- `WSRESTFUL CNSAOSEXCLUIR` (POST) — exclui.
- `WSRESTFUL CNSAOSCOPIAR` (POST) — replica a lógica que já existe em
  `U_COPIAR_OS` (CNSA002.PRW): novo `Z1_OS` via `GetSXENum`, zera
  `Z1_APROVAD`/`Z1_FATURAR`/campos de aprovação.

Lupas: estende `ComponentesRest.prw` (`WSRESTFUL CNSACOMPONENTES`) com 4 novos
valores de `tipo`:
- `modulo` — SX5 `X5_TABELA='Z2'`.
- `motivo` — SX5 `X5_TABELA='Z1'`.
- `servico` — `SB1`, filtro por `B1_COD`/`B1_DESC` (like `%...%`).
- `proposta` — `SZ3`, cascata por cliente (exige `cliente`/`lojaCliente` na
  querystring, mesmo padrão de `tipo=projeto`).

`cliente`/`tecnico`/`projeto`/`tarefa` são reaproveitados sem mudança
nenhuma.

### Frontend (Angular, `pouios`)

Instala PO-UI na mesma versão do `pouichamados` (`@po-ui/ng-components`
`^21.23.0`, `@po-ui/ng-templates`, `@po-ui/style`, `@totvs/po-theme`,
`@totvs/protheus-lib-core`, `zone.js`).

Estrutura espelha `pouichamados`:
- `core/models/os.model.ts` — `Os`, `FiltroOs`, `OsPagina`, payloads de
  incluir/alterar/copiar/excluir.
- `core/services/os.service.ts` — `listar`, `buscarPorId`, `incluir`,
  `alterar`, `excluir`, `copiar`.
- `features/os-lista/` — componente único: `po-page-dynamic-table` (lista +
  busca) + `po-modal` com formulário unificado Incluir/Editar (mesmo padrão
  "Editar = Incluir" do `chamados-lista`).
- `shared/lupa-modal` — copiado/adaptado de `pouichamados`, `TipoLupa`
  estendido com os novos tipos.

Ações de página: Novo, Excluir, Copiar (sem Aprovar/Faturar no v1). Legenda
da lista usa `type:'label'` com as 5 cores/nomes do `AddLegend`.

## Testes

Mesmo padrão do `pouichamados` — sem suíte automatizada real (só o spec
default do Angular CLI); validação manual via `ng serve` + REST publicado no
APPServer, testado com curl/Postman antes de plugar no front.
