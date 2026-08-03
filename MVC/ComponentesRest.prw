                                    ////////////////////////////////////////////////
                                    //isto é um codigo que é para carregar no rest //
                                    //todos as consultas padrao que preciso       //
                                    //tecnico, CLILUPA, tarefa, projeto          //
                                    //(pouichamados) + modulo, motivo, servico, //
                                    //proposta (pouios)                        //
                                    ////////////////////////////////////////////////

#include "RESTFUL.CH"
#include "PROTHEUS.CH"
#include "RWMAKE.CH"
#include "TOPCONN.CH"
#include "TOTVS.CH"

////////////////////////////////////////////////////////////////////////////////
// ComponentesRest.prw
// Endpoints de apoio pras "lupas" (Consulta Padrao) do portal PO-UI - nao
// existe F3 nativo em Angular, entao cada campo (Tecnico, Cliente, Projeto,
// Tarefa) abre um modal que chama este REST e devolve o registro escolhido.
//
// Um WSMETHOD so, despachando por "tipo" - mesmo padrao ja validado em
// CNSACHAMADOS (idCh/texto/status). NAO usa multiplos WSMETHOD/WSPATH no
// mesmo WSRESTFUL - isso ja deu erro real de compilacao (C2051/C2006) em
// outro arquivo deste projeto, entao evitamos repetir o mesmo risco aqui.
//
// Tipos suportados hoje:
// - Compartilhados entre pouichamados e pouios: tecnico (AA1), cliente (SA1),
//   projeto (AF8) e tarefa (AF9 - depende do projeto, ver WSDATA "projeto" e
//   CNSA_TARLUPA). Criados originalmente pro pouichamados, reaproveitados sem
//   mudanca nenhuma pelo formulario de OS do pouios (Cliente/Analista/Projeto/
//   Tarefa la usam os mesmos tipos).
// - Exclusivos do pouios: modulo (SX5 tipo "Z2"), motivo (SX5 tipo "Z1"),
//   servico (SB1) e proposta (SZ3, cascata por cliente). Ver secao
//   "LUPAS EXCLUSIVAS DO POUIOS" mais abaixo.
//
// FIX (500 com filtro vazio / lista sem resultado): o JSON de resposta NAO
// e mais montado com JsonObject['items'] := aItens (array de JsonObject
// aninhado dentro de outro JsonObject) - montamos a string do array "items"
// na mao, chamando oLinha:ToJson() item a item e concatenando. Isso elimina
// qualquer dependencia do comportamento do ToJson() com array vazio (0
// resultados) ou aninhado, que era suspeito de estourar erro nao-capturavel
// pelo Begin/Recover Sequence. Resposta agora sempre inclui "resultado"
// (true = achou 1+ registro, false = filtro nao encontrou nada - NAO e erro,
// e resposta 200 normal) pro front distinguir "lista vazia" de "erro real".
////////////////////////////////////////////////////////////////////////////////

WSRESTFUL CNSACOMPONENTES DESCRIPTION "Consultas de apoio (lupas) para o portal PO-UI" FORMAT APPLICATION_JSON

    WSDATA tipo    AS CHARACTER OPTIONAL
    WSDATA filtro  AS CHARACTER OPTIONAL
    // So usado quando tipo=tarefa - a tarefa (AF9) e sempre filha de um
    // projeto (AF8), entao a lupa de tarefa exige o codigo do projeto ja
    // selecionado no formulario (cascata Projeto -> Tarefa, confirmado por
    // Henrique: "tarefa depende do projeto, o projeto tem uma tarefa x").
    WSDATA projeto AS CHARACTER OPTIONAL
    // So usados quando tipo=projeto - cascata Cliente -> Projeto (confirmado
    // por Henrique: AF8_CLIENT + AF8_LOJA na AF8). Loja default "01" se vier
    // vazia, mesmo padrao usado no resto do app.
    WSDATA cliente      AS CHARACTER OPTIONAL
    WSDATA lojaCliente  AS CHARACTER OPTIONAL

    WSMETHOD GET DESCRIPTION "Busca tecnico, cliente, projeto ou tarefa por codigo/nome, para uso nas lupas do frontend"

END WSRESTFUL

WSMETHOD GET WSRECEIVE tipo, filtro, projeto, cliente, lojaCliente WSSERVICE CNSACOMPONENTES
    Local cTipoParam    := ""
    Local cFiltroParam  := ""
    Local cProjetoParam := ""
    Local cClienteParam := ""
    Local cLojaParam    := ""
    Local aItens        := {}
    Local cItensJson    := ""
    Local cResposta     := ""
    Local nI            := 0
    Local oErro         := Nil

    ::SetContentType("application/json")
    // CORS - NAO configurar aqui via ::SetHeader (metodo nao existe nessa
    // classe do WSRESTFUL classico e causa erro 500 - ja tentamos e revertemos).
    // Resolvido no appserver.ini da instancia rest-exclusivo (3624), secoes
    // [HTTPURI] (/rest) e [HTTPURI2] (/api), com CORSEnable=1 AllowOrigin=*.

    Begin Sequence

        Default ::tipo         := ""
        Default ::filtro       := ""
        Default ::projeto      := ""
        Default ::cliente      := ""
        Default ::lojaCliente  := ""

        // FIX (busca por nome acentuado, ex "João", nao batia): DecodeUTF8 no
        // filtro digitado antes de montar o LIKE - mesmo problema de
        // ANSI/UTF-8 do restante do app.
        cTipoParam    := Lower(AllTrim(::tipo))
        cFiltroParam  := DecodeUTF8(AllTrim(::filtro))
        cProjetoParam := AllTrim(::projeto)
        cClienteParam := AllTrim(::cliente)
        cLojaParam    := AllTrim(::lojaCliente)

        Do Case
            // ---- LUPAS COMPARTILHADAS (pouichamados + pouios) ----
            Case cTipoParam == "tecnico"
                aItens := CNSA_TECLUPA(cFiltroParam)
            Case cTipoParam == "cliente"
                aItens := CNSA_CLILUPA(cFiltroParam)
            Case cTipoParam == "projeto"
                If Empty(cClienteParam)
                    ::SetStatus(400)
                    ::SetResponse('{"resultado":false,"erro":"Informe o cliente (?cliente=000001) antes de buscar o projeto."}')
                    Break
                EndIf
                aItens := CNSA_PROJLUPA(cFiltroParam, cClienteParam, If(Empty(cLojaParam), "01", cLojaParam))
            Case cTipoParam == "tarefa"
                If Empty(cProjetoParam)
                    ::SetStatus(400)
                    ::SetResponse('{"resultado":false,"erro":"Informe o projeto (?projeto=000001) antes de buscar a tarefa."}')
                    Break
                EndIf
                aItens := CNSA_TARLUPA(cFiltroParam, cProjetoParam)

            // ---- LUPAS EXCLUSIVAS DO POUIOS ----
            Case cTipoParam == "modulo"
                aItens := CNSA_MODULUPA(cFiltroParam)
            Case cTipoParam == "motivo"
                aItens := CNSA_MOTIVLUPA(cFiltroParam)
            Case cTipoParam == "servico"
                aItens := CNSA_SERVLUPA(cFiltroParam)
            Case cTipoParam == "proposta"
                If Empty(cClienteParam)
                    ::SetStatus(400)
                    ::SetResponse('{"resultado":false,"erro":"Informe o cliente (?cliente=000001) antes de buscar a proposta."}')
                    Break
                EndIf
                aItens := CNSA_PROPLUPA(cFiltroParam, cClienteParam, If(Empty(cLojaParam), "01", cLojaParam))
            OtherWise
                ::SetStatus(400)
                ::SetResponse('{"resultado":false,"erro":"Informe um tipo valido (?tipo=tecnico, cliente, projeto, tarefa, modulo, motivo, servico ou proposta)."}')
                Break
        EndCase

        // Monta o array "items" na mao (nao aninha JsonObject dentro de
        // JsonObject) - funciona igual com 0, 1 ou N linhas.
        cItensJson := "["
        For nI := 1 To Len(aItens)
            If nI > 1
                cItensJson += ","
            EndIf
            cItensJson += aItens[nI]:ToJson()
        Next nI
        cItensJson += "]"

        cResposta := '{"resultado":' + IIf(Len(aItens) > 0, "true", "false") + ',"items":' + cItensJson + '}'

        ::SetStatus(200)
        ::SetResponse(cResposta)

    Recover Using oErro
        If oErro != Nil
            ::SetStatus(500)
            ::SetResponse('{"resultado":false,"erro":"' + CNSA_JSONESC_COMP(oErro:Description) + '"}')
        EndIf
    End Sequence

Return .T.

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                 LUPAS COMPARTILHADAS - pouichamados + pouios              //
//    (tecnico/cliente/projeto/tarefa - criadas pro pouichamados, o          //
//    formulario de OS do pouios reaproveita sem nenhuma mudanca)            //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Erro na query propaga sozinho pro Recover do WSMETHOD (que monta o 500 com
// a descricao real) - nao precisa de Begin/Recover proprio aqui.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_TECLUPA(cFiltro)
    Local aRet    := {}
    Local oLinha  := Nil
    Local cAlias  := GetNextAlias()
    // Oracle e case-sensitive em LIKE por padrao - UPPER() nos dois lados
    // (coluna e valor) resolve "joao" batendo com "JOAO SILVA" cadastrado
    // em maiusculo.
    // FIX (ORA-00936 com filtro vazio, confirmado 2x em log de producao):
    // passar o valor JA com "%" embutido via %Exp:cLike% saia em branco na
    // query gerada (SQL virava "LIKE OR LIKE", sem valor). Nao era reuso de
    // variavel (testado com variaveis duplicadas, mesmo erro) - o "%" DENTRO
    // do valor parece colidir com o proprio delimitador de macro do BeginSql
    // (%Exp:%, %Table:%...). Fix: o valor que vai pro %Exp:% NUNCA contem "%"
    // - o wildcard e montado no proprio SQL via concatenacao ('%' || valor).
    Local cFiltroUp  := Upper(cFiltro)
    Local cFiltroUp2 := cFiltroUp

    BeginSql Alias cAlias
        SELECT AA1_CODTEC, AA1_NOMTEC
        FROM %Table:AA1% AA1
        WHERE AA1_FILIAL = %xFilial:AA1%
          AND %NotDel%
          AND (UPPER(AA1_CODTEC) LIKE '%' || %Exp:cFiltroUp% || '%' OR UPPER(AA1_NOMTEC) LIKE '%' || %Exp:cFiltroUp2% || '%')
        ORDER BY AA1_NOMTEC
    EndSql

    While !(cAlias)->(Eof())
        oLinha := JsonObject():New()
        oLinha['codigo']      := CNSA_COMPSTR((cAlias)->AA1_CODTEC)
        oLinha['complemento'] := ""
        oLinha['descricao']   := CNSA_COMPSTR((cAlias)->AA1_NOMTEC)
        AAdd(aRet, oLinha)
        (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())

Return aRet

////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_CLILUPA(cFiltro)
    Local aRet    := {}
    Local oLinha  := Nil
    Local cAlias  := GetNextAlias()
    // Idem CNSA_TECLUPA - UPPER() case-insensitive, wildcard montado no SQL
    // via concatenacao (ver FIX ORA-00936 no comentario de CNSA_TECLUPA).
    Local cFiltroUp  := Upper(cFiltro)
    Local cFiltroUp2 := cFiltroUp

    BeginSql Alias cAlias
        SELECT A1_COD, A1_LOJA, A1_NOME
        FROM %Table:SA1% SA1
        WHERE A1_FILIAL = %xFilial:SA1%
          AND %NotDel%
          AND (UPPER(A1_COD) LIKE '%' || %Exp:cFiltroUp% || '%' OR UPPER(A1_NOME) LIKE '%' || %Exp:cFiltroUp2% || '%')
        ORDER BY A1_NOME
    EndSql

    While !(cAlias)->(Eof())
        oLinha := JsonObject():New()
        oLinha['codigo']      := CNSA_COMPSTR((cAlias)->A1_COD)
        oLinha['complemento'] := CNSA_COMPSTR((cAlias)->A1_LOJA)
        oLinha['descricao']   := CNSA_COMPSTR((cAlias)->A1_NOME)
        AAdd(aRet, oLinha)
        (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())

Return aRet

////////////////////////////////////////////////////////////////////////////////
// Lupa de Projeto (AF8) - campos confirmados por Henrique (print do dicionario
// SX3): AF8_PROJET (codigo), AF8_DESCRI (descricao). Devolve tambem AF8_REVISA
// (versao/revisao do projeto) no campo "complemento" - o front nao precisa
// exibir isso, mas o CNSA_TARLUPA abaixo usa a mesma logica de revisao mais
// recente, entao deixamos disponivel caso o front queira mostrar no futuro.
//
// FIX (filtro por empresa/status - confirmado por Henrique): so mostra
// projetos do cliente selecionado (AF8_CLIENT + AF8_LOJA) e SO os ativos
// (AF8_FASE = "03" - mesma fase usada em CNSA_ASSUMIR pra liberar assumir
// chamado). cCliente/cLoja SEMPRE preenchidos aqui (WSMETHOD ja bloqueia
// tipo=projeto sem cliente antes de chegar nesta funcao).
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_PROJLUPA(cFiltro, cCliente, cLoja)
    Local aRet    := {}
    Local oLinha  := Nil
    Local cAlias  := GetNextAlias()
    // Idem CNSA_TECLUPA - UPPER() case-insensitive, wildcard montado no SQL
    // via concatenacao (ver FIX ORA-00936 no comentario de CNSA_TECLUPA).
    Local cFiltroUp  := Upper(cFiltro)
    Local cFiltroUp2 := cFiltroUp

    BeginSql Alias cAlias
        SELECT AF8_PROJET, AF8_DESCRI, AF8_REVISA
        FROM %Table:AF8% AF8
        WHERE AF8_FILIAL = %xFilial:AF8%
          AND %NotDel%
          AND AF8_CLIENT = %Exp:cCliente%
          AND AF8_LOJA   = %Exp:cLoja%
          AND AF8_FASE   = '03'
          AND (UPPER(AF8_PROJET) LIKE '%' || %Exp:cFiltroUp% || '%' OR UPPER(AF8_DESCRI) LIKE '%' || %Exp:cFiltroUp2% || '%')
        ORDER BY AF8_DESCRI
    EndSql

    While !(cAlias)->(Eof())
        oLinha := JsonObject():New()
        oLinha['codigo']      := CNSA_COMPSTR((cAlias)->AF8_PROJET)
        oLinha['complemento'] := CNSA_COMPSTR((cAlias)->AF8_REVISA)
        oLinha['descricao']   := CNSA_COMPSTR((cAlias)->AF8_DESCRI)
        AAdd(aRet, oLinha)
        (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())

Return aRet

////////////////////////////////////////////////////////////////////////////////
// Lupa de Tarefa (AF9) - SEMPRE filtrada por projeto (AF9_PROJET), confirmado
// por Henrique: a tarefa e sempre filha de um projeto especifico.
// campos: AF9_TAREFA (codigo), AF9_DESCRI (descricao).
//
// SIMPLIFICACAO ASSUMIDA (Henrique, confere): a AF9 tambem tem AF9_REVISA
// (o projeto pode ter mais de uma revisao/versao, cada uma com seu proprio
// conjunto de tarefas) - aqui NAO filtramos por revisao, trazemos todas as
// tarefas do projeto independente da versao. Se isso trouxer tarefa
// duplicada/de versao antiga, me avisa que eu ajusto pra pegar so a
// ultima revisao (MAX(AF8_REVISA) daquele AF8_PROJET).
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_TARLUPA(cFiltro, cProjeto)
    Local aRet    := {}
    Local oLinha  := Nil
    Local cAlias  := GetNextAlias()
    // Idem CNSA_TECLUPA - UPPER() case-insensitive, wildcard montado no SQL
    // via concatenacao (ver FIX ORA-00936 no comentario de CNSA_TECLUPA).
    Local cFiltroUp  := Upper(cFiltro)
    Local cFiltroUp2 := cFiltroUp

    BeginSql Alias cAlias
        SELECT AF9_TAREFA, AF9_DESCRI
        FROM %Table:AF9% AF9
        WHERE AF9_FILIAL = %xFilial:AF9%
          AND %NotDel%
          AND AF9_PROJET = %Exp:cProjeto%
          AND (UPPER(AF9_TAREFA) LIKE '%' || %Exp:cFiltroUp% || '%' OR UPPER(AF9_DESCRI) LIKE '%' || %Exp:cFiltroUp2% || '%')
        ORDER BY AF9_TAREFA
    EndSql

    While !(cAlias)->(Eof())
        oLinha := JsonObject():New()
        oLinha['codigo']      := CNSA_COMPSTR((cAlias)->AF9_TAREFA)
        oLinha['complemento'] := ""
        oLinha['descricao']   := CNSA_COMPSTR((cAlias)->AF9_DESCRI)
        AAdd(aRet, oLinha)
        (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())

Return aRet

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                       LUPAS EXCLUSIVAS DO POUIOS                          //
//     (modulo/motivo/servico/proposta - formulario de OS, CNSA002)          //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Lupa de Modulo (SX5 generica, tipo "Z2") - usada no campo Z1_MODULO da OS
// (pouios). Confirmado via "Visualizar Campo - Z1_MODULO" no dicionario:
// Cons. Padrao "Z2 - Modulos Para Os's".
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_MODULUPA(cFiltro)
Return CNSA_GENERICALUPA(cFiltro, "Z2")

////////////////////////////////////////////////////////////////////////////////
// Lupa de Motivo (SX5 generica, tipo "Z1") - usada no campo Z1_MOTIV da OS
// (pouios). Confirmado via "Visualizar Campo - Z1_MOTIV": Cons. Padrao
// "Z1 - Motivos de Os's".
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_MOTIVLUPA(cFiltro)
Return CNSA_GENERICALUPA(cFiltro, "Z1")

////////////////////////////////////////////////////////////////////////////////
// Consulta comum as tabelas genericas (SX5) - Modulo e Motivo da OS
// compartilham o mesmo formato (X5_CHAVE/X5_DESCRI), so muda X5_TABELA.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_GENERICALUPA(cFiltro, cTabelaX5)
    Local aRet    := {}
    Local oLinha  := Nil
    Local cAlias  := GetNextAlias()
    Local cFiltroUp  := Upper(cFiltro)
    Local cFiltroUp2 := cFiltroUp

    BeginSql Alias cAlias
        SELECT X5_CHAVE, X5_DESCRI
        FROM %Table:SX5% SX5
        WHERE X5_FILIAL = %xFilial:SX5%
          AND %NotDel%
          AND X5_TABELA = %Exp:cTabelaX5%
          AND (UPPER(X5_CHAVE) LIKE '%' || %Exp:cFiltroUp% || '%' OR UPPER(X5_DESCRI) LIKE '%' || %Exp:cFiltroUp2% || '%')
        ORDER BY X5_DESCRI
    EndSql

    While !(cAlias)->(Eof())
        oLinha := JsonObject():New()
        oLinha['codigo']      := CNSA_COMPSTR((cAlias)->X5_CHAVE)
        oLinha['complemento'] := ""
        oLinha['descricao']   := CNSA_COMPSTR((cAlias)->X5_DESCRI)
        AAdd(aRet, oLinha)
        (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())

Return aRet

////////////////////////////////////////////////////////////////////////////////
// Lupa de Servico (SB1 - Produto) - usada nos campos Z1_TIPO/Z1_NMTIPO
// ("Cod Servico") da OS (pouios). Confirmado via "Visualizar Campo -
// Z1_TIPO": Cons. Padrao "SB1 - Produto".
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_SERVLUPA(cFiltro)
    Local aRet    := {}
    Local oLinha  := Nil
    Local cAlias  := GetNextAlias()
    Local cFiltroUp  := Upper(cFiltro)
    Local cFiltroUp2 := cFiltroUp

    BeginSql Alias cAlias
        SELECT B1_COD, B1_DESC
        FROM %Table:SB1% SB1
        WHERE B1_FILIAL = %xFilial:SB1%
          AND %NotDel%
          AND (UPPER(B1_COD) LIKE '%' || %Exp:cFiltroUp% || '%' OR UPPER(B1_DESC) LIKE '%' || %Exp:cFiltroUp2% || '%')
        ORDER BY B1_DESC
    EndSql

    While !(cAlias)->(Eof())
        oLinha := JsonObject():New()
        oLinha['codigo']      := CNSA_COMPSTR((cAlias)->B1_COD)
        oLinha['complemento'] := ""
        oLinha['descricao']   := CNSA_COMPSTR((cAlias)->B1_DESC)
        AAdd(aRet, oLinha)
        (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())

Return aRet

////////////////////////////////////////////////////////////////////////////////
// Lupa de Proposta (SZ3 - Cabecalho de Propostas) - usada no campo
// Z1_NUMPRO da OS (pouios). Confirmado via "Visualizar Campo - Z1_NUMPRO":
// Cons. Padrao "SZ3 - Proposta", campos Z3_NUM/Z3_CODCLI/Z3_LOJA/Z3_DESC
// (print do dicionario "Cabecalho de Propostas\Campos"). Cascata por
// cliente, mesma logica de CNSA_PROJLUPA (AF8) - so mostra propostas do
// cliente selecionado.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_PROPLUPA(cFiltro, cCliente, cLoja)
    Local aRet    := {}
    Local oLinha  := Nil
    Local cAlias  := GetNextAlias()
    Local cFiltroUp  := Upper(cFiltro)
    Local cFiltroUp2 := cFiltroUp

    BeginSql Alias cAlias
        SELECT Z3_NUM, Z3_DESC
        FROM %Table:SZ3% SZ3
        WHERE Z3_FILIAL = %xFilial:SZ3%
          AND %NotDel%
          AND Z3_CODCLI = %Exp:cCliente%
          AND Z3_LOJA   = %Exp:cLoja%
          AND (UPPER(Z3_NUM) LIKE '%' || %Exp:cFiltroUp% || '%' OR UPPER(Z3_DESC) LIKE '%' || %Exp:cFiltroUp2% || '%')
        ORDER BY Z3_NUM
    EndSql

    While !(cAlias)->(Eof())
        oLinha := JsonObject():New()
        oLinha['codigo']      := CNSA_COMPSTR((cAlias)->Z3_NUM)
        oLinha['complemento'] := ""
        oLinha['descricao']   := CNSA_COMPSTR((cAlias)->Z3_DESC)
        AAdd(aRet, oLinha)
        (cAlias)->(DbSkip())
    EndDo
    (cAlias)->(DbCloseArea())

Return aRet

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//        UTILITARIOS COMPARTILHADOS (usados por todas as lupas acima,       //
//                    pouichamados e pouios)                                 //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// AllTrim direto quebra se o campo vier NIL/tipo diferente de Character (por
// exemplo linha com valor nulo no banco) - com filtro vazio a query varre
// muito mais linhas de uma vez, entao qualquer linha "suja" faz o WSRESTFUL
// inteiro cair (erro nao capturavel pelo Begin/Recover). Blinda cada valor
// antes de expor no JSON.
//
// FIX (acentos virando caractere de substituicao no front): EncodeUtf8 aqui
// cobre os 4 lupas de uma vez so (TECLUPA/CLILUPA/PROJLUPA/TARLUPA), ja que
// todos passam pelo mesmo funil. Em codigo puro (AA1_CODTEC, A1_COD etc,
// sem acento) EncodeUtf8 e inofensivo/no-op.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_COMPSTR(xValor)
    If ValType(xValor) == "C"
        Return EncodeUtf8(AllTrim(xValor))
    EndIf
Return ""

////////////////////////////////////////////////////////////////////////////////
// Copia local - Static nao atravessa arquivos em ADVPL.
////////////////////////////////////////////////////////////////////////////////
Static Function CNSA_JSONESC_COMP(cTexto)
    Local cRet := cTexto
    cRet := StrTran(cRet, '\',  '\\')
    cRet := StrTran(cRet, '"',  '\"')
    cRet := StrTran(cRet, Chr(13)+Chr(10), '\n')
    cRet := StrTran(cRet, Chr(10), '\n')
    cRet := StrTran(cRet, Chr(13), '\n')
    cRet := StrTran(cRet, Chr(9),  '\t')
Return cRet
