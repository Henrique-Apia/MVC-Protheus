#include "RESTFUL.CH"
#include "PROTHEUS.CH"
#include "RWMAKE.CH"
#include "TOPCONN.CH"
#include "TOTVS.CH"

#define CNSA_FWMODEL_HOST     "http://10.0.0.3:3624"
#define CNSA_FWMODEL_ZA1_PATH "/rest/FwModel/chamados/"
#define CNSA_FWMODEL_ZA1_ID   "ModelZA1_Main"

////////////////////////////////////////////////////////////////////////////////
// POUICNSA002.prw
// API REST do portal PO-UI de Ordens de Servico (pouios) - espelha
// POUICNSA001.prw (chamados): cada WSRESTFUL consulta/grava a SZ1 direto via
// BeginSql/RecLock, sem proxy FwModel (mais simples, sem depender de
// host/porta/autenticacao entre instancias do AppServer).
//
// Campos de negocio expostos - ver
// docs/superpowers/specs/2026-07-31-pouios-ordens-servico-design.md pro
// detalhamento completo. Campos de auditoria/aprovacao/fatura (Z1_APROVAD,
// Z1_FATURAR, Z1_APVDOR, Z1_APVMAIL, Z1_APVIP, Z1_APVDATA, Z1_APVHORA,
// Z1_APVTIPO, Z1_HRDIGIT, Z1_APVMAN, Z1_ENVDT, Z1_ENVHR, Z1_DREMUN,
// Z1_DNREMUN, Z1_CUSTOD, Z1_CUSTOI, Z1_OSACTEC, Z1_CHTOTVS, Z1_OSENVCL,
// Z1_ALTPOR, Z1_ALTEM) ficam fora do v1 - Z1_APROVAD/Z1_FATURAR/Z1_TEC ainda
// sao lidos so pra calcular o `status` derivado (legenda da lista, mesmas
// 5 cores do AddLegend em CNSA002.PRW).
//
// ASSUNCAO A VALIDAR (Henrique, confere isso): Order(1) da SZ1 e
// Z1_FILIAL+Z1_OS (mesma convencao usada em ZA1/l_oModel:SetPrimaryKey do
// CNSA002.PRW classico). Se a ordem real for outra, o DbSetOrder(1) abaixo
// so falha o DbSeek (devolve "OS nao encontrada"), nao quebra a compilacao.
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// LISTAGEM / VISUALIZAR / PESQUISAR
////////////////////////////////////////////////////////////////////////////////
WSRESTFUL CNSAOS DESCRIPTION "Listagem de Ordens de Servico (SZ1) para o portal PO-UI" FORMAT APPLICATION_JSON

    WSDATA pagina  AS INTEGER   OPTIONAL
    WSDATA tamanho AS INTEGER   OPTIONAL
    WSDATA os      AS CHARACTER OPTIONAL
    WSDATA texto   AS CHARACTER OPTIONAL
    WSDATA cliente  AS CHARACTER OPTIONAL
    WSDATA analista AS CHARACTER OPTIONAL
    // Sem informar, usa a janela padrao (ano atual -1 a +2, ver dDataIni/
    // dDataFim). Informando, filtra so aquele ano (Z1_DTOS entre 01/01 e
    // 31/12) - permite navegar historico anterior (dados desde 2004).
    WSDATA ano      AS INTEGER   OPTIONAL
    // Com ano+mes juntos, filtra so aquele mes (Z1_DTOS entre dia 01 e o
    // ultimo dia do mes). Mes sem ano (ou vice-versa) e ignorado, cai no
    // comportamento de so-ano ou janela padrao de sempre.
    WSDATA mes      AS INTEGER   OPTIONAL
    // Range livre (formato "AAAA-MM-DD", mesmo que o po-datepicker-range do
    // Angular manda) - front agora usa isso pro botao "Buscar" (igual a tela
    // de agenda), em vez do filtro automatico por ano/mes. Tem prioridade
    // sobre ano/mes: se vier dataIni+dataFim, ano/mes sao ignorados.
    WSDATA dataIni  AS CHARACTER OPTIONAL
    WSDATA dataFim  AS CHARACTER OPTIONAL

    WSMETHOD GET DESCRIPTION "Lista OS - visualizar por numero, pesquisa livre por texto na descricao, filtro por cliente/analista, periodo (dataIni/dataFim), ano ou ano+mes"

END WSRESTFUL

WSMETHOD GET WSRECEIVE pagina, tamanho, os, texto, cliente, analista, ano, mes, dataIni, dataFim WSSERVICE CNSAOS
    Local oJson         := JsonObject():New()
    Local aRetorno      := {}
    Local oLinha        := Nil
    Local aTodos        := {}
    Local aFiltrado     := {}
    Local nPagina        := 1
    Local nTamanho       := 10
    Local nStartIdx      := 1
    Local nTotal         := 0
    Local nI             := 0
    Local nAnoParam      := 0
    Local nMesParam      := 0
    Local cDataIniParam  := ""
    Local cDataFimParam  := ""
    Local cOsParam       := ""
    Local cTextoParam    := ""
    Local cTextoLike     := ""
    Local cClienteParam  := ""
    Local cAnalistaParam := ""
    Local dDataIni       := CToD("")
    Local dDataFim       := CToD("")
    Local cAlias         := GetNextAlias()
    Local oErro          := Nil

    ::SetContentType("application/json")

    Begin Sequence

        Default ::pagina   := 1
        Default ::tamanho  := 10
        Default ::os       := ""
        Default ::texto    := ""
        Default ::cliente  := ""
        Default ::analista := ""
        Default ::ano      := 0
        Default ::mes      := 0
        Default ::dataIni  := ""
        Default ::dataFim  := ""

        nPagina      := If(::pagina  < 1, 1, ::pagina)
        nTamanho     := If(::tamanho < 1 .Or. ::tamanho > 100, 10, ::tamanho)
        nStartIdx    := (nPagina - 1) * nTamanho + 1
        cOsParam     := AllTrim(::os)
        // FIX (busca por descricao acentuada nao bate): DecodeUTF8 no texto
        // da pesquisa livre antes de montar o LIKE, mesmo padrao ja usado
        // em CNSACHAMADOS/CNSACOMPONENTES.
        cTextoParam    := DecodeUTF8(AllTrim(::texto))
        cTextoLike     := Upper(cTextoParam)
        cClienteParam  := AllTrim(::cliente)
        cAnalistaParam := AllTrim(::analista)
        nAnoParam      := ::ano
        nMesParam      := ::mes
        cDataIniParam  := AllTrim(::dataIni)
        cDataFimParam  := AllTrim(::dataFim)

        // FIX (lista trazendo TUDO desde 2004, confirmado em producao - SZ1
        // e tabela historica grande): sem numero de OS especifico, so traz
        // ano atual -2 ate +1 por padrao (confirmado por Henrique: com ano
        // atual 2026, mostra 2024/2025/2026/2027). Buscar por numero de OS
        // (?os=) ignora a janela e acha mesmo uma OS antiga. Informando "ano"
        // (combo no front), filtra so aquele ano especifico.
        //
        // Prioridade: dataIni+dataFim (range livre do botao "Buscar", igual
        // padrao da tela de agenda) > ano+mes > ano > janela padrao.
        If !Empty(cDataIniParam) .And. !Empty(cDataFimParam)
            dDataIni := StoD(StrTran(cDataIniParam, "-", ""))
            dDataFim := StoD(StrTran(cDataFimParam, "-", ""))
        ElseIf nAnoParam > 0 .And. nMesParam >= 1 .And. nMesParam <= 12
            // Ultimo dia do mes = primeiro dia do mes seguinte menos 1 (mesmo
            // truque ja usado em CNSAAGENDAMENTOS/CNSACHAMADOS pra Z6_DTAGE/
            // ZA1_DATA - evita tratar Fev/Dez como caso especial).
            dDataIni := StoD(StrZero(nAnoParam, 4) + StrZero(nMesParam, 2) + "01")
            If nMesParam == 12
                dDataFim := StoD(StrZero(nAnoParam + 1, 4) + "0101") - 1
            Else
                dDataFim := StoD(StrZero(nAnoParam, 4) + StrZero(nMesParam + 1, 2) + "01") - 1
            EndIf
        ElseIf nAnoParam > 0
            dDataIni := StoD(StrZero(nAnoParam, 4) + "0101")
            dDataFim := StoD(StrZero(nAnoParam, 4) + "1231")
        Else
            dDataIni := StoD(StrZero(Year(Date()) - 2, 4) + "0101")
            dDataFim := StoD(StrZero(Year(Date()) + 1, 4) + "1231")
        EndIf

        // BeginSql/EndSql e um template FIXO (os tokens %Table:%/%xFilial:%/
        // %Exp:% sao resolvidos em tempo de parse) - nao da pra injetar uma
        // clausula SQL condicional via %Exp:%, que so faz bind de VALOR. Cada
        // filtro entra como uma condicao propria "(<param> IS NULL OR <coluna>
        // <op> <param>)" - vira no-op sozinha quando o parametro correspondente
        // vem vazio, sem precisar montar SQL dinamico. IS NULL, nao "= ''":
        // Oracle trata string vazia como NULL, ver FIX logo abaixo.
        // FIX (ORA-00904 "Z1_NMTEC": invalid identifier, confirmado em
        // producao): Z1_NMTEC e Z1_NMTIPO existem no dicionario (SX3) mas nao
        // sao coluna fisica na tabela (gatilho/campo so-tela, nunca gravado
        // de verdade) - removidos da SELECT. Nome do analista e do servico
        // agora sao SEMPRE calculados ao vivo via Posicione (mesmo padrao ja
        // usado pra nomeCliente/nomeModulo/nomeMotivo/nomeProjeto/nomeTarefa),
        // nunca lidos como coluna da SZ1.
        //
        // FIX (ORA-00932 "inconsistent datatypes: expected CHAR got LONG
        // BINARY", confirmado em producao): Z1_SERV (Descricao) e Memo -> vira
        // LONG no Oracle, que nao aceita UPPER()/LIKE (nem quase nenhuma
        // funcao) na clausula WHERE. O filtro de texto livre saiu do SQL - agora
        // filtra em memoria em ADVPL depois do fetch (ver bloco abaixo), unico
        // jeito seguro de pesquisar dentro de um campo Memo aqui.
        // FIX ("invalid field name in Alias ...->Z1_SERV", confirmado em
        // producao): Z1_SERV (Descricao) e Memo - o cursor virtual do
        // BeginSql nao expoe coluna Memo/LONG pelo nome (limitacao conhecida
        // do TOP nesse tipo de campo). Saiu da SELECT - lido a parte via
        // Posicione (acesso nativo na tabela, que le Memo sem problema),
        // ver CNSA_OSDESC mais abaixo.
        BeginSql Alias cAlias
            SELECT Z1_OS, Z1_DTDIGIT, Z1_CLI, Z1_LOJA, Z1_USR, Z1_MODULO, Z1_MOTIV, ;
                Z1_TIPO, Z1_DTOS, Z1_INTERNO, Z1_HRINI, Z1_INI, Z1_HRFIM, Z1_FIM, ;
                Z1_TRANS, Z1_PREVIST, Z1_HRTOT, Z1_TOTAL, Z1_TEC, Z1_NUMPRO, Z1_PV, ;
                Z1_ALMOCO, Z1_PROJET, Z1_REVISA, Z1_TAREFA, Z1_CHPSD, Z1_CHHDK, Z1_OSDESE, ;
                Z1_LIN, Z1_VLRHR, Z1_APROVAD, Z1_FATURAR
            FROM %Table:SZ1% SZ1
            WHERE Z1_FILIAL = %xFilial:SZ1%
              AND %NotDel%
              // FIX (lista sempre vazia, sem erro nenhum - confirmado em
              // producao): Oracle trata string vazia como NULL, e
              // "NULL = qualquer coisa" nunca e verdadeiro - a comparacao
              // "%Exp:cOsParam% = ''" nunca virava no-op de verdade, entao
              // TODA linha caia fora do filtro mesmo sem nenhum parametro
              // informado. "IS NULL" e o jeito certo de testar "vazio" aqui.
              AND (%Exp:cOsParam% IS NULL OR Z1_OS = %Exp:cOsParam%)
              AND (%Exp:cClienteParam% IS NULL OR Z1_CLI = %Exp:cClienteParam%)
              AND (%Exp:cAnalistaParam% IS NULL OR Z1_TEC = %Exp:cAnalistaParam%)
              AND (%Exp:cOsParam% IS NOT NULL OR Z1_DTOS BETWEEN %Exp:dDataIni% AND %Exp:dDataFim%)
            ORDER BY Z1_DTOS DESC, Z1_OS DESC
        EndSql

        // Pequeno volume esperado pra OS (bem longe do problema de escala da
        // SZ6 em CNSAAGENDAMENTOS) - traz tudo filtrado e pagina em memoria,
        // evita paginacao nativa em SQL (LIMIT/OFFSET varia por dialeto).
        While !(cAlias)->(Eof())
            AAdd(aTodos, {;
                AllTrim((cAlias)->Z1_OS), ;
                (cAlias)->Z1_DTDIGIT, ;
                AllTrim((cAlias)->Z1_CLI), ;
                AllTrim((cAlias)->Z1_LOJA), ;
                AllTrim((cAlias)->Z1_USR), ;
                AllTrim((cAlias)->Z1_MODULO), ;
                AllTrim((cAlias)->Z1_MOTIV), ;
                CNSA_OSDESC(AllTrim((cAlias)->Z1_OS)), ;
                AllTrim((cAlias)->Z1_TIPO), ;
                (cAlias)->Z1_DTOS, ;
                AllTrim((cAlias)->Z1_INTERNO), ;
                AllTrim((cAlias)->Z1_HRINI), ;
                (cAlias)->Z1_INI, ;
                AllTrim((cAlias)->Z1_HRFIM), ;
                (cAlias)->Z1_FIM, ;
                (cAlias)->Z1_TRANS, ;
                AllTrim((cAlias)->Z1_PREVIST), ;
                AllTrim((cAlias)->Z1_HRTOT), ;
                (cAlias)->Z1_TOTAL, ;
                AllTrim((cAlias)->Z1_TEC), ;
                AllTrim((cAlias)->Z1_NUMPRO), ;
                AllTrim((cAlias)->Z1_PV), ;
                (cAlias)->Z1_ALMOCO, ;
                AllTrim((cAlias)->Z1_PROJET), ;
                AllTrim((cAlias)->Z1_REVISA), ;
                AllTrim((cAlias)->Z1_TAREFA), ;
                AllTrim((cAlias)->Z1_CHPSD), ;
                cValToChar((cAlias)->Z1_CHHDK), ;
                AllTrim((cAlias)->Z1_OSDESE), ;
                AllTrim((cAlias)->Z1_LIN), ;
                (cAlias)->Z1_VLRHR, ;
                AllTrim((cAlias)->Z1_APROVAD), ;
                AllTrim((cAlias)->Z1_FATURAR) ;
            })
            (cAlias)->(DbSkip())
        EndDo
        (cAlias)->(DbCloseArea())

        // Filtro de texto livre (Z1_SERV/descricao) em memoria - ver FIX
        // ORA-00932 acima, campo Memo nao aceita LIKE/UPPER no SQL.
        If !Empty(cTextoLike)
            aFiltrado := {}
            For nI := 1 To Len(aTodos)
                If cTextoLike $ Upper(aTodos[nI][8])
                    AAdd(aFiltrado, aTodos[nI])
                EndIf
            Next nI
            aTodos := aFiltrado
        EndIf

        nTotal := Len(aTodos)

        For nI := nStartIdx To Min(nStartIdx + nTamanho - 1, nTotal)
            oLinha := JsonObject():New()
            oLinha['os']             := aTodos[nI][1]
            oLinha['dtDigitacao']    := CNSA_OS_DATA_ISO(aTodos[nI][2])
            oLinha['codCliente']     := aTodos[nI][3]
            oLinha['lojaCliente']    := aTodos[nI][4]
            oLinha['nomeCliente']    := EncodeUtf8(CNSA_CLINOME(aTodos[nI][3], aTodos[nI][4]))
            oLinha['usuario']        := EncodeUtf8(aTodos[nI][5])
            oLinha['modulo']         := aTodos[nI][6]
            oLinha['nomeModulo']     := EncodeUtf8(CNSA_GENNOME("Z2", aTodos[nI][6]))
            oLinha['motivo']         := aTodos[nI][7]
            oLinha['nomeMotivo']     := EncodeUtf8(CNSA_GENNOME("Z1", aTodos[nI][7]))
            oLinha['descricao']      := EncodeUtf8(aTodos[nI][8])
            oLinha['codServico']     := aTodos[nI][9]
            oLinha['nomeServico']    := EncodeUtf8(CNSA_SRVNOME(aTodos[nI][9]))
            oLinha['dataOs']         := CNSA_OS_DATA_ISO(aTodos[nI][10])
            oLinha['osInterna']      := aTodos[nI][11]
            oLinha['horaInicial']    := aTodos[nI][12]
            oLinha['horaInicialDec'] := aTodos[nI][13]
            oLinha['horaFinal']      := aTodos[nI][14]
            oLinha['horaFinalDec']   := aTodos[nI][15]
            oLinha['horasTranDec']   := aTodos[nI][16]
            oLinha['prevPmt']        := aTodos[nI][17]
            oLinha['totalHoras']     := aTodos[nI][18]
            oLinha['horasTiDec']     := aTodos[nI][19]
            oLinha['codAnalista']    := aTodos[nI][20]
            oLinha['nomeAnalista']   := EncodeUtf8(CNSA_TECNOME(aTodos[nI][20]))
            oLinha['numProposta']    := aTodos[nI][21]
            oLinha['pedVenda']       := aTodos[nI][22]
            oLinha['hrAlmoco']       := aTodos[nI][23]
            oLinha['projeto']        := aTodos[nI][24]
            oLinha['nomeProjeto']    := EncodeUtf8(CNSA_PRJNOME(aTodos[nI][24]))
            oLinha['revisao']        := aTodos[nI][25]
            oLinha['tarefa']         := aTodos[nI][26]
            oLinha['nomeTarefa']     := EncodeUtf8(CNSA_TRFNOME(aTodos[nI][24], aTodos[nI][26]))
            oLinha['chamadoHpsd']    := aTodos[nI][27]
            oLinha['chamado']        := aTodos[nI][28]
            oLinha['osDesenv']       := aTodos[nI][29]
            oLinha['linhaPv']        := aTodos[nI][30]
            oLinha['valorHora']      := aTodos[nI][31]
            oLinha['status']         := CNSA_OS_STATUS(aTodos[nI][32], aTodos[nI][33], aTodos[nI][20])
            AAdd(aRetorno, oLinha)
        Next nI

        oJson['total']        := nTotal
        oJson['totalPaginas'] := If(nTotal == 0, 0, Ceiling(nTotal / nTamanho))
        oJson['pagina']       := nPagina
        oJson['tamanho']      := nTamanho
        oJson['items']        := aRetorno

        ::SetResponse(oJson:ToJson())

    Recover Using oErro
        If oErro != Nil
            ::SetStatus(500)
            ::SetResponse('{"erro":"' + CNSA_OS_JSONESC(EncodeUtf8(oErro:Description)) + '"}')
        EndIf
    End Sequence

Return .T.

////////////////////////////////////////////////////////////////////////////////
// Descricao (Z1_SERV) - campo Memo, lido via Posicione (acesso nativo na
// tabela) em vez de coluna do BeginSql - ver FIX acima ("invalid field name
// in Alias ...->Z1_SERV").
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OSDESC(cOs)
    If Empty(cOs)
        Return ""
    EndIf
Return AllTrim(Posicione("SZ1", 1, xFilial("SZ1") + cOs, "Z1_SERV"))

////////////////////////////////////////////////////////////////////////////////
// Helpers de leitura (nomes derivados por Posicione, mesmo padrao de
// CNSA_CAMPO/CNSA_TECLUPA em ComponentesRest.prw).
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_CLINOME(cCodCliente, cLoja)
    If Empty(cCodCliente)
        Return ""
    EndIf
Return AllTrim(Posicione("SA1", 1, xFilial("SA1") + cCodCliente + cLoja, "A1_NOME"))

////////////////////////////////////////////////////////////////////////////////
// Descricao da tabela generica SX5 (Modulo=tipo "Z2", Motivo=tipo "Z1" -
// confirmado via "Visualizar Campo" do dicionario, ver spec).
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_GENNOME(cTabela, cChave)
    If Empty(cChave)
        Return ""
    EndIf
Return AllTrim(Posicione("SX5", 1, xFilial("SX5") + cTabela + cChave, "X5_DESCRI"))

Static Function CNSA_PRJNOME(cProjeto)
    If Empty(cProjeto)
        Return ""
    EndIf
Return AllTrim(Posicione("AF8", 1, xFilial("AF8") + cProjeto, "AF8_DESCRI"))

Static Function CNSA_TRFNOME(cProjeto, cTarefa)
    If Empty(cTarefa)
        Return ""
    EndIf
Return AllTrim(Posicione("AF9", 1, xFilial("AF9") + cProjeto + cTarefa, "AF9_DESCRI"))

////////////////////////////////////////////////////////////////////////////////
// Nome do servico (SB1) e do analista (AA1) - FIX (ORA-00904 "Z1_NMTEC":
// invalid identifier, confirmado em producao): Z1_NMTEC/Z1_NMTIPO existem no
// dicionario (SX3) mas nao sao coluna fisica na SZ1 (gatilho so-tela, nunca
// gravado) - nunca ler direto da tabela, sempre calcular ao vivo aqui.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_SRVNOME(cCodServico)
    If Empty(cCodServico)
        Return ""
    EndIf
Return AllTrim(Posicione("SB1", 1, xFilial("SB1") + cCodServico, "B1_DESC"))

Static Function CNSA_TECNOME(cCodAnalista)
    If Empty(cCodAnalista)
        Return ""
    EndIf
Return AllTrim(Posicione("AA1", 1, xFilial("AA1") + cCodAnalista, "AA1_NOMTEC"))

////////////////////////////////////////////////////////////////////////////////
// Status derivado - mesma regra das 5 legendas (AddLegend) do CNSA002.PRW
// classico: Aprovada e Faturada / Faturada sem Aprovacao / Aprovada /
// Aguardando Aprovacao / Negada.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OS_STATUS(cAprovad, cFaturar, cTec)
    Local lAprovada := cAprovad == "S" .Or. cAprovad == "A"

    If lAprovada .And. cFaturar == "S"
        Return "aprovada_faturada"
    ElseIf cFaturar == "S" .And. !lAprovada
        Return "faturada_sem_aprovacao"
    ElseIf lAprovada
        Return "aprovada"
    ElseIf !Empty(cTec)
        Return "aguardando_aprovacao"
    EndIf
Return "negada"

////////////////////////////////////////////////////////////////////////////////
// FIX (Data OS nao aparecia na lista, confirmado em producao): DToS() devolve
// "AAAAMMDD" sem traco - o Angular espera ISO "AAAA-MM-DD" (new Date() nao
// entende o formato sem traco). Alem disso, campo Data lido de um cursor
// BeginSql pode vir como Character em vez de Date (mesmo problema ja
// documentado em POUICNSA001.PRW/CNSA_POSCOMMIT_EXCLUIR pra Z6_DTAGE) -
// trata os dois casos.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OS_DATA_ISO(dData)
    Local cData := ""

    If ValType(dData) == "D"
        If Empty(dData)
            Return ""
        EndIf
        cData := DToS(dData)
    ElseIf ValType(dData) == "C"
        cData := AllTrim(dData)
    Else
        Return ""
    EndIf

    If Len(cData) == 8
        Return SubStr(cData, 1, 4) + "-" + SubStr(cData, 5, 2) + "-" + SubStr(cData, 7, 2)
    EndIf
Return ""

////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OS_JSONESC(cTexto)
    Local cRet := cTexto
    cRet := StrTran(cRet, '\',  '\\')
    cRet := StrTran(cRet, '"',  '\"')
    cRet := StrTran(cRet, Chr(13)+Chr(10), '\n')
    cRet := StrTran(cRet, Chr(10), '\n')
    cRet := StrTran(cRet, Chr(13), '\n')
    cRet := StrTran(cRet, Chr(9),  '\t')
Return cRet


////////////////////////////////////////////////////////////////////////////////
// INCLUIR - WSRESTFUL proprio, mesmo arquivo, mesmo padrao ja validado em
// CNSACHAMADOSINCLUIR (POUICNSA001.prw). Z1_APROVAD/Z1_FATURAR ficam fixos
// "N" no ADVPL - nao expostos ao front (fora do escopo do v1).
////////////////////////////////////////////////////////////////////////////////
WSRESTFUL CNSAOSINCLUIR DESCRIPTION "Inclui uma nova Ordem de Servico (SZ1)" FORMAT APPLICATION_JSON

    WSDATA codCliente     AS CHARACTER OPTIONAL
    WSDATA lojaCliente    AS CHARACTER OPTIONAL
    WSDATA usuario        AS CHARACTER OPTIONAL
    WSDATA modulo         AS CHARACTER OPTIONAL
    WSDATA motivo         AS CHARACTER OPTIONAL
    WSDATA descricao      AS CHARACTER OPTIONAL
    WSDATA codServico     AS CHARACTER OPTIONAL
    WSDATA dataOs         AS CHARACTER OPTIONAL
    WSDATA horaInicialDec AS CHARACTER OPTIONAL
    WSDATA horaFinalDec   AS CHARACTER OPTIONAL
    WSDATA horasTiDec     AS CHARACTER OPTIONAL
    WSDATA codAnalista    AS CHARACTER OPTIONAL
    WSDATA dtDigitacao    AS CHARACTER OPTIONAL
    WSDATA osInterna      AS CHARACTER OPTIONAL
    WSDATA horasTranDec   AS CHARACTER OPTIONAL
    WSDATA prevPmt        AS CHARACTER OPTIONAL
    WSDATA numProposta    AS CHARACTER OPTIONAL
    WSDATA pedVenda       AS CHARACTER OPTIONAL
    WSDATA hrAlmoco       AS CHARACTER OPTIONAL
    WSDATA projeto        AS CHARACTER OPTIONAL
    WSDATA revisao        AS CHARACTER OPTIONAL
    WSDATA tarefa         AS CHARACTER OPTIONAL
    WSDATA chamadoHpsd    AS CHARACTER OPTIONAL
    WSDATA chamado        AS CHARACTER OPTIONAL
    WSDATA osDesenv       AS CHARACTER OPTIONAL
    WSDATA linhaPv        AS CHARACTER OPTIONAL
    WSDATA valorHora      AS CHARACTER OPTIONAL

    WSMETHOD POST DESCRIPTION "Inclui uma OS - ver CNSA_OS_INCLUIR pra lista completa de campos"

END WSRESTFUL

WSMETHOD POST WSRECEIVE codCliente, lojaCliente, usuario, modulo, motivo, descricao, codServico, ;
    dataOs, horaInicialDec, horaFinalDec, horasTiDec, codAnalista, dtDigitacao, osInterna, ;
    horasTranDec, prevPmt, numProposta, pedVenda, hrAlmoco, projeto, revisao, tarefa, ;
    chamadoHpsd, chamado, osDesenv, linhaPv, valorHora WSSERVICE CNSAOSINCLUIR
    Local aResultado := {}

    ::SetContentType("application/json")

    aResultado := CNSA_OS_INCLUIR(AllTrim(::codCliente), AllTrim(::lojaCliente), AllTrim(::usuario), ;
        AllTrim(::modulo), AllTrim(::motivo), DecodeUTF8(AllTrim(::descricao)), AllTrim(::codServico), ;
        AllTrim(::dataOs), AllTrim(::horaInicialDec), AllTrim(::horaFinalDec), AllTrim(::horasTiDec), ;
        AllTrim(::codAnalista), AllTrim(::dtDigitacao), AllTrim(::osInterna), AllTrim(::horasTranDec), ;
        AllTrim(::prevPmt), AllTrim(::numProposta), AllTrim(::pedVenda), AllTrim(::hrAlmoco), ;
        AllTrim(::projeto), AllTrim(::revisao), AllTrim(::tarefa), AllTrim(::chamadoHpsd), ;
        AllTrim(::chamado), AllTrim(::osDesenv), AllTrim(::linhaPv), AllTrim(::valorHora))
    ::SetStatus(aResultado[1])
    ::SetResponse(aResultado[2])

Return .T.

////////////////////////////////////////////////////////////////////////////////
// Logica real do Incluir - fora do WSMETHOD, devolve {nStatusHttp, cCorpoJson}.
//
// ASSUNCAO A VALIDAR (Henrique, confere isso): Z1_OS tem grupo de numeracao
// configurado no SX5 pro GetSxeNum()/ConfirmSX8() funcionar (mesmo padrao ja
// usado em ZA1_IDCH pelo CNSA_INCLUIR de chamados). U_COPIAR_OS (CNSA002.PRW
// classico) ja usa GetSXENum("SZ1","Z1_OS") sem ConfirmSX8/RollBackSX8 -
// aqui uso o par completo (mais seguro contra numero "queimado" em erro).
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OS_INCLUIR(cCodCliente, cLojaCliente, cUsuario, cModulo, cMotivo, cDescricao, ;
    cCodServico, cDataOs, cHoraIniDec, cHoraFimDec, cHorasTiDec, cCodAnalista, cDtDigitacao, ;
    cOsInterna, cHorasTranDec, cPrevPmt, cNumProposta, cPedVenda, cHrAlmoco, cProjeto, cRevisao, ;
    cTarefa, cChamadoHpsd, cChamado, cOsDesenv, cLinhaPv, cValorHora)
    Local cOs   := ""
    Local oJson := JsonObject():New()
    Local oErro := Nil

    Begin Sequence

        If Empty(cCodCliente) .Or. Empty(cLojaCliente)
            Return {400, '{"erro":"Informe o cliente e o site do cliente."}'}
        EndIf
        If Empty(cUsuario)
            Return {400, '{"erro":"Informe o usuario."}'}
        EndIf
        If Empty(cModulo)
            Return {400, '{"erro":"Informe o modulo."}'}
        EndIf
        If Empty(cMotivo)
            Return {400, '{"erro":"Informe o motivo."}'}
        EndIf
        If Empty(cDescricao)
            Return {400, '{"erro":"Informe a descricao."}'}
        EndIf
        If Empty(cCodServico)
            Return {400, '{"erro":"Informe o codigo do servico."}'}
        EndIf
        If Empty(cDataOs)
            Return {400, '{"erro":"Informe a data da OS."}'}
        EndIf
        If Empty(cHoraIniDec) .Or. Empty(cHoraFimDec)
            Return {400, '{"erro":"Informe a hora inicial e final (decimais)."}'}
        EndIf
        If Empty(cHorasTiDec)
            Return {400, '{"erro":"Informe as horas TI (decimais)."}'}
        EndIf
        If Empty(cCodAnalista)
            Return {400, '{"erro":"Informe o analista."}'}
        EndIf

        If Empty(cDtDigitacao)
            cDtDigitacao := DToS(Date())
        Else
            cDtDigitacao := StrTran(cDtDigitacao, "-", "")
        EndIf

        cOs := GetSxeNum("SZ1", "Z1_OS")

        RecLock("SZ1", .T.)
            SZ1->Z1_FILIAL  := xFilial("SZ1")
            SZ1->Z1_OS      := cOs
            SZ1->Z1_DTDIGIT := STOD(cDtDigitacao)
            SZ1->Z1_CLI     := cCodCliente
            SZ1->Z1_LOJA    := cLojaCliente
            SZ1->Z1_USR     := cUsuario
            SZ1->Z1_MODULO  := cModulo
            SZ1->Z1_MOTIV   := cMotivo
            SZ1->Z1_SERV    := cDescricao
            SZ1->Z1_TIPO    := cCodServico
            SZ1->Z1_DTOS    := STOD(StrTran(cDataOs, "-", ""))
            SZ1->Z1_INTERNO := If(Empty(cOsInterna), "N", cOsInterna)
            SZ1->Z1_INI     := Val(cHoraIniDec)
            SZ1->Z1_FIM     := Val(cHoraFimDec)
            SZ1->Z1_TRANS   := Val(cHorasTranDec)
            SZ1->Z1_PREVIST := If(Empty(cPrevPmt), "N", cPrevPmt)
            SZ1->Z1_TOTAL   := Val(cHorasTiDec)
            SZ1->Z1_TEC     := cCodAnalista
            SZ1->Z1_NUMPRO  := cNumProposta
            SZ1->Z1_PV      := cPedVenda
            SZ1->Z1_ALMOCO  := Val(cHrAlmoco)
            SZ1->Z1_PROJET  := cProjeto
            SZ1->Z1_REVISA  := cRevisao
            SZ1->Z1_TAREFA  := cTarefa
            SZ1->Z1_CHPSD   := cChamadoHpsd
            SZ1->Z1_CHHDK   := Val(cChamado)
            SZ1->Z1_OSDESE  := If(Empty(cOsDesenv), "N", cOsDesenv)
            SZ1->Z1_LIN     := cLinhaPv
            SZ1->Z1_VLRHR   := Val(cValorHora)
            SZ1->Z1_APROVAD := "N"
            SZ1->Z1_FATURAR := "N"
        SZ1->(MsUnlock())

        ConfirmSX8()

        oJson['sucesso']  := .T.
        oJson['os']       := cOs
        oJson['mensagem'] := "OS incluida com sucesso."

        Return {200, oJson:ToJson()}

    Recover Using oErro
        RollBackSX8()
        Return {500, '{"erro":"' + CNSA_OS_JSONESC(EncodeUtf8(oErro:Description)) + '"}'}
    End Sequence

Return {500, '{"erro":"Erro desconhecido."}'}


////////////////////////////////////////////////////////////////////////////////
// ALTERAR - WSRESTFUL proprio, alteracao PARCIAL - so troca o que vier
// preenchido, mesmo padrao de CNSACHAMADOSALTERAR.
////////////////////////////////////////////////////////////////////////////////
WSRESTFUL CNSAOSALTERAR DESCRIPTION "Altera uma Ordem de Servico (SZ1) - mesmos campos do Incluir" FORMAT APPLICATION_JSON

    WSDATA os             AS CHARACTER OPTIONAL
    WSDATA codCliente     AS CHARACTER OPTIONAL
    WSDATA lojaCliente    AS CHARACTER OPTIONAL
    WSDATA usuario        AS CHARACTER OPTIONAL
    WSDATA modulo         AS CHARACTER OPTIONAL
    WSDATA motivo         AS CHARACTER OPTIONAL
    WSDATA descricao      AS CHARACTER OPTIONAL
    WSDATA codServico     AS CHARACTER OPTIONAL
    WSDATA dataOs         AS CHARACTER OPTIONAL
    WSDATA horaInicialDec AS CHARACTER OPTIONAL
    WSDATA horaFinalDec   AS CHARACTER OPTIONAL
    WSDATA horasTiDec     AS CHARACTER OPTIONAL
    WSDATA codAnalista    AS CHARACTER OPTIONAL
    WSDATA osInterna      AS CHARACTER OPTIONAL
    WSDATA horasTranDec   AS CHARACTER OPTIONAL
    WSDATA prevPmt        AS CHARACTER OPTIONAL
    WSDATA numProposta    AS CHARACTER OPTIONAL
    WSDATA pedVenda       AS CHARACTER OPTIONAL
    WSDATA hrAlmoco       AS CHARACTER OPTIONAL
    WSDATA projeto        AS CHARACTER OPTIONAL
    WSDATA revisao        AS CHARACTER OPTIONAL
    WSDATA tarefa         AS CHARACTER OPTIONAL
    WSDATA chamadoHpsd    AS CHARACTER OPTIONAL
    WSDATA chamado        AS CHARACTER OPTIONAL
    WSDATA osDesenv       AS CHARACTER OPTIONAL
    WSDATA linhaPv        AS CHARACTER OPTIONAL
    WSDATA valorHora      AS CHARACTER OPTIONAL

    WSMETHOD POST DESCRIPTION "Altera uma OS - alteracao parcial, mesmos campos do Incluir"

END WSRESTFUL

WSMETHOD POST WSRECEIVE os, codCliente, lojaCliente, usuario, modulo, motivo, descricao, codServico, ;
    dataOs, horaInicialDec, horaFinalDec, horasTiDec, codAnalista, osInterna, horasTranDec, ;
    prevPmt, numProposta, pedVenda, hrAlmoco, projeto, revisao, tarefa, chamadoHpsd, chamado, ;
    osDesenv, linhaPv, valorHora WSSERVICE CNSAOSALTERAR
    Local aResultado := {}

    ::SetContentType("application/json")

    aResultado := CNSA_OS_ALTERAR(AllTrim(::os), AllTrim(::codCliente), AllTrim(::lojaCliente), ;
        AllTrim(::usuario), AllTrim(::modulo), AllTrim(::motivo), DecodeUTF8(AllTrim(::descricao)), ;
        AllTrim(::codServico), AllTrim(::dataOs), AllTrim(::horaInicialDec), AllTrim(::horaFinalDec), ;
        AllTrim(::horasTiDec), AllTrim(::codAnalista), AllTrim(::osInterna), AllTrim(::horasTranDec), ;
        AllTrim(::prevPmt), AllTrim(::numProposta), AllTrim(::pedVenda), AllTrim(::hrAlmoco), ;
        AllTrim(::projeto), AllTrim(::revisao), AllTrim(::tarefa), AllTrim(::chamadoHpsd), ;
        AllTrim(::chamado), AllTrim(::osDesenv), AllTrim(::linhaPv), AllTrim(::valorHora))
    ::SetStatus(aResultado[1])
    ::SetResponse(aResultado[2])

Return .T.

////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OS_ALTERAR(cOs, cCodCliente, cLojaCliente, cUsuario, cModulo, cMotivo, ;
    cDescricao, cCodServico, cDataOs, cHoraIniDec, cHoraFimDec, cHorasTiDec, cCodAnalista, ;
    cOsInterna, cHorasTranDec, cPrevPmt, cNumProposta, cPedVenda, cHrAlmoco, cProjeto, cRevisao, ;
    cTarefa, cChamadoHpsd, cChamado, cOsDesenv, cLinhaPv, cValorHora)
    Local oJson := JsonObject():New()
    Local oErro := Nil
    Local lTemAlgumCampo := !Empty(cCodCliente) .Or. !Empty(cUsuario) .Or. !Empty(cModulo) .Or. ;
        !Empty(cMotivo) .Or. !Empty(cDescricao) .Or. !Empty(cCodServico) .Or. !Empty(cDataOs) .Or. ;
        !Empty(cHoraIniDec) .Or. !Empty(cHoraFimDec) .Or. !Empty(cHorasTiDec) .Or. !Empty(cCodAnalista) .Or. ;
        !Empty(cOsInterna) .Or. !Empty(cHorasTranDec) .Or. !Empty(cPrevPmt) .Or. !Empty(cNumProposta) .Or. ;
        !Empty(cPedVenda) .Or. !Empty(cHrAlmoco) .Or. !Empty(cProjeto) .Or. !Empty(cRevisao) .Or. ;
        !Empty(cTarefa) .Or. !Empty(cChamadoHpsd) .Or. !Empty(cChamado) .Or. !Empty(cOsDesenv) .Or. ;
        !Empty(cLinhaPv) .Or. !Empty(cValorHora)

    Begin Sequence

        If Empty(cOs)
            Return {400, '{"erro":"Informe o numero da OS (?os=000001)."}'}
        EndIf
        If !lTemAlgumCampo
            Return {400, '{"erro":"Informe ao menos um campo para alterar."}'}
        EndIf

        DbSelectArea("SZ1")
        SZ1->(DbSetOrder(1))
        If !SZ1->(DbSeek(xFilial("SZ1") + cOs))
            Return {404, '{"erro":"OS nao encontrada."}'}
        EndIf

        RecLock("SZ1", .F.)
            If !Empty(cCodCliente)
                SZ1->Z1_CLI  := cCodCliente
                SZ1->Z1_LOJA := If(Empty(cLojaCliente), "01", cLojaCliente)
            EndIf
            If !Empty(cUsuario)
                SZ1->Z1_USR := cUsuario
            EndIf
            If !Empty(cModulo)
                SZ1->Z1_MODULO := cModulo
            EndIf
            If !Empty(cMotivo)
                SZ1->Z1_MOTIV := cMotivo
            EndIf
            If !Empty(cDescricao)
                SZ1->Z1_SERV := cDescricao
            EndIf
            If !Empty(cCodServico)
                SZ1->Z1_TIPO := cCodServico
            EndIf
            If !Empty(cDataOs)
                SZ1->Z1_DTOS := STOD(StrTran(cDataOs, "-", ""))
            EndIf
            If !Empty(cHoraIniDec)
                SZ1->Z1_INI := Val(cHoraIniDec)
            EndIf
            If !Empty(cHoraFimDec)
                SZ1->Z1_FIM := Val(cHoraFimDec)
            EndIf
            If !Empty(cHorasTranDec)
                SZ1->Z1_TRANS := Val(cHorasTranDec)
            EndIf
            If !Empty(cHorasTiDec)
                SZ1->Z1_TOTAL := Val(cHorasTiDec)
            EndIf
            If !Empty(cCodAnalista)
                SZ1->Z1_TEC := cCodAnalista
            EndIf
            If !Empty(cOsInterna)
                SZ1->Z1_INTERNO := cOsInterna
            EndIf
            If !Empty(cPrevPmt)
                SZ1->Z1_PREVIST := cPrevPmt
            EndIf
            If !Empty(cNumProposta)
                SZ1->Z1_NUMPRO := cNumProposta
            EndIf
            If !Empty(cPedVenda)
                SZ1->Z1_PV := cPedVenda
            EndIf
            If !Empty(cHrAlmoco)
                SZ1->Z1_ALMOCO := Val(cHrAlmoco)
            EndIf
            If !Empty(cProjeto)
                SZ1->Z1_PROJET := cProjeto
            EndIf
            If !Empty(cRevisao)
                SZ1->Z1_REVISA := cRevisao
            EndIf
            If !Empty(cTarefa)
                SZ1->Z1_TAREFA := cTarefa
            EndIf
            If !Empty(cChamadoHpsd)
                SZ1->Z1_CHPSD := cChamadoHpsd
            EndIf
            If !Empty(cChamado)
                SZ1->Z1_CHHDK := Val(cChamado)
            EndIf
            If !Empty(cOsDesenv)
                SZ1->Z1_OSDESE := cOsDesenv
            EndIf
            If !Empty(cLinhaPv)
                SZ1->Z1_LIN := cLinhaPv
            EndIf
            If !Empty(cValorHora)
                SZ1->Z1_VLRHR := Val(cValorHora)
            EndIf
        SZ1->(MsUnlock())

        oJson['sucesso']  := .T.
        oJson['os']       := cOs
        oJson['mensagem'] := "OS alterada com sucesso."

        Return {200, oJson:ToJson()}

    Recover Using oErro
        Return {500, '{"erro":"' + CNSA_OS_JSONESC(EncodeUtf8(oErro:Description)) + '"}'}
    End Sequence

Return {500, '{"erro":"Erro desconhecido."}'}


////////////////////////////////////////////////////////////////////////////////
// EXCLUIR - WSRESTFUL proprio. CNSA002.PRW classico usa a operacao 5 padrao
// (VIEWDEF), sem dialogo de motivo (diferente de chamados) - exclusao direta.
////////////////////////////////////////////////////////////////////////////////
WSRESTFUL CNSAOSEXCLUIR DESCRIPTION "Exclui uma Ordem de Servico (SZ1)" FORMAT APPLICATION_JSON

    WSDATA os AS CHARACTER OPTIONAL

    WSMETHOD POST DESCRIPTION "Exclui uma OS pelo numero"

END WSRESTFUL

WSMETHOD POST WSRECEIVE os WSSERVICE CNSAOSEXCLUIR
    Local aResultado := {}

    ::SetContentType("application/json")

    aResultado := CNSA_OS_EXCLUIR(AllTrim(::os))
    ::SetStatus(aResultado[1])
    ::SetResponse(aResultado[2])

Return .T.

////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OS_EXCLUIR(cOs)
    Local oJson := JsonObject():New()
    Local oErro := Nil

    Begin Sequence

        If Empty(cOs)
            Return {400, '{"erro":"Informe o numero da OS."}'}
        EndIf

        DbSelectArea("SZ1")
        SZ1->(DbSetOrder(1))
        If !SZ1->(DbSeek(xFilial("SZ1") + cOs))
            Return {404, '{"erro":"OS nao encontrada."}'}
        EndIf

        RecLock("SZ1", .F.)
            SZ1->(DbDelete())
        SZ1->(MsUnlock())

        oJson['sucesso']  := .T.
        oJson['os']       := cOs
        oJson['mensagem'] := "OS excluida com sucesso."

        Return {200, oJson:ToJson()}

    Recover Using oErro
        Return {500, '{"erro":"' + CNSA_OS_JSONESC(EncodeUtf8(oErro:Description)) + '"}'}
    End Sequence

Return {500, '{"erro":"Erro desconhecido."}'}


////////////////////////////////////////////////////////////////////////////////
// COPIAR - WSRESTFUL proprio. Replica a logica de U_COPIAR_OS (CNSA002.PRW
// classico): copia todos os campos do registro atual pra um novo Z1_OS,
// zerando aprovacao/faturamento/dados de aprovador.
////////////////////////////////////////////////////////////////////////////////
WSRESTFUL CNSAOSCOPIAR DESCRIPTION "Duplica uma Ordem de Servico (SZ1), zerando aprovacao/faturamento" FORMAT APPLICATION_JSON

    WSDATA os AS CHARACTER OPTIONAL

    WSMETHOD POST DESCRIPTION "Copia uma OS pelo numero, devolve o numero da nova OS"

END WSRESTFUL

WSMETHOD POST WSRECEIVE os WSSERVICE CNSAOSCOPIAR
    Local aResultado := {}

    ::SetContentType("application/json")

    aResultado := CNSA_OS_COPIAR(AllTrim(::os))
    ::SetStatus(aResultado[1])
    ::SetResponse(aResultado[2])

Return .T.

////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_OS_COPIAR(cOsOrigem)
    Local oJson    := JsonObject():New()
    Local oErro    := Nil
    Local aFields  := {}
    Local nI       := 0
    Local cOsNova  := ""

    Begin Sequence

        If Empty(cOsOrigem)
            Return {400, '{"erro":"Informe o numero da OS a copiar."}'}
        EndIf

        DbSelectArea("SZ1")
        SZ1->(DbSetOrder(1))
        If !SZ1->(DbSeek(xFilial("SZ1") + cOsOrigem))
            Return {404, '{"erro":"OS nao encontrada."}'}
        EndIf

        For nI := 1 To SZ1->(FCount())
            AAdd(aFields, {SZ1->(FieldName(nI)), SZ1->(FieldGet(nI))})
        Next nI

        cOsNova := GetSxeNum("SZ1", "Z1_OS")

        RecLock("SZ1", .T.)
            For nI := 1 To Len(aFields)
                SZ1->(FieldPut(FieldPos(aFields[nI][1]), aFields[nI][2]))
            Next nI
            // Campos que devem ser diferentes na copia - mesma lista do
            // U_COPIAR_OS classico (CNSA002.PRW).
            SZ1->Z1_OS      := cOsNova
            SZ1->Z1_DTDIGIT := Date()
            SZ1->Z1_APROVAD := "N"
            SZ1->Z1_FATURAR := "N"
            SZ1->Z1_APVDOR  := ""
            SZ1->Z1_APVMAIL := ""
            SZ1->Z1_APVIP   := ""
            SZ1->Z1_APVDATA := CtoD("")
            SZ1->Z1_APVHORA := ""
        SZ1->(MsUnlock())

        ConfirmSX8()

        oJson['sucesso']    := .T.
        oJson['osOriginal'] := cOsOrigem
        oJson['osNova']     := cOsNova
        oJson['mensagem']   := "OS copiada com sucesso."

        Return {200, oJson:ToJson()}

    Recover Using oErro
        RollBackSX8()
        Return {500, '{"erro":"' + CNSA_OS_JSONESC(EncodeUtf8(oErro:Description)) + '"}'}
    End Sequence

Return {500, '{"erro":"Erro desconhecido."}'}
