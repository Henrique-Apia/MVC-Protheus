# Fix: race condition no Z6_SEQ + validação de sobreposição de horário (CNSA_AGENDAR)

## Contexto

`POUICNSA001.PRW` expõe `CNSACHAMADOSAGENDAR`, chamado pelo front `pouichamados`
(`chamados-lista.ts:confirmarAgendar()`) para criar agendamentos (SZ6) vinculados
a um ou mais chamados. Quando o usuário seleciona vários chamados de uma vez pra
agendar com o mesmo técnico/data/horário, o front dispara um POST por chamado
**em paralelo** via `forkJoin` (mesmo técnico, mesma data, N requisições
concorrentes).

No backend, `CNSA_PROXSEQ_SZ6(cTecnico, dData)` calcula o próximo `Z6_SEQ` via
`SELECT MAX(Z6_SEQ) + 1` e devolve pro chamador, que em seguida faz
`RecLock("SZ6", .T.)` e grava. Não há lock entre o SELECT e o INSERT. Quando
duas requisições concorrentes calculam o mesmo `MAX` antes de qualquer uma
gravar, ambas tentam inserir o mesmo `Z6_SEQ` para o mesmo técnico+data.

**Confirmado pelo usuário**: SZ6 tem índice único em FILIAL+TECNICO+DTAGE+SEQ
no banco, e esse erro de chave duplicada já foi observado em produção ao
agendar múltiplos chamados de uma vez para o mesmo técnico/dia.

**Atualização (mesmo dia)**: o usuário também pediu uma segunda regra pra essa
mesma função - o mesmo técnico não pode ter dois agendamentos com horário
sobreposto no mesmo dia (outros técnicos podem ter o mesmo horário à vontade -
a regra é só por técnico; coparticipação de vários técnicos no mesmo
chamado/horário já funciona hoje sem mudança nenhuma, repetindo a chamada de
Agendar uma vez por técnico). Como usa a mesma função, o mesmo loop por dia e o
mesmo lock por técnico, foi incorporada neste mesmo design em vez de um spec
separado.

**Nota**: `CNSA_PROXSEQ_SZ6` já teve a assinatura corrigida durante uma sessão
de debug anterior (recebia uma string `AAAAMMDD`, comparava contra `Z6_DTAGE`
que é campo Data de verdade - trocado pra receber Data diretamente). Esse fix
já está em produção, não faz mais parte do escopo deste spec.

## Problema secundário descoberto durante a análise

`CNSA_AGENDAR` grava um agendamento por dia num loop (`dDataIni..dDataFim`)
dentro de um único `Begin Sequence / Recover` que envolve a função inteira. Se
um erro (de chave duplicada ou qualquer outro) ocorre em qualquer iteração do
loop, a função inteira aborta e retorna `{500, erro}` — mas os dias já gravados
com sucesso *antes* da falha permanecem no banco (RecLock/MsUnlock committa
linha a linha, não há transação agrupando o loop inteiro). O chamador recebe
"falha" mesmo tendo sido criados alguns registros.

## Design

### 1. Lock por técnico (defesa principal contra a race do Z6_SEQ E contra a
   validação de sobreposição correr em paralelo)

Lock advisório (`LockByName`/`UnLockByName`) chaveado por `"CNSA_AGENDA_" +
cCodTecnico`, adquirido uma vez no início de `CNSA_AGENDAR` e liberado ao
final (cobrindo o loop inteiro de dias, não por dia individual).

- **Escopo escolhido**: por técnico, não por técnico+data. Mais simples de
  implementar (um acquire/release por requisição, não por iteração) e
  suficiente pro volume real de uso do sistema. Trade-off aceito: duas
  requisições para o mesmo técnico em datas diferentes serializam entre si
  desnecessariamente — considerado aceitável.
- Esse mesmo lock também é o que torna a checagem de sobreposição (seção 2)
  segura sob concorrência: sem ele, duas requisições paralelas pro mesmo
  técnico poderiam checar sobreposição ao mesmo tempo, nenhuma ver o
  agendamento da outra ainda não commitado, e ambas conseguirem gravar
  horários sobrepostos (mesmo tipo de corrida do Z6_SEQ, agora pra regra de
  negócio em vez de chave técnica).
- Se o lock não for obtido dentro do timeout, retorna `{423, erro}` (Locked)
  pedindo pro usuário tentar de novo, em vez de deixar a race acontecer.
- **Assunção a validar**: assinatura exata de `LockByName(cLockName,
  lHasLock, lServerLock, nMaxTime)` / `UnLockByName(cLockName,
  lServerLock)` pode variar por build do TOTVS. Não há como validar sem
  rodar no ambiente real — sinalizar no código com comentário e testar em
  homologação antes de produção.

### 2. Validação de sobreposição de horário (por dia, dentro do lock)

Pra cada dia do loop, ANTES de calcular sequência/gravar: consulta SZ6 do
mesmo técnico na mesma data e verifica se o novo intervalo `[horaInicio,
horaFim)` sobrepõe algum intervalo já existente. Fórmula padrão de
sobreposição de intervalos (não basta comparar só os inícios):

```
existe conflito SE existente.Z6_HMINI < novo.horaFim
              E  existente.Z6_HMFIM > novo.horaInicio
```

(comparação de string funciona porque `HH:MM` é zero-padded e comparável
lexicograficamente, mesmo formato já usado hoje pra gravar Z6_HMINI/Z6_HMFIM).

- Se houver conflito: essa data específica NÃO é criada, entra na lista de
  `falhas` da resposta incluindo os horários já ocupados que geraram o
  conflito (pedido explícito do usuário - "avisa que já tem agendado e
  mostra os horários"). O loop **continua** pras próximas datas do
  intervalo (mesmo comportamento de falha parcial da seção 3).
- Escopo do conflito: só entre agendamentos do **mesmo técnico**. Técnicos
  diferentes podem ter o mesmo horário sem problema (inclusive de propósito,
  pra coparticipação no mesmo chamado - fluxo já suportado hoje chamando
  Agendar uma vez por técnico, sem mudança necessária).
- Dentro do mesmo lote (multi-select, N requisições paralelas pro mesmo
  técnico): coberto automaticamente pelo lock da seção 1 - a segunda
  requisição só entra na seção crítica depois que a primeira já commitou (ou
  liberou o lock), então já vê o agendamento recém-criado na consulta.

### 3. Retry local por dia (rede de segurança) + isolamento de falha por iteração

Cada iteração do loop de dias ganha seu **próprio** `Begin Sequence /
Recover` (não depende só do lock, nem do Recover externo da função). Ordem
dentro de cada dia: (a) checa sobreposição (seção 2) - se conflito, registra
falha e pula pro próximo dia; (b) senão, tenta `CNSA_PROXSEQ_SZ6` + `RecLock`
+ grava:

1. Tenta `CNSA_PROXSEQ_SZ6` + `RecLock` + grava.
2. Se falhar com erro compatível com chave duplicada (heurística: descrição
   do erro contém código de constraint violation, ex. `"ORA-00001"`),
   recalcula a sequência e tenta de novo — até 3 tentativas.
3. Esgotadas as tentativas, ou erro de outra natureza: essa data específica
   entra na lista de falhas, mas o loop **continua** para as próximas datas
   (não aborta a função inteira).
4. Resposta final passa a poder ser parcial: `quantidade` (dias criados com
   sucesso) e uma lista (`falhas`, novo campo) com as datas que não foram
   criadas e o motivo — hoje a resposta só tem sucesso binário via HTTP
   status; isso muda o contrato de resposta de `CNSA_AGENDAR` (ver "Contrato
   de resposta" abaixo).

### 4. Logging

`ConOut` quando:
- o lock não é obtido (timeout) — inclui técnico e data;
- o retry esgota as 3 tentativas pra um dia específico — inclui técnico,
  data e a descrição do erro real.

Conflito de sobreposição (seção 2) NÃO precisa de `ConOut` - não é uma falha
inesperada, é uma regra de negócio normal sendo aplicada; já fica visível pro
usuário via `falhas` na resposta.

### Contrato de resposta (mudança)

Hoje, sucesso é tudo-ou-nada: `{200, {sucesso:true, quantidade:N,
mensagem:"..."}}` ou `{500, {erro:"..."}}`.

Com o retry por dia isolado e a validação de sobreposição, uma requisição
pode ter sucesso parcial (ex.: 5 de 7 dias criados, 1 falhou por chave
duplicada mesmo após retry, 1 falhou por sobreposição de horário). Resposta
passa a ser:

```json
{
  "sucesso": true,
  "idCh": "000031",
  "quantidade": 5,
  "falhas": [
    {"data": "2026-08-03", "erro": "Chave duplicada apos 3 tentativas"},
    {
      "data": "2026-08-05",
      "erro": "Tecnico ja tem agendamento neste horario",
      "conflitos": [{"horaInicio": "14:00", "horaFim": "15:00"}]
    }
  ],
  "mensagem": "5 de 7 dia(s) criado(s) com sucesso."
}
```

`conflitos` só aparece nas falhas por sobreposição (omitido nas falhas de
chave duplicada). `sucesso` continua `true`/status 200 se **pelo menos um**
dia foi criado; `false`/status 500 só se **todos** falharem. O front
(`AgendarResposta` em `chamado.model.ts` e o tratamento em
`confirmarAgendar()`) precisa aceitar o novo campo `falhas` opcional e exibir
aviso quando não-vazio (incluindo os horários em conflito quando presentes),
similar ao que já faz hoje pro caso multi-chamado com falhas parciais.

## Arquivos tocados

- `POUICNSA001.PRW` — `CNSA_AGENDAR` (lock, checagem de sobreposição, retry
  local por dia, novo campo `falhas` na resposta), nova função
  `CNSA_VERIFICASOBREPOSICAO(cTecnico, dData, cHoraIni, cHoraFim)` (consulta
  SZ6 e devolve array de conflitos), `CNSA_PROXSEQ_SZ6` (sem mudança adicional
  além da já feita, reusada como está dentro do retry).
- `pouichamados/src/app/core/models/chamado.model.ts` — `AgendarResposta`
  ganha `falhas?: Array<{ data: string; erro: string; conflitos?: Array<{
  horaInicio: string; horaFim: string }> }>`.
- `pouichamados/src/app/features/chamados-lista/chamados-lista.ts` —
  `confirmarAgendar()` passa a checar `resposta.falhas` (por chamado, já que
  cada chamado do multi-select tem sua própria resposta) e ajustar a
  mensagem de sucesso/aviso mostrada ao usuário, incluindo os horários em
  conflito quando presentes.

## Fora de escopo

- Lock por técnico+data (granularidade mais fina) — descartado por
  simplicidade, ver seção 1.
- Transação agrupando o loop inteiro de dias (rollback automático em caso de
  falha parcial) — mudaria o comportamento esperado (sucesso parcial deixa
  de existir, vira tudo-ou-nada de novo) e não foi isso que foi pedido;
  manter sucesso parcial com `falhas` explícitas é a escolha feita aqui.
- Tela/API pra selecionar vários técnicos numa única ação de Agendar
  (coparticipação em lote) — confirmado com o usuário que o fluxo atual
  (repetir a ação uma vez por técnico) já resolve; não faz parte deste spec.
- Anotações múltiplas por chamado (ZA2) — pedido separado, feature
  diferente, tratado em spec próprio (pendente de confirmação dos campos
  reais da ZA2).

## Verificação

Não há como compilar/rodar AdvPL neste ambiente. Verificação é manual, em
homologação:

1. Selecionar 3+ chamados na lista e agendar todos de uma vez pro mesmo
   técnico/data/horário (o cenário que já reproduziu o erro em produção).
   Confirmar que não aparece mais erro de chave duplicada (ORA-00001).
2. Agendar um técnico das 14:00-15:00, depois tentar agendar o MESMO técnico
   das 14:30-15:30 (sobreposição parcial) - deve falhar só nesse dia,
   mostrando o horário 14:00-15:00 já ocupado.
3. Agendar dois técnicos DIFERENTES no mesmo horário - deve funcionar sem
   nenhum aviso (regra é só por técnico).
4. Agendar um intervalo de vários dias onde só 1 dia tem conflito - confirmar
   que os outros dias são criados normalmente e só o dia conflitante aparece
   em `falhas`.
5. Rodar `npx tsc --noEmit -p pouichamados/tsconfig.app.json` após a mudança
   no front, pra garantir que o novo campo opcional não quebra tipagem.
